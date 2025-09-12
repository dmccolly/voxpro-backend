// netlify/functions/blog-posts-list.js
// Proxy function: forwards /api/blog-posts-list → Xano (or other backend)

exports.handler = async (event) => {
  const ALLOW = 'https://app.streamofdan.com';

  // --- Handle CORS preflight ---
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOW,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  // --- Enforce GET only ---
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': ALLOW,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // --- Build upstream URL ---
  const url = process.env.BLOG_POSTS_LIST_URL; // e.g. https://<xano-domain>/<api-group>/asset
  if (!url) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': ALLOW,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Missing BLOG_POSTS_LIST_URL env var' })
    };
  }

  // Add query string passthrough
  const target = event.rawQuery ? `${url}${url.includes('?') ? '&' : '?'}${event.rawQuery}` : url;

  try {
    // Timeout guard
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 12000);

    const res = await fetch(target, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(process.env.XANO_API_KEY ? { 'Authorization': process.env.XANO_API_KEY } : {})
      },
      signal: ac.signal
    });
    clearTimeout(timeout);

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': ALLOW,
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': res.headers.get('content-type') || 'application/json'
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        'Access-Control-Allow-Origin': ALLOW,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Upstream fetch failed',
        detail: String(err),
        target: url
      })
    };
  }
};
