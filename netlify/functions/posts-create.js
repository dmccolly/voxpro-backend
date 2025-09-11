// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18).
// Creates a CMS item (live if requested). Sends only fields that exist in the
// target collection, including 'media-url' and 'thumbnail' WHEN those keys exist.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

let SCHEMA = null;

function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }

// Use a smaller Cloudinary variant for safer ingest
function smallCloudinaryUrl(url, width=800){
  try {
    if(!url) return url;
    const u = new URL(url);
    if(!/res\.cloudinary\.com/i.test(u.hostname)) return url;
    const p = u.pathname.replace(/\/upload\/(?!.*\/upload\/)/, `/upload/f_auto,q_auto,w_${width}/`);
    return `${u.origin}${p}${u.search}${u.hash}`;
  } catch { return url; }
}

async function readSchema(){
  if (SCHEMA) return SCHEMA;
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}`, {
    headers: { Authorization: AUTH_HEADER, accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`Schema read failed: ${r.status} ${await r.text()}`);
  const json = await r.json();

  const byKey = {};
  const byName = {};
  for (const f of json.fieldDefinitions || []) {
    byKey[f.key] = f;
    byName[norm(f.name)] = f;
  }

  // Adjust labels below only if you renamed fields in Webflow
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date'
  };

  SCHEMA = {
    byKey,
    // core keys always exist
    title: { key: 'name', type: 'Plain Text' },
    slug:  { key: 'slug', type: 'Plain Text' },
    // optional content
    summary:      byName[norm(LABELS.summary)]      || null,
    bodyHtml:     byName[norm(LABELS.bodyHtml)]     || null,
    featureImage: byName[norm(LABELS.featureImage)] || null,
    publishDate:  byName[norm(LABELS.publishDate)]  || null,
    // these keys may exist in some collections (e.g., the older one you used)
    mediaUrl:  byKey['media-url']  || null,
    thumbnail: byKey['thumbnail']  || null
  };
  return SCHEMA;
}

function setField(fd, def, value, { imageSmall=false } = {}){
  if (!def || value == null || value === '') return;
  if (def.type === 'ImageRef' || def.type === 'File') {
    fd[def.key] = { url: imageSmall ? smallCloudinaryUrl(value) : value };
  } else {
    fd[def.key] = String(value);
  }
}

async function buildFieldData(ui){
  const s = await readSchema();
  const fd = {};

  // always include system fields
  fd[s.title.key] = ui.title || 'Untitled Post';
  fd[s.slug.key]  = ui.slug  || 'untitled-post';

  // optional content (only if present in this collection)
  setField(fd, s.summary,      ui.summary);
  setField(fd, s.bodyHtml,     ui.bodyHtml);
  setField(fd, s.featureImage, ui.featureImageUrl);
  setField(fd, s.publishDate,  ui.publishDate);

  // media-url: ONLY send if this collection actually has the key
  // value source: explicit ui.mediaUrl, else hero image URL
  const mediaVal = ui.mediaUrl || ui.featureImageUrl || '';
  if (s.mediaUrl && mediaVal) setField(fd, s.mediaUrl, mediaVal);

  // thumbnail: ONLY send if this collection has the key (use hero image by default)
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  if (s.thumbnail && thumbUrl) setField(fd, s.thumbnail, thumbUrl, { imageSmall: true });

  return { fd, schema: s };
}

async function createDraftItem(fieldData){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items?skipInvalidFiles=true`, {
    method: 'POST',
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ isArchived: false, isDraft: true, fieldData })
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error('create failed'), { status: r.status, response: j });
  return j;
}

// Create LIVE item (immediately published)
async function createLiveItem(fieldData){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items/live?skipInvalidFiles=true`, {
    method: 'POST',
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ items: [{ isArchived: false, isDraft: false, fieldData }] })
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error('create live failed'), { status: r.status, response: j });
  return j;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  try {
    const ui = JSON.parse(event.body || '{}');
    const { fd, schema } = await buildFieldData(ui);

    // if this collection expects media-url/thumbnail and we couldn't derive them, fail early with specifics
    if (schema.mediaUrl && !fd[schema.mediaUrl.key]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Validation: 'media-url' is required for this collection." }) };
    }
    if (schema.thumbnail && !fd[schema.thumbnail.key]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Validation: 'thumbnail' is required for this collection." }) };
    }

    const result = (ui.status === 'published')
      ? await createLiveItem(fd)   // one-call publish
      : await createDraftItem(fd); // draft

    return {
      statusCode: 200,
      body: JSON.stringify({
        targetCollectionId: COLLECTION_ID,
        sentKeys: Object.keys(fd),
        live: ui.status === 'published',
        item: result
      })
    };

  } catch (e) {
    const body = e.response ? JSON.stringify(e.response) : JSON.stringify({ error: String(e) });
    return { statusCode: e.status || 500, body };
  }
};
