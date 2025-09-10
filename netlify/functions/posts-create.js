// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18 on Netlify). No node-fetch.
// Reads the Webflow collection schema once, caches, and maps visible labels
// to real keys. Keeps ALL fields reliable (incl. required Media URL).

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

  // If your visible CMS labels differ, change these strings to match
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date',
    mediaUrl: 'Media URL' // <-- REQUIRED in your collection
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
    mediaUrl: null
  };

  for (const k of ['summary', 'bodyHtml', 'featureImage', 'publishDate', 'mediaUrl']) {
    const hit = byName[norm(LABELS[k])];
    if (hit) map[k] = hit.key;
  }

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

  // Feature image: pass a public URL; Webflow ingests it
  if (map.featureImage && ui.featureImageUrl) {
    fieldData[map.featureImage] = { url: ui.featureImageUrl };
  }

  // Publish date: ISO 8601 string
  if (map.publishDate && ui.publishDate) fieldData[map.publishDate] = ui.publishDate;

  // Media URL (required in your collection)
  if (map.mediaUrl && ui.mediaUrl) fieldData[map.mediaUrl] = ui.mediaUrl;

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

    // If Media URL is required, enforce before calling Webflow
    const map = await ensureFieldMap();
    if (map.mediaUrl && !fieldData[map.mediaUrl]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Validation Error: 'Media URL' is required." })
      };
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
