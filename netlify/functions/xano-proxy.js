// netlify/functions/xano-proxy.js
const https = require('https');

exports.handler = async (event) => {
  console.log('xano-proxy called:', event.httpMethod, event.path);
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract the endpoint path
    let endpoint = event.path.replace('/.netlify/functions/xano-proxy', '');
    
    // Remove any double slashes
    endpoint = endpoint.replace(/\/+/g, '/');
    
    console.log('Requesting endpoint:', endpoint);
    
    // Use your actual Xano API base URL
    const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
    
    const url = `${XANO_API_BASE}${endpoint}${event.rawQuery ? '?' + event.rawQuery : ''}`;
    console.log('Full URL:', url);
    
    const response = await makeRequest(url, {
      method: event.httpMethod,
      body: event.body,
      headers: event.headers
    });
    
    return {
      statusCode: response.statusCode,
      headers,
      body: response.body || '[]'
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Proxy request failed',
        message: error.message
      })
    };
  }
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      
      const requestOptions = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: urlObj.port || 443,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        },
        timeout: 30000
      };
      
      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}
