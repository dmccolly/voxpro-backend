// Node 18 native fetch — returns precise upstream errors
exports.handler = async (event) => {
  const ALLOW = 'https://app.streamofdan.com';
  const url =
    process.env.BLOG_POSTS_LIST_URL ||
    process.env.XANO_ASSETS_ENDPOINT ||
    (process.env.XANO_API_BASE ? `${process.env.XANO_API_BASE.replace(/\/+$/,'')}/asset` : '');

  const debug = process.env.DEBUG_BLOG === '1';

  const reply = (status, data, type='application/json') => ({
    statusCode: debug ? 200 : status,   // force 200 in debug so body shows in browser
    headers: {
      'Access-Control-Allow-Origin': ALLOW,
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': type
    },
    body: typeof data === 'string' ? data : JSON.stringify(data)
  });

  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers: {
      'Access-Control-Allow-Origin': ALLOW,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }};

  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method Not Allowed' });
  if (!url) return reply(500, { error: 'No upstream URL', tried: ['BLOG_POSTS_LIST_URL','XANO_ASSETS_ENDPOINT','XANO_API_BASE+/asset'] });

  const target = event.rawQuery ? `${url}${url.includes('?')?'&':'?'}${event.rawQuery}` : url;

  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    const res = await fetch(target, {
      headers: {
        'Accept': 'application/json',
        ...(process.env.XANO_API_KEY ? { 'Authorization': process.env.XANO_API_KEY } : {})
      },
      signal: ac.signal
    });
    clearTimeout(t);

    const text = await res.text();
    const ctype = res.headers.get('content-type') || 'application/json';

    if (!res.ok) {
      return reply(res.status, {
        error: 'Upstream non-OK',
        status: res.status,
        target,
        body_preview: text.slice(0, 2000)
      });
    }
    return reply(200, text, ctype);
  } catch (e) {
    return reply(502, { error: 'Upstream fetch failed', target, detail: String(e) });
  }
};
