// Complete xano-proxy.js file for Netlify function
const fetch = require('node-fetch');

// Get API base from environment variables or use default
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';

exports.handler = async (event, context) => {
  // Set up CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

  // For debugging - log all incoming requests
  console.log(`Xano proxy request: ${event.httpMethod} ${event.path}`);
  console.log(`Query parameters:`, event.queryStringParameters);
  if (event.body) {
    console.log(`Request body: ${event.body}`);
  }

  try {
    // Extract the endpoint from the path
    // Remove the function path prefix from the incoming request path
    const endpoint = event.path.replace('/.netlify/functions/xano-proxy/', '');
    let xanoUrl = `${XANO_API_BASE}/${endpoint}`;
    
    console.log(`Proxying ${event.httpMethod} to: ${xanoUrl}`);

    // Prepare fetch options with proper headers
    const fetchOptions = {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add a user agent to avoid restrictions
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // Add a generous timeout for slow API responses
      timeout: 15000
    };

    // Add body for POST/PUT/PATCH requests
    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PUT' || event.httpMethod === 'PATCH')) {
      fetchOptions.body = event.body;
      console.log(`Request body: ${event.body}`);
    }

    // Handle query parameters
    if (event.queryStringParameters) {
      const params = new URLSearchParams();
      
      for (const [key, value] of Object.entries(event.queryStringParameters)) {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      }
      
      const paramString = params.toString();
      if (paramString) {
        xanoUrl = `${xanoUrl}?${paramString}`;
      }
    }
    
    console.log(`Final Xano URL: ${xanoUrl}`);
    
    // Make the request to Xano
    const response = await fetch(xanoUrl, fetchOptions);
    
    // Read the response body as text first
    const responseText = await response.text();
    console.log(`Xano raw response: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
    
    let responseData;
    try {
      // Try to parse as JSON
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If not JSON, return as text
      console.log(`Response is not valid JSON: ${e.message}`);
      responseData = { text: responseText };
    }

    // Handle error responses
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

    // Log successful response for debugging
    console.log(`Xano API success (${response.status})`);
    
    // Special handling for empty assignment responses
    if (endpoint === 'assignments/get' && (!responseData || !responseData.assignments || responseData.assignments.length === 0)) {
      console.log('Empty assignments array in response, adding sample data for testing');
      responseData = responseData || {};
      responseData.assignments = [
        {
          id: 1,
          key: 'F1',
          title: 'Test Audio',
          description: 'This is a test audio file',
          file_type: 'audio/mp3',
          media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/11/file_example_MP3_700KB.mp3',
          station: 'Test Station',
          tags: ['test', 'audio'],
          submitted_by: 'System'
        },
        {
          id: 2,
          key: 'F2',
          title: 'Test Video',
          description: 'This is a test video file',
          file_type: 'video/mp4',
          media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4',
          station: 'Test Station',
          tags: ['test', 'video'],
          submitted_by: 'System'
        }
      ];
    }
    
    // Special handling for empty search results
    if (endpoint.startsWith('media/search') && (!responseData || !responseData.results || responseData.results.length === 0)) {
      console.log('Empty search results in response, adding sample data for testing');
      responseData = responseData || {};
      responseData.results = [
        {
          id: 1,
          title: 'Test Audio',
          description: 'This is a test audio file',
          file_type: 'audio/mp3',
          media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/11/file_example_MP3_700KB.mp3',
          station: 'Test Station',
          tags: ['test', 'audio'],
          submitted_by: 'System'
        },
        {
          id: 2,
          title: 'Test Video',
          description: 'This is a test video file',
          file_type: 'video/mp4',
          media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4',
          station: 'Test Station',
          tags: ['test', 'video'],
          submitted_by: 'System'
        },
        {
          id: 3,
          title: 'Test Image',
          description: 'This is a test image file',
          file_type: 'image/jpeg',
          media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/10/file_example_JPG_500kB.jpg',
          station: 'Test Station',
          tags: ['test', 'image'],
          submitted_by: 'System'
        }
      ];
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
      headers,
      body: JSON.stringify({
        error: 'Xano proxy request failed',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
