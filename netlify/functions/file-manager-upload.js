const https = require('https');
const cloudinary = require('cloudinary').v2;
const multipart = require('parse-multipart');
const boundary = multipart.getBoundary(contentType);
const parts = multipart.parse(bodyBuffer, boundary);


// Configure Cloudinary from Netlify environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse multipart form-data using parse-multipart@0.0.x
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    const boundary = Multipart.getBoundary(contentType);
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    const parts = Multipart.Parse(bodyBuffer, boundary);

    // Find the uploaded file part
    const filePart = parts.find(part => part.filename);
    if (!filePart) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No file found in request' })
      };
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
        (error, result) => error ? reject(error) : resolve(result)
      );
      uploadStream.end(filePart.data);
    });

    // Gather other form fields
    const fields = {};
    parts.forEach(part => {
      if (!part.filename) fields[part.name] = part.data.toString('utf8');
    });

    const xanoPayload = {
      title: fields.title || 'Untitled',
      description: fields.description || '',
      submitted_by: fields.submittedBy || 'Anonymous',
      notes: fields.notes || '',
      tags: fields.tags || '',
      category: fields.category || 'Other',
      station: fields.station || '',
      priority: fields.priority || 'Normal',
      file_type: filePart.type || 'unknown',
      file_size: String(filePart.data.length),
      filename: filePart.filename,
      is_approved: 'false',
      file_url: uploadResult.secure_url,
      thumbnail_url: uploadResult.eager && uploadResult.eager[0] ? uploadResult.eager[0].secure_url : ''
    };

    // Send payload to Xano
    const options = {
      hostname: 'xajo-b57d-cagt.n7e.xano.io',
      path: '/api:pYQcQtVX/user_submission',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.XANO_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const xanoResponse = await new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on('error', (err) => resolve({ statusCode: 500, body: JSON.stringify({ error: err.message }) }));
      req.write(JSON.stringify(xanoPayload));
      req.end();
    });

    return {
      statusCode: xanoResponse.statusCode,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json'
      },
      body: xanoResponse.body
    };
  } catch (err) {
    // Return detailed error info to the client
    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message, stack: err.stack })
    };
  }
};
