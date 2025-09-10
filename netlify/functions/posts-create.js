// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18 on Netlify). No node-fetch.
// Reads the Webflow CMS schema, maps visible labels to keys, and
// *correctly shapes* values by field type (Image/File vs Link/Text).
// Also ensures thumbnail is under 4MB by using a smaller Cloudinary variant.
//
// Docs: Image/File fields accept an object with { url } (or fileId). Max 4MB. 
// https://developers.webflow.com/data/reference/field-types-item-values

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// Warm cache between invocations
let SCHEMA_CACHE = null;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// If it's a Cloudinary URL, return a smaller/optimized variant.
// e.g. .../image/upload/v123/abc.jpg -> .../image/upload/f_auto,q_auto,w_800/v123/abc.jpg
function smallCloudinaryUrl(url, width = 800) {
  try {
    if (!url) return url;
    const u = new URL(url);
    if (!/res\.cloudinary\.com/i.test(u.hostname)) return url;
    const replaced = u.pathname.replace(
      /\/upload\/(?!.*\/upload\/)/,
      `/upload/f_auto,q_auto,w_${width}/`
    );
    return `${u.origin}${replaced}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

// Build a quick lookup by *key* and by *name*
function indexFields(fieldDefs) {
  const byKey = {};
  const byName = {};
  for (const f of fieldDefs || []) {
    byKey[f.key] = f;
    byName[norm(f.name)] = f;
  }
  return { byKey, byName };
}

// Read and cache schema; return helpers + our label→key map.
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
  const { byKey, byName } = indexFields(schema.fieldDefinitions);

  // Update these labels if your visible Webflow field names differ.
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date',
    mediaUrl: 'Media URL',
    thumbnail: 'Thumbnail'
  };

  const map = {
    title: { key: 'name', type: 'Plain Text' },
    slug: { key: 'slug', type: 'Plain Text' },
    summary: byName[norm(LABELS.summary)] || null,
    bodyHtml: byName[norm(LABELS.bodyHtml)] || null,
    featureImage: byName[norm(LABELS.featureImage)] || null,
    publishDate: byName[norm(LABELS.publishDate)] || null,
    mediaUrl: byName[norm(LABELS.mediaUrl)] || null,
    thumbnail: byName[norm(LABELS.thumbnail)] || null,
    // Hard fallbacks by *key* in case matching by label ever misses
    fallback: {
      mediaUrl: byKey['media-url'] || null,
      thumbnail: byKey['thumbnail'] || null
    },
    byKey,
    byName
  };

  SCHEMA_CACHE = map;
  return map;
}

// Assign a value to fieldData with correct shape for the field's *type*.
function setField(fieldData, fieldDef, value, { isImageLikeSmall = false } = {}) {
  if (!fieldDef || value == null || value === '') return;

  const key = fieldDef.key;
  const type = fieldDef.type;

  // Image/File fields accept an object with { url } (or fileId) — 4MB max via URL.
  // Link/Text-like fields accept a string.
  if (type === 'ImageRef' || type === 'File') {
    const url = isImageLikeSmall ? smallCloudinaryUrl(value) : value;
    fieldData[key] = { url };
  } else {
    fieldData[key] = String(value);
  }
}

async function buildFieldData(ui) {
  const schema = await ensureSchema();
  const fd = {};

  // Always include title/slug
  setField(fd, schema.title, ui.title || 'Untitled Post');
  setField(fd, schema.slug, ui.slug || 'untitled-post');

  // Optional textual fields
  if (schema.summary) setField(fd, schema.summary, ui.summary);
  if (schema.bodyHtml) setField(fd, schema.bodyHtml, ui.bodyHtml);

  // Feature image (use exact URL provided)
  if (schema.featureImage && ui.featureImageUrl) {
    setField(fd, schema.featureImage, ui.featureImageUrl);
  }

  // Thumbnail: prefer explicit ui.thumbnailUrl, else reuse featureImageUrl.
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  const thumbDef = schema.thumbnail || schema.fallback.thumbnail;
  if (thumbDef && thumbUrl) {
    // Force a smaller Cloudinary variant to stay under 4MB for ingestion.
    setField(fd, thumbDef, thumbUrl, { isImageLikeSmall: true });
  }

  // Publish date (ISO string)
  if (schema.publishDate && ui.publishDate) {
    setField(fd, schema.publishDate, ui.publishDate);
  }

  // Media URL (plain URL or file, depending on your field type)
  const mediaDef = schema.mediaUrl || schema.fallback.mediaUrl;
  if (mediaDef && ui.mediaUrl) {
    setField(fd, mediaDef, ui.mediaUrl);
  }

  return { fd, schema };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  try {
    const ui = JSON.parse(event.body || '{}');

    const { fd, schema } = await buildFieldData(ui);

    // Enforce requireds we know about: mediaUrl & thumbnail
    const mediaKey = (schema.mediaUrl || schema.fallback.mediaUrl)?.key;
    const thumbKey = (schema.thumbnail || schema.fallback.thumbnail)?.key;

    if (mediaKey && !fd[mediaKey]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Validation Error: 'Media URL' is required." }) };
    }
    if (thumbKey && !fd[thumbKey]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Validation Error: 'Thumbnail' is required." }) };
    }

    const payload = {
      isArchived: false,
      isDraft: ui.status !== 'published',
      fieldData: fd
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
      // Surface detailed API error for quick troubleshooting
      return { statusCode: resp.status, body: JSON.stringify(json) };
    }
    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
