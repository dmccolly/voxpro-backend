// Complete xano-proxy.js file for Netlify function - FIXED VERSION
const https = require('https');
const http = require('http');

// Get API base from environment variables or use default
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
const DEBUG = true;

// Helper function to make HTTP requests to Xano
function makeXanoRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(XANO_API_BASE + endpoint);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            
            if (DEBUG) {
                console.log(`[DEBUG] Making ${method} request to: ${url.toString()}`);
                if (data) {
                    console.log(`[DEBUG] Request data:`, JSON.stringify(data).substring(0, 500));
                }
            }
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'VoxPro-Netlify-Function/1.0',
                    'Accept': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            };

            const req = client.request(options, (res) => {
                let body = '';
                
                res.on('data', (chunk) => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    if (DEBUG) {
                        console.log(`[DEBUG] Xano ${method} ${endpoint} - Status: ${res.statusCode}`);
                        console.log(`[DEBUG] Response headers:`, JSON.stringify(res.headers));
                        console.log(`[DEBUG] Response body preview:`, body.substring(0, 200));
                    }
                    
                    try {
                        // Try to parse as JSON
                        const jsonData = JSON.parse(body);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(jsonData);
                        } else {
                            reject(new Error(`Xano API error: ${res.statusCode} - ${JSON.stringify(jsonData)}`));
                        }
                    } catch (parseError) {
                        if (DEBUG) {
                            console.error(`[ERROR] Failed to parse JSON:`, parseError);
                            console.log(`[DEBUG] Raw response:`, body);
                        }
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ message: body });
                        } else {
                            reject(new Error(`Xano API error: ${res.statusCode} - ${body}`));
                        }
                    }
                });
            });

            req.on('error', (error) => {
                console.error('[ERROR] Request error:', error);
                reject(new Error(`Request failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                console.error('[ERROR] Request timeout');
                req.abort();
                reject(new Error('Request timed out'));
            });

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                const stringData = JSON.stringify(data);
                req.write(stringData);
                if (DEBUG) {
                    console.log(`[DEBUG] Sent request body: ${stringData.substring(0, 500)}`);
                }
            }

            req.end();
        } catch (error) {
            console.error('[ERROR] Request setup error:', error);
            reject(error);
        }
    });
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
            body: JSON.stringify({ message: 'CORS preflight successful' })
        };
    }

    if (DEBUG) {
        console.log(`[DEBUG] Received ${event.httpMethod} request to ${event.path}`);
        console.log(`[DEBUG] Query parameters:`, event.queryStringParameters || 'none');
        if (event.body) {
            console.log(`[DEBUG] Request body preview:`, event.body.substring(0, 500));
        }
    }

    try {
        // Extract the endpoint from the path
        // Remove the function path prefix from the incoming request path
        const endpoint = event.path.replace('/.netlify/functions/xano-proxy/', '');
        
        if (DEBUG) {
            console.log(`[DEBUG] Extracted endpoint: ${endpoint}`);
        }

        // Prepare data for POST/PUT/PATCH requests
        let data = null;
        if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PUT' || event.httpMethod === 'PATCH')) {
            try {
                data = JSON.parse(event.body);
            } catch (parseError) {
                console.error('[ERROR] Failed to parse request body:', parseError);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Invalid JSON in request body',
                        details: parseError.message
                    })
                };
            }
        }

        // Handle query parameters for GET requests
        let queryParams = {};
        if (event.httpMethod === 'GET' && event.queryStringParameters) {
            queryParams = event.queryStringParameters;
        }

        // Build the endpoint with query parameters if needed
        let fullEndpoint = endpoint;
        if (event.httpMethod === 'GET' && Object.keys(queryParams).length > 0) {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(queryParams)) {
                if (value !== undefined && value !== null) {
                    params.append(key, value);
                }
            }
            const paramString = params.toString();
            if (paramString) {
                fullEndpoint += (fullEndpoint.includes('?') ? '&' : '?') + paramString;
            }
        }
        
        if (DEBUG) {
            console.log(`[DEBUG] Full endpoint with params: ${fullEndpoint}`);
        }

        // Make the request to Xano
        const responseData = await makeXanoRequest(event.httpMethod, fullEndpoint, data);
        
        // Special handling for empty responses
        if (responseData === null || responseData === undefined) {
            return {
                statusCode: 204, // No Content
                headers
            };
        }

        // Return successful response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };
    } catch (error) {
        console.error('[ERROR] Handler error:', error);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (error.message && error.message.includes('Xano API error:')) {
            // Extract status code from error message if present
            const match = error.message.match(/Xano API error: (\d+)/);
            if (match && match[1]) {
                statusCode = parseInt(match[1]);
            }
        }
        
        return {
            statusCode: statusCode,
            headers,
            body: JSON.stringify({
                error: 'API request failed',
                message: error.message,
                details: DEBUG ? (error.stack || 'No stack trace available') : undefined
            })
        };
    }
};
