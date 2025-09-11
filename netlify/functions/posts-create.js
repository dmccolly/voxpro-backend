// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18).
// Creates the CMS item, enforces required fields, then PUBLISHES the item (v2 requires a second call).
// Also keeps your 'media-url' (string) and 'thumbnail' ({url}) logic with a safe Cloudinary size for ingest.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// Cache for optional schema lookups (summary/body/featureImage/publishDate)
let SCHEMA_CACHE = null;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Make Cloudinary thumbs smaller (<~4MB) for Webflow ingestion
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
  for (const f of schema.fieldDefinitions || []) byName[norm(f.name)] = f;

  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date'
  };

  SCHEMA_CACHE = {
    // system keys
    title: { key: 'name', type: 'Plain Text' },
    slug: { key: 'slug', type: 'Plain Text' },
    // optional content fields (only if present in your collection)
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
  if (def.type === 'ImageRef' || def.type === 'File') {
    fieldData[key] = { url: imageSmall ? smallCloudinaryUrl(value) : value };
  } else {
    fieldData[key] = String(value);
  }
}

async function buildFieldData(ui) {
  const schema = await ensureSchema();
  const fd = {};

  // Always include title/slug
  fd[schema.title.key] = ui.title || 'Untitled Post';
  fd[schema.slug.key] = ui.slug || 'untitled-post';

  // Optional fields (only if this collection actually has them)
  setField(fd, schema.summary, ui.summary);
  setField(fd, schema.bodyHtml, ui.bodyHtml);
  setField(fd, schema.featureImage, ui.featureImageUrl);
  setField(fd, schema.publishDate, ui.publishDate);

  // REQUIRED (force exact API keys expected by your collection)
  // 'media-url' is a text/link style field -> send a plain string
  if (ui.mediaUrl) fd['media-url'] = String(ui.mediaUrl);
  // 'thumbnail' is an image/file -> send { url } (downsized for safe ingest)
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  if (thumbUrl) fd['thumbnail'] = { url: smallCloudinaryUrl(thumbUrl) };

  return fd;
}

// Publish items (v2 requires this separate call)
async function publishItems(collectionId, itemIds) {
  const resp = await fetch(`${WEBFLOW_BASE}/collections/${collectionId}/items/publish`, {
    method: 'POST',
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({ itemIds })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Publish failed ${resp.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  try {
    const ui = JSON.parse(event.body || '{}');

    // 1) Build the field payload
    const fieldData = await buildFieldData(ui);

    // Enforce presence of required fields before calling Webflow
    if (!fieldData['media-url'] || !fieldData['thumbnail']) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Validation: 'media-url' and 'thumbnail' are required. Upload an image so these auto-fill."
        })
      };
    }

    // 2) Create the item (staged)
    const createResp = await fetch(
      `${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items?skipInvalidFiles=true`,
      {
        method: 'POST',
        headers: {
          Authorization: AUTH_HEADER,
          'Content-Type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          isArchived: false,
          isDraft: ui.status !== 'published', // draft unless explicitly publishing now
          fieldData
        })
      }
    );

    const created = await createResp.json();
    if (!createResp.ok) {
      return { statusCode: createResp.status, body: JSON.stringify(created) };
    }

    // 3) If this was a "Publish Now", publish the staged item to live
    let published = null;
    if (ui.status === 'published') {
      try {
        published = await publishItems(COLLECTION_ID, [created.id]); // publish the just-created item
      } catch (e) {
        // Surface publish error but still return the created item so you can debug
        return {
          statusCode: 502,
          body: JSON.stringify({ error: String(e), created })
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ created, published })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
