// netlify/functions/file-manager-upload.js
const Busboy = require('busboy');
const https = require('https');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

function cors(extra) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...(extra || {})
  };
}

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { ...cors({ 'content-type': 'application/json' }), ...(extraHeaders || {}) },
    body: JSON.stringify(body)
  };
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
    });

    const fields = {};
    const files = [];

    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', (d) => chunks.push(d));
      file.on('limit', () => {});
      file.on('end', () => {
        files.push({
          fieldname: name,
          filename: info.filename,
          mime: info.mimeType,
          buffer: Buffer.concat(chunks),
          size: Buffer.concat(chunks).length
        });
      });
    });

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('error', reject);
    bb.on('finish', () => resolve({ fields, files }));

    const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '');
    bb.end(body);
  });
}

function uploadToCloudinary(buffer, filename, mime) {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', folder: 'voxpro', public_id: filename ? filename.replace(/\.[^.]+$/, '') : undefined },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    upload.end(buffer);
  });
}

function postToXano(base, key, payload) {
  return new Promise((resolve) => {
    try {
      const url = new URL(base.replace(/\/+$/, '') + '/user_submission');
      const data = JSON.stringify(payload);

      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        (r) => {
          let body = '';
          r.on('data', (c) => (body += c));
          r.on('end', () => {
            let out = body;
            try { out = JSON.parse(body); } catch {}
            resolve({ status: r.statusCode, data: out });
          });
        }
      );

      req.on('error', (e) => resolve({ status: 500, data: { ok:false, error: e.message } }));
      req.write(data);
      req.end();
    } catch (e) {
      resolve({ status: 500, data: { ok:false, error: 'Invalid XANO_API_BASE' } });
    }
  });
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };

  // Diagnostics
  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      env: {
        CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
        XANO_API_KEY: !!process.env.XANO_API_KEY,
        XANO_API_BASE_present: !!process.env.XANO_API_BASE
      }
    });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok:false, error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseMultipart(event);
    const file = files.find(f => f.fieldname === 'attachment') || files[0];
    if (!file) return json(400, { ok:false, error: 'No file found (field "attachment")' });

    // Upload to Cloudinary
    const up = await uploadToCloudinary(file.buffer, file.filename, file.mime);
    const thumbUrl = cloudinary.url(up.public_id, { width: 400, height: 400, crop: 'fill', secure: true });

    // Send metadata to Xano
    const base = process.env.XANO_API_BASE || '';
    const key  = process.env.XANO_API_KEY || '';

    if (!base || !key) {
      return json(200, {
        ok:true,
        uploaded: { url: up.secure_url, public_id: up.public_id },
        warning: 'XANO_API_BASE or XANO_API_KEY missing; metadata not posted to Xano'
      });
    }

    const payload = {
      title: fields.title || file.filename || 'Untitled',
      description: fields.description || '',
      submitted_by: fields.submitted_by || 'Anonymous',
      notes: fields.notes || '',
      tags: fields.tags || '',
      category: fields.category || 'Other',
      station: fields.station || '',
      priority: fields.priority || 'Normal',
      file_type: fields.file_type || file.mime || 'unknown',
      file_size: Number(fields.file_size || file.size || 0),
      filename: fields.filename || file.filename || '',
      is_approved: String(fields.is_approved || 'false') === 'true',
      file_url: up.secure_url,
      cloudinary_public_id: up.public_id,
      thumbnail_url: thumbUrl,
      created_at: Date.now()
    };

    const xr = await postToXano(base, key, payload);

    if (xr.status >= 200 && xr.status < 300) {
      return json(200, { ok:true, cloudinary: up, xano: xr.data });
    } else {
      return json(200, { ok:true, cloudinary: up, xano: { warning: 'Xano returned ' + xr.status, data: xr.data } });
    }
  } catch (e) {
    return json(500, { ok:false, error: e.message, stage: 'h
