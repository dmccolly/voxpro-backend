/*
 * Netlify function for creating Blog posts in Webflow (v2 API).
 *
 * This implementation is a drop‑in replacement for the original
 * `posts-create.js` handler. It accepts both the legacy payload shape
 * used by the old blog manager (e.g. top‑level `title`, `slug`,
 * `summary`, `body`, etc.) and the newer `fieldData` shape (where
 * fields are nested under `fieldData`).  It also normalizes hero
 * image fields (`heroUrl`/`heroAlt` vs. nested `hero`), handles
 * comma‑separated or array tags, and respects the `status`/`state`
 * field to determine draft/archived flags.  This should prevent
 * 400 errors like “Missing title” when saving or publishing posts.
 */

const API_BASE = 'https://api.webflow.com/v2';

// Polyfill fetch for Node ≤16. On Node 18+ the global fetch is available.
const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

// Determine the allowed origin for CORS. Allow multiple environment
// variables for flexibility. If nothing is set, default to '*'.
const allowOrigin =
  process.env.ALLOW_ORIGINS ||
  process.env.ALLOW_ORIGIN ||
  '*';

// Helper to build a successful response.
const ok = (body) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

// Helper to build an error response with a code and message. Additional
// details can be merged into the body. For CORS we always return the
// allowOrigin header.
const err = (code, message, extra = {}) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ error: message, ...extra }),
});

// Normalize a slug from arbitrary input. Removes invalid URL chars,
// collapses consecutive dashes, trims, and lowercases.
function normaliseSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

exports.handler = async (event) => {
  // CORS preflight support
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  // Only allow POST requests for creating posts
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  // Pull required environment variables. Fallback to WEBFLOW_COLLECTION_ID
  // if WEBFLOW_POSTS_COLLECTION_ID isn’t provided.
  const token = process.env.WEBFLOW_API_TOKEN;
  const collectionId =
    process.env.WEBFLOW_POSTS_COLLECTION_ID || process.env.WEBFLOW_COLLECTION_ID;
  if (!token)
    return err(500, 'Missing WEBFLOW_API_TOKEN', {
      message: 'Set WEBFLOW_API_TOKEN in your environment.',
    });
  if (!collectionId)
    return err(500, 'Missing WEBFLOW_POSTS_COLLECTION_ID or WEBFLOW_COLLECTION_ID', {
      message: 'Set the Webflow collection ID in your environment.',
    });

  // Parse the request body. If body isn’t valid JSON, return a 400 error.
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return err(400, 'Invalid JSON body');
  }

  // Extract the title. Support both legacy `title` and `fieldData.name`.
  const title =
    (body.title || body.name || (body.fieldData && body.fieldData.name) || '')
      .toString()
      .trim();
  if (!title) return err(400, 'Missing title');

  // Generate a slug. Use provided slug if available, otherwise derive
  // from title. Normalise to URL‑friendly format.
  const rawSlug =
    body.slug ||
    (body.fieldData && body.fieldData.slug) ||
    title;
  const slug = normaliseSlug(rawSlug);

  // Determine publication status. Allowed values: draft, published,
  // scheduled, archived. Default to draft. Accept legacy `state` field
  // as well. Webflow doesn’t support scheduled status directly via API
  // (items remain drafts until published), so scheduling is handled
  // separately via another endpoint.
  const statusValue = (
    body.status || body.state || (body.fieldData && body.fieldData.status) || 'draft'
  ).toString().toLowerCase();
  const isDraft = statusValue === 'draft' || statusValue === 'scheduled';
  const isArchived = statusValue === 'archived';

  // Normalise summary. Accept `summary`, `fieldData.summary`.
  const summary =
    body.summary || (body.fieldData && body.fieldData.summary) || '';

  // Normalise content/body. Accept `content` (new), `body` (legacy),
  // or `fieldData.body`. The blog manager sends HTML.
  const content =
    body.content ||
    body.body ||
    (body.fieldData && body.fieldData.body) ||
    '';

  // Media URL (e.g. video, audio). Accept `mediaUrl` from body or fieldData.
  const mediaUrl =
    body.mediaUrl || (body.fieldData && body.fieldData.mediaUrl) || '';

  // Hero image normalisation. Support nested `hero` (legacy),
  // separate `heroUrl`/`heroAlt`, and `fieldData.featureImageUrl`.
  const heroUrl =
    (body.hero && body.hero.url) ||
    body.heroUrl ||
    (body.fieldData &&
      (body.fieldData.featureImageUrl ||
        (body.fieldData.hero && body.fieldData.hero.url))) ||
    '';
  const heroAlt =
    (body.hero && body.hero.alt) ||
    body.heroAlt ||
    (body.fieldData &&
      (body.fieldData.heroAlt ||
        (body.fieldData.hero && body.fieldData.hero.alt))) ||
    '';

  // Tags. Accept array of strings, comma‑separated string, or fieldData.tags.
  let tags = body.tags || (body.fieldData && body.fieldData.tags) || '';
  if (Array.isArray(tags)) {
    tags = tags.join(', ');
  } else if (typeof tags === 'string') {
    // leave as is; user may provide comma‑separated string already
  } else {
    tags = '';
  }

  // Author. Accept `author` or `fieldData.author`.
  const author = body.author || (body.fieldData && body.fieldData.author) || '';

  // Assemble fieldData according to your Webflow collection schema. Adjust
  // keys to match your collection’s field slugs as needed.
  const fieldData = {
    name: title,
    slug: slug,
    summary: summary,
    body: content,
    mediaUrl: mediaUrl,
    'feature-image': {
      url: heroUrl,
      alt: heroAlt
    },
    tags: tags,
    author: author,
  };

  // Construct payload. Additional fields (scheduleAt, etc.) can be
  // added as needed. Note: schedule is handled elsewhere.
  const payload = {
    isDraft,
    isArchived,
    slug,
    fieldData,
  };

  try {
    // Send request to Webflow to create an item. Use v2 endpoint.
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
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      return err(res.status, 'Webflow create error', { details: json });
    }
    // On success, return the created item’s id and status.
    return ok({ ok: true, id: json?.id || json?.item?.id || null });
  } catch (e) {
    return err(502, 'Unhandled error in posts-create', {
      details: e?.message || e,
    });
  }
};
