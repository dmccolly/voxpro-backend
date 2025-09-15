(function(){
const BASE = '/.netlify/functions';
const timeout = (ms, p) => Promise.race([
p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))
]);


async function listAssets({ expression = '', type = '', sort = '-created_at', cursor = '', max = 80 } = {}){
const qs = new URLSearchParams();
if (expression) qs.set('expression', expression);
if (type) qs.set('type', type);
if (sort) qs.set('sort', sort);
if (cursor) qs.set('cursor', cursor);
if (max) qs.set('max', String(max));
const res = await timeout(15000, fetch(`${BASE}/list-assets?${qs.toString()}`));
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return res.json();
}


async function updateAsset(payload){
const res = await timeout(15000, fetch(`${BASE}/update-asset`, {
method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
}));
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return res.json();
}


async function deleteAssets(ids){
const res = await timeout(15000, fetch(`${BASE}/delete-asset`, {
method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
}));
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return res.json();
}


// Expose globally
window.HOIBF = { listAssets, updateAsset, deleteAssets };
})();
