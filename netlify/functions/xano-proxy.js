// /.netlify/functions/xano-proxy.js
// CORS proxy for Xano API calls

const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
const XANO_API_KEY = process.env.XANO_API_KEY; // if you're using API key authentication

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Extract the endpoint from the path
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy/', '');
    const xanoUrl = `${XANO_API_BASE}/${endpoint}`;
    
    console.log(`Proxying ${event.httpMethod} to: ${xanoUrl}`);

    // Prepare fetch options
    const fetchOptions = {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add API key if available
    if (XANO_API_KEY) {
      fetchOptions.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
    }

    // Add body for POST/PATCH requests
    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PATCH')) {
      fetchOptions.body = event.body;
      console.log(`Request body: ${event.body}`);
    }

    // Make the request to Xano
    const finalUrl = event.queryStringParameters 
      ? `${xanoUrl}?${new URLSearchParams(event.queryStringParameters).toString()}`
      : xanoUrl;
    
    console.log(`Making request to: ${finalUrl}`);
    console.log(`Method: ${fetchOptions.method}`);
    console.log(`Body: ${fetchOptions.body || 'none'}`);
    
    const response = await fetch(finalUrl, fetchOptions);

    const data = await response.text();
    let jsonData;
    
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      // If response isn't JSON, return as text
      jsonData = { data: data };
    }

    console.log(`Response status: ${response.status}`);
    console.log(`Response data:`, jsonData);

    if (!response.ok) {
      console.error(`Xano API error: ${response.status} ${response.statusText}`, jsonData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Xano API error: ${response.status} ${response.statusText}`,
          details: jsonData
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(jsonData)
    };

  } catch (error) {
    console.error('Xano proxy error:', error);
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
