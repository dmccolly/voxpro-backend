const API_BASE = 'https://api.webflow.com/v2';

// Polyfill fetch for Node ≤16. On Node 18+ the global fetch is available.
const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

// Determine the allowed origin for CORS. Allow multiple environment variable names for flexibility.
const allowOrigin = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';

// Helper to build a successful response.
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

// Helper to build an error response with a code and message. Additional details can be merged into the body.
const err = (code, message, extra = {}) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ error: message, ...extra }),
});

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  // Only allow POST requests for creating posts
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  // Pull required environment variables. Fallback to WEBFLOW_COLLECTION_ID if POST collection id isn't provided.
  const token = process.env.WEBFLOW_API_TOKEN;
  const collectionId =
    process.env.WEBFLOW_POSTS_COLLECTION_ID || process.env.WEBFLOW_COLLECTION_ID;

  if (!token) return err(500, 'Missing WEBFLOW_API_TOKEN');
  if (!collectionId)
    return err(
      500,
      'Missing WEBFLOW_POSTS_COLLECTION_ID or WEBFLOW_COLLECTION_ID'
    );

  // Parse the request body. If body isn't valid JSON, return a 400 error.
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return err(400, 'Invalid JSON body');
  }

  // Title is required for all posts.
  const title = (body.title || '').trim();
  if (!title) return err(400, 'Missing title');

  // Generate a slug. Use provided slug if available, otherwise derive from title. Normalize to URL-friendly format.
  const slug = (body.slug || title)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Determine publication status. Allowed values: draft, published, scheduled. Default to draft.
  const status = (body.status || 'draft').toLowerCase();
  const isDraft = status === 'draft';
  const isArchived = false; // New items aren't archived by default.

  // Map incoming fields to Webflow collection fields. Adjust keys to your collection's schema as needed.
  const fieldData = {
    name: title,
    slug: slug,
    summary: body.summary || '',
    body: body.content || '', // Use HTML content directly
    mediaUrl: body.mediaUrl || '',
    featureImageUrl: body.hero?.url || '',
    heroAlt: body.hero?.alt || '',
    tags: Array.isArray(body.tags) ? body.tags.join(', ') : body.tags || '',
    author: body.author || '',
  };

  // Construct payload. Additional fields (scheduleAt, etc.) can be added as needed.
  const payload = {
    isDraft,
    isArchived,
    slug,
    fieldData,
  };

  try {
    // Send request to Webflow to create an item.
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
    if (!res.ok) {
      return err(res.status, 'Webflow create error', { details: json });
    }
    return ok({ ok: true, id: json?.id || json?._id || null });
  } catch (e) {
    return err(500, 'Unhandled error in posts-create', {
      details: e?.message || e,
    });
  }
};

// Helper to safely parse JSON.
function safeParse(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
