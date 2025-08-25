exports.handler = async (event, context) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, body: 'Error: url query parameter is required' };
  }

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return { statusCode: response.status, body: `Error: Failed to fetch media. Status: ${response.status}` };
    }

    const contentType = response.headers.get('content-type');

    // Convert the response body to a Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Fetch media error:', error);
    return { statusCode: 500, body: `Error: Could not fetch media. ${error.message}` };
  }
};
