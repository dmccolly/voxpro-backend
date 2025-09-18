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

        const orphanedFiles = [];
        const titleCounts = {};
        const sizeCounts = {};

        existingAssets.forEach(asset => {
            const title = asset.title || '';
            const size = asset.file_size || 0;
            
            titleCounts[title] = (titleCounts[title] || 0) + 1;
            const sizeKey = `${title}_${size}`;
            sizeCounts[sizeKey] = (sizeCounts[sizeKey] || []).concat(asset);
        });

        existingAssets.forEach(asset => {
            const title = asset.title || '';
            const isOrphaned = 
                (!asset.media_url || !asset.media_url.trim() || !asset.attachment || !asset.attachment.trim()) ||
                (title === 'download image' && titleCounts[title] > 1) ||
                title.startsWith('Gemini_Generated_Image_') ||
                /^\d+$/.test(title) ||
                ['image', 'download', 'untitled'].includes(title.toLowerCase()) ||
                (asset.file_size && asset.file_size < 1000) ||
                (sizeCounts[`${title}_${asset.file_size || 0}`] && 
                 sizeCounts[`${title}_${asset.file_size || 0}`].length > 1 && 
                 sizeCounts[`${title}_${asset.file_size || 0}`][0].id !== asset.id);

            if (isOrphaned) {
                orphanedFiles.push(asset);
            }
        });

        console.log(`Found ${orphanedFiles.length} orphaned files to delete`);

        let deleted = 0;
        const errors = [];
        const batchSize = 10;
        const maxProcessTime = 25000;
        const startTime = Date.now();

        for (let i = 0; i < orphanedFiles.length; i += batchSize) {
            if (Date.now() - startTime > maxProcessTime) {
                errors.push(`Timeout reached. Deleted ${deleted} of ${orphanedFiles.length} records.`);
                break;
            }

            const batch = orphanedFiles.slice(i, i + batchSize);
            const batchPromises = batch.map(async (record) => {
                try {
                    const response = await fetch(`${event.headers.origin || 'https://app.streamofdan.com'}/.netlify/functions/xano-proxy/user_submission/${record.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (response.ok) {
                        console.log(`Deleted orphaned file ${record.id}: "${record.title}" (${record.file_size} bytes)`);
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
                orphaned_files_found: orphanedFiles.length,
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
