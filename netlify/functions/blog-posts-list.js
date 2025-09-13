// netlify/functions/blog-posts-list.js
// Webflow v2 ONLY. Returns mapped Blog items. Node 18 native fetch.

const ALLOW = 'https://app.streamofdan.com';

const respond = (code, payload, type = 'application/json') => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': ALLOW,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': type
  },
  body: typeof payload === 'string' ? payload : JSON.stringify(payload)
});

// Map common fields out of Webflow v2 item objects
const mapItems = (items) =>
  (items || []).map((it) => ({
    id: it.id ?? it._id ?? null,
    title: it.name ?? it.title ?? '',
    slug: it.slug ?? '',
    summary: it.summary ?? it.excerpt ?? '',
    body: it.body ?? it.richText ?? it['post-body'] ?? '',
    hero_image: it['main-image'] ?? it.hero_image ?? it.image ?? null,
    status: it.isArchived ? 'archived' : (it.isDraft ? 'draft' : 'published'),
    published_at: it.lastPublished ?? it.publishedOn ?? it['published-on'] ?? null,
    updated_at: it.updatedOn ?? it['updated-on'] ?? null
  }));

exports.handler = async (event) => {
  // CORS / preflight
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
  if (event.httpMethod !== 'GET') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  const token = process.env.WEBFLOW_API_TOKEN;
  const coll  = process.env.WEBFLOW_COLLECTION_ID;

  if (!token || !coll) {
    return respond(500, { error: 'Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID' });
  }

  // Webflow v2 items list (no "live" param in v2)
  const url = `https://api.webflow.com/v2/collections/${coll}/items?limit=100&offset=0&archived=false&draft=false`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const text = await res.text();
    if (!res.ok) {
      // Bubble up clear diagnostics to fix token/collection quickly
      return respond(res.status, {
        error: 'Webflow upstream non-OK',
        status: res.status,
        target: url,
        hint: 'Verify token has collections:read and the COLLECTION_ID is the Blog collection.',
        body_preview: text.slice(0, 2000)
      });
    }

    // Webflow v2 returns: { items: [...], pagination: {...} }
    let data;
    try { data = JSON.parse(text); } catch { data = { items: [] }; }
    const items = Array.isArray(data) ? data : (data.items || []);
    return respond(200, mapItems(items));
  } catch (e) {
    return respond(502, { error: 'Fetch failed', detail: String(e) });
  }
};
