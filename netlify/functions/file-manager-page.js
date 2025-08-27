// netlify/functions/file-manager-upload.js
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};
const json = (code, body) => ({
  statusCode: code,
  headers: { ...CORS, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // Health check that DOES NOT import heavy modules
  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      env: {
        CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
        XANO_API_KEY: !!process.env.XANO_API_KEY,
        XANO_API_BASE_present: !!process.env.XANO_API_BASE,
      },
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // Validate env up front
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    XANO_API_KEY,
    XANO_API_BASE,
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return json(500, { ok: false, stage: 'env', error: 'Missing Cloudinary env vars' });
  }
  if (!XANO_API_KEY || !XANO_API_BASE) {
    return json(500, { ok: false, stage: 'env', error: 'Missing Xano env vars' });
  }

  // Lazy-require only for POST so GET never blows up
  let Busboy, cloudinary;
  try {
    Busboy = require('busboy');
    cloudinary = require('cloudinary').v2;
  } catch (e) {
    return json(500, { ok: false, stage: 'deps', error: 'Missing dependency', detail: e.message });
  }

  // Configure Cloudinary now
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  // Parse multipart with Busboy
  const parseMultipart = () =>
    new Promise((resolve, reject) => {
      const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
      if (!/multipart\/form-data/i.test(contentType)) {
        return reject(new Error(`Invalid content-type: ${contentType || 'undefined'}`));
      }
      const bb = Busboy({ headers: { 'content-type': contentType } });
      const fields = {};
      let file = null;
      bb.on('file', (name, stream, info) => {
        const { filename, mimeType } = info;
        const chunks = [];
        stream.on('data', (d) => chunks.push(d));
        stream.on('end', () => {
          if (name === 'attachment' || !file) {
            file = { fieldname: name, filename, mimeType, buffer: Buffer.concat(chunks) };
          }
        });
      });
      bb.on('field', (n, v) => (fields[n] = v));
      bb.on('error', reject);
      bb.on('finish', () => resolve({ fields, file }));
      const bodyBuf = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
      bb.end(bodyBuf);
    });

  try {
    const { fields, file } = await parseMultipart();
    if (!file) return json(400, { ok: false, stage: 'parse', error: 'No file (field "attachment")' });

    // Upload to Cloudinary
    const cloudRes = await new Promise((resolve, reject) => {
      const up = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      up.end(file.buffer);
    });

    // Build Xano payload
    const payload = {
      title: fields.title || file.filename || 'Untitled',
      description: fields.description || '',
      submitted_by: fields.submitted_by || 'Anonymous',
      notes: fields.notes || '',
      tags: fields.tags || '',
      category: fields.category || 'Other',
      station: fields.station || '',
      priority: fields.priority || 'Normal',
      file_type: file.mimeType || 'unknown',
      file_size: String(file.buffer.length),
      filename: fields.filename || file.filename || '',
      is_approved: String(fields.is_approved || 'false') === 'true',
      file_url: cloudRes.secure_url,
      thumbnail_url: cloudRes.eager?.[0]?.secure_url || '',
      created_at: Date.now(),
    };

    // POST to Xano
    let xanoUrl;
    try {
      xanoUrl = new URL(XANO_API_BASE.replace(/\/+$/, '') + '/user_submission');
    } catch {
      return json(500, { ok: false, stage: 'env', error: 'Invalid XANO_API_BASE' });
    }

    const xanoResp = await new Promise((resolve) => {
      const req = https.request(
        {
          protocol: xanoUrl.protocol,
          hostname: xanoUrl.hostname,
          path: xanoUrl.pathname + xanoUrl.search,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + XANO_API_KEY,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on('error', (e) => resolve({ status: 500, body: JSON.stringify({ error: e.message }) }));
      req.write(JSON.stringify(payload));
      req.end();
    });

    let xanoBody = xanoResp.body;
    try { xanoBody = JSON.parse(xanoResp.body); } catch {}

    return json(200, { ok: true, cloudinary: cloudRes, xano: { status: xanoResp.status, body: xanoBody } });
  } catch (e) {
    return json(500, { ok: false, stage: 'handler', error: e.message });
  }
};
