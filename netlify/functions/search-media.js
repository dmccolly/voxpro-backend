// Multi-endpoint search-media.js - tries multiple Xano endpoints to find File Manager data
const fetch = require('node-fetch');

// Get API base from environment variables or use default
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX';

// List of possible endpoints where File Manager might store data
const POSSIBLE_ENDPOINTS = [
    '/voxpro',           // Most likely
    '/media',            // Common name
    '/assets',           // Alternative name
    '/uploads',          // File uploads
    '/files',            // File storage
    '/content',          // Content management
    '/broadcast_media',  // Broadcast specific
    '/idaho_media'       // Idaho Broadcasting specific
];

async function tryEndpoint(endpoint, query) {
    try {
        const searchUrl = `${XANO_API_BASE}${endpoint}`;
        console.log(`Trying endpoint: ${searchUrl}`);
        
        const response = await fetch(searchUrl, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Endpoint ${endpoint} returned ${Array.isArray(data) ? data.length : 'non-array'} results`);
            return { success: true, data, endpoint };
        } else {
            console.log(`❌ Endpoint ${endpoint} failed: ${response.status}`);
            return { success: false, status: response.status, endpoint };
        }
    } catch (error) {
        console.log(`❌ Endpoint ${endpoint} error: ${error.message}`);
        return { success: false, error: error.message, endpoint };
    }
}

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
        console.log(`Multi-endpoint search for: "${query}"`);
        
        // Try all possible endpoints
        const results = [];
        const endpointResults = [];

        for (const endpoint of POSSIBLE_ENDPOINTS) {
            const result = await tryEndpoint(endpoint, query);
            endpointResults.push(result);
            
            if (result.success && Array.isArray(result.data)) {
                // Filter results based on query if provided
                let filteredData = result.data;
                if (query) {
                    filteredData = result.data.filter(item => {
                        const searchText = `${item.title || ''} ${item.description || ''} ${item.station || ''} ${item.tags || ''}`.toLowerCase();
                        return searchText.includes(query.toLowerCase());
                    });
                }

                // Transform and add to results
                const transformedItems = filteredData.map(item => ({
                    id: item.id || `${endpoint}:${item.id}`,
                    source: `xano${endpoint}`,
                    title: item.title || item.name || 'Untitled',
                    description: item.description || '',
                    station: item.station || 'Unknown',
                    tags: item.tags || '',
                    thumbnail: item.thumbnail || '',
                    media_url: item.database_url || item.media_url || '',
                    file_type: item.file_type || 'unknown',
                    submitted_by: item.submitted_by || '',
                    created_at: item.created_at || Date.now(),
                    _endpoint: endpoint
                }));

                results.push(...transformedItems);
            }
        }

        console.log(`Found ${results.length} total results across all endpoints`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: results,
                total: results.length,
                query: query,
                debug: {
                    endpoints_tried: endpointResults,
                    successful_endpoints: endpointResults.filter(r => r.success).map(r => r.endpoint)
                }
            })
        };

    } catch (error) {
        console.error('Multi-endpoint search error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error', 
                message: error.message 
            })
        };
    }
};

