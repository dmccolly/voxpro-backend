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
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  // Environment variables
  const { XANO_API_KEY, XANO_API_BASE } = process.env;
  if (!XANO_API_KEY || !XANO_API_BASE) {
    return json(500, { ok: false, error: 'Missing Xano environment variables' });
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { id } = body;

    if (!id) {
      return json(400, { ok: false, error: 'Missing required field: id' });
    }

    // Construct Xano URL for deletion
    let xanoUrl;
    try {
      xanoUrl = new URL(XANO_API_BASE.replace(/\/+$/, '') + '/user_submission/' + id);
    } catch {
      return json(500, { ok: false, error: 'Invalid XANO_API_BASE' });
    }

    // Make DELETE request to Xano
    const xanoResp = await new Promise((resolve) => {
      const req = https.request(
        {
          protocol: xanoUrl.protocol,
          hostname: xanoUrl.hostname,
          path: xanoUrl.pathname + xanoUrl.search,
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer ' + XANO_API_KEY,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on('error', (e) => resolve({ status: 500, body: JSON.stringify({ error: e.message }) }));
      req.end();
    });

    if (xanoResp.status === 200 || xanoResp.status === 204) {
      return json(200, { ok: true, message: 'Item deleted successfully' });
    } else {
      let errorBody = xanoResp.body;
      try {
        errorBody = JSON.parse(xanoResp.body);
      } catch {}
      return json(xanoResp.status, { ok: false, error: 'Delete failed', details: errorBody });
    }
  } catch (error) {
    return json(500, { ok: false, error: 'Server error', details: error.message });
  }
};

