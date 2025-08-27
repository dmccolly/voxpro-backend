// netlify/functions/list-media.js
const https = require('https');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
  const out = (code, body) => ({
    statusCode: code,
    headers: { ...cors, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return out(405, { ok: false, error: 'Method not allowed' });

  const { XANO_API_BASE, XANO_API_KEY } = process.env;
  if (!XANO_API_BASE || !XANO_API_KEY) {
    return out(500, { ok: false, stage: 'env', error: 'Missing XANO_API_BASE or XANO_API_KEY' });
  }

  let url;
  try {
    // GET list endpoint (same collection we POST to)
    const base = XANO_API_BASE.replace(/\/+$/, '');
    url = new URL(base + '/user_submission'); // adjust here if your list endpoint differs
  } catch {
    return out(500, { ok: false, stage: 'env', error: 'Invalid XANO_API_BASE', value: XANO_API_BASE });
  }

  // fetch from Xano
  const res = await new Promise((resolve) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + XANO_API_KEY,
          Accept: 'application/json'
        }
      },
      (r) => {
        let data = '';
        r.on('data', (c) => (data += c));
        r.on('end', () => resolve({ status: r.statusCode, data }));
      }
    );
    req.on('error', (e) => resolve({ status: 500, data: JSON.stringify({ ok: false, error: e.message }) }));
    req.end();
  });

  // try to parse
  let payload = res.data;
  try { payload = JSON.parse(res.data); } catch {}
  return out(res.status, { ok: res.status === 200, data: payload });
};
