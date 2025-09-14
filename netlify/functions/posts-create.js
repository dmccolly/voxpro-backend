/*
 * Netlify function for creating Blog posts in Webflow (v2 API).
 * Uses correct field slugs: name, slug, summary, body, feature-image, category, publish-date
 */

const API_BASE = 'https://api.webflow.com/v2'; // ✅ Fixed: no trailing spaces

// Polyfill fetch for Node ≤16
const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

// Allow CORS origins
const allowOrigin =
  process.env.ALLOW_ORIGINS ||
  process.env.ALLOW_ORIGIN ||
  '*';

// Helpers
const ok = (body) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const err = (code, message, extra = {}) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ error: message, ...extra }),
});

// Normalize slug
function normaliseSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Helper to get tag IDs from names
async function getTagIds(token, collectionId, tagNamesString) {
  if (!tagNamesString?.trim()) return [];

  const names = tagNamesString
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (!names.length) return [];

  try {
    const res = await fetch(
      `${API_BASE}/collections/${collectionId}/tags`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();

    if (!res.ok) {
      console.warn('Failed to fetch tags:', data);
      return [];
    }

    const tagMap = {};
    data.tags.forEach((tag) => {
      tagMap[tag.name.toLowerCase()] = tag._id;
    });

    return names.map((name) => tagMap[name.toLowerCase()]).filter((id) => id);
  } catch (e) {
    console.error('Error fetching tag IDs:', e);
    return [];
  }
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

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

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return err(400, 'Invalid JSON body');
  }

  // Extract title (legacy + fieldData support)
  const title =
    (body.title || body.name || (body.fieldData && body.fieldData.name) || '')
      .toString()
      .trim();
  if (!title) return err(400, 'Missing title');

  // Generate slug
  const rawSlug =
    body.slug ||
    (body.fieldData && body.fieldData.slug) ||
    title;
  const slug = normaliseSlug(rawSlug);

  // Status: draft, published, scheduled, archived
  const statusValue = (
    body.status || body.state || (body.fieldData && body.fieldData.status) || 'draft'
  ).toString().toLowerCase();
  const isDraft = statusValue === 'draft' || statusValue === 'scheduled';
  const isArchived = statusValue === 'archived';

  // Summary
  const summary =
    body.summary || (body.fieldData && body.fieldData.summary) || '';

  // Content/body
  const content =
    body.content ||
    body.body ||
    (body.fieldData && body.fieldData.body) ||
    '';

  // Media URL
  const mediaUrl =
    body.mediaUrl || (body.fieldData && body.fieldData.mediaUrl) || '';

  // Hero image: supports legacy `hero`, `heroUrl`, and `fieldData.featureImageUrl`
  const heroUrl =
    (body.hero && body.hero.url) ||
    body.heroUrl ||
    (body.fieldData && body.fieldData.featureImageUrl) ||
    '';
  const heroAlt =
    (body.hero && body.hero.alt) ||
    body.heroAlt ||
    (body.fieldData && body.fieldData.heroAlt) ||
    '';

  // Tags: accept array or comma-separated string
  let tagsString =
    body.tags || (body.fieldData && body.fieldData.tags) || '';
  if (Array.isArray(tagsString)) {
    tagsString = tagsString.join(', ');
  }

  // Author
  const author = body.author || (body.fieldData && body.fieldData.author) || '';

  // Publish Date
  const publishDate =
    body.publishDate || (body.fieldData && body.fieldData.publishDate) || null;

  // Get tag IDs
  const tagIds = await getTagIds(token, collectionId, tagsString);

  // Build fieldData using YOUR ACTUAL FIELD SLUGS
  const fieldData = {
    name: title,
    slug: slug,
    summary: summary,
    body: content,
    mediaUrl: mediaUrl,
    'feature-image': {
      url: heroUrl,
      alt: heroAlt,
    },
    category: tagIds.length > 0 ? tagIds[0] : undefined, // Only use first tag as category if needed
    'publish-date': publishDate,
    tags: tagIds, // Array of tag IDs
    author: author,
  };

  // Construct payload
  const payload = {
    isDraft,
    isArchived,
    slug,
    fieldData,
  };

  // Log payload for debugging
  console.log('Sending to Webflow:', JSON.stringify(payload, null, 2));

  try {
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

    return ok({ ok: true, id: json?.id || json?.item?.id || null });
  } catch (e) {
    return err(502, 'Unhandled error in posts-create', {
      details: e?.message || e,
    });
  }
};
