const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return {
      statusCode: 400,
      body: 'Error: url query parameter is required',
    };
  }

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: `Error: Failed to fetch media. Status: ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    const buffer = await response.buffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength,
        'Access-Control-Allow-Origin': '*', // Allow any origin to access this
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Fetch media error:', error);
    return {
      statusCode: 500,
      body: `Error: Could not fetch media. ${error.message}`,
    };
  }
};
