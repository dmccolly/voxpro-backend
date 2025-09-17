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
        const existingResponse = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission`);
        
        if (!existingResponse.ok) {
            throw new Error(`Failed to fetch existing records: ${existingResponse.status}`);
        }

        const existingAssets = await existingResponse.json();
        console.log(`Found ${existingAssets.length} total records`);

        const recordsToDelete = existingAssets.filter(asset => 
            !asset.media_url || !asset.media_url.trim() || 
            !asset.attachment || !asset.attachment.trim()
        );

        console.log(`Found ${recordsToDelete.length} records with empty media_url/attachment fields`);

        let deleted = 0;
        const errors = [];
        const batchSize = 10;
        const maxProcessTime = 25000;
        const startTime = Date.now();

        for (let i = 0; i < recordsToDelete.length; i += batchSize) {
            if (Date.now() - startTime > maxProcessTime) {
                errors.push(`Timeout reached. Deleted ${deleted} of ${recordsToDelete.length} records.`);
                break;
            }

            const batch = recordsToDelete.slice(i, i + batchSize);
            const batchPromises = batch.map(async (record) => {
                try {
                    const response = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission/${record.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (response.ok) {
                        console.log(`Deleted record ${record.id}: "${record.title}"`);
                        return { type: 'deleted' };
                    } else {
                        return { type: 'error', message: `Failed to delete record ${record.id}: ${response.status}` };
                    }
                } catch (error) {
                    return { type: 'error', message: `Error deleting record ${record.id}: ${error.message}` };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                if (result.type === 'deleted') {
                    deleted++;
                } else if (result.type === 'error') {
                    errors.push(result.message);
                }
            });
        }

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                total_records: existingAssets.length,
                records_with_empty_urls: recordsToDelete.length,
                deleted: deleted,
                errors: errors.slice(0, 10)
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
