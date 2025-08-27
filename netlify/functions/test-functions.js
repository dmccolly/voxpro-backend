// netlify/functions/test-functions.js
// Script to test if functions are accessible and properly deployed

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  
  try {
    // Get Netlify environment info
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NETLIFY: process.env.NETLIFY,
      CONTEXT: process.env.CONTEXT,
      DEPLOY_URL: process.env.DEPLOY_URL,
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
      URL: process.env.URL,
      COMMIT_REF: process.env.COMMIT_REF,
      BRANCH: process.env.BRANCH
    };
    
    // Get function info
    const functionInfo = {
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      memoryLimitInMB: context.memoryLimitInMB,
      awsRequestId: context.awsRequestId,
      invokedFunctionArn: context.invokedFunctionArn
    };
    
    // List all files in the functions directory
    // Note: This won't work in production, but helps during local development
    let functionFiles = [];
    try {
      const fs = require('fs');
      const path = require('path');
      const functionsDir = path.join(__dirname);
      
      if (fs.existsSync(functionsDir)) {
        functionFiles = fs.readdirSync(functionsDir)
          .filter(file => file.endsWith('.js'))
          .map(file => file);
      }
    } catch (e) {
      functionFiles = ['Error listing files: ' + e.message];
    }
    
    // Information about the deployed functions
    const deployedFunctions = [
      'file-manager-page',
      'file-manager-upload',
      'search-media',
      'xano-proxy',
      'fetch-media',
      'test-functions'
    ].map(name => {
      return {
        name,
        url: `${process.env.URL || 'https://your-site.netlify.app'}/.netlify/functions/${name}`
      };
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Function test successful',
        timestamp: new Date().toISOString(),
        environment: envInfo,
        function: functionInfo,
        functionFiles,
        deployedFunctions,
        event: {
          httpMethod: event.httpMethod,
          path: event.path,
          queryStringParameters: event.queryStringParameters,
          headers: {
            ...event.headers,
            // Remove potentially sensitive headers
            authorization: event.headers.authorization ? '[REDACTED]' : undefined,
            cookie: event.headers.cookie ? '[REDACTED]' : undefined
          }
        }
      }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Function test failed',
        message: error.message,
        stack: error.stack
      }, null, 2)
    };
  }
};
