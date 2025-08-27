// netlify/functions/file-manager-upload.js
const https = require('https');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Forward the entire request to Xano
    const xanoUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX/user_submission';
    
    return new Promise((resolve) => {
      const options = {
        hostname: 'x8ki-letl-twmt.n7.xano.io',
        path: '/api:pYeQctVX/user_submission',
        method: 'POST',
        headers: {
          ...event.headers,
          'host': 'x8ki-letl-twmt.n7.xano.io'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: {
              ...headers,
              'content-type': res.headers['content-type'] || 'application/json'
            },
            body: data
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message })
        });
      });

      // Write the body directly
      if (event.body) {
        req.write(event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body);
      }
      
      req.end();
    });
    
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
