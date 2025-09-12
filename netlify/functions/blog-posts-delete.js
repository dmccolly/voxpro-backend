const API_BASE = 'https://api.webflow.com/v2';
const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const allowOrigin = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';

const ok = (body) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  const token = process.env.WEBFLOW_API_TOKEN;
  const collectionId =
    process.env.WEBFLOW_POSTS_COLLECTION_ID || process.env.WEBFLOW_COLLECTION_ID;

  if (!token) return err(500, 'Missing WEBFLOW_API_TOKEN');
  if (!collectionId)
    return err(500, 'Missing WEBFLOW_POSTS_COLLECTION_ID or WEBFLOW_COLLECTION_ID');

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {}
  const id = (body.id || '').trim();
  if (!id) return err(400, 'Missing id');

  try {
    const res = await fetch(
      `${API_BASE}/collections/${collectionId}/items/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    const text = await res.text();
    if (!res.ok) return err(res.status, 'Webflow error', { details: safeParse(text) });

    return ok({ ok: true, id, deleted: true });
  } catch (e) {
    return err(500, 'Unhandled error in blog-posts-delete', {
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
