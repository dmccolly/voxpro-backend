// /.netlify/functions/xano-proxy.js
// Enhanced CORS proxy for Xano API calls with better error handling and response processing

const axios = require('axios');

// Set this to your Xano API base URL
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';

// Set this to your Xano API key if required
const XANO_API_KEY = process.env.XANO_API_KEY || '';

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
    // Get the endpoint from query parameters
    const endpoint = event.queryStringParameters.endpoint || '/key_assignments';
    
    // Log request details for debugging
    console.log(`Xano API request: ${endpoint}`);
    console.log(`HTTP Method: ${event.httpMethod}`);
    
    // Prepare request configuration
    const requestConfig = {
      method: event.httpMethod,
      url: `${XANO_API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    };
    
    // Add API key if available
    if (XANO_API_KEY) {
      requestConfig.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
    }
    
    // Handle request body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        body = event.body;
      }
      requestConfig.data = body;
    }
    
    // Handle query parameters for GET requests
    if (event.httpMethod === 'GET') {
      requestConfig.params = {};
      
      // Copy all query parameters except 'endpoint'
      for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
        if (key !== 'endpoint') {
          requestConfig.params[key] = value;
        }
      }
    }
    
    // Make the API request
    const response = await axios(requestConfig);
    
    // Log success response
    console.log(`Xano API response: ${response.status}`);
    
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(response.data)
    };
    
  } catch (error) {
    // Enhanced error handling
    console.error('Xano API error:', error);
    
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorDetails = {};
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || 'API request failed';
      errorDetails = {
        data: error.response.data,
        status: error.response.status,
        headers: error.response.headers
      };
    } else if (error.request) {
      // The request was made but no response was received
      statusCode = 504; // Gateway Timeout
      errorMessage = 'No response received from API';
      errorDetails = {
        request: 'Request was made but no response was received'
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      statusCode = 400; // Bad Request
      errorMessage = error.message;
      errorDetails = {
        message: 'Error setting up the request'
      };
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: errorMessage,
        details: errorDetails
      })
    };
  }
};
