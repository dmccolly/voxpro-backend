// netlify/functions/blog-posts-list.js
// Proxies to Xano (or your chosen backend) and normalizes CORS.
// Configure either BLOG_POSTS_LIST_URL or XANO_API_BASE in Netlify env.

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  try {
    // Allow only your site (adjust if you preview from a different domain)
    const allowOrigin = 'https://app.streamofdan.com';

    // Prefer explicit URL; otherwise fall back to Xano base + conventional path
    const explicit = process.env.BLOG_POSTS_LIST_URL; // e.g. https://x8a2-1234-foo.xano.io/api:abcd/blog-posts-list
    const base = process.env.XANO_API_BASE;           // e.g. https://x8a2-1234-foo.xano.io/api:abcd
    const apiKey = process.env.XANO_API_KEY;          // if your Xano group requires Authorization

    const url = explicit || (base ? `${base.replace(/\/+$/,'')}/blog-posts-list` : null);
    if (!url) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'No BLOG_POSTS_LIST_URL or XANO_API_BASE configured.' })
      };
    }

    // Pass through any query params from the frontend (pagination, filters, etc.)
    const qs = event.rawQuery ? `?${event.rawQuery}` : '';
    const target = `${url}${qs}`;

    const res = await fetch(target, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': apiKey } : {})
      }
    });

    const text = await res.text();
    // Try to return JSON; if not JSON, return raw text
    let body;
    try { body = JSON.parse(text); }
    catch { body = text; }

    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': res.headers.get('content-type') || 'application/json'
      },
      body: (typeof body === 'string') ? body : JSON.stringify(body)
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Upstream fetch failed', detail: String(err) })
    };
  }
};
