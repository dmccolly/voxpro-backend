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
    // Get the endpoint from the path
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy', '');
    
    // YOUR ACTUAL XANO URL
    const XANO_URL = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX' + endpoint;
    
    console.log('Fetching:', XANO_URL);
    
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
    
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
