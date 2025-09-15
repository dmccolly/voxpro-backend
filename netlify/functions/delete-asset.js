import { fields, getXanoHeaders, findByPublicId } from './_xano.js';


// Delete Cloudinary resource(s) and mirror in Xano (hard delete or soft delete via deleted_at)
export default async (req, context) => {
if (req.method === 'OPTIONS') return ok();


const env = process.env;
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, WEBFLOW_ALLOW_ORIGIN,
XANO_API_BASE, XANO_API_KEY, XANO_ASSETS_ENDPOINT = '/assets', XANO_SOFT_DELETE } = env;


if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET){
return respond({ error:'Missing Cloudinary env vars' }, 500, WEBFLOW_ALLOW_ORIGIN);
}


let body = {};
try { body = await req.json(); } catch { return respond({ error:'Invalid JSON' }, 400, WEBFLOW_ALLOW_ORIGIN); }
const ids = Array.isArray(body.ids) ? body.ids : [];
if (!ids.length) return respond({ error:'ids required' }, 400, WEBFLOW_ALLOW_ORIGIN);


// Cloudinary delete per resource_type
const auth = (typeof btoa === 'function' ? btoa(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`) : Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64'));
const headersCL = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
const byType = ids.reduce((m,x)=>{ const t=x.resource_type||'image'; (m[t]||(m[t]=[])).push(x.public_id); return m; }, {});
for (const [type, public_ids] of Object.entries(byType)){
const qs = new URLSearchParams(); public_ids.forEach(id=>qs.append('public_ids[]', id));
const del = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${type}/upload?`+qs.toString(), { method:'DELETE', headers: headersCL });
if (!del.ok) return respond({ error:'Cloudinary delete failed', detail: await del.text() }, 502, WEBFLOW_ALLOW_ORIGIN);
}


// Mirror in Xano
if (XANO_API_BASE){
const headersX = getXanoHeaders(env);
const soft = String(XANO_SOFT_DELETE || '').toLowerCase() === 'true';
const now = new Date().toISOString();


for (const it of ids){
export const config = { path: '/.netlify/functions/delete-asset' };
