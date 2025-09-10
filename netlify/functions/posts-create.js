// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18 on Netlify).
// Forces required keys 'media-url' (string) and 'thumbnail' ({url}) so Webflow always receives them.
// Optional fields (Summary, Body, Feature Image, Publish Date) are mapped via schema if available.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// Cache schema between invocations
let SCHEMA_CACHE = null;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// If it's a Cloudinary URL, return a smaller/optimized variant (helps with Webflow 4MB ingest limit)
function smallCloudinaryUrl(url, width = 800) {
  try {
    if (!url) return url;
    const u = new URL(url);
    if (!/res\.cloudinary\.com/i.test(u.hostname)) return url;
    const replaced = u.pathname.replace(/\/upload\/(?!.*\/upload\/)/, `/upload/f_auto,q_auto,w_${width}/`);
    return `${u.origin}${replaced}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

async function ensureSchema() {
  if (SCHEMA_CACHE) return SCHEMA_CACHE;

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
    byName[norm(f.name)] = f; // f.key, f.type
  }

  // Adjust these if your visible field labels differ in Webflow
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date'
  };

  SCHEMA_CACHE = {
    title: { key: 'name', type: 'Plain Text' },
    slug: { key: 'slug', type: 'Plain Text' },
    summary: byName[norm(LABELS.summary)] || null,
    bodyHtml: byName[norm(LABELS.bodyHtml)] || null,
    featureImage: byName[norm(LABELS.featureImage)] || null,
    publishDate: byName[norm(LABELS.publishDate)] || null
  };
  return SCHEMA_CACHE;
}

function setField(fieldData, def, value, { imageSmall = false } = {}) {
  if (!def || value == null || value === '') return;
  const key = def.key;
  // Image/File fields = object { url }, text/link = string
  if (def.type === 'ImageRef' || def.type === 'File') {
    fieldData[key] = { url: imageSmall ? smallCloudinaryUrl(value) : value };
  } else {
    fieldData[key] = String(value);
  }
}

async function buildFieldData(ui) {
  const schema = await ensureSchema();
  const fd = {};

  // Always
  fd[schema.title.key] = ui.title || 'Untitled Post';
  fd[schema.slug.key] = ui.slug || 'untitled-post';

  // Optional (only if schema says they exist)
  setField(fd, schema.summary, ui.summary);
  setField(fd, schema.bodyHtml, ui.bodyHtml);
  setField(fd, schema.featureImage, ui.featureImageUrl);     // hero image
  setField(fd, schema.publishDate, ui.publishDate);

  // REQUIRED: force exact API keys (bypass labels)
  if (ui.mediaUrl) {
    // 'media-url' is a Link/Text style field → plain string
    fd['media-url'] = String(ui.mediaUrl);
  }
  // Thumbnail is an Image/File → object with { url } (use smaller Cloudinary variant)
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  if (thumbUrl) {
    fd['thumbnail'] = { url: smallCloudinaryUrl(thumbUrl) };
  }

  return fd;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  try {
    const ui = JSON.parse(event.body || '{}');
    const fieldData = await buildFieldData(ui);

    // Enforce presence of the two required fields before calling Webflow
    if (!fieldData['media-url'] || !fieldData['thumbnail']) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Validation: 'media-url' and 'thumbnail' are required. Ensure an image was uploaded."
        })
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
