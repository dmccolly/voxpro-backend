// netlify/functions/cloudinary-metadata.js
const https = require('https');

// Process metadata from Cloudinary and save to Xano
exports.handler = async (event, context) => {
  // Set CORS headers for preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    console.log('Received data:', data);
    
    // Validate required fields
    if (!data.file_url || !data.title) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: file_url and title are required' })
      };
    }
    
    // Prepare data for Xano
    const xanoData = {
      title: data.title,
      description: data.description || '',
      category: data.category || 'Other',
      station: data.station || '',
      tags: data.tags || '',
      submitted_by: data.submitted_by || '',
      notes: data.notes || '',
      priority: data.priority || 'Normal',
      cloudinary_url: data.file_url,
      thumbnail_url: data.thumbnail_url || data.file_url,
      file_type: data.file_type || '',
      file_size: data.file_size ? parseInt(data.file_size, 10) : 0,
      public_id: data.public_id || '',
      created_at: new Date().toISOString()
    };
    
    // Send data to Xano
    const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
    const XANO_API_KEY = process.env.XANO_API_KEY;
    
    const xanoUrl = `${XANO_API_BASE}/user_submission`;
    
    const xanoResponse = await new Promise((resolve, reject) => {
      const parsedUrl = new URL(xanoUrl);
      
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': XANO_API_KEY ? `Bearer ${XANO_API_KEY}` : undefined
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = responseData ? JSON.parse(responseData) : {};
            resolve({
              statusCode: res.statusCode,
              data: result
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              data: responseData
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('Error sending to Xano:', error);
        reject(error);
      });
      
      // Send the data
      req.write(JSON.stringify(xanoData));
      req.end();
    });
    
    console.log('Xano response:', xanoResponse);
    
    // If Xano request succeeded
    if (xanoResponse.statusCode >= 200 && xanoResponse.statusCode < 300) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Media metadata saved successfully',
          data: xanoResponse.data
        })
      };
    } else {
      // Xano request failed
      return {
        statusCode: xanoResponse.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Failed to save to database',
          details: xanoResponse.data
        })
      };
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Server error',
        message: error.message
      })
    };
  }
};
