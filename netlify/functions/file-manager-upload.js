// Simplified file-manager-upload.js for testing deployment
exports.handler = async (event, context) => {
  // Basic CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Just return a success response for testing
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Upload function is working',
      receivedMethod: event.httpMethod,
      contentType: event.headers['content-type'] || 'none',
      timestamp: new Date().toISOString()
    })
  };
};
