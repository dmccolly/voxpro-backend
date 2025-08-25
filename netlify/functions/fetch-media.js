// Enhanced fetch-media.js - Complete file
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Set up response headers with proper CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  // Get the URL parameter
  const targetUrl = event.queryStringParameters.url;
  
  if (!targetUrl) {
    console.error('Missing URL parameter');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing URL parameter' })
    };
  }

  console.log(`Fetching media from: ${targetUrl}`);

  try {
    // Fetch the media
    const response = await fetch(targetUrl);

    if (!response.ok) {
      console.error(`Error fetching media: ${response.status} ${response.statusText}`);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Error fetching media: ${response.status} ${response.statusText}`
        })
      };
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    headers['Content-Type'] = contentType;
    
    // Add additional headers
    headers['Accept-Ranges'] = 'bytes';
    
    // Get the buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers,
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Error in fetch-media function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `Error fetching media: ${error.message}`
      })
    };
  }
};
