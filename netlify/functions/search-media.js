// /.netlify/functions/search-media.js
const fetch = require('node-fetch');

// Get API base from environment variables or use default
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
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Get query parameter
  const query = event.queryStringParameters?.q || '';
  
  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing query parameter' })
    };
  }

  try {
    console.log(`Searching for: "${query}"`);
    
    // Call Xano API to search media
    const searchUrl = `${XANO_API_BASE}/media/search?q=${encodeURIComponent(query)}`;
    console.log(`Making request to: ${searchUrl}`);
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    console.log(`Search returned ${data.results?.length || 0} results`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Search error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Search failed',
        message: error.message
      })
    };
  }
};
