// netlify/functions/cloudinary-metadata.js
const https = require('https');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Verify POST method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const payload = JSON.parse(event.body);
    console.log('Received payload:', payload);

    // Validate required fields
    if (!payload.cloudinary_url || !payload.title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: cloudinary_url and title' })
      };
    }

    // Prepare data for Xano
    const xanoData = {
      title: payload.title,
      description: payload.description || '',
      category: payload.category || 'Other',
      station: payload.station || '',
      tags: payload.tags || '',
      submitted_by: payload.submitted_by || '',
      notes: payload.notes || '',
      priority: payload.priority || 'Normal',
      cloudinary_url: payload.cloudinary_url,
      thumbnail_url: payload.thumbnail_url || payload.cloudinary_url,
      file_type: payload.file_type || '',
      file_size: payload.file_size ? parseInt(payload.file_size, 10) : 0,
      public_id: payload.public_id || '',
      created_at: new Date().toISOString()
    };

    // Send to Xano
    const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
    const xanoResponse = await makeRequest(
      'POST', 
      `${XANO_API_BASE}/user_submission`,
      xanoData
    );

    console.log('Xano response:', xanoResponse);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Media data saved successfully',
        data: xanoResponse
      })
    };

  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Server error',
        message: error.message
      })
    };
  }
};

// Helper function for HTTP requests
function makeRequest(method, url, data = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = responseData ? JSON.parse(responseData) : {};
              resolve(parsed);
            } catch (e) {
              resolve(responseData);
            }
          } else {
            reject(new Error(`HTTP error ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}
