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
    return fail(500
