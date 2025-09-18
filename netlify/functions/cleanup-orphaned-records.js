const fetch = require('node-fetch');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
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

        const existingResponse = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission`);
        
        if (!existingResponse.ok) {
            const errorText = await existingResponse.text();
            throw new Error(`Failed to fetch existing records: ${existingResponse.status} - ${errorText}`);
        }

        let existingAssets;
        let responseText;
        try {
            responseText = await existingResponse.text();
            console.log(`Raw response length: ${responseText.length}, first 200 chars:`, responseText.substring(0, 200));
        console.log('Response headers:', existingResponse.headers);
            
            if (!responseText || responseText.trim() === '') {
                throw new Error('Empty response from Xano API');
            }
            
            existingAssets = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Failed to parse JSON response: ${parseError.message}. Response length: ${responseText ? responseText.length : 'null'}, Content: ${responseText ? responseText.substring(0, 200) : 'empty'}`);
        }

        if (!Array.isArray(existingAssets)) {
            throw new Error(`Expected array response, got: ${typeof existingAssets}`);
        }

        console.log(`Found ${existingAssets.length} total records`);
        console.log('Sample record:', existingAssets[0] ? JSON.stringify(existingAssets[0], null, 2) : 'No records');

        const recordsToValidate = existingAssets.filter(asset => {
            const hasCloudinaryUrl = asset.cloudinary_url && asset.cloudinary_url.includes('cloudinary.com');
            const hasAttachment = asset.attachment && asset.attachment.includes('cloudinary.com');
            const hasMediaUrl = asset.media_url && asset.media_url.includes('cloudinary.com');
            return hasCloudinaryUrl || hasAttachment || hasMediaUrl;
        });

        console.log(`Found ${recordsToValidate.length} records with Cloudinary URLs to validate`);

        const orphanedRecords = [];
        const validationErrors = [];
        const batchSize = 5;
        const maxProcessTime = 25000;
        const startTime = Date.now();

        for (let i = 0; i < recordsToValidate.length; i += batchSize) {
            if (Date.now() - startTime > maxProcessTime) {
                validationErrors.push(`Timeout reached. Validated ${i} of ${recordsToValidate.length} records.`);
                break;
            }

            const batch = recordsToValidate.slice(i, i + batchSize);
            const batchPromises = batch.map(async (record) => {
                try {
                    const cloudinaryUrl = record.cloudinary_url || record.attachment || record.media_url;
                    const publicId = extractPublicIdFromUrl(cloudinaryUrl);
                    
                    if (!publicId) {
                        return { record, status: 'invalid_url' };
                    }

                    const cloudinaryResponse = await fetch(
                        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${publicId}`,
                        {
                            headers: {
                                'Authorization': `Basic ${clAuth}`
                            }
                        }
                    );

                    if (cloudinaryResponse.status === 404) {
                        return { record, status: 'not_found' };
                    } else if (cloudinaryResponse.ok) {
                        return { record, status: 'exists' };
                    } else {
                        return { record, status: 'error', error: cloudinaryResponse.status };
                    }
                } catch (error) {
                    return { record, status: 'error', error: error.message };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                if (result.status === 'not_found') {
                    orphanedRecords.push(result.record);
                } else if (result.status === 'error') {
                    validationErrors.push(`Error validating record ${result.record.id}: ${result.error}`);
                }
            });
        }

        console.log(`Found ${orphanedRecords.length} orphaned records to delete`);

        let deleted = 0;
        const deleteErrors = [];

        for (const record of orphanedRecords.slice(0, 10)) {
            try {
                const deleteResponse = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission/${record.id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (deleteResponse.ok) {
                    deleted++;
                    console.log(`Deleted orphaned record ${record.id}: "${record.title}"`);
                } else {
                    deleteErrors.push(`Failed to delete record ${record.id}: ${deleteResponse.status}`);
                }
            } catch (error) {
                deleteErrors.push(`Error deleting record ${record.id}: ${error.message}`);
            }
        }

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                total_records: existingAssets.length,
                records_validated: recordsToValidate.length,
                orphaned_found: orphanedRecords.length,
                deleted: deleted,
                validation_errors: validationErrors.slice(0, 5),
                delete_errors: deleteErrors.slice(0, 5),
                processing_time: `${Math.round((Date.now() - startTime) / 1000)}s`
            })
        };

    } catch (error) {
        console.error('Cleanup error:', error);
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

function extractPublicIdFromUrl(url) {
    if (!url) return null;
    
    try {
        const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
        return match ? match[1] : null;
    } catch (error) {
        console.error('Error extracting public_id from URL:', url, error);
        return null;
    }
}
