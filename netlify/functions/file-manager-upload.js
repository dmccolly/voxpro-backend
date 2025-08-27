// netlify/functions/file-manager-upload.js
const https = require('https');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // REQUIRE INSIDE TRY so missing packages don’t cause a 502
    const cloudinary = require('cloudinary').v2;
    const multipart = require('parse-multipart'); // v1.0.4

    // Basic sanity checks so we fail fast with a readable error
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, XANO_API_KEY } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary env vars missing (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).');
    }
    if (!XANO_API_KEY) throw new Error('XANO_API_KEY missing.');

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    });

    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      throw new Error(`Invalid content-type: ${contentType || 'undefined'}`);
    }

    const boundary = multipart.getBoundary(contentType);
    const bodyBuf = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    const parts = multipart.parse(bodyBuf, boundary); // NOTE: lowercase parse() for v1.0.4

    const filePart = parts.find(p => p.filename);
    if (!filePart) throw new Error('No file part found in multipart payload.');

    // Collect other fields
    const fields = {};
    parts.forEach(p => { if (!p.filename) fields[p.name] = p.data.toString('utf8'); });

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
        (err, res) => err ? reject(err) : resolve(res)
      );
      stream.end(filePart.data);
    });

    // Send metadata to Xano
    const payload = {
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
      thumbnail_url: uploadResult.eager?.[0]?.secure_url || ''
    };

    const reqOpts = {
      hostname: 'xajo-b57d-cagt.n7e.xano.io',
      path: '/api:pYQcQtVX/user_submission',
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + XANO_API_KEY, 'Content-Type': 'application/json' }
    };

    const xanoRes = await new Promise((resolve) => {
      const req = https.request(reqOpts, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on('error', (e) => resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) }));
      req.write(JSON.stringify(payload));
      req.end();
    });

    return { statusCode: xanoRes.statusCode, headers: { ...cors, 'content-type': 'application/json' }, body: xanoRes.body };

  } catch (err) {
    // You will now see this in the browser Network “Response” tab instead of a 502
    return {
      statusCode: 500,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ error: err.message, stack: err.stack, hint: 'See Cloudinary/Xano env vars & parse-multipart version (use 1.0.4).' })
    };
  }
};
