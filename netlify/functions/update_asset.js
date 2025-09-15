import { fields, getXanoHeaders, mapXanoRecord, buildXanoPayload, findByPublicId } from './_xano.js';


// Update Cloudinary (context/tags) AND Xano (authoritative fields)
export default async (req, context) => {
if (req.method === 'OPTIONS') return ok();


const env = process.env;
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, WEBFLOW_ALLOW_ORIGIN,
XANO_API_BASE, XANO_API_KEY, XANO_ASSETS_ENDPOINT = '/assets' } = env;


if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET){ return respond({ error:'Missing Cloudinary env vars' }, 500, WEBFLOW_ALLOW_ORIGIN); }


let body = {};
try { body = await req.json(); } catch { return respond({ error:'Invalid JSON' }, 400, WEBFLOW_ALLOW_ORIGIN); }


const { resource_type='image', public_id, context = {}, tags, xano = {}, xano_id, bulk, ids, addTags } = body;


if (bulk){
// simple bulk tag add across mixed resource types
try { await bulkAdd(env, ids, addTags); return respond({ ok:true }, 200, WEBFLOW_ALLOW_ORIGIN); }
catch(e){ return respond({ error:String(e) }, 500, WEBFLOW_ALLOW_ORIGIN); }
}


if (!public_id) return respond({ error:'public_id required' }, 400, WEBFLOW_ALLOW_ORIGIN);


// --- Cloudinary updates ---
const auth = typeof btoa === 'function' ? btoa(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`) : Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
const headersCL = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };


// Context
if (context && Object.keys(context).length){
const contextStr = Object.entries(context).filter(([,v])=>typeof v === 'string').map(([k,v])=>`${k}=${String(v).replace(/\|/g,'%7C').replace(/
/g,'\n')}`).join('|');
if (contextStr){
const ctxRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${resource_type}/context`, { method:'POST', headers: headersCL, body: JSON.stringify({ public_ids:[public_id], context: contextStr }) });
if (!ctxRes.ok) return respond({ error:'Cloudinary context update failed', detail: await ctxRes.text() }, 502, WEBFLOW_ALLOW_ORIGIN);
}
}


// Tags
if (Array.isArray(tags)){
const tRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${resource_type}/tags`, { method:'POST', headers: headersCL, body: JSON.stringify({ public_ids:[public_id], tags: tags.join(','), command:'replace' }) });
if (!tRes.ok) return respond({ error:'Cloudinary tag update failed', detail: await tRes.text() }, 502, WEBFLOW_ALLOW_ORIGIN);
}


// --- Xano upsert ---
if (XANO_API_BASE){
const headersX = getXanoHeaders(env);


let existing = null;
if (xano_id){
const g = await fetch(`${XANO_API_BASE}${XANO_ASSETS_ENDPOINT}/${xano_id}`, { headers: headersX });
if (g.ok) existing = await g.json();
} else {
existing = await findByPublicId(XANO_API_BASE, XANO_ASSETS_ENDPOINT, headersX, public_id);
}


const merged = {
public_id,
resource_type,
title: context.title ?? xano.title,
description: context.description ?? xano.description,
station: context.station ?? xano.station,
tags,
export const config = { path: '/.netlify/functions/update-asset' };
