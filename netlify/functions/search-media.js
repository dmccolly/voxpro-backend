// Multi-workspace search-media.js
// Searches multiple Xano workspaces to find File Manager uploads

const https = require('https');
const http = require('http');

// Multiple Xano API bases to check
const XANO_WORKSPACES = [
    process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX',
    'https://x8ki-letl-twmt.n7.xano.io/api:YourOtherAPIKey', // Add other potential workspaces
    'https://xano.com/api:AnotherPossibleKey',
    // Add more workspace URLs as needed
];

// Multiple endpoint patterns to try
const ENDPOINT_PATTERNS = [
    '/voxpro',
    '/media',
    '/uploads', 
    '/assets',
    '/files',
    '/content'
];

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const query = event.queryStringParameters?.q || '';
    console.log('=== MULTI-WORKSPACE SEARCH ===');
    console.log('Query:', query);

    let allResults = [];
    let workspaceResults = {};

    // Try each workspace + endpoint combination
    for (const workspace of XANO_WORKSPACES) {
        for (const endpoint of ENDPOINT_PATTERNS) {
            try {
                const searchUrl = `${workspace}${endpoint}`;
                console.log(`Trying: ${searchUrl}`);
                
                const response = await makeRequest(searchUrl);
                
                if (response.status === 200) {
                    console.log(`✅ SUCCESS: ${searchUrl}`);
                    
                    let data = [];
                    try {
                        data = JSON.parse(response.data);
                        if (Array.isArray(data) && data.length > 0) {
                            console.log(`Found ${data.length} records at ${searchUrl}`);
                            
                            // Store results by workspace for debugging
                            const workspaceKey = `${workspace}${endpoint}`;
                            workspaceResults[workspaceKey] = {
                                count: data.length,
                                sample: data.slice(0, 2).map(item => ({
                                    id: item.id,
                                    title: item.title,
                                    created_at: item.created_at
                                }))
                            };
                            
                            // Filter results if query provided
                            let filteredData = data;
                            if (query && query.trim() !== '') {
                                const searchTerm = query.toLowerCase().trim();
                                filteredData = data.filter(item => {
                                    const searchableText = [
                                        item.title || '',
                                        item.description || '',
                                        item.station || '',
                                        item.tags || '',
                                        item.category || '',
                                        item.submitted_by || '',
                                        item.notes1 || '',
                                        item.notes2 || ''
                                    ].join(' ').toLowerCase();
                                    
                                    return searchableText.includes(searchTerm);
                                });
                            }
                            
                            // Transform to VoxPro format and add to results
                            const transformedResults = filteredData.map(item => ({
                                id: item.id || `${workspace.split(':')[1]?.substring(0,8)}:${item.id}`,
                                source: `xano-${workspace.split(':')[1]?.substring(0,8)}`,
                                title: item.title || 'Untitled',
                                description: item.description || '',
                                station: item.station || '',
                                tags: item.tags || '',
                                thumbnail: item.thumbnail || '',
                                media_url: item.database_url || item.media_url || '',
                                file_type: item.file_type || 'unknown',
                                submitted_by: item.submitted_by || '',
                                created_at: item.created_at || Date.now(),
                                category: item.category || '',
                                priority: item.priority || 'normal',
                                notes: item.notes1 || item.notes || '',
                                file_size: item.file_size || 0,
                                workspace_source: searchUrl
                            }));
                            
                            allResults = allResults.concat(transformedResults);
                        }
                    } catch (parseError) {
                        console.log(`Parse error for ${searchUrl}:`, parseError.message);
                    }
                } else {
                    console.log(`❌ Failed: ${searchUrl} (${response.status})`);
                }
            } catch (error) {
                console.log(`❌ Error: ${workspace}${endpoint} - ${error.message}`);
            }
        }
    }

    // Sort results by creation date (newest first)
    allResults.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    console.log(`=== SEARCH COMPLETE ===`);
    console.log(`Total results found: ${allResults.length}`);
    console.log(`Workspaces checked: ${XANO_WORKSPACES.length}`);
    console.log(`Endpoints per workspace: ${ENDPOINT_PATTERNS.length}`);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            results: allResults,
            total: allResults.length,
            query: query,
            debug_info: {
                workspaces_checked: XANO_WORKSPACES.length,
                endpoints_per_workspace: ENDPOINT_PATTERNS.length,
                workspace_results: workspaceResults,
                successful_endpoints: Object.keys(workspaceResults),
                timestamp: new Date().toISOString()
            }
        })
    };
};

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'VoxPro-MultiSearch/1.0'
            },
            timeout: 10000
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

