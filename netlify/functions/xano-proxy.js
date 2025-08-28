// netlify/functions/xano-proxy.js
const https = require('https');

exports.handler = async (event) => {
  console.log('xano-proxy called:', event.httpMethod, event.path);
  
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
    let endpoint = event.path.replace('/.netlify/functions/xano-proxy', '');
    
    // Handle different endpoint types
    if (endpoint === '/auth/ping') {
      endpoint = '/user_submission';
    } else if (endpoint === '/assignments/get') {
      endpoint = '/voxpro_assignments';
    } else if (endpoint === '/assignments/create') {
      endpoint = '/voxpro_assignments';
    } else if (endpoint === '/assignments/delete') {
      endpoint = '/voxpro_assignments';
    } else if (endpoint === '/media/search') {
      endpoint = '/user_submission';
    } else if (!endpoint) {
      endpoint = '/user_submission';
    }
    
    // FIXED URL
    const url = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX' + endpoint;
    
    console.log(`Forwarding ${event.httpMethod} request to: ${url}`);
    console.log('Body size:', event.body ? event.body.length : 0);
    
    const response = await new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      if (event.httpMethod === 'GET') {
        urlObj.searchParams.append('_t', Date.now());
      }
      
      const postData = event.body || '';
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: 443,
        method: event.httpMethod,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response status:', res.statusCode);
          console.log('Response preview:', data.substring(0, 200));
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
      
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
    
    // Return the actual response from Xano
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
