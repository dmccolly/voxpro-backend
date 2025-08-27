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
    // CORRECTED URL
    const options = {
      hostname: 'xajo-bs7d-cagt.n7e.xano.io',
      path: '/api:pYeQctVX/user_submission',
      method: 'POST',
      headers: {
        ...event.headers,
        'host': 'xajo-bs7d-cagt.n7e.xano.io'
      }
    };

    return new Promise((resolve) => {
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
