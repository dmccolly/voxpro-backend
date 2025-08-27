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
    let endpoint = event.path.replace('/.netlify/functions/xano-proxy', '');
    
    // Default to /voxpro if no endpoint specified or if /auth/ping is requested
    if (!endpoint || endpoint === '/auth/ping') {
      endpoint = '/voxpro';
    }
    
    // Use the correct Xano API URL
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
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response status:', res.statusCode);
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
        req.write(event.body);
      }
      
      req.end();
    });
    
    // For /auth/ping requests, return a success response if we got data from /voxpro
    if (endpoint === '/voxpro' && event.path.includes('/auth/ping')) {
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ status: 'ok', message: 'Connection successful' })
      };
    }
    
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
