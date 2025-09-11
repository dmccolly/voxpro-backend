// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18).
// Creates a CMS item and publishes immediately when requested.
// Only sends fields that actually exist in the target collection.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// cache between invocations
let SCHEMA = null;

function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }

// smaller Cloudinary variant for images (safer ingest size)
function smallCloudinaryUrl(url, width=800){
  try{
    if(!url) return url;
    const u = new URL(url);
    if(!/res\.cloudinary\.com/i.test(u.hostname)) return url;
    const p = u.pathname.replace(/\/upload\/(?!.*\/upload\/)/, `/upload/f_auto,q_auto,w_${width}/`);
    return `${u.origin}${p}${u.search}${u.hash}`;
  }catch{ return url; }
}

async function readSchema(){
  if (SCHEMA) return SCHEMA;

  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}`, {
    headers: { Authorization: AUTH_HEADER, accept: 'application/json' }
  });
  if(!r.ok){
    const t = await r.text();
    throw new Error(`Schema read failed: ${r.status} ${t}`);
  }
  const json = await r.json();

  const byKey = {};
  const byName = {};
  for (const f of json.fieldDefinitions || []) {
    byKey[f.key] = f;
    byName[norm(f.name)] = f;
  }

  // Adjust labels if you renamed fields in Webflow
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date',
    mediaUrl: 'Media URL',
    thumbnail: 'Thumbnail'
  };

  SCHEMA = {
    // system keys
    title: { key: 'name', type: 'Plain Text' },
    slug:  { key: 'slug', type: 'Plain Text' },

    // optional fields (present in some collections)
    summary:      byName[norm(LABELS.summary)]      || null,
    bodyHtml:     byName[norm(LABELS.bodyHtml)]     || null,
    featureImage: byName[norm(LABELS.featureImage)] || null,
    publishDate:  byName[norm(LABELS.publishDate)]  || null,

    // these may exist in other collections; only send if present
    mediaUrl:  byKey['media-url']  || byName[norm(LABELS.mediaUrl)]  || null,
    thumbnail: byKey['thumbnail']  || byName[norm(LABELS.thumbnail)] || null,
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

  // required system fields
  fd[s.title.key] = ui.title || 'Untitled Post';
  fd[s.slug.key]  = ui.slug  || 'untitled-post';

  // optional content (only if those fields exist in this collection)
  setField(fd, s.summary,      ui.summary);
  setField(fd, s.bodyHtml,     ui.bodyHtml);
  setField(fd, s.featureImage, ui.featureImageUrl);
  setField(fd, s.publishDate,  ui.publishDate);

  // send media-url / thumbnail only if this collection has them
  setField(fd, s.mediaUrl,  ui.mediaUrl);
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  setField(fd, s.thumbnail, thumbUrl, { imageSmall: true });

  return fd;
}

async function createDraftItem(fieldData){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items?skipInvalidFiles=true`, {
    method:'POST',
    headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
    body: JSON.stringify({ isArchived:false, isDraft:true, fieldData })
  });
  const j = await r.json();
  if(!r.ok) throw Object.assign(new Error('create failed'), { status:r.status, response:j });
  return j;
}

// Create *live* (published) item (v2 has a dedicated endpoint)
async function createLiveItem(fieldData){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items/live?skipInvalidFiles=true`, {
    method:'POST',
    headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
    body: JSON.stringify({ items: [{ isArchived:false, isDraft:false, fieldData }] })
  });
  const j = await r.json();
  if(!r.ok) throw Object.assign(new Error('create live failed'), { status:r.status, response:j });
  return j; // Webflow returns the created item object
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  try {
    const ui = JSON.parse(event.body || '{}');
    const fieldData = await buildFieldData(ui);

    // If status=published, create directly on the live database
    let result;
    if (ui.status === 'published') {
      result = await createLiveItem(fieldData);  // immediate publish :contentReference[oaicite:1]{index=1}
      return { statusCode: 200, body: JSON.stringify({ targetCollectionId: COLLECTION_ID, live: true, item: result }) };
    }

    // otherwise create a draft/staged item
    result = await createDraftItem(fieldData);
    return { statusCode: 200, body: JSON.stringify({ targetCollectionId: COLLECTION_ID, live: false, item: result }) };

  } catch (e) {
    // bubble Webflow’s error detail so the UI shows the real reason (e.g., slug duplicate)
    const body = e.response ? JSON.stringify(e.response) : JSON.stringify({ error: String(e) });
    return { statusCode: e.status || 500, body };
  }
};
