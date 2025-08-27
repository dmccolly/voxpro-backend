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
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: event.httpMethod,
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      
      req.on('error', reject);
      
      if (event.body) req.write(event.body);
      req.end();
    });
    
    return {
      statusCode: response.statusCode,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: response.body
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
}
