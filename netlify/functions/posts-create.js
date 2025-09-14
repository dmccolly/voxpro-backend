const API_BASE = 'https://api.webflow.com/v2';

const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const allowOrigin =
  process.env.ALLOW_ORIGINS ||
  process.env.ALLOW_ORIGIN ||
  '*';

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

function normaliseSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

exports.handler = async (event) => {
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

  const title =
    (body.title || body.name || (body.fieldData && body.fieldData.name) || '')
      .toString()
      .trim();
  if (!title) return err(400, 'Missing title');

  const rawSlug =
    body.slug ||
    (body.fieldData && body.fieldData.slug) ||
    title;
  const slug = normaliseSlug(rawSlug);

  const statusValue = (
    body.status || body.state || (body.fieldData && body.fieldData.status) || 'draft'
  ).toString().toLowerCase();
  const isDraft = statusValue === 'draft' || statusValue === 'scheduled';
  const isArchived = statusValue === 'archived';

  const summary =
    body.summary || (body.fieldData && body.fieldData.summary) || '';

  const content =
    body.content ||
    body.body ||
    (body.fieldData && body.fieldData.body) ||
    '';

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

  // 👇 ONLY SEND FIELDS THAT EXIST IN YOUR COLLECTION
  const fieldData = {
    name: title,
    slug: slug,
    summary: summary,
    body: content,
    'feature-image-url': heroUrl,
    'feature-image-alt': heroAlt,
  };

  const payload = {
    isDraft,
    isArchived,
    slug,
    fieldData,
  };

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
