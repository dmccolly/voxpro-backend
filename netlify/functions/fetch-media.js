// Complete fetch-media.js file for Netlify function - FIXED VERSION
const https = require('https');
const http = require('http');

const DEBUG = true;

// Helper function to fetch remote content
function fetchContent(url) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;
            
            if (DEBUG) {
                console.log(`[DEBUG] Fetching content from: ${url}`);
            }
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'VoxPro-Media-Proxy/1.0',
                    'Accept': '*/*'
                },
                timeout: 30000 // 30 second timeout
            };
            
            const req = client.request(options, (res) => {
                // For binary data, we need to collect as Buffer
                const chunks = [];
                
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    if (DEBUG) {
                        console.log(`[DEBUG] Fetch completed with status: ${res.statusCode}`);
                        console.log(`[DEBUG] Response headers:`, JSON.stringify(res.headers));
                        console.log(`[DEBUG] Received data size: ${chunks.reduce((acc, chunk) => acc + chunk.length, 0)} bytes`);
                    }
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const buffer = Buffer.concat(chunks);
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: buffer
                        });
                    } else {
                        reject(new Error(`Remote server error: ${res.statusCode} - ${res.statusMessage || 'Unknown error'}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('[ERROR] Fetch error:', error);
                reject(new Error(`Fetch failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                console.error('[ERROR] Fetch timeout');
                req.abort();
                reject(new Error('Fetch request timed out'));
            });
            
            req.end();
        } catch (error) {
            console.error('[ERROR] Fetch setup error:', error);
            reject(error);
        }
    });
}

exports.handler = async (event, context) => {
    // Set up response headers with proper CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Vary': 'Origin'
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
        console.log(`[DEBUG] Received ${event.httpMethod} request to fetch-media`);
        console.log(`[DEBUG] Query parameters:`, event.queryStringParameters || 'none');
    }

    // Get the URL parameter
    const targetUrl = event.queryStringParameters?.url;
    
    if (!targetUrl) {
        console.error('[ERROR] Missing URL parameter');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing URL parameter' })
        };
    }

    try {
        // Validate URL
        try {
            new URL(targetUrl);
        } catch (urlError) {
            console.error('[ERROR] Invalid URL:', targetUrl);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid URL format' })
            };
        }
        
        if (DEBUG) {
            console.log(`[DEBUG] Fetching media from: ${targetUrl}`);
        }

        // Fetch the content
        const { statusCode, headers: responseHeaders, body: responseBody } = await fetchContent(targetUrl);
        
        // Build response headers, combining our headers with some from the original response
        const mediaHeaders = { ...headers };
        
        // Copy content-related headers from the original response
        const headersToCopy = [
            'content-type',
            'content-length',
            'cache-control',
            'expires',
            'last-modified',
            'etag'
        ];
        
        headersToCopy.forEach(header => {
            if (responseHeaders[header]) {
                mediaHeaders[header] = responseHeaders[header];
            }
        });
        
        // Ensure content-type is set
        if (!mediaHeaders['content-type']) {
            mediaHeaders['content-type'] = 'application/octet-stream';
        }
        
        // Add additional headers for better caching and range requests
        mediaHeaders['Accept-Ranges'] = 'bytes';
        
        if (DEBUG) {
            console.log(`[DEBUG] Response content type: ${mediaHeaders['content-type']}`);
            console.log(`[DEBUG] Response size: ${responseBody.length} bytes`);
        }
        
        // For certain content types, we want to send a redirect instead of proxying
        // This helps with CORS issues for media files
        const directTypes = ['image/', 'audio/', 'video/', 'application/pdf'];
        const shouldRedirect = directTypes.some(type => 
            mediaHeaders['content-type'] && mediaHeaders['content-type'].includes(type)
        );
        
        if (shouldRedirect && event.queryStringParameters?.direct !== 'false') {
            if (DEBUG) {
                console.log(`[DEBUG] Redirecting to original URL for content type: ${mediaHeaders['content-type']}`);
            }
            
            // Redirect to the original URL for media types the browser can handle directly
            return {
                statusCode: 302,
                headers: {
                    ...headers,
                    'Location': targetUrl,
                    'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
                },
                body: ''
            };
        }
        
        // For other content types or when direct=false, proxy the content
        if (DEBUG) {
            console.log(`[DEBUG] Proxying content: ${mediaHeaders['content-type']}`);
        }
        
        return {
            statusCode: 200,
            headers: mediaHeaders,
            body: responseBody.toString('base64'),
            isBase64Encoded: true
        };
    } catch (error) {
        console.error('[ERROR] Media proxy error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch media',
                message: error.message,
                url: targetUrl,
                details: DEBUG ? (error.stack || 'No stack trace available') : undefined
            })
        };
    }
};
