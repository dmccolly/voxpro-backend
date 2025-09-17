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
                    max_results: 500
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
        console.log('Sample existing assets:', existingAssets.slice(0, 3).map(a => ({ title: a.title, media_url: a.media_url })));
        
        const existingAssetsMap = new Map();
        existingAssets.forEach(asset => {
            if (asset.media_url && asset.media_url.trim()) {
                existingAssetsMap.set(asset.media_url, asset);
            }
            if (asset.id) {
                existingAssetsMap.set(`id_${asset.id}`, asset);
            }
            if (asset.title && asset.title.trim()) {
                existingAssetsMap.set(asset.title, asset);
            }
        });

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        const batchSize = 10;
        const maxProcessTime = 25000; // 25 seconds to leave buffer for Netlify timeout
        const startTime = Date.now();

        for (let i = 0; i < assets.length; i += batchSize) {
            if (Date.now() - startTime > maxProcessTime) {
                errors.push(`Timeout reached. Processed ${i} of ${assets.length} assets.`);
                break;
            }

            const batch = assets.slice(i, i + batchSize);
            const batchPromises = batch.map(async (asset) => {
                let existingAsset = existingAssetsMap.get(asset.secure_url) || existingAssetsMap.get(asset.public_id);
                console.log(`\n=== Processing Asset ${asset.public_id} ===`);
                console.log(`Cloudinary URL: ${asset.secure_url}`);
                console.log(`Existing asset found: ${!!existingAsset}`);
                if (existingAsset) {
                    console.log(`Existing asset ID: ${existingAsset.id}, title: "${existingAsset.title}", media_url: "${existingAsset.media_url}"`);
                }
                
                if (existingAsset && existingAsset.media_url === asset.secure_url) {
                    console.log(`SKIPPING: ${asset.public_id} - already has correct media_url`);
                    return { type: 'skipped' };
                }
                
                if (existingAsset) {
                    console.log(`UPDATING: ${asset.public_id} - existing asset needs media_url populated`);
                } else {
                    console.log(`IMPORTING: ${asset.public_id} - new asset`);
                }

                try {
                    const properTitle = asset.display_name || 
                                      asset.filename || 
                                      asset.context?.custom?.title || 
                                      asset.public_id.split('/').pop(); // Get filename part only
                    
                    const xanoData = {
                        title: properTitle,
                        description: asset.context?.custom?.description || '',
                        station: asset.context?.custom?.station || '',
                        file_type: getFileType(asset.resource_type, asset.format),
                        file_size: asset.bytes || 0,
                        media_url: asset.secure_url,
                        attachment: asset.secure_url, // Also populate attachment field
                        filename: asset.filename || (asset.public_id.split('/').pop() + '.' + asset.format),
                        tags: asset.tags ? asset.tags.join(',') : '',
                        created_at: asset.created_at
                    };

                    let response;
                    let operationType;
                    
                    if (existingAsset) {
                        response = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission/${existingAsset.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(xanoData)
                        });
                        operationType = 'updated';
                    } else {
                        response = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(xanoData)
                        });
                        operationType = 'imported';
                    }

                    if (response.ok) {
                        return { type: operationType };
                    } else {
                        return { type: 'error', message: `Failed to ${operationType} ${asset.public_id}: ${response.status}` };
                    }
                } catch (error) {
                    return { type: 'error', message: `Error importing ${asset.public_id}: ${error.message}` };
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
                imported: imported,
                updated: updated,
                skipped: skipped,
                errors: errors.slice(0, 10)
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
    if (resourceType === 'video') return 'video';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(format?.toLowerCase())) return 'audio';
    return 'document';
}
