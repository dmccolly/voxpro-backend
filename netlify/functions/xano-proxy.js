// /.netlify/functions/xano-proxy.js
// CORS proxy for Xano API calls

import { makeJsonRequest } from './_http-utils.js';

const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
const XANO_API_KEY = process.env.XANO_API_KEY;

export const handler = async (event, context) => {
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

    const requestOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (XANO_API_KEY) {
      requestOptions.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
    }

    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PATCH')) {
      requestOptions.body = event.body;
    }

    // Make the request to Xano
    const finalUrl = event.queryStringParameters 
      ? `${xanoUrl}?${new URLSearchParams(event.queryStringParameters).toString()}`
      : xanoUrl;
    
    const response = await makeJsonRequest(event.httpMethod, finalUrl, requestOptions);
    
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(response.data)
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
