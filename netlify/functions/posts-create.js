// netlify/functions/posts-create.js
const API_BASE = 'https://api.webflow.com/v2';

// Polyfill fetch for Node ≤16; on Node 18+ global fetch will be used.
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
  // CORS preflight support
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  // Environment checks
  const token = process.env.WEBFLOW_API_TOKEN;
  const collectionId =
    process.env.WEBFLOW_POSTS_COLLECTION_ID || process.env.WEBFLOW_COLLECTION_ID;
  if (!token) return err(500, 'Missing WEBFLOW_API_TOKEN');
  if (!collectionId)
    return err(
      500,
      'Missing WEBFLOW_POSTS_COLLECTION_ID or WEBFLOW_COLLECTION_ID'
    );

  // Parse and validate body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return err(400, 'Invalid JSON body');
  }
  const title = (body.title || '').trim();
  if (!title) return err(400, 'Missing title');

  // Build slug; if provided, use that. Otherwise derive from title.
  const slug = (body.slug || title)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Normalize status and draft/archived flags
  const status = (body.status || 'draft').toLowerCase();
  const isDraft = status === 'draft';
  const isArchived = false; // we never create archived items

  // Map fields from request to Webflow fieldData; adjust labels as needed
  const fieldData = {
    // Use your collection's field labels here; `name` is often required
    name: title,
    slug: slug,
    summary: body.summary || '',
    body: body.content || '',      // for rich text HTML
    mediaUrl: body.mediaUrl || '',
    // Webflow ImageRef fields can accept { url: string }
    featureImageUrl: body.hero?.url || '',
    heroAlt: body.hero?.alt || '',
    tags: Array.isArray(body.tags) ? body.tags.join(', ') : body.tags || '',
    author: body.author || '',
  };

  // Additional properties (draft/scheduled) outside of fieldData
  const payload = {
    isDraft,
    isArchived,
    slug,
    fieldData,
  };

  try {
    // Create item in Webflow
    const res = await fetch(
      `${API_BASE}/collections/${collectionId}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    const text = await res.text();
    const json = safeParse(text);
    if (!res.ok)
      return err(res.status, 'Webflow create error', { details: json });

    // Optionally, handle scheduled publishing by storing scheduleAt
    // in a custom field or by invoking another function.

    return ok({ ok: true, id: json.id || json._id || null });
  } catch (e) {
    return err(500, 'Unhandled error in posts-create', {
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
