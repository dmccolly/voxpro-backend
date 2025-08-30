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
    
    console.log('Fetching:', XANO_URL, 'Method:', event.httpMethod);
    
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
      
    } else if (event.httpMethod === 'POST') {
      // POST request
      const postData = event.body;
      
      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'xajo-bs7d-cagt.n7e.xano.io',
          path: '/api:pYeQctVX' + endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.write(postData);
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
