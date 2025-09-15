// Update Webflow v2 item; PATCH body: { id, fieldData:{...}, isDraft?:bool, isArchived?:bool }
// Optional ?publish=true to publish after update.
const ALLOW = 'https://app.streamofdan.com';
const resJSON = (code, obj) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': ALLOW,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,PATCH',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resJSON(200, { ok: true });
  if (event.httpMethod !== 'PATCH') return resJSON(405, { error: 'Method Not Allowed' });

  const token = process.env.WEBFLOW_API_TOKEN;
  const coll  = process.env.WEBFLOW_COLLECTION_ID;
  if (!token || !coll) return resJSON(500, { error: 'Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID' });

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch { return resJSON(400, { error: 'Invalid JSON body' }); }

  const { id, fieldData = {}, isDraft = false, isArchived = false } = payload;
  if (!id) return resJSON(400, { error: 'id is required' });

  const updateURL = `https://api.webflow.com/v2/collections/${coll}/items/${id}`;
  try {
    const updRes = await fetch(updateURL, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isArchived, isDraft, fieldData })
    });
    const updText = await updRes.text();
    if (!updRes.ok) {
      return resJSON(updRes.status, { error: 'Webflow update failed', status: updRes.status, body_preview: updText.slice(0,2000) });
    }
    const updated = JSON.parse(updText);

    const publish = (event.queryStringParameters || {}).publish === 'true';
    if (publish) {
      const pubURL = `https://api.webflow.com/v2/collections/${coll}/items/${id}/publish`;
      const pubRes = await fetch(pubURL, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const pubText = await pubRes.text();
      if (!pubRes.ok) {
        return resJSON(pubRes.status, { error: 'Webflow publish failed', status: pubRes.status, body_preview: pubText.slice(0,2000), item: updated });
      }
      return resJSON(200, { ok: true, item: updated, published: true });
    }

    return resJSON(200, { ok: true, item: updated, published: false });
  } catch (e) {
    return resJSON(502, { error: 'Update exception', detail: String(e) });
  }
};
