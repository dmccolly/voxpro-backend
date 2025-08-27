// netlify/functions/xano-proxy.js
const https = require('https');

exports.handler = async (event) => {
  console.log('xano-proxy called:', event.httpMethod, event.path);
  
  // Handle OPTIONS requests for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Extract the endpoint from the path
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy', '') || '/auth/ping';
    
    // Use the CORRECT Xano API URL (typo fixed: letl not lell)
    const url = 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX' + endpoint;
    
    console.log(`Forwarding ${event.httpMethod} request to: ${url}`);
    
    const response = await new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      // Add timestamp to prevent caching
      urlObj.searchParams.append('_t', Date.now());
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: 443,
        method: event.httpMethod,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // CRITICAL: Disable SSL verification
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response status:', res.statusCode);
          console.log('Response data preview:', data.substring(0, 200));
          resolve({ 
            statusCode: res.statusCode, 
            headers: res.headers, 
            body: data 
          });
        });
      });
      
      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });
      
      if (event.body) {
        console.log('Sending body:', event.body.substring(0, 200));
        req.write(event.body);
      }
      
      req.end();
    });
    
    return {
      statusCode: response.statusCode,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: response.body
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      },
      body: JSON.stringify({ 
        error: 'Proxy request failed', 
        message: error.message
      })
    };
  }
};
