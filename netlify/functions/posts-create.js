// netlify/functions/posts-create.js
// Permanent fix: map UI labels (Summary, Body, Feature Image, Publish Date) to
// the Webflow collection's real field KEYS by reading the schema once and caching.
// Keeps ALL your fields working without hardcoding.

/* Env required (already configured per your debug report):
   - WEBFLOW_COLLECTION_ID
   - WEBFLOW_API_TOKEN
*/
const fetch = require('node-fetch');

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// Cache schema between invocations (Netlify keeps the process warm)
let FIELD_MAP_CACHE = null;

/**
 * Normalize a human label to match the way your UI refers to it.
 * We’ll use this to match incoming UI labels to Webflow schema "name".
 */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load and cache the collection schema, returning a map:
 * {
 *   title:        "name",              // Webflow key for Title (always "name")
 *   slug:         "slug",              // Webflow key for Slug  (always "slug")
 *   summary:      "<key for Summary>", // from schema.name === "Summary"
 *   bodyHtml:     "<key for Body>",    // from schema.name === "Body" (Rich Text)
 *   featureImage: "<key for Feature Image>",
 *   publishDate:  "<key for Publish Date>"
 * }
 *
 * We match by **schema field NAME** visible in Webflow (not the key).
 * If your visible labels differ, update the LABELS object below to whatever your UI uses.
 */
async function ensureFieldMap() {
  if (FIELD_MAP_CACHE) return FIELD_MAP_CACHE;

  // Adjust these if your visible CMS field names are different
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date'
  };

  const res = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}`, {
    headers: { Authorization: AUTH_HEADER, accept: 'application/json' }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to read collection schema: ${res.status} ${txt}`);
  }
  const schema = await res.json();

  // Build a lookup from normalized field "name" -> key and type
  const byName = {};
  for (const f of schema.fieldDefinitions || []) {
    byName[norm(f.name)] = { key: f.key, type: f.type };
  }

  // Required “special” keys that are always present
  const map = {
    title: 'name',
    slug: 'slug',
    summary: null,
    bodyHtml: null,
    featureImage: null,
    publishDate: null
  };

  // Resolve optional fields by label
  for (const k of ['summary', 'bodyHtml', 'featureImage', 'publishDate']) {
    const label = LABELS[k];
    const hit = byName[norm(label)];
    if (hit) map[k] = hit.key;
  }

  FIELD_MAP_CACHE = map;
  return map;
}

/**
 * Build Webflow fieldData from incoming UI JSON using the resolved schema map.
 * Only includes fields that exist in the collection.
 */
async function buildFieldData(ui) {
  const map = await ensureFieldMap();

  // Title/Slug (always)
  const fieldData = {
    [map.title]: ui.title || 'Untitled Post',
    [map.slug]: ui.slug || 'untitled-post'
  };

  // Optional: Summary (plain text)
  if (map.summary && ui.summary) {
    fieldData[map.summary] = ui.summary;
  }

  // Optional: Body (Rich Text) — Webflow accepts HTML string for rich text fields
  if (map.bodyHtml && ui.bodyHtml) {
    fieldData[map.bodyHtml] = ui.bodyHtml;
  }

  // Optional: Feature Image — pass a public https URL, Webflow will ingest
  if (map.featureImage && ui.featureImageUrl) {
    fieldData[map.featureImage] = { url: ui.featureImageUrl };
  }

  // Optional: Publish Date — ISO 8601 (e.g., 2025-09-10T15:00:00-06:00)
  if (map.publishDate && ui.publishDate) {
    fieldData[map.publishDate] = ui.publishDate;
  }

  return fieldData;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  try {
    const ui = JSON.parse(event.body || '{}');

    // Compose fieldData from UI using the live schema keys
    const fieldData = await buildFieldData(ui);

    const payload = {
      isArchived: false,
      isDraft: ui.status !== 'published',
      fieldData
    };

    const resp = await fetch(
      `${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: AUTH_HEADER,
          'Content-Type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const json = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify(json) };
    }

    return { statusCode: 200, body: JSON.stringify(json) };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
