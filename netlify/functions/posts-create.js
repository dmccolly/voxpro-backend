// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18 on Netlify). No node-fetch.
// Reads Webflow schema once, caches, maps visible labels to real keys.
// Adds hard fallbacks for required keys: "media-url" and "thumbnail".

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// Warm cache between invocations
let FIELD_MAP_CACHE = null;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function ensureFieldMap() {
  if (FIELD_MAP_CACHE) return FIELD_MAP_CACHE;

  // Change label strings only if your visible CMS field names differ
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date',
    mediaUrl: 'Media URL',
    thumbnail: 'Thumbnail'
  };

  const res = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}`, {
    headers: { Authorization: AUTH_HEADER, accept: 'application/json' }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to read collection schema: ${res.status} ${txt}`);
  }
  const schema = await res.json();

  const byName = {};
  for (const f of schema.fieldDefinitions || []) {
    byName[norm(f.name)] = { key: f.key, type: f.type };
  }

  const map = {
    title: 'name',
    slug: 'slug',
    summary: null,
    bodyHtml: null,
    featureImage: null,
    publishDate: null,
    mediaUrl: null,
    thumbnail: null
  };

  for (const k of ['summary','bodyHtml','featureImage','publishDate','mediaUrl','thumbnail']) {
    const hit = byName[norm(LABELS[k])];
    if (hit) map[k] = hit.key;
  }

  // Known stable API keys to fall back to if label lookup ever misses
  map._fallback = {
    mediaUrl: 'media-url',
    thumbnail: 'thumbnail'
  };

  FIELD_MAP_CACHE = map;
  return map;
}

async function buildFieldData(ui) {
  const map = await ensureFieldMap();

  // Always include Title/Slug
  const fieldData = {
    [map.title]: ui.title || 'Untitled Post',
    [map.slug]: ui.slug || 'untitled-post'
  };

  if (map.summary && ui.summary) fieldData[map.summary] = ui.summary;
  if (map.bodyHtml && ui.bodyHtml) fieldData[map.bodyHtml] = ui.bodyHtml;

  // Feature image: public URL (Webflow ingests)
  if (ui.featureImageUrl) {
    const key = map.featureImage;
    if (key) fieldData[key] = { url: ui.featureImageUrl };
  }

  // Thumbnail: use explicit ui.thumbnailUrl, else reuse featureImageUrl
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl;
  if (thumbUrl) {
    const key = map.thumbnail || map._fallback.thumbnail; // ensure we hit "thumbnail"
    fieldData[key] = { url: thumbUrl };
  }

  // Publish date: ISO 8601 string
  if (map.publishDate && ui.publishDate) fieldData[map.publishDate] = ui.publishDate;

  // Media URL (required): plain text / URL field
  if (ui.mediaUrl) {
    const key = map.mediaUrl || map._fallback.mediaUrl; // ensure we hit "media-url"
    fieldData[key] = ui.mediaUrl;
  }

  return fieldData;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  try {
    const ui = JSON.parse(event.body || '{}');

    // Build schema-safe field payload
    const fieldData = await buildFieldData(ui);
    const map = await ensureFieldMap();

    // Enforce required fields before calling Webflow
    const mediaKey = map.mediaUrl || map._fallback.mediaUrl;
    const thumbKey = map.thumbnail || map._fallback.thumbnail;
    if (mediaKey && !fieldData[mediaKey]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Validation Error: 'Media URL' is required." }) };
    }
    if (thumbKey && !fieldData[thumbKey]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Validation Error: 'Thumbnail' is required." }) };
    }

    const payload = {
      isArchived: false,
      isDraft: ui.status !== 'published',
      fieldData
    };

    const resp = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items`, {
      method: 'POST',
      headers: {
        Authorization: AUTH_HEADER,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify(json) };
    }
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
