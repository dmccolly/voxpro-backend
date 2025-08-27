// netlify/functions/xano-proxy.js
const https = require('https');

exports.handler = async (event) => {
  // Handle OPTIONS requests for CORS
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

  // Forward the request to Xano
  try {
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy', '') || '/auth/ping';
    const url = 'https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV' + endpoint;
    
    console.log(`Forwarding ${event.httpMethod} request to: ${url}`);
    
    const response = await new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: 443,
        method: event.httpMethod,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        // Critical fix: disable SSL certificate verification
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ 
          statusCode: res.statusCode, 
          headers: res.headers, 
          body: data 
        }));
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
    
    return {
      statusCode: response.statusCode,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
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
        message: error.message,
        stack: error.stack 
      })
    };
  }
};
