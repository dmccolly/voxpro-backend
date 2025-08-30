const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy', '');
    const XANO_URL = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX' + endpoint;
    
    console.log('Request:', event.httpMethod, XANO_URL);
    
    if (event.httpMethod === 'GET') {
      // GET request
      const response = await new Promise((resolve, reject) => {
        https.get(XANO_URL, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
      });
      
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
      };
      
    } else {
      // POST, PATCH, DELETE requests
      const options = {
        hostname: 'xajo-bs7d-cagt.n7e.xano.io',
        path: '/api:pYeQctVX' + endpoint,
        method: event.httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': event.body ? Buffer.byteLength(event.body) : 0
        }
      };
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        if (event.body) req.write(event.body);
        req.end();
      });
      
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
      };
    }
    
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
