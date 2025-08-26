// Fixed search-media.js file for Netlify function
// This version connects to the same Xano table that the File Manager uploads to

const fetch = require('node-fetch');

// Get API base from environment variables or use default
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

    if (!query) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing query parameter' })
        };
    }

    try {
        console.log(`Searching for: "${query}"`);
        
        // FIXED: Call the correct Xano endpoint that File Manager uses
        // This should be the same table where File Manager uploads go
        const searchUrl = `${XANO_API_BASE}/voxpro?title=${encodeURIComponent(query)}`;
        console.log(`Making request to: ${searchUrl}`);

        // Prepare fetch options with proper headers
        const fetchOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Add a user agent to avoid restrictions
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            // Add a generous timeout for slow API responses
            timeout: 15000
        };

        const response = await fetch(searchUrl, fetchOptions);

        // Read response as text first
        const responseText = await response.text();
        console.log(`Search raw response: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);

        let responseData;
        try {
            // Try to parse as JSON
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.log(`Response is not valid JSON: ${e.message}`);
            responseData = { text: responseText };
        }

        // Handle error responses
        if (!response.ok) {
            console.error(`Search API error: ${response.status} ${response.statusText}`, responseData);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Search failed', 
                    details: responseData,
                    status: response.status 
                })
            };
        }

        // Transform the response to match VoxPro's expected format
        let results = [];
        if (Array.isArray(responseData)) {
            results = responseData.map(item => ({
                id: item.id || `xano:${item.id}`,
                source: 'xano',
                title: item.title || item.name || 'Untitled',
                description: item.description || '',
                station: item.station || 'Unknown',
                tags: item.tags || '',
                thumbnail: item.thumbnail || '',
                media_url: item.database_url || item.media_url || '',
                file_type: item.file_type || 'unknown',
                submitted_by: item.submitted_by || '',
                created_at: item.created_at || Date.now()
            }));
        }

        console.log(`Returning ${results.length} search results`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: results,
                total: results.length,
                query: query
            })
        };

    } catch (error) {
        console.error('Search function error:', error);
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

