// /.netlify/functions/xano-proxy.js - Complete file
const fetch = require('node-fetch');

const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';

exports.handler = async (event, context) => {
  // Set up CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Extract the endpoint from the path
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy/', '');
    let xanoUrl = `${XANO_API_BASE}/${endpoint}`;
    
    console.log(`Proxying ${event.httpMethod} to: ${xanoUrl}`);

    // Prepare fetch options
    const fetchOptions = {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add body for POST/PUT/PATCH requests
    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PUT' || event.httpMethod === 'PATCH')) {
      fetchOptions.body = event.body;
      console.log(`Request body: ${event.body}`);
    }

    // Handle GET query parameters
    let finalUrl = xanoUrl;
    if (event.httpMethod === 'GET' && event.queryStringParameters) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(event.queryStringParameters)) {
        if (value !== undefined && value !== null) {
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
