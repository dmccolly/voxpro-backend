// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18).
// Creates a LIVE CMS item (when status === 'published') and reliably maps your
// Blog Posts fields: Feature Image, Summary (Rich text), Body (Rich text), Publish Date.
// Field discovery is resilient: by label, by slug, and by type fallback.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// cache schema between invocations
let SCHEMA = null;

function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }

// Safer Cloudinary variant for thumbnails/ingest if you ever use it later
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
  const txt = await r.text();
  if(!r.ok) throw new Error(`Schema read failed: ${r.status} ${txt}`);
  const json = JSON.parse(txt);

  const defs = json.fieldDefinitions || [];

  // index by slug (key) and by visible label (name)
  const byKey = Object.fromEntries(defs.map(f => [f.key, f]));
  const byName = Object.fromEntries(defs.map(f => [norm(f.name), f]));

  // helpers to find by label or by a slug guess
  const find = (label, slugGuesses = [], type = null) => {
    if (label && byName[norm(label)]) return byName[norm(label)];
    for (const g of slugGuesses) if (byKey[g]) return byKey[g];
    if (type) return defs.find(f => f.type === type) || null; // type fallback
    return null;
  };

  // try common slugs for resilience
  const summary = find('Summary', ['summary'], 'RichText');
  const body    = find('Body',    ['body','post-body','content','rich-text','body-html'], 'RichText');
  const featImg = find('Feature Image', ['main-image','feature-image','hero','image'], 'ImageRef');
  const pubDate = find('Publish Date',  ['publish-date','date','date-published'], 'DateTime');

  // sometimes other collections require these; send only if present
  const mediaUrl = byKey['media-url'] || byName['media url'] || null;
  const thumbnail = byKey['thumbnail'] || byName['thumbnail'] || null;

  SCHEMA = {
    defs, byKey, byName,
    title: { key: 'name', type: 'Plain Text' },
    slug:  { key: 'slug', type: 'Plain Text' },
    summary, bodyHtml: body, featureImage: featImg, publishDate: pubDate,
    mediaUrl, thumbnail
  };
  return SCHEMA;
}

function setField(fd, def, value, { imageSmall=false } = {}){
  if (!def || value == null || value === '') return;
  if (def.type === 'ImageRef' || def.type === 'File') {
    fd[def.key] = { url: imageSmall ? smallCloudinaryUrl(value) : value };
  } else {
    // Rich Text in v2 accepts an HTML string
    fd[def.key] = String(value);
  }
}

async function buildFieldData(ui){
  const s = await readSchema();
  const fd = {};

  // required system fields
  fd[s.title.key] = ui.title || 'Untitled Post';
  fd[s.slug.key]  = ui.slug  || 'untitled-post';

  // optional content (only if those fields exist for THIS collection)
  setField(fd, s.summary,      ui.summary);                 // plain string OK
  setField(fd, s.bodyHtml,     ui.bodyHtml);                // HTML from Quill
  setField(fd, s.featureImage, ui.featureImageUrl);         // image url
  setField(fd, s.publishDate,  ui.publishDate);             // ISO string

  // only send these if the collection actually has them
  setField(fd, s.mediaUrl, ui.mediaUrl || ui.featureImageUrl);
  setField(fd, s.thumbnail, ui.thumbnailUrl || ui.featureImageUrl, { imageSmall: true });

  return { fd, s };
}

// Create LIVE (single item object body)
async function createLive(fieldData){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items/live?skipInvalidFiles=true`, {
    method:'POST',
    headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
    body: JSON.stringify({ isArchived:false, isDraft:false, fieldData }) // single-item shape
  });
  const txt = await r.text();
  const json = tryJson(txt);
  if (!r.ok) throw Object.assign(new Error('create live failed'), { status:r.status, response:json });
  return json;
}

// Create STAGED draft
async function createDraft(fieldData){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items?skipInvalidFiles=true`, {
    method:'POST',
    headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
    body: JSON.stringify({ isArchived:false, isDraft:true, fieldData })
  });
  const txt = await r.text();
  const json = tryJson(txt);
  if (!r.ok) throw Object.assign(new Error('create failed'), { status:r.status, response:json });
  return json;
}

function tryJson(t){ try{ return JSON.parse(t); } catch { return { _raw: String(t).slice(0,400) }; } }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  try {
    const ui = JSON.parse(event.body || '{}');

    // build fieldData with resilient mapping
    const { fd, s } = await buildFieldData(ui);

    // if publishing now and Publish Date exists but is empty, auto-fill now
    if (ui.status === 'published' && s.publishDate && !fd[s.publishDate.key]) {
      fd[s.publishDate.key] = new Date().toISOString();
    }

    const item = (ui.status === 'published') ? await createLive(fd) : await createDraft(fd);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        targetCollectionId: COLLECTION_ID,
        sentKeys: Object.keys(fd),        // helps verify what we populated
        item
      })
    };
  } catch (e) {
    // bubble the real Webflow error
    return { statusCode: e.status || 500, body: JSON.stringify(e.response || { error: String(e) }) };
  }
};
