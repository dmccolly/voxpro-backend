// netlify/functions/blog-posts-list.js
// Returns Blog posts from WEBFLOW collection (preferred). Falls back to XANO if no Webflow envs.
// Node 18+ native fetch.

const ALLOW = 'https://app.streamofdan.com';

// --- helpers ---
const ok = (status, data, type = 'application/json') => ({
  statusCode: status,
  headers: {
    'Access-Control-Allow-Origin': ALLOW,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': type
  },
  body: typeof data === 'string' ? data : JSON.stringify(data)
});

const mapWebflowItems = (items) =>
  items.map(it => ({
    id: it.id || it._id || it['cmsItemId'] || null,
    title: it.name || it.title || '',
    slug: it.slug || '',
    summary: it.summary || it.excerpt || '',
    body: it.body || it.rich_text || it.content || '',
    hero_image: (it['main-image'] || it.hero_image || it.image || {}), // field names vary
    status: it.isArchived ? 'archived' : (it.isDraft ? 'draft' : 'published'),
    published_at: it['lastPublished'] || it['published-on'] || it['published_at'] || it['created-on'] || null,
    updated_at: it['updated-on'] || it['updated_at'] || null,
    raw: it
  }));

exports.handler = async (event) => {
  // CORS + method handling
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
  if (event.httpMethod !== 'GET') return ok(405, { error: 'Method Not Allowed' });

  const WF_TOKEN = process.env.WEBFLOW_API_TOKEN;
  const WF_COLL  = process.env.WEBFLOW_COLLECTION_ID;
  const WF_VER   = (process.env.WEBFLOW_API_VERSION || '2').trim();

  try {
    if (WF_TOKEN && WF_COLL) {
      // ----- WEBFLOW (preferred) -----
      // v2 endpoint:
      const isV2 = WF_VER === '2';
      const base = isV2
        ? `https://api.webflow.com/v2/collections/${WF_COLL}/items`
        : `https://api.webflow.com/collections/${WF_COLL}/items?live=true`;

      const headers = isV2
        ? { Authorization: `Bearer ${WF_TOKEN}`, Accept: 'application/json' }
        : { Authorization: `Bearer ${WF_TOKEN}`, Accept: 'application/json', 'accept-version': '1.0.0' };

      const url = base; // add pagination later if needed

      const res = await fetch(url, { headers });
      const text = await res.text();

      if (!res.ok) {
        return ok(res.status, {
          error: 'Webflow upstream non-OK',
          status: res.status,
          target: url,
          body_preview: text.slice(0, 2000)
        });
      }

      const data = JSON.parse(text);
      const items = isV2 ? (data.items || data) : ((data.items && data.items.items) ? data.items.items : data.items || data);
      return ok(200, mapWebflowItems(items || []));
    }

    // ----- FALLBACK: XANO (only if WEBFLOW envs missing) -----
    const xanoURL =
      process.env.BLOG_POSTS_LIST_URL ||
      process.env.XANO_ASSETS_ENDPOINT ||
      (process.env.XANO_API_BASE ? `${process.env.XANO_API_BASE.replace(/\/+$/,'')}/asset` : '');

    if (!xanoURL) return ok(500, { error: 'No Webflow envs and no Xano URL. Set WEBFLOW_API_TOKEN + WEBFLOW_COLLECTION_ID.' });

    const xRes = await fetch(xanoURL, {
      headers: {
        Accept: 'application/json',
        ...(process.env.XANO_API_KEY ? { Authorization: process.env.XANO_API_KEY } : {})
      }
    });
    const xText = await xRes.text();
    if (!xRes.ok) {
      return ok(xRes.status, { error: 'Xano upstream non-OK', status: xRes.status, target: xanoURL, body_preview: xText.slice(0, 2000) });
    }
    // If you want untouched Xano JSON, return xText; otherwise map similarly
    return ok(200, xText, xRes.headers.get('content-type') || 'application/json');

  } catch (e) {
    return ok(502, { error: 'Fetch failed', detail: String(e) });
  }
};
