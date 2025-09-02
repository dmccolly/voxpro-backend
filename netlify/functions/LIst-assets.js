import { fields, getXanoHeaders, mapXanoRecord, batchGetByPublicIds, findByPublicId } from './_xano.js';


// List Cloudinary resources, then enrich with Xano metadata.
export default async (req, context) => {
const env = process.env;
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, WEBFLOW_ALLOW_ORIGIN,
XANO_API_BASE, XANO_API_KEY, XANO_ASSETS_ENDPOINT = '/assets', XANO_BATCH_ENDPOINT } = env;


if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
return resJSON({ error: 'Missing Cloudinary env vars' }, 500, WEBFLOW_ALLOW_ORIGIN);
}


const { searchParams } = new URL(req.url);
const expression = searchParams.get('expression') || '';
const type = searchParams.get('type') || '';
const sort = searchParams.get('sort') || '-created_at';
const next_cursor = searchParams.get('cursor') || undefined;
const max_results = Math.min(parseInt(searchParams.get('max') || '80', 10), 500);


const base = type ? `resource_type:${type}` : '(resource_type:image OR resource_type:video OR resource_type:raw)';
const finalExpr = expression ? `${base} AND (${expression})` : base;


const clBody = { expression: finalExpr, with_field: ['context','tags'], sort_by: [{ [sort.replace('-', '')]: sort.startsWith('-') ? 'desc' : 'asc' }], max_results };
if (next_cursor) clBody.next_cursor = next_cursor;


const clAuth = (typeof btoa === 'function' ? btoa(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`) : Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64'));


let cloudinary;
try{
const clRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/search`, { method: 'POST', headers: { 'Authorization': `Basic ${clAuth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(clBody) });
if (!clRes.ok) return resJSON({ error: 'Cloudinary search failed', detail: await clRes.text() }, 502, WEBFLOW_ALLOW_ORIGIN);
cloudinary = await clRes.json();
}catch(err){
return resJSON({ error: 'Cloudinary request error', detail: String(err) }, 500, WEBFLOW_ALLOW_ORIGIN);
}


const resources = (cloudinary.resources || []).map(simplifyCL);


let xanoMap = {};
if (XANO_API_BASE){
try{
const headers = getXanoHeaders(env);
if (XANO_BATCH_ENDPOINT){
const arr = await batchGetByPublicIds(XANO_API_BASE, XANO_BATCH_ENDPOINT, headers, resources.map(r=>r.public_id));
xanoMap = indexBy(arr.map(mapXanoRecord), x => x.public_id);
} else {
const settled = await Promise.all(resources.map(async r => mapXanoRecord(await findByPublicId(XANO_API_BASE, XANO_ASSETS_ENDPOINT, headers, r.public_id)) ));
xanoMap = indexBy(settled.filter(Boolean), x => x.public_id);
}
}catch(err){ console.warn('Xano enrichment failed', err); }
}


const merged = resources.map(r => {
const xm = xanoMap[r.public_id];
if (!xm) return r;
return { ...r, title: xm.title || r.title, description: xm.description || r.description, station: xm.station || r.station, collection_id: xm.collection_id, categories: xm.categories, xano_id: xm.id, tags: normalizeTags(r.tags, xm.tags) };
});


return resJSON({ resources: merged, next_cursor: cloudinary.next_cursor || null }, 200, WEBFLOW_ALLOW_ORIGIN);
};


function simplifyCL(r){
export const config = { path: '/.netlify/functions/list-assets' };
