// Node 18 native fetch
exports.handler = async (event) => {
  const ALLOW = 'https://app.streamofdan.com';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOW,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': ALLOW, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const base = process.env.BLOG_POSTS_LIST_URL;
    if (!base) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': ALLOW, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing BLOG_POSTS_LIST_URL' })
      };
    }

    const target = event.rawQuery ? `${base}${base.includes('?') ? '&' : '?'}${event.rawQuery}` : base;

    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 12000);

    const res = await fetch(target, {
      headers: {
        'Accept': 'application/json',
        ...(process.env.XANO_API_KEY ? { 'Authorization': process.env.XANO_API_KEY } : {})
      },
      signal: ac.signal
    });
    clearTimeout(to);

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
      headers: { 'Access-Control-Allow-Origin': ALLOW, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream fetch failed', detail: String(err) })
    };
  }
};
