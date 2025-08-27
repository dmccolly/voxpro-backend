// netlify/functions/file-manager-upload.js
const https = require('https');
const { Readable } = require('stream');

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

  // Quick env probe via GET (no upload)
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

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET)
    return fail(500, 'env', 'Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).');

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
    // Require in try so missing modules show JSON error, not 502
    const Busboy = require('busboy');
    const cloudinary = require('cloudinary').v2;

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    });

    // ---------- Parse multipart with Busboy ----------
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    if (!/multipart\/form-data/i.test(contentType)) {
      return fail(400, 'parse', `Invalid content-type: ${contentType || 'undefined'}`);
    }

    const bb = Busboy({ headers: { 'content-type': contentType } });

    const fields = {};
    let fileMeta = null; // { filename, mimeType, buffer }

    const filePromise = new Promise((resolve, reject) => {
      bb.on('file', (name, file, info) => {
        const { filename, mimeType } = info;
        const chunks = [];
        file.on('data', (d) => chunks.push(d));
        file.on('limit', () => reject(new Error('File too large')));
        file.on('end', () => {
          if (name === 'attachment') {
            fileMeta = { filename, mimeType, buffer: Buffer.concat(chunks) };
          }
        });
      });

      bb.on('field', (name, val) => {
        fields[name] = val;
      });

      bb.on('error', reject);
      bb.on('finish', () => resolve());
    });

    // Netlify sends base64 for multipart; prefer base64 regardless of flag to be safe
    const bodyBuf = Buffer.from(event.body || '', 'base64');
    Readable.from([bodyBuf]).pipe(bb);
    await filePromise;

    if (!fileMeta) {
      return fail(400, 'parse', 'No file found. Ensure your input name="attachment".', { fields: Object.keys(fields) });
    }

    // ---------- Upload to Cloudinary ----------
    let uploadResult;
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(fileMeta.buffer);
      });
    } catch (e) {
      return fail(500, 'cloudinary', e.message);
    }

    // ---------- Send metadata to Xano ----------
    const payload = {
      title: fields.title || 'Untitled',
      description: fields.description || '',
      submitted_by: fields.submittedBy || 'Anonymous',
      notes: fields.notes || '',
      tags: fields.tags || '',
      category: fields.category || 'Other',
      station: fields.station || '',
      priority: fields.priority || 'Normal',
      file_type: fileMeta.mimeType || 'unknown',
      file_size: String(fileMeta.buffer.length),
      filename: fileMeta.filename,
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
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ code: res.statusCode, body: data }));
      });
      req.on('error', (e) => resolve({ code: 500, body: JSON.stringify({ error: e.message }) }));
      req.write(JSON.stringify(payload));
      req.end();
    });

    let out = { raw: xanoRes.body };
    try { out = JSON.parse(xanoRes.body); } catch {}
    return json(xanoRes.code, out);
  } catch (err) {
    return fail(500, 'unhandled', err.message, { stack: err.stack });
  }
};
