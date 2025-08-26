// Complete fetch-media.js file for Netlify function
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
    // Add request options with a longer timeout and user agent
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 30000, // 30 seconds timeout
      redirect: 'follow'
    };
    
    // Fetch the media
    const response = await fetch(targetUrl, requestOptions);

    if (!response.ok) {
      console.error(`Error fetching media: ${response.status} ${response.statusText}`);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Error fetching media: ${response.status} ${response.statusText}`,
          url: targetUrl
        })
      };
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    headers['Content-Type'] = contentType;
    
    // Add additional headers
    headers['Accept-Ranges'] = 'bytes';
    
    // For certain content types, allow the browser to handle them directly
    const directTypes = ['image/', 'audio/', 'video/', 'application/pdf'];
    const shouldProxy = !directTypes.some(type => contentType.includes(type));
    
    if (shouldProxy) {
      console.log(`Proxying content type: ${contentType}`);
      // Get the buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return {
        statusCode: 200,
        headers,
        body: buffer.toString('base64'),
        isBase64Encoded: true
      };
    } else {
      console.log(`Redirecting to original URL for content type: ${contentType}`);
      // Redirect to the original URL for media types the browser can handle
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': targetUrl
        },
        body: ''
      };
    }
  } catch (error) {
    console.error('Error in fetch-media function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `Error fetching media: ${error.message}`,
        url: targetUrl
      })
    };
  }
};
