// netlify/functions/blog-posts-create.js
// Creates a Webflow item with v2 API. Expects JSON { fieldData: {...}, isDraft?:bool, isArchived?:bool }
// Optional ?publish=true will publish the created item.

const ALLOW = 'https://app.streamofdan.com';

const resJSON = (code, obj) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': ALLOW,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resJSON(200, { ok: true });
  if (event.httpMethod !== 'POST') return resJSON(405, { error: 'Method Not Allowed' });

  const token = process.env.WEBFLOW_API_TOKEN;
  const coll  = process.env.WEBFLOW_COLLECTION_ID;
  if (!token || !coll) return resJSON(500, { error: 'Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return resJSON(400, { error: 'Invalid JSON body' }); }

  const fieldData = payload.fieldData || {};
  const isDraft = typeof payload.isDraft === 'boolean' ? payload.isDraft : false;
  const isArchived = typeof payload.isArchived === 'boolean' ? payload.isArchived : false;

  // REQUIRED FIELDS for Webflow CMS: name and slug at minimum
  if (!fieldData.name) return resJSON(400, { error: 'fieldData.name is required' });
  if (!fieldData.slug) {
    fieldData.slug = String(fieldData.name).toLowerCase().trim().replace(/[^\w\- ]+/g,'').replace(/\s+/g,'-');
  }

  const createURL = `https://api.webflow.com/v2/collections/${coll}/items`;
  try {
    const createRes = await fetch(createURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isArchived, isDraft, fieldData })
    });
    const createText = await createRes.text();
    if (!createRes.ok) {
      return resJSON(createRes.status, { error: 'Webflow create failed', status: createRes.status, body_preview: createText.slice(0,2000) });
    }
    const created = JSON.parse(createText);
    const itemId = created?.id;

    // Optional publish flow
    const publish = (event.queryStringParameters || {}).publish === 'true';
    if (publish && itemId) {
      const publishURL = `https://api.webflow.com/v2/collections/${coll}/items/${itemId}/publish`;
      const pubRes = await fetch(publishURL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
      const pubText = await pubRes.text();
      if (!pubRes.ok) {
        return resJSON(pubRes.status, { error: 'Webflow publish failed', status: pubRes.status, body_preview: pubText.slice(0,2000), item: created });
      }
      return resJSON(200, { ok: true, item: created, published: true });
    }

    return resJSON(200, { ok: true, item: created, published: false });
  } catch (e) {
    return resJSON(502, { error: 'Create exception', detail: String(e) });
  }
};
