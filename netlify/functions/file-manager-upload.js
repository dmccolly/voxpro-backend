// Fixed file-manager-upload.js - Uses SAME endpoint as search-media.js
const https = require('https');
const http = require('http');

// Use EXACT same API base as search-media.js
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV';
const DEBUG = true;

// Helper function to make HTTP requests to Xano
const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const cacheBuster = `${urlObj.search ? '&' : '?'}_t=${Date.now()}&_r=${Math.random()}`;
      const fullUrl = urlObj.toString() + cacheBuster;
      const protocol = fullUrl.startsWith('https:') ? https : http;
      
      if (DEBUG) {
        console.log(`[DEBUG] Making ${options.method || 'GET'} request to: ${url}`);
        if (options.body) {
          console.log(`[DEBUG] Request data:`, JSON.stringify(options.body).substring(0, 500));
        }
      }

      const parsedUrl = new URL(fullUrl);
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
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

      const req = protocol.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          if (DEBUG) {
            console.log(`[DEBUG] Response status: ${res.statusCode}`);
            console.log(`[DEBUG] Response headers:`, res.headers);
            console.log(`[DEBUG] Response data (preview):`, data.substring(0, 200));
          }
          
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (e) {
            console.log(`[DEBUG] Non-JSON response or empty data`);
            resolve(data);
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[ERROR] Request error:`, error);
        reject(error);
      });
      
      if (options.body) {
        const stringData = JSON.stringify(options.body);
        req.write(stringData);
      }
      
      req.end();
    } catch (error) {
      console.error(`[ERROR] Request setup error:`, error);
      reject(error);
    }
  });
};

// Parse multipart form data
function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    try {
      if (!event.headers['content-type']?.includes('multipart/form-data')) {
        return reject(new Error('Not a multipart form data request'));
      }
      
      const contentType = event.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1]?.split(';')[0];
      
      if (!boundary) {
        return reject(new Error('No boundary found in content-type header'));
      }
      
      const body = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64').toString() 
        : event.body;
      
      const parts = body.split(`--${boundary}`);
      const formData = {};
      
      // Process each part
      parts.forEach(part => {
        if (!part.includes('Content-Disposition: form-data')) return;
        
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch) return;
        
        const name = nameMatch[1];
        const isFile = part.includes('filename="');
        
        if (isFile) {
          const filenameMatch = part.match(/filename="([^"]+)"/);
          const filename = filenameMatch ? filenameMatch[1] : 'unknown';
          
          const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
          const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
          
          const headerEndIndex = part.indexOf('\r\n\r\n');
          const dataStartIndex = headerEndIndex + 4;
          
          formData[name] = {
            filename,
            contentType,
            // For simplicity, we're not handling binary data correctly here
            // In a real implementation, you'd need to handle Base64 encoding
            data: part.substring(dataStartIndex, part.lastIndexOf('\r\n'))
          };
        } else {
          const valueStartIndex = part.indexOf('\r\n\r\n') + 4;
          const value = part.substring(valueStartIndex, part.lastIndexOf('\r\n'));
          formData[name] = value;
        }
      });
      
      resolve(formData);
    } catch (error) {
      console.error(`[ERROR] Error parsing multipart form:`, error);
      reject(error);
    }
  });
}

// Main handler function
exports.handler = async (event, context) => {
  // Log the request details
  console.log(`[INFO] Received ${event.httpMethod} request to ${event.path}`);
  console.log(`[INFO] Headers:`, JSON.stringify(event.headers));
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('[INFO] Handling OPTIONS request (CORS preflight)');
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ status: 'ok' }) 
    };
  }

  try {
    // For initial testing, just return a success response
    // This helps isolate deployment issues from code logic issues
    if (event.queryStringParameters?.test === 'true') {
      console.log('[INFO] Test mode - returning success response');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Upload function is accessible',
          method: event.httpMethod,
          path: event.path,
          contentType: event.headers['content-type'] || 'none',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Only allow POST requests for actual uploads
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Parse form data from the request
    let formData;
    try {
      formData = await parseMultipartForm(event);
      console.log('[INFO] Parsed form data fields:', Object.keys(formData));
    } catch (parseError) {
      console.error('[ERROR] Form parsing error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Could not parse form data', 
          details: parseError.message 
        })
      };
    }

    // Validate required fields
    if (!formData.title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Title is required' })
      };
    }

    // Prepare upload data - using same structure as existing VoxPro entries
    const uploadData = {
      title: formData.title || 'Untitled',
      description: formData.description || '',
      category: formData.category || 'Other',
      station: formData.station || '',
      tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
      submitted_by: formData.submittedBy || '',
      priority: formData.priority || 'Normal',
      notes: formData.notes || '',
      uploadDate: new Date().toISOString(),
      source: 'file-manager'
    };

    // Add file information if a file was uploaded
    if (formData.file) {
      uploadData.filename = formData.file.filename;
      uploadData.file_type = formData.file.contentType;
      uploadData.file_size = formData.file.data.length;
      
      // In a real implementation, you would upload the file to storage
      // and add the URL to uploadData
      console.log(`[INFO] File details: ${formData.file.filename}, ${formData.file.contentType}`);
    }

    console.log('[INFO] Sending data to Xano:', JSON.stringify(uploadData));

    // Send to Xano using same endpoint as search-media.js
    const xanoUrl = `${XANO_API_BASE}/voxpro`;
    
    const result = await makeRequest(xanoUrl, {
      method: 'POST',
      body: uploadData
    });

    console.log('[INFO] Xano response:', JSON.stringify(result));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Upload successful',
        data: result,
        uploadInfo: {
          title: uploadData.title,
          filename: uploadData.filename || 'No file',
          size: uploadData.file_size || 0
        }
      })
    };

  } catch (error) {
    console.error('[ERROR] Upload error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Upload failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
};
