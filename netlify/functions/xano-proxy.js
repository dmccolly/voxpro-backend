// netlify/functions/xano-proxy.js
const https = require('https');

exports.handler = async (event) => {
  console.log('xano-proxy called:', event.httpMethod, event.path);
  
  // Enhanced CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    
    // Default to user_submission if no endpoint specified
    if (!endpoint || endpoint === '/') {
      endpoint = '/user_submission';
    }
    
    // Handle different API versions and backward compatibility
    if (endpoint === '/media') endpoint = '/user_submission';
    if (endpoint === '/auth/ping') endpoint = '/user_submission';
    if (endpoint === '/assignments') endpoint = '/voxpro_assignments';
    if (endpoint === '/assignments/get') endpoint = '/voxpro_assignments';
    if (endpoint === '/media/search') endpoint = '/user_submission';
    
    console.log('Normalized endpoint:', endpoint);
    
    // Multiple potential base URLs to try
    const baseUrls = [
      'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX',
      'https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV',
      process.env.XANO_API_BASE
    ].filter(Boolean); // Remove any undefined values
    
    // Try each base URL until one works
    let response = null;
    let lastError = null;
    
    for (const baseUrl of baseUrls) {
      try {
        const url = `${baseUrl}${endpoint}`;
        console.log(`Trying ${event.httpMethod} request to: ${url}`);
        
        response = await makeRequest(url, {
          method: event.httpMethod,
          body: event.body,
          headers: event.headers
        });
        
        if (response) {
          console.log(`Success with base URL: ${baseUrl}`);
          break; // Stop if we got a successful response
        }
      } catch (error) {
        console.log(`Error with base URL ${baseUrl}:`, error.message);
        lastError = error;
      }
    }
    
    if (!response) {
      throw lastError || new Error('All base URLs failed');
    }
    
    // Return the response
    return {
      statusCode: response.statusCode,
      headers,
      body: response.body || '{}'
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Proxy request failed',
        message: error.message,
        path: event.path,
        method: event.httpMethod
      })
    };
  }
};

// Helper function for making HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      
      // Add cache buster for GET requests
      if (options.method === 'GET') {
        urlObj.searchParams.append('_t', Date.now());
        urlObj.searchParams.append('_r', Math.random());
      }
      
      const postData = options.body || '';
      
      const requestOptions = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: urlObj.port || 443,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          ...options.headers
        },
        timeout: 30000 // 30 second timeout
      };
      
      console.log('Request options:', JSON.stringify(requestOptions));
      
      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response status:', res.statusCode);
          console.log('Response headers:', res.headers);
          
          // Only log a small preview of the response body to avoid huge logs
          const bodyPreview = data.length > 200 ? `${data.substring(0, 200)}...` : data;
          console.log('Response body preview:', bodyPreview);
          
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
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Simple test function to check if the proxy is working
function testConnection() {
  return makeRequest('https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX/user_submission', {
    method: 'GET'
  });
}
