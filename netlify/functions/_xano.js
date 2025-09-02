// Xano schema adapter + helpers. Configure via env XANO_FIELDS_JSON and XANO_TAGS_TYPE.
export const fields = (() => {
let m = { id: 'id', public_id: 'public_id', resource_type: 'resource_type', title: 'title', description: 'description', station: 'station', tags: 'tags', collection_id: 'collection_id', categories: 'categories', deleted_at: 'deleted_at' };
try { const s = process.env.XANO_FIELDS_JSON; if (s) m = { ...m, ...JSON.parse(s) }; } catch {}
return m;
})();


export const TAGS_TYPE = (process.env.XANO_TAGS_TYPE || 'array').toLowerCase(); // 'array' | 'string'


export function getXanoHeaders(env){
const h = { 'Content-Type': 'application/json' };
if (env.XANO_API_KEY) h['Authorization'] = `Bearer ${env.XANO_API_KEY}`;
return h;
}


export function mapXanoRecord(row){
if (!row) return null;
const f = fields;
const out = {
id: row[f.id],
public_id: row[f.public_id],
resource_type: row[f.resource_type],
title: row[f.title],
description: row[f.description],
station: row[f.station],
collection_id: row[f.collection_id],
categories: row[f.categories],
deleted_at: row[f.deleted_at]
};
const tagsVal = row[f.tags];
out.tags = Array.isArray(tagsVal) ? tagsVal : (typeof tagsVal === 'string' ? tagsVal.split(',').map(s=>s.trim()).filter(Boolean) : []);
return out;
}


export function buildXanoPayload({ public_id, resource_type, title, description, station, tags, xanoExtra }){
const f = fields;
}
