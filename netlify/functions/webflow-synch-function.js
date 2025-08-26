// Webflow CMS Sync Function
// Syncs Xano media records to Webflow CMS for display

const https = require('https');

// Environment variables
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID; // Media collection ID

exports.handler = async (event, context) => {
    // Set up CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        console.log('Starting Webflow CMS sync...');

        // Check configuration
        if (!WEBFLOW_API_TOKEN || !WEBFLOW_SITE_ID) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Webflow not configured',
                    message: 'WEBFLOW_API_TOKEN and WEBFLOW_SITE_ID required'
                })
            };
        }

        // Get all media from Xano
        const xanoResponse = await makeRequest(`${XANO_API_BASE}/voxpro`);
        
        if (xanoResponse.status !== 200) {
            throw new Error(`Failed to fetch from Xano: ${xanoResponse.status}`);
        }

        const xanoMedia = JSON.parse(xanoResponse.data);
        console.log(`Found ${xanoMedia.length} media items in Xano`);

        // Get existing Webflow items
        const webflowItemsUrl = `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/cms/collections/${WEBFLOW_COLLECTION_ID}/items`;
        const webflowResponse = await makeWebflowRequest(webflowItemsUrl, 'GET');
        
        const existingItems = webflowResponse.items || [];
        console.log(`Found ${existingItems.length} existing items in Webflow`);

        // Create a map of existing items by Xano ID
        const existingMap = new Map();
        existingItems.forEach(item => {
            const xanoId = item.fieldData?.['xano-id'];
            if (xanoId) {
                existingMap.set(xanoId, item);
            }
        });

        let syncResults = {
            created: 0,
            updated: 0,
            errors: 0,
            details: []
        };

        // Process each Xano media item
        for (const media of xanoMedia) {
            try {
                const xanoId = String(media.id);
                const existingItem = existingMap.get(xanoId);

                // Prepare Webflow data
                const webflowData = {
                    fieldData: {
                        'name': media.title || 'Untitled',
                        'slug': (media.title || 'untitled').toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, ''),
                        'title': media.title || '',
                        'description': media.description || '',
                        'station': media.station || '',
                        'category': media.category || '',
                        'tags': media.tags || '',
                        'submitted-by': media.submitted_by || '',
                        'priority': media.priority || 'normal',
                        'notes': media.notes1 || '',
                        'file-type': media.file_type || '',
                        'file-size': media.file_size || 0,
                        'xano-id': xanoId,
                        'created-date': media.created_at ? new Date(media.created_at).toISOString() : new Date().toISOString()
                    }
                };

                if (existingItem) {
                    // Update existing item
                    const updateUrl = `${webflowItemsUrl}/${existingItem.id}`;
                    await makeWebflowRequest(updateUrl, 'PATCH', webflowData);
                    syncResults.updated++;
                    syncResults.details.push(`Updated: ${media.title} (ID: ${xanoId})`);
                } else {
                    // Create new item
                    await makeWebflowRequest(webflowItemsUrl, 'POST', webflowData);
                    syncResults.created++;
                    syncResults.details.push(`Created: ${media.title} (ID: ${xanoId})`);
                }

            } catch (itemError) {
                console.error(`Error syncing item ${media.id}:`, itemError);
                syncResults.errors++;
                syncResults.details.push(`Error: ${media.title} - ${itemError.message}`);
            }
        }

        console.log('Webflow sync completed:', syncResults);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Webflow sync completed',
                results: syncResults,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Webflow sync error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Sync failed', 
                message: error.message 
            })
        };
    }
};

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = https;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    data: data
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

function makeWebflowRequest(url, method, data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`Webflow API error: ${res.statusCode} - ${responseData}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse Webflow response: ${parseError.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Webflow request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

