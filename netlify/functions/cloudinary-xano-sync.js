const fetch = require('node-fetch');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const {
            CLOUDINARY_CLOUD_NAME,
            CLOUDINARY_API_KEY,
            CLOUDINARY_API_SECRET
        } = process.env;

        if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
            throw new Error('Missing Cloudinary environment variables');
        }

        const clAuth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
        
        const cloudinaryResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${clAuth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    expression: 'resource_type:image OR resource_type:video OR resource_type:raw',
                    with_field: ['context', 'tags'],
                    sort_by: [{ 'created_at': 'desc' }],
                    max_results: 100
                })
            }
        );

        if (!cloudinaryResponse.ok) {
            throw new Error(`Cloudinary API error: ${cloudinaryResponse.status}`);
        }

        const cloudinaryData = await cloudinaryResponse.json();
        const assets = cloudinaryData.resources || [];

        const existingResponse = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission`);
        const existingAssets = existingResponse.ok ? await existingResponse.json() : [];
        console.log(`Found ${existingAssets.length} existing records in Xano`);
        
        const recordsToDelete = existingAssets.filter(asset => 
            !asset.media_url || !asset.media_url.trim() || 
            !asset.attachment || !asset.attachment.trim()
        );
        
        const existingAssetsMap = new Map();
        existingAssets.forEach(asset => {
            if (asset.media_url && asset.media_url.trim()) {
                existingAssetsMap.set(asset.media_url, asset);
                
                const normalizedMediaUrl = asset.media_url.replace(/^http:/, 'https:').split('?')[0].toLowerCase();
                existingAssetsMap.set(normalizedMediaUrl, asset);
                
                if (asset.attachment && asset.attachment.trim()) {
                    existingAssetsMap.set(asset.attachment, asset);
                    const normalizedAttachment = asset.attachment.replace(/^http:/, 'https:').split('?')[0].toLowerCase();
                    existingAssetsMap.set(normalizedAttachment, asset);
                }
                
                if (asset.title && asset.title.trim()) {
                    existingAssetsMap.set(asset.title.toLowerCase(), asset);
                }
            }
        });
        
        console.log(`Cleaning up ${recordsToDelete.length} records with empty media_url/attachment fields`);
        
        let deleted = 0;
        for (const record of recordsToDelete.slice(0, 5)) { // Limit to 5 to avoid timeout
            try {
                const deleteResponse = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission/${record.id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (deleteResponse.ok) {
                    deleted++;
                    console.log(`Deleted record ${record.id}: "${record.title}"`);
                }
            } catch (error) {
                console.error(`Failed to delete record ${record.id}:`, error.message);
            }
        }
        
        console.log(`Cleanup complete: deleted ${deleted} records. Now importing fresh Cloudinary assets...`);

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        const batchSize = 5; // Process 5 assets at a time for better efficiency
        const maxProcessTime = 25000; // 25 seconds processing time
        const startTime = Date.now();

        for (let i = 0; i < assets.length; i += batchSize) {
            if (Date.now() - startTime > maxProcessTime) {
                errors.push(`Timeout reached. Processed ${i} of ${assets.length} assets.`);
                break;
            }

            const batch = assets.slice(i, i + batchSize);
            const batchPromises = batch.map(async (asset) => {
                console.log(`\n=== Processing Asset ${asset.public_id} ===`);
                console.log(`Cloudinary URL: ${asset.secure_url}`);
                console.log(`Existing assets map size: ${existingAssetsMap.size}`);
                console.log(`Looking for match in existing assets...`);

                try {
                    const properTitle = asset.display_name || 
                                      asset.filename || 
                                      asset.context?.custom?.title || 
                                      asset.public_id.split('/').pop();
                    
                    const correctedFileType = getFileType(asset.resource_type, asset.format);
                    
                    const xanoData = {
                        title: properTitle,
                        description: asset.context?.custom?.description || '',
                        station: asset.context?.custom?.station || '',
                        file_type: correctedFileType,
                        file_size: asset.bytes || 0,
                        media_url: asset.secure_url,
                        attachment: asset.secure_url,
                        filename: asset.filename || (asset.public_id.split('/').pop() + '.' + asset.format),
                        tags: asset.tags ? asset.tags.join(',') : '',
                        created_at: asset.created_at
                    };

                    const normalizeUrl = (url) => {
                        if (!url) return '';
                        return url.replace(/^http:/, 'https:').split('?')[0].toLowerCase();
                    };
                    
                    const cloudinaryUrl = normalizeUrl(asset.secure_url);
                    const cloudinaryUrlAlt = normalizeUrl(asset.url);
                    
                    console.log(`Cloudinary URLs to match: ${asset.secure_url}, ${cloudinaryUrl}`);
                    
                    let existingAsset = existingAssetsMap.get(asset.secure_url) ||
                                       existingAssetsMap.get(asset.url) ||
                                       existingAssetsMap.get(cloudinaryUrl) ||
                                       existingAssetsMap.get(cloudinaryUrlAlt) ||
                                       existingAssetsMap.get(properTitle.toLowerCase());
                    
                    if (!existingAsset) {
                        const expectedFilename = asset.filename || (asset.public_id.split('/').pop() + '.' + asset.format);
                        const expectedTitle = asset.display_name || asset.filename || asset.public_id.split('/').pop();
                        const publicIdPart = asset.public_id.split('/').pop();
                        
                        existingAsset = existingAssets.find(existing => {
                            if (!existing.media_url || !existing.media_url.trim()) return false;
                            
                            const existingUrl = normalizeUrl(existing.media_url);
                            const existingAttachment = normalizeUrl(existing.attachment || '');
                            
                            if (existingUrl === cloudinaryUrl || existingAttachment === cloudinaryUrl) {
                                console.log(`Exact URL match found: ${existingUrl} === ${cloudinaryUrl}`);
                                return true;
                            }
                            
                            const publicIdInUrl = cloudinaryUrl.includes(publicIdPart.toLowerCase());
                            const publicIdInExisting = existingUrl.includes(publicIdPart.toLowerCase()) || existingAttachment.includes(publicIdPart.toLowerCase());
                            
                            if (publicIdInUrl && publicIdInExisting) {
                                console.log(`Public ID match found: ${publicIdPart} in both URLs`);
                                return true;
                            }
                            
                            if (existing.title === expectedTitle ||
                                existing.title === asset.public_id ||
                                existing.title === publicIdPart ||
                                existing.filename === expectedFilename ||
                                existing.filename === asset.filename) {
                                return true;
                            }
                            
                            return false;
                        });
                    }
                    
                    console.log(`Match found: ${existingAsset ? 'YES' : 'NO'}`);
                    if (!existingAsset) {
                        console.log(`No match for URL: ${asset.secure_url}`);
                        console.log(`Available URLs in map: ${Array.from(existingAssetsMap.keys()).slice(0, 3).join(', ')}...`);
                    }
                    
                    if (existingAsset) {
                        console.log(`UPDATING: ${asset.public_id} - correcting file_type from "${existingAsset.file_type}" to "${correctedFileType}"`);
                        
                        const response = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission/${existingAsset.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(xanoData)
                        });
                        
                        if (response.ok) {
                            return { type: 'updated' };
                        } else {
                            return { type: 'error', message: `Failed to update ${asset.public_id}: ${response.status}` };
                        }
                    } else {
                        console.log(`IMPORTING: ${asset.public_id} - new asset`);
                        
                        const response = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(xanoData)
                        });
                        
                        if (response.ok) {
                            return { type: 'imported' };
                        } else {
                            return { type: 'error', message: `Failed to import ${asset.public_id}: ${response.status}` };
                        }
                    }
                } catch (error) {
                    return { type: 'error', message: `Error processing ${asset.public_id}: ${error.message}` };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                switch (result.type) {
                    case 'imported':
                        imported++;
                        break;
                    case 'updated':
                        updated++;
                        break;
                    case 'skipped':
                        skipped++;
                        break;
                    case 'error':
                        errors.push(result.message);
                        break;
                }
            });
        }

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                total_cloudinary_assets: assets.length,
                cleanup_deleted: deleted,
                imported: imported,
                updated: updated,
                skipped: skipped,
                errors: errors.slice(0, 10),
                processing_time: `${Math.round((Date.now() - startTime) / 1000)}s`
            })
        };

    } catch (error) {
        console.error('Sync error:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            })
        };
    }
};

function getFileType(resourceType, format) {
    if (resourceType === 'image') return 'image';
    
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(format?.toLowerCase())) return 'audio';
    
    if (resourceType === 'video') return 'video';
    
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(format?.toLowerCase())) return 'document';
    
    return 'document';
}
