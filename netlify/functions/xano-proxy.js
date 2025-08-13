// /.netlify/functions/xano-proxy.js
// CORS proxy for Xano API calls

const XANO_API_BASE = process.env.XANO_API_BASE || 'https://your-workspace.xano.io/api:version';
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
    }

    // Add query parameters
    if (event.queryStringParameters) {
      const params = new URLSearchParams(event.queryStringParameters);
      const urlWithParams = `${xanoUrl}?${params.toString()}`;
      console.log(`Full URL with params: ${urlWithParams}`);
    }

    // Make the request to Xano
    const response = await fetch(
      event.queryStringParameters 
        ? `${xanoUrl}?${new URLSearchParams(event.queryStringParameters).toString()}`
        : xanoUrl,
      fetchOptions
    );

    const data = await response.text();
    let jsonData;
    
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      // If response isn't JSON, return as text
      jsonData = { data: data };
    }

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
