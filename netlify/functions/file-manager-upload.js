// netlify/functions/file-manager-upload.js
const https = require('https');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  const json = (code, obj) => ({
    statusCode: code,
    headers: { ...cors, 'content-type': 'application/json' },
    body: JSON.stringify(obj)
  });
  const fail = (code, stage, msg, extra = {}) =>
    json(code, { ok: false, stage, error: msg, ...extra });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  // Quick env probe via GET
  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      method: 'GET',
      expects: 'POST multipart/form-data with field name "attachment"',
      env: {
        CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
        XANO_API_KEY: !!process.env.XANO_API_KEY,
        XANO_API_BASE_present: !!process.env.XANO_API_BASE,
        XANO_API_BASE_value: process.env.XANO_API_BASE || null
      }
    });
  }

  if (event.httpMethod !== 'POST') return fail(405, 'entry', 'Method not allowed');

  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    XANO_API_KEY,
    XANO_API_BASE
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return fail(500, 'env', 'Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).');
  }
  if (!XANO_API_KEY) return fail(500, 'env', 'Missing XANO_API_KEY.');
  if (!XANO_API_BASE) return fail(500, 'env', 'Missing XANO_API_BASE (e.g. https://...xano.io/api:YOURKEY)');

  // Build Xano URL
  let xanoURL;
  try {
    const base = XANO_API_BASE.replace(/\/+$/, '');
    xanoURL = new URL(base + '/user_submission');
  } catch {
    return fail(500, 'env', 'XANO_API_BASE is not a valid URL', { value: XANO_API_BASE });
  }

  try {
    // Require inside try so module errors return JSON instead of a 502
    const cloudinary = require('cloudinary').v2;
    const multipart = require('parse-multipart'); // supports parse() or Parse()

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    });

    // -------- robust boundary & body decode ----------
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    if (!/multipart\/form-data/i.test(contentType)) {
      return fail(400, 'parse', `Invalid content-type: ${contentType || 'undefined'}`);
    }

    // Safe boundary extraction (no split crash)
    const m = /boundary=([^;]+)/i.exec(contentType);
    const boundary = m && m[1] ? m[1] : null;
    if (!boundary) {
      return fail(400, 'parse', 'No multipart boundary found in Content-Type', { contentType });
    }

    // Netlify sends multipart bodies base64-encoded. Use base64 regardless of flag.
    const bodyBuf = Buffer.from(event.body || '', 'base64');

    let parts;
    if (typeof multipart.parse === 'function') {
      parts = multipart.parse(bodyBuf, boundary);      // lowercase API
    } else if (typeof multipart.Parse === 'function') {
      parts = multipart.Parse(bodyBuf, boundary);      // uppercase API
    } else {
      return fail(500, 'parse', 'Multipart library has neither parse() nor Parse(). Check package/version.');
    }

    const filePart = parts.find(p => p.filename);
    if (!filePart) return fail(400, 'parse', 'No file part found (field name must be "attachment").');

    const fields = {};
    parts.forEach(p => { if (!p.filename) fields[p.name] = p.data.toString('utf8'); });

    // -------- cloudinary ----------
    let uploadResult;
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
          (err, res) => err ? reject(err) : resolve(res)
        );
        stream.end(filePart.data);
      });
    } catch (e) {
      return fail(500, 'cloudinary', e.message);
    }

    // -------- xano ----------
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

    const opts = {
      hostname: xanoURL.hostname,
      path: xanoURL.pathname + xanoURL.search,
      protocol: xanoURL.protocol,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + XANO_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const xanoRes = await new Promise((resolve) => {
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ code: res.statusCode, body: data }));
      });
      req.on('error', (e) => resolve({ code: 500, body: JSON.stringify({ error: e.message }) }));
      req.write(JSON.stringify(payload));
      req.end();
    });

    // Return whatever Xano returns (parsed if JSON)
    let bodyOut = { raw: xanoRes.body };
    try { bodyOut = JSON.parse(xanoRes.body); } catch {}
    return json(xanoRes.code, bodyOut);

  } catch (err) {
    return fail(500, 'unhandled', err.message, { stack: err.stack });
  }
};
