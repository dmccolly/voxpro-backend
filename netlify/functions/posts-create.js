// netlify/functions/posts-create.js
// CommonJS + global fetch (Node 18).
// Creates the item, then PUBLISHES it (API v2 requires a second call).
// Auto-detects which fields exist in the target collection; only sends those.
// Handles optional 'media-url' and 'thumbnail' if that collection has them.

const WEBFLOW_BASE = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const AUTH_HEADER = `Bearer ${process.env.WEBFLOW_API_TOKEN}`;

// cache between invocations
let SCHEMA = null;

function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }

// safer Cloudinary variant for thumbnails (keeps under ingest limits)
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

  // visible labels (adjust if you renamed in Webflow)
  const LABELS = {
    summary: 'Summary',
    bodyHtml: 'Body',
    featureImage: 'Feature Image',
    publishDate: 'Publish Date',
    mediaUrl: 'Media URL',
    thumbnail: 'Thumbnail'
  };

  SCHEMA = {
    // system keys (always exist)
    title: { key: 'name', type: 'Plain Text' },
    slug: { key: 'slug', type: 'Plain Text' },

    // optional fields (exist in some collections)
    summary:     byName[norm(LABELS.summary)]     || null,
    bodyHtml:    byName[norm(LABELS.bodyHtml)]    || null,
    featureImage:byName[norm(LABELS.featureImage)]|| null,
    publishDate: byName[norm(LABELS.publishDate)] || null,

    // these may or may not exist depending on collection
    mediaUrl:  byKey['media-url']  || byName[norm(LABELS.mediaUrl)]  || null,
    thumbnail: byKey['thumbnail']  || byName[norm(LABELS.thumbnail)] || null,
  };

  return SCHEMA;
}

function setField(fd, def, value, {imageSmall=false}={}){
  if(!def || value==null || value==='') return;
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
  fd[s.slug.key]  = ui.slug || 'untitled-post';

  // optional content
  setField(fd, s.summary, ui.summary);
  setField(fd, s.bodyHtml, ui.bodyHtml);
  setField(fd, s.featureImage, ui.featureImageUrl);
  setField(fd, s.publishDate, ui.publishDate);

  // only send media-url/thumbnail if those fields exist in THIS collection
  if (s.mediaUrl && ui.mediaUrl) {
    setField(fd, s.mediaUrl, ui.mediaUrl);
  }
  const thumbUrl = ui.thumbnailUrl || ui.featureImageUrl || '';
  if (s.thumbnail && thumbUrl) {
    setField(fd, s.thumbnail, thumbUrl, { imageSmall: true });
  }

  return { fd, s };
}

async function publishItems(collectionId, itemIds){
  const r = await fetch(`${WEBFLOW_BASE}/collections/${collectionId}/items/publish`, {
    method:'POST',
    headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
    body: JSON.stringify({ itemIds })
  });
  const j = await r.json().catch(()=> ({}));
  if(!r.ok) throw new Error(`Publish failed ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  try {
    const ui = JSON.parse(event.body || '{}');

    // Build fields for the target collection
    const { fd, s } = await buildFieldData(ui);

    // create
    const createRes = await fetch(
      `${WEBFLOW_BASE}/collections/${COLLECTION_ID}/items?skipInvalidFiles=true`,
      {
        method:'POST',
        headers:{ Authorization: AUTH_HEADER, 'Content-Type':'application/json', accept:'application/json' },
        body: JSON.stringify({ isArchived:false, isDraft: ui.status !== 'published', fieldData: fd })
      }
    );
    const created = await createRes.json();
    if(!createRes.ok){
      return { statusCode: createRes.status, body: JSON.stringify({ error:'Create failed', detail: created, targetCollectionId: COLLECTION_ID }) };
    }

    // publish if requested
    let published = null;
    if (ui.status === 'published') {
      published = await publishItems(COLLECTION_ID, [created.id]);
    }

    // helpful debug in response
    return {
      statusCode: 200,
      body: JSON.stringify({
        targetCollectionId: COLLECTION_ID,
        created: { id: created.id, slug: created.fieldData?.slug, lastPublished: created.lastPublished || null },
        published
      })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, targetCollectionId: COLLECTION_ID }) };
  }
};
