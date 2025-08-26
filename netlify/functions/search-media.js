// Unified search-media.js for VoxPro Manager
// Searches the unified Xano database where File Manager uploads go

const https = require('https');
const http = require('http');

// Get API base from environment variables
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX';

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

    // Get query parameter
    const query = event.queryStringParameters?.q || '';

    try {
        console.log(`Unified search for: "${query}"`);
        
        // Search the unified Xano voxpro table
        const searchUrl = `${XANO_API_BASE}/voxpro`;
        console.log(`Searching unified database: ${searchUrl}`);

        const response = await makeRequest(searchUrl);

        if (response.status !== 200) {
            console.error(`Xano API error: ${response.status}`);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Search failed', 
                    status: response.status,
                    message: response.data
                })
            };
        }

        // Parse response
        let allData = [];
        try {
            allData = JSON.parse(response.data);
        } catch (parseError) {
            console.error('Failed to parse Xano response:', parseError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Invalid response from database' })
            };
        }

        // Filter results based on query
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
                    item.submitted_by || ''
                ].join(' ').toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
        }

        // Transform results to VoxPro format
        const results = filteredResults.map(item => ({
            id: item.id || `xano:${item.id}`,
            source: 'xano',
            title: item.title || 'Untitled',
            description: item.description || '',
            station: item.station || 'Unknown',
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

        console.log(`Returning ${results.length} unified search results`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: results,
                total: results.length,
                query: query,
                source: 'unified-xano',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Unified search error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Search failed', 
                message: error.message,
                source: 'unified-search'
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
                'User-Agent': 'VoxPro-Unified-Search/1.0'
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

