// Complete working file-manager-upload.js - Uses SAME endpoint as search-media.js
const https = require('https');
const http = require('http');

// Use EXACT same API base as search-media.js
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV';
const DEBUG = true;

// Helper function to make HTTP requests to Xano - SAME as search-media.js
const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const cacheBuster = `?_t=${Date.now()}&_r=${Math.random()}`;
    const fullUrl = url + cacheBuster;
    const protocol = fullUrl.startsWith('https:') ? https : http;
    
    if (DEBUG) {
      console.log(`[DEBUG] Making ${options.method || 'GET'} request to: ${url.toString()}`);
      if (options.body) {
        console.log(`[DEBUG] Request data:`, JSON.stringify(options.body).substring(0, 500));
      }
    }

    const requestOptions = {
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json',
        'User-Agent': 'VoxPro-Netlify-Function/1.0',
        'Accept': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(fullUrl, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
};

// Parse multipart form data
function parseMultipartData(body, boundary) {
  const parts = body.split(`--${boundary}`);
  const fields = {};
  let file = null;

  for (const part of parts) {
    if (part.includes('Content-Disposition: form-data')) {
      const nameMatch = part.match(/name="([^"]+)"/);
      if (nameMatch) {
        const fieldName = nameMatch[1];
        const valueStart = part.indexOf('\r\n\r\n') + 4;
        const valueEnd = part.lastIndexOf('\r\n');
        
        if (valueStart < valueEnd) {
          const value = part.substring(valueStart, valueEnd);
          
          if (part.includes('filename=')) {
            const filenameMatch = part.match(/filename="([^"]+)"/);
            file = {
              fieldName,
              filename: filenameMatch ? filenameMatch[1] : 'unknown',
              data: value,
              headers: {
                'content-type': part.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'application/octet-stream'
              }
            };
          } else {
            fields[fieldName] = value;
          }
        }
      }
    }
  }

  return { fields, file };
}

// Main handler function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
      };
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No boundary found in Content-Type' })
      };
    }

    const body = event.isBase64Encoded ? 
      Buffer.from(event.body, 'base64').toString('binary') : 
      event.body;

    const { fields, file } = parseMultipartData(body, boundary);

    if (DEBUG) {
      console.log('Parsed fields:', Object.keys(fields));
      console.log('File info:', file ? { filename: file.filename, size: file.data.length } : 'No file');
    }

    // Validate required fields
    if (!fields.title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Title is required' })
      };
    }

    // Create the upload data object - SAME structure as existing VoxPro entries
    const uploadData = {
      title: fields.title || 'Untitled',
      description: fields.description || '',
      category: fields.category || 'Other',
      station: fields.station || 'Unknown',
      tags: fields.tags || '',
      submittedBy: fields.submittedBy || 'Unknown',
      priority: fields.priority || 'Normal',
      notes: fields.notes || '',
      filename: file ? file.filename : 'no-file',
      fileSize: file ? file.data.length : 0,
      contentType: file ? file.headers['content-type'] : 'unknown',
      uploadDate: new Date().toISOString(),
      source: 'file-manager'
    };

    if (DEBUG) {
      console.log('Upload data to send to Xano:', uploadData);
    }

    // Send to Xano using EXACT same endpoint as search-media.js
    const xanoUrl = `${XANO_API_BASE}/voxpro`;
    
    const result = await makeRequest(xanoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: uploadData
    });

    if (DEBUG) {
      console.log('Xano response:', result);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Upload successful',
        data: result,
        uploadInfo: {
          title: uploadData.title,
          filename: uploadData.filename,
          size: uploadData.fileSize
        }
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Upload failed',
        details: error.message
      })
    };
  }
};
