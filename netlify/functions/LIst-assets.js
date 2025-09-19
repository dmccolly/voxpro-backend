// netlify/functions/list-assets.js
// CommonJS + global fetch (Node 18+). No ESM exports/imports, no node-fetch needed.

exports.handler = async function (event, context) {
  const env = process.env;
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    WEBFLOW_ALLOW_ORIGIN,
    XANO_API_BASE,
    XANO_API_KEY,
    XANO_ASSETS_ENDPOINT = '/assets',
    XANO_BATCH_ENDPOINT
  } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return resJSON({ error: 'Missing Cloudinary env vars' }, 500, WEBFLOW_ALLOW_ORIGIN);
  }

  // ----- Query params -----
  const q = event.queryStringParameters || {};
  const expression = q.expression || '';
  const type = q.type || '';
  const sort = q.sort || '-created_at'; // e.g. "-created_at" for descending
  const next_cursor = q.cursor || undefined;
  const max_results = Math.min(parseInt(q.max || '80', 10), 500);

  const base = type
    ? `resource_type:${type}`
    : '(resource_type:image OR resource_type:video OR resource_type:raw)';
  const finalExpr = expression ? `${base} AND (${expression})` : base;

  const sortField = String(sort).replace(/^-/, '');
  const sortOrder = sort.startsWith('-') ? 'desc' : 'asc';

  const clBody = {
    expression: finalExpr,
    with_field: ['context', 'tags'],
    sort_by: [{ [sortField]: sortOrder }],
    max_results
  };
  if (next_cursor) clBody.next_cursor = next_cursor;

  // ----- Cloudinary auth header -----
  const clAuth =
    typeof btoa === 'function'
      ? btoa(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`)
      : Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');

  // ----- Call Cloudinary -----
  let cloudinary;
  try {
    const clRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${clAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clBody)
      }
    );
    if (!clRes.ok) {
      return resJSON(
        { error: 'Cloudinary search failed', detail: await clRes.text() },
        502,
        WEBFLOW_ALLOW_ORIGIN
      );
    }
    cloudinary = await clRes.json();
  } catch (err) {
    return resJSON({ error: 'Cloudinary request error', detail: String(err) }, 500, WEBFLOW_ALLOW_ORIGIN);
  }

  const resources = (cloudinary.resources || []).map(simplifyCL);

  // ----- Optional Xano enrichment -----
  let xanoMap = {};
  if (XANO_API_BASE) {
    try {
      // dynamic import so this file works whether _xano.js is ESM or CJS
      const xanoMod = await import(new URL('./_xano.js', `file://${__dirname}/`).href).catch(async () => {
        // fallback for local resolution differences
        return await import('./_xano.js');
      });

      const {
        fields,
        getXanoHeaders,
        mapXanoRecord,
        batchGetByPublicIds,
        findByPublicId
      } = xanoMod;

      const headers = getXanoHeaders(env);

      if (XANO_BATCH_ENDPOINT) {
        const arr = await batchGetByPublicIds(
          XANO_API_BASE,
          XANO_BATCH_ENDPOINT,
          headers,
          resources.map((r) => r.public_id)
        );
        xanoMap = indexBy(arr.map(mapXanoRecord).filter(Boolean), (x) => x.public_id);
      } else {
        const settled = await Promise.all(
          resources.map(async (r) => {
            const rec = await findByPublicId(XANO_API_BASE, XANO_ASSETS_ENDPOINT, headers, r.public_id);
            return rec ? mapXanoRecord(rec) : null;
          })
        );
        xanoMap = indexBy(settled.filter(Boolean), (x) => x.public_id);
      }
    } catch (err) {
      console.warn('Xano enrichment failed', err);
      // Continue without enrichment
    }
  }

  const merged = resources.map((r) => {
    const xm = xanoMap[r.public_id];
    if (!xm) return r;
    return {
      ...r,
      title: xm.title || r.title,
      description: xm.description || r.description,
      station: xm.station || r.station,
      collection_id: xm.collection_id,
      categories: xm.categories,
      xano_id: xm.id,
      tags: normalizeTags(r.tags, xm.tags)
    };
  });

  return resJSON(
    { resources: merged, next_cursor: cloudinary.next_cursor || null },
    200,
    WEBFLOW_ALLOW_ORIGIN
  );
};

// ---------- Helpers ----------

function resJSON(data, status = 200, allowOrigin) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return {
    statusCode: status,
    headers,
    body: JSON.stringify(data)
  };
}

function indexBy(arr, keyFn) {
  const out = {};
  for (const item of arr || []) {
    const k = keyFn(item);
    if (k != null) out[k] = item;
  }
  return out;
}

function normalizeTags(a, b) {
  const one = Array.isArray(a) ? a : a ? String(a).split(',') : [];
  const two = Array.isArray(b) ? b : b ? String(b).split(',') : [];
  const set = new Set([...one.map((t) => String(t).trim()).filter(Boolean),
                       ...two.map((t) => String(t).trim()).filter(Boolean)]);
  return Array.from(set);
}

// Flatten Cloudinary resource -> lean shape our UI/API expects
function simplifyCL(r) {
  const ctx = (r.context && (r.context.custom || r.context)) || {};
  return {
    public_id: r.public_id,
    asset_id: r.asset_id,
    resource_type: r.resource_type,
    type: r.type,
    format: r.format,
    version: r.version,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    created_at: r.created_at,
    url: r.url,
    secure_url: r.secure_url,
    folder: r.folder,
    tags: r.tags || [],
    // Derive some helpful display fields; Xano may override these later
    title: ctx.title || r.public_id,
    description: ctx.description || '',
    station: ctx.station || ctx.collection || ''
  };
}
