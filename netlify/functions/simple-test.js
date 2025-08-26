// Simple test function
exports.handler = async (event, context) => {
    return {
          statusCode: 200,
          headers: {
                  'Content-Type': 'text/html',
                  'Access-Control-Allow-Origin': '*'
          },
          body: `
                <html>
                        <head><title>Simple Test</title></head>
                                <body>
                                          <h1>Netlify Function Works!</h1>
                                                    <p>This proves Netlify functions are working.</p>
                                                              <p>Time: ${new Date().toISOString()}</p>
                                                                        <p>Path: ${event.path}</p>
                                                                                </body>
                                                                                      </html>
                                                                                          `
    };
};
