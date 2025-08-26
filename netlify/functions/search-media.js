// Diagnostic search-media.js 
// Shows exactly what's in the Xano /voxpro endpoint

const https = require('https');
const http = require('http');

const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX';

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

    try {
        console.log('=== DIAGNOSTIC SEARCH STARTING ===');
        console.log('Query:', query);
        console.log('XANO_API_BASE:', XANO_API_BASE);
        
        // Get ALL data from the /voxpro endpoint
        const searchUrl = `${XANO_API_BASE}/voxpro`;
        console.log('Fetching from:', searchUrl);

        const response = await makeRequest(searchUrl);
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (response.status !== 200) {
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Xano API error',
                    status: response.status,
                    response: response.data,
                    url: searchUrl
                })
            };
        }

        let allData = [];
        try {
            allData = JSON.parse(response.data);
            console.log('Parsed data successfully, count:', allData.length);
        } catch (parseError) {
            console.error('Parse error:', parseError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Parse error',
                    raw_response: response.data.substring(0, 500),
                    parse_error: parseError.message
                })
            };
        }

        // Show detailed diagnostic info
        const diagnostics = {
            total_records: allData.length,
            api_endpoint: searchUrl,
            query_used: query,
            sample_records: allData.slice(0, 3).map(item => ({
                id: item.id,
                title: item.title,
                created_at: item.created_at,
                file_type: item.file_type,
                database_url_type: typeof item.database_url,
                database_url_sample: JSON.stringify(item.database_url).substring(0, 100),
                all_fields: Object.keys(item)
            })),
            recent_records: allData
                .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
                .slice(0, 5)
                .map(item => ({
                    id: item.id,
                    title: item.title,
                    created_at: new Date(item.created_at || 0).toISOString(),
                    filename_in_title: item.title?.includes('Colorized') || item.title?.includes('Transmitter')
                }))
        };

        // Filter results if query provided
        let filteredResults = allData;
        if (query && query.trim() !== '') {
            const searchTerm = query.toLowerCase().trim();
            filteredResults = allData.filter(item => {
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
            
            console.log(`Filtered results: ${filteredResults.length} of ${allData.length}`);
        }

        // Transform to VoxPro format
        const results = filteredResults.map(item => ({
            id: item.id || `xano:${item.id}`,
            source: 'xano',
            title: item.title || 'Untitled',
            description: item.description || '',
            station: item.station || '',
            tags: item.tags || '',
            thumbnail: item.thumbnail || '',
            media_url: item.database_url || '',
            file_type: item.file_type || 'unknown',
            submitted_by: item.submitted_by || '',
            created_at: item.created_at || Date.now(),
            category: item.category || '',
            priority: item.priority || 'normal',
            notes: item.notes1 || '',
            file_size: item.file_size || 0
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: results,
                total: results.length,
                query: query,
                diagnostics: diagnostics,
                debug_info: {
                    endpoint_used: searchUrl,
                    raw_count: allData.length,
                    filtered_count: filteredResults.length,
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        console.error('Diagnostic search error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Diagnostic search failed',
                message: error.message,
                stack: error.stack,
                endpoint: `${XANO_API_BASE}/voxpro`
            })
        };
    }
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
                'User-Agent': 'VoxPro-Diagnostic/1.0'
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

