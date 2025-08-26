// Simple test function to verify Netlify functions are working
exports.handler = async (event, context) => {
    console.log('Test function called');

    return {
          statusCode: 200,
          headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
                  message: 'Netlify function is working!',
                  timestamp: new Date().toISOString(),
                  event: {
                            httpMethod: event.httpMethod,
                            path: event.path,
                            queryStringParameters: event.queryStringParameters
                  }
          })
    };
};
