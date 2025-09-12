// netlify/functions/blog-posts-list.js
// Native fetch only (Node 18). No node-fetch import.

exports.handler = async (event) => {
  const ALLOW_ORIGIN = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || 'https://app.streamofdan.com';
  const ok = (status, body, contentType = 'application/json') => ({
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': contentType
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'GET') return ok(405, { error: 'Method Not Allowed' });

  try {
    const base = process.env.BLOG_POSTS_LIST_URL;
    if (!base) return ok(500, { error: 'Missing BLOG_POSTS_LIST_URL' });

    // Append any query string transparently
    const target = event.rawQuery ? `${base}${base.includes('?') ? '&' : '?'}${event.rawQuery}` : base;

    // Timeout after 12s to avoid hanging 502s
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);

    const res = await fetch(target, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // If your Xano needs auth, set XANO_API_KEY in Netlify (e.g., "Bearer <token>")
        ...(process.env.XANO_API_KEY ? { 'Authorization': process.env.XANO_API_KEY } : {})
      },
      signal: ac.signal
    }).catch((e) => {
      console.error('Upstream fetch error:', e);
      throw e;
    });
    clearTimeout(t);

    const contentType = res.headers.get('content-type') || 'application/json';
    const text = await res.text();

    // Pass through upstream status/body so you can see real errors
    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': contentType
      },
      body: text
    };
  } catch (err) {
    console.error('Function error:', err);
    return ok(502, { error: 'Upstream fetch failed', detail: String(err) });
  }
};
