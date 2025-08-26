const fetch = require('node-fetch');

exports.handler = async (event) => {
  const url = event.queryStringParameters.url;
  
  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL parameter is required' })
    };
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Failed to fetch: ${response.statusText}` })
      };
    }

    // For media files, we need to return the binary data
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      },
      isBase64Encoded: true,
      body: buffer.toString('base64')
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
