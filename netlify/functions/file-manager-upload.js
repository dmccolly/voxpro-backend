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

  // Diagnostics without uploading
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
    // Require inside try so module errors come back as JSON (not 502)
    const cloudinary = require('cloudinary').v2;
    const parser = require('aws-lambda-multipart-parser');

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    });

    // -------- parse with aws-lambda-multipart-parser ----------
    // keepBinary = true -> returns Buffer in file.content
    const parsed = parser.parse(event, true);

    // The file input NAME in the form must be "attachment"
    const file = parsed.attachment;
    if (!file || !file.content || !file.filename) {
      return fail(400, 'parse', 'No file found. Ensure input name="attachment".', { fields: Object.keys(parsed) });
    }

    // Collect text fields
    const title = parsed.title || 'Untitled';
    const description = parsed.description || '';
    const submittedBy = parsed.submittedBy || 'Anonymous';
    const notes = parsed.notes || '';
    const tags = parsed.tags || '';
    const category = parsed.category || 'Other';
    const station = parsed.station || '';
    const priority = parsed.priority || 'Normal';

    // -------- Cloudinary upload ----------
    let uploadResult;
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', eager: [{ width: 300, height: 300, crop: 'thumb' }] },
          (err, res) => err ? reject(err) : resolve(res)
        );
        stream.end(file.content); // Buffer
      });
    } catch (e) {
      return fail(500, 'cloudinary', e.message);
    }

    // -------- send to Xano ----------
    const payload = {
      title,
      description,
      submitted_by: submittedBy,
      notes,
      tags,
      category,
      station,
      priority,
      file_type: file.contentType || 'unknown',
      file_size: String(file.content.length),
      filename: file.filename,
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

    // Return whatever Xano returns (parse if JSON)
    let bodyOut = { raw: xanoRes.body };
    try { bodyOut = JSON.parse(xanoRes.body); } catch {}
    return json(xanoRes.code, bodyOut);

  } catch (err) {
    return fail(500, 'unhandled', err.message, { stack: err.stack });
  }
};
