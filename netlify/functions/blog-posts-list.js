// Webflow v2 list → returns simplified blog items
const ALLOW = 'https://app.streamofdan.com';

const respond = (code, data, type='application/json') => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': ALLOW,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': type
  },
  body: typeof data === 'string' ? data : JSON.stringify(data)
});

const mapItems = (items=[]) =>
  items.map(it => ({
    id: it.id ?? null,
    title: it.name ?? it.title ?? '',
    slug: it.slug ?? '',
    summary: it.summary ?? it.excerpt ?? it['summary'] ?? '',
    body: it.body ?? it.richText ?? it['post-body'] ?? '',
    image: it['main-image'] ?? it.hero_image ?? it.image ?? null,
    status: it.isArchived ? 'archived' : (it.isDraft ? 'draft' : 'published'),
    published_at: it.lastPublished ?? it.publishedOn ?? null,
    updated_at: it.updatedOn ?? null
  }));

exports.handler = async (event) => {
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
  if (event.httpMethod !== 'GET') return respond(405, { error: 'Method Not Allowed' });

  const token = process.env.WEBFLOW_API_TOKEN;
  const coll  = process.env.WEBFLOW_COLLECTION_ID;
  if (!token || !coll) return respond(500, { error: 'Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID' });

  const url = `https://api.webflow.com/v2/collections/${coll}/items?limit=100&offset=0&archived=false&draft=false`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    if (!res.ok) {
      return respond(res.status, { error: 'Webflow upstream non-OK', status: res.status, target: url, body_preview: text.slice(0,2000) });
    }
    const data = JSON.parse(text);
    const items = Array.isArray(data) ? data : (data.items || []);
    return respond(200, mapItems(items));
  } catch (e) {
    return respond(502, { error: 'Fetch failed', detail: String(e) });
  }
};
