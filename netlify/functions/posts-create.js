// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18).
// Creates a CMS item (live if requested), sends ONLY fields that exist
// in the target collection, retries once on duplicate slug, and returns
// FULL Webflow validation details so you can see exactly what's wrong.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

let SCHEMA = null;

function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function nowSuffix(){ return ('-' + Date.now().toString().slice(-5)); }

// Safer (smaller) Cloudinary variant for API ingest if needed later
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
  const text = await r.text();
  if(!r.ok) throw new Error(`Schema read failed: ${r.status} ${text}`);
  const json = JSON.parse(text);

  const byKey = {}, byName = {};
  for (const f of json.fieldDefinitions || []) {
    byKey[f.key] = f; byName[norm(f.name)] = f;
  }

  // Adjust labels only if you renamed them in Webflow
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date',
    mediaUrl: 'Media URL',     // optional (some collections)
    thumbnail: 'Thumbnail'     // optional (some collections)
  };

  SCHEMA = {
    byKey,
    title: { key: 'name', type: 'Plain Text' }, // always exists
    slug:  { key: 'slug', type: 'Plain Text' }, // always exists
    summary:      byName[norm(LABELS.summary)]      || null,
    bodyHtml:     byName[norm(LABELS.bodyHtml)]     || null,
    featureImage: byName[norm(LABELS.featureImage)] || null,
    publishDate:  byName[norm(LABELS.publishDate)]  || null,
    mediaUrl:     byKey['media-url']  || byName[norm(LABELS.mediaUrl)]  || null,
    thumbnail:    byKey['thumbnail']  || byName[norm(LABELS.thumbnail)] || null
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

  // Required system fields
  fd[s.title.key] = ui.title || 'Untitled Post';
  fd[s.slug.key]  = ui.slug  || 'untitled-post';

  // Optional content — send only if the field exists in this collection
  setField(fd, s.summary,      ui.summary);
  setField(fd, s.bodyHtml,     ui.bodyHtml);
  setField(fd, s.featureImage, ui.featureImageUrl);
  setField(fd, s.publishDate,  ui.publishDate);

  // media-url (only if the key exists in this collection)
  const mediaVal = ui.mediaUrl || ui.featureImageUrl || '';
  setField(fd, s.mediaUrl, mediaVal);

  // thumbnail (only if the key exists)
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  setField(fd, s.thumbnail, thumbUrl, { imageSmall: true });

  return { fd, schema: s };
}

async function createOrPublish(fieldData, publishNow){
  // Create LIVE item (published immediately) uses a different endpoint/shape
  if (publishNow) {
    const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items/live?skipInvalidFiles=true`, {
      method:'POST',
      headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
      body: JSON.stringify({ items: [{ isArchived:false, isDraft:false, fieldData }] })
    });
    const txt = await r.text();
    const json = tryJson(txt);
    return { ok: r.ok, status: r.status, json, raw: txt, endpoint: 'live' };
  }

  // Create DRAFT (staged) item
  const r = await fetch(`${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items?skipInvalidFiles=true`, {
    method:'POST',
    headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
    body: JSON.stringify({ isArchived:false, isDraft:true, fieldData })
  });
  const txt = await r.text();
  const json = tryJson(txt);
  return { ok: r.ok, status: r.status, json, raw: txt, endpoint: 'staged' };
}

function tryJson(t){ try{ return JSON.parse(t); } catch { return { _unparsed: String(t).slice(0,500) }; } }

// Retry once with a unique slug if Webflow says the slug is already used
function looksLikeSlugConflict(objOrText){
  const s = typeof objOrText === 'string' ? objOrText : JSON.stringify(objOrText);
  return /slug/i.test(s) && /(already|in use|must be unique)/i.test(s);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  try {
    const ui = JSON.parse(event.body || '{}');
    const publishNow = ui.status === 'published';

    const { fd, schema } = await buildFieldData(ui);
    const slugKey = schema.slug.key;

    // 1st attempt
    let attempt = await createOrPublish(fd, publishNow);
    if (!attempt.ok && looksLikeSlugConflict(attempt.json || attempt.raw)) {
      // Auto-unique the slug and retry once
      fd[slugKey] = (fd[slugKey] || 'untitled-post') + nowSuffix();
      attempt = await createOrPublish(fd, publishNow);
    }

    if (!attempt.ok) {
      // Return the exact error + what we sent, so you can act on it immediately
      return {
        statusCode: attempt.status || 400,
        body: JSON.stringify({
          error: 'webflow_validation_failed',
          targetCollectionId: COLLECTION_ID,
          endpoint: attempt.endpoint,
          sentFieldKeys: Object.keys(fd),
          sentPreview: pick(fd, [schema.title.key, schema.slug.key]), // small preview
          webflow: attempt.json
        })
      };
    }

    // Success — return minimal details and what collection we hit
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        targetCollectionId: COLLECTION_ID,
        endpoint: attempt.endpoint,
        item: attempt.json
      })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e), targetCollectionId: COLLECTION_ID }) };
  }
};

function pick(obj, keys){
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
