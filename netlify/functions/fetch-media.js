// Improved Fetch Media Function
// Based on the working Audio Memory Game implementation

const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  console.log('=== FETCH MEDIA FUNCTION STARTING ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  const url = event.queryStringParameters?.url;
  
  if (!url) {
    console.error('No URL parameter provided');
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'URL parameter is required',
        received: event.queryStringParameters 
      })
    };
  }

  console.log(`Attempting to fetch: ${url}`);

  try {
    // Validate URL format
    const urlObj = new URL(url);
    console.log(`Parsed URL - Protocol: ${urlObj.protocol}, Host: ${urlObj.hostname}`);
    
    const response = await makeHttpRequest('GET', url);
    console.log('✅ Successfully fetched media');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      isBase64Encoded: true,
      body: response.data
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch media:', error.message);
    console.error('Full error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: `Failed to fetch media: ${error.message}`,
        url: url,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Reliable HTTP request function based on Audio Memory Game implementation
function makeHttpRequest(method, urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'User-Agent': 'VoxPro-Media-Fetcher/1.0',
        'Accept': '*/*'
      },
      timeout: 30000 // 30 second timeout for media files
    };

    console.log(`Making ${method} request to: ${urlString}`);

    const req = client.request(options, (res) => {
      console.log(`Response status: ${res.statusCode}`);
      console.log(`Response headers:`, res.headers);
      
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirects
        console.log(`Following redirect to: ${res.headers.location}`);
        return makeHttpRequest(method, res.headers.location)
          .then(resolve)
          .catch(reject);
      }
      
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || 'application/octet-stream';
        
        console.log(`Received ${buffer.length} bytes of ${contentType}`);
        
        resolve({
          data: buffer.toString('base64'),
          contentType: contentType,
          size: buffer.length
        });
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Request timeout after 30 seconds'));
    });

    req.end();
  });
}

