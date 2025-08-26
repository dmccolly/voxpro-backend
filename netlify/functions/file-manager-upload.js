// Netlify File Manager - Upload Function
// This replaces your Heroku File Manager with a Netlify version
// Uses the same environment variables and database as VoxPro

const https = require('https');
const http = require('http');
const multiparty = require('multiparty');

const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi',
  'mp3', 'wav', 'pdf', 'doc', 'docx', 'mkv', 'wmv', 'flv'
];

const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250MB

const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
};

const uploadToXano = async (fileBuffer, filename, fileType) => {
  const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeqCtV';
  
  // Try multiple Xano upload endpoints
  const uploadEndpoints = [
    `${XANO_API_BASE}/upload/attachment`,
    `${XANO_API_BASE}/upload`,
    `${XANO_API_BASE}/file/upload`
  ];
  
  for (const endpoint of uploadEndpoints) {
    try {
      console.log(`Trying upload endpoint: ${endpoint}`);
      
      // Create form data for file upload
      const boundary = '----formdata-' + Math.random().toString(36);
      const formData = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
        Buffer.from(`Content-Type: ${fileType}\r\n\r\n`),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
      
      const response = await makeRequest(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formData.length
        },
        body: formData
      });
      
      if (response.status === 200 || response.status === 201) {
        console.log(`Upload successful via ${endpoint}:`, response.data);
        return response.data;
      }
      
    } catch (error) {
      console.log(`Upload failed via ${endpoint}:`, error.message);
      continue;
    }
  }
  
  throw new Error('All upload endpoints failed');
};

const saveToDatabase = async (mediaData) => {
  const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8ki-letl-twmt.n7.xano.io/api:pYeqCtV';
  const endpoint = `${XANO_API_BASE}/voxpro`;
  
  console.log(`Saving to database: ${endpoint}`);
  console.log('Media data:', mediaData);
  
  const response = await makeRequest(endpoint, {
    method: 'POST',
    body: mediaData
  });
  
  if (response.status === 200 || response.status === 201) {
    console.log('Database save successful:', response.data);
    return response.data;
  } else {
    throw new Error(`Database save failed: ${response.status}`);
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
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
    console.log('File upload started');
    
    // Parse multipart form data
    const form = new multiparty.Form({
      maxFilesSize: MAX_FILE_SIZE
    });
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(event, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });
    
    if (!files.file || !files.file[0]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' })
      };
    }
    
    const file = files.file[0];
    const filename = file.originalFilename;
    const fileExtension = filename.split('.').pop().toLowerCase();
    
    // Validate file extension
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` 
        })
      };
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024*1024)}MB` 
        })
      };
    }
    
    console.log(`Processing file: ${filename} (${file.size} bytes)`);
    
    // Read file buffer
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(file.path);
    
    // Upload file to Xano storage
    const uploadResult = await uploadToXano(fileBuffer, filename, file.headers['content-type']);
    
    // Prepare media data for database
    const mediaData = {
      title: fields.title?.[0] || filename,
      description: fields.description?.[0] || '',
      category: fields.category?.[0] || 'Other',
      station: fields.station?.[0] || '',
      tags: fields.tags?.[0] || '',
      priority: fields.priority?.[0] || 'Normal',
      notes: fields.notes?.[0] || '',
      submitted_by: fields.submitted_by?.[0] || 'Unknown',
      file_size: file.size,
      file_type: file.headers['content-type'],
      file_name: filename,
      database_url: uploadResult, // This contains the Xano file reference
      created_at: new Date().toISOString()
    };
    
    // Save to VoxPro database
    const dbResult = await saveToDatabase(mediaData);
    
    console.log('Upload completed successfully');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Upload successful! File: ${filename}`,
        xano_id: dbResult.id,
        file_size: file.size,
        database_url: uploadResult
      })
    };
    
  } catch (error) {
    console.error('Upload failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Upload failed: ${error.message}`
      })
    };
  }
};

