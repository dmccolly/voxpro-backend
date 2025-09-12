const API_BASE = 'https://api.webflow.com/v2';
const fetch = global.fetch || ((...args ) => import('node-fetch').then(({ default: f }) => f(...args)));

const allowOrigin = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';

const ok = (body) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const err = (code, message, extra = {}) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ error: message, ...extra }),
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS' ) return ok({ ok: true });
  if (event.httpMethod !== 'GET' ) return err(405, 'Method Not Allowed');

  const token = process.env.WEBFLOW_API_TOKEN;
  const collectionId = process.env.WEBFLOW_POSTS_COLLECTION_ID || process.env.WEBFLOW_COLLECTION_ID;

  if (!token) return err(500, 'Missing WEBFLOW_API_TOKEN environment variable');
  if (!collectionId) return err(500, 'Missing WEBFLOW_POSTS_COLLECTION_ID or WEBFLOW_COLLECTION_ID environment variable');

  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const limit = Math.max(1, Math.min(200, parseInt(params.get('limit') || '100', 10)));
    const offset = Math.max(0, parseInt(params.get('offset') || '0', 10));
    const wantStatus = (params.get('status') || '').toLowerCase();
    const q = (params.get('q') || '').trim().toLowerCase();

    const url = `${API_BASE}/collections/${collectionId}/items?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const text = await res.text();
    if (!res.ok) return err(res.status, 'Webflow API error', { details: safeParse(text) });

    const json = safeParse(text) || {};
    const items = (json.items || []).map(normalize);

    const filtered = items.filter((it) => {
      if (wantStatus) {
        if (wantStatus === 'archived' && it.status !== 'archived') return false;
        if (wantStatus === 'draft' && it.status !== 'draft') return false;
        if (wantStatus === 'published' && it.status !== 'published') return false;
      }
      if (q) {
        const hay = `${it.title} ${it.slug} ${it.summary || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return ok(filtered);
  } catch (e) {
    return err(500, 'Unhandled error in blog-posts-list', {
      details: String(e?.message || e),
    });
  }
};

function safeParse(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function normalize(raw) {
  const {
    id,
    slug,
    name,
    createdOn,
    updatedOn,
    lastPublished,
    isArchived,
    isDraft,
    fieldData = {},
  } = raw || {};

  const title = fieldData.name || name || '';
  const summary = fieldData.summary || fieldData.seoDescription || fieldData.description || '';
  const hero = fieldData.featureImageUrl || fieldData.hero || fieldData.mainImage || fieldData.image || '';

  let status = 'published';
  if (isArchived) status = 'archived';
  else if (isDraft) status = 'draft';

  return {
    id,
    slug,
    title,
    summary,
    featureImageUrl: hero,
    status,
    createdOn,
    updatedOn,
    lastPublished,
    isArchived,
    isDraft,
    raw,
  };
}
