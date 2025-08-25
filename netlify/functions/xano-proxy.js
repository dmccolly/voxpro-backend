// /.netlify/functions/xano-proxy.js
// Enhanced CORS proxy for Xano API calls with better error handling

const fetch = require('node-fetch');

// Set this to your Xano API base URL - update as needed
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
const XANO_API_KEY = process.env.XANO_API_KEY || ''; // If you're using API key authentication

exports.handler = async (event, context) => {
  // Set up CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Get the endpoint from the path or query parameters
    let endpoint = '';
    
    // First check if it's in the path
    if (event.path.includes('/xano-proxy/')) {
      endpoint = event.path.replace('/.netlify/functions/xano-proxy/', '');
    } 
    // Then check if it's in query parameters
    else if (event.queryStringParameters && event.queryStringParameters.endpoint) {
      endpoint = event.queryStringParameters.endpoint;
      // Remove leading slash if present
      if (endpoint.startsWith('/')) {
        endpoint = endpoint.substring(1);
      }
    }
    
    const xanoUrl = `${XANO_API_BASE}/${endpoint}`;
    
    console.log(`Proxying ${event.httpMethod} to: ${xanoUrl}`);
    console.log(`Full event:`, JSON.stringify(event, null, 2));

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

    // Add body for POST/PUT/PATCH/DELETE requests
    if (event.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.httpMethod)) {
      fetchOptions.body = event.body;
      console.log(`Request body: ${event.body}`);
    }

    // Add query parameters (except 'endpoint')
    let finalUrl = xanoUrl;
    if (event.queryStringParameters) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(event.queryStringParameters)) {
        if (key !== 'endpoint') {
          params.append(key, value);
        }
      }
      
      const paramString = params.toString();
      if (paramString) {
        finalUrl = `${xanoUrl}?${paramString}`;
      }
    }
    
    console.log(`Making request to: ${finalUrl}`);
    console.log(`Method: ${fetchOptions.method}`);
    
    // Make the request to Xano
    const response = await fetch(finalUrl, fetchOptions);
    const responseText = await response.text();
    
    console.log(`Response from Xano: ${responseText}`);
    
    let responseData;
    try {
      // Try to parse as JSON
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If not JSON, return as text
      responseData = { text: responseText };
    }

    if (!response.ok) {
      console.error(`Xano API error: ${response.status} ${response.statusText}`, responseData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Xano API error: ${response.status} ${response.statusText}`,
          details: responseData
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    console.error('Xano proxy error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Xano proxy request failed',
        message: error.message
      })
    };
  }
};
