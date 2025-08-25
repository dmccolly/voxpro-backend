/* ===== GLOBAL ERROR SURFACE ===== */
window.addEventListener('error', (e) => {
  const msg = (e && e.message) ? e.message : String(e);
  const where = e?.filename ? ` @ ${e.filename}:${e.lineno || ''}` : '';
  try {
    const alertBox = document.getElementById('alert');
    alertBox.className = 'alert error';
    alertBox.textContent = `JS error: ${msg}${where}`;
    alertBox.style.display = 'block';
  } catch {}
  console.error('Global error:', e);
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || String(e?.reason || 'unhandledrejection');
  try {
    const alertBox = document.getElementById('alert');
    alertBox.className = 'alert error';
    alertBox.textContent = `Promise error: ${msg}`;
    alertBox.style.display = 'block';
  } catch {}
  console.error('Unhandled rejection:', e);
});

/* ===== pdf.js worker (safe) ===== */
window.addEventListener('load', () => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
});

/* ===== CONFIG ===== */
const FUNCTIONS_ORIGIN = 'https://majestic-beijinho-cd3d75.netlify.app';
const MEDIA_PROXY     = FUNCTIONS_ORIGIN + '/.netlify/functions/fetch-media?url=';
const SEARCH_API_PRIMARY = FUNCTIONS_ORIGIN + '/.netlify/functions/search-media';
const SEARCH_API_SECONDARY = '';
const XANO_PROXY_BASE    = FUNCTIONS_ORIGIN + '/.netlify/functions/xano-proxy';
const ASSIGNMENTS_REFRESH_MS = 30000;

/* ===== STATE & DOM ===== */
let unifiedResults = [];
let assignments = [];
let selectedUnified = null;
let playing = null;
let searchEndpointChosen = null;
let activeMediaEl = null;

const keyButtons = [...document.querySelectorAll('.key[data-key]')];
const stopButton = document.getElementById('stopButton');
const assignmentsList = document.getElementById('assignmentsList');
const assignmentsListManager = document.getElementById('assignmentsListManager');
const connectionStatus = document.getElementById('connectionStatus');
const searchInput = document.getElementById('searchInput');
const mediaBrowser = document.getElementById('mediaBrowser');
const selectedMedia = document.getElementById('selectedMedia');
const keySelect = document.getElementById('keySelect');
const titleInput = document.getElementById('titleInput');
const descriptionInput = document.getElementById('descriptionInput');
const stationInput = document.getElementById('stationInput');
const tagsInput = document.getElementById('tagsInput');
const submittedByInput = document.getElementById('submittedByInput');
const assignButton = document.getElementById('assignButton');
const alertBox = document.getElementById('alert');
const currentInfo = document.getElementById('currentInfo');
const currentTitle = document.getElementById('currentTitle');
const currentMeta = document.getElementById('currentMeta');
const mediaModal = document.getElementById('mediaModal');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const mediaPlayer = document.getElementById('mediaPlayer');
const mediaDescription = document.getElementById('mediaDescription');
const sheet = document.getElementById('sheet');
const sheetHeader = document.getElementById('sheetHeader');
const sheetResize = document.getElementById('sheetResize');
const tapOverlay = document.getElementById('tapOverlay');
const titleOptions = document.getElementById('titleOptions');
const stationOptions = document.getElementById('stationOptions');

/* ===== UTILS ===== */
const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
function show(type, msg) {
  alertBox.className = 'alert ' + (type || '');
  alertBox.textContent = msg;
  alertBox.style.display = 'block';
  clearTimeout(show._t);
  show._t = setTimeout(() => { alertBox.style.display = 'none'; }, type === 'error' ? 6000 : 3000);
}
function setConn(ok) {
  connectionStatus.textContent = ok ? 'Connected' : 'Connection Error';
  connectionStatus.classList.toggle('bad', !ok);
}
function fetchWithTimeout(resource, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(resource, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}
async function fetchJSON(url, opts) {
  const r = await fetchWithTimeout(url, opts, 12000);
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}
async function xano(endpoint, opts = {}) {
  try {
    const url = `${XANO_PROXY_BASE}/${endpoint}`.replace(/(?<!:)\/{2,}/g, '/').replace('https:/','https://');
    const r = await fetchWithTimeout(url, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      mode: 'cors',
      credentials: 'omit',
      ...opts
    }, 12000);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const j = await r.json().catch(() => ({}));
    setConn(true);
    return j;
  } catch (err) {
    console.error('Xano error:', err);
    setConn(false);
    show('error', 'Server error: ' + (err?.message || err));
    return null;
  }
}

/* ===== DATALISTS MEMORY ===== */
const LS_TITLES = 'voxpro_titles';
const LS_STATIONS = 'voxpro_stations';
const readSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const writeSet = (k, s) => localStorage.setItem(k, JSON.stringify([...s].slice(0,300)));
function addMemory(){
  const t=(titleInput.value||'').trim(), s=(stationInput.value||'').trim();
  if(t){const set=readSet(LS_TITLES); set.delete(t); set.add(t); writeSet(LS_TITLES,set)}
  if(s){const set=readSet(LS_STATIONS); set.delete(s); set.add(s); writeSet(LS_STATIONS,set)}
  populateDatalistsFromMemory();
}
function populateDatalistsFromMemory(){
  const titles=[...readSet(LS_TITLES)], stations=[...readSet(LS_STATIONS)];
  titleOptions.innerHTML=titles.slice(-200).reverse().map(v=>`<option value="${esc(v)}">`).join('');
  stationOptions.innerHTML=stations.slice(-200).reverse().map(v=>`<option value="${esc(v)}">`).join('');
}

/* ===== URL DETECTION ===== */
function assetUrlCommon(a){
  return a?.media_url || a?.database_url || a?.file_url || a?.url ||
         a?.public_url || a?.signed_url || a?.s3_url || a?.storage_url ||
         a?.path || a?.source_url || (a?.file && (a.file.url || a.file.path || a.file.public_url)) || '';
}
function findUrlDeep(obj, depth=0, maxDepth=4){
  if (!obj || depth>maxDepth) return '';
  if (typeof obj === 'string') return /^https?:\/\//i.test(obj) ? obj : '';
  if (Array.isArray(obj)) { for (const v of obj){ const u=findUrlDeep(v, depth+1, maxDepth); if(u) return u; } return ''; }
  if (typeof obj === 'object') { for (const k of Object.keys(obj)){ const u=findUrlDeep(obj[k], depth+1, maxDepth); if(u) return u; } }
  return '';
}
function assetUrlRaw(a){ return assetUrlCommon(a) || findUrlDeep(a) || ''; }
function proxied(url){ 
  const urlStr = String(url || '');
  return urlStr ? (urlStr.startsWith(MEDIA_PROXY)?urlStr:MEDIA_PROXY+encodeURIComponent(urlStr)) : ''; 
}
function assetUrl(a){ return proxied(assetUrlRaw(a)); }

/* ===== TYPE GUESS ===== */
function detectType(item){
  const t=(item.file_type||'').toLowerCase();
  if (t) return t;
  const u=(assetUrlRaw(item)||'').toLowerCase();
  if (/\.(mp3|m4a|aac|wav|ogg|flac)(\?|$)/.test(u)) return 'audio';
  if (/\.(mp4|mov|mkv|webm)(\?|$)/.test(u)) return 'video';
  if (/\.(png|jpg|jpeg|gif|webp|avif)(\?|$)/.test(u)) return 'image';
  if (/\.pdf(\?|$)/.test(u)) return 'pdf';
  if (/\.(doc|docx)(\?|$)/.test(u)) return 'doc';
  if (/\.(xls|xlsx|csv)(\?|$)/.test(u)) return 'sheet';
  return '';
}

/* ===== THUMBNAILS ===== */
async function createThumbnail(item){
  const raw=item.thumbnail || assetUrlRaw(item);
  const url=raw?proxied(raw):'';
  const type=detectType(item);

  if (!url){
    if(type.includes('audio')) return '<div class="icon">🎵</div>';
    if(type.includes('video')) return '<div class="icon">🎬</div>';
    if(type.includes('pdf'))   return '<div class="icon">📄</div>';
    if(type.includes('doc'))   return '<div class="icon">📝</div>';
    if(type.includes('sheet')) return '<div class="icon">📊</div>';
    return '<div class="icon">📁</div>';
  }
  if (type.includes('image')){
    return `<img src="${esc(url)}" onerror="this.outerHTML='<div class=&quot;icon&quot;>🖼️</div>'" />`;
  }
  if (type.includes('video')){
    return `<video muted preload="metadata" playsinline onerror="this.outerHTML='<div class=&quot;icon&quot;>🎬</div>'">
              <source src="${esc(url)}#t=0.1">
            </video>`;
  }
  if (type.includes('audio')) return '<div class="icon">🎵</div>';
  if (type.includes('pdf'))   return '<div class="icon">📄</div>';
  if (type.includes('doc'))   return '<div class="icon">📝</div>';
  if (type.includes('sheet')) return '<div class="icon">📊</div>';
  return `<img src="${esc(url)}" onerror="this.outerHTML='<div class=&quot;icon&quot;>📁</div>'" />`;
}

/* ===== DIAGNOSTICS LINE ===== */
function setSelectionDiagnostics(asset){
  const raw=assetUrlRaw(asset);
  selectedMedia.textContent = `Selected (${asset.source}): ${asset.title||'Untitled'} — ` + (raw ? `URL ✓ (${raw.slice(0,80)}${raw.length>80?'…':''})` : 'NO URL');
}

/* ===== SEARCH ===== */
async function unifiedSearch(term=''){
  if (unifiedSearch._t) clearTimeout(unifiedSearch._t);
  return new Promise((resolve)=>{
    unifiedSearch._t=setTimeout(async()=>{
      try{
        const q=term.trim();
        const endpoints=searchEndpointChosen?[searchEndpointChosen]:[SEARCH_API_PRIMARY,SEARCH_API_SECONDARY].filter(Boolean);
        let data=null,lastErr=null;
        for(const ep of endpoints){
          try{
            const url=ep+'?'+(q?('q='+encodeURIComponent(q)+'&'):'')+'limit=100';
            data=await fetchJSON(url,{mode:'cors'}); searchEndpointChosen=ep; break;
          }catch(e){ lastErr=e; }
        }
        if(!data){
          const assets=await xano('asset');
          if(!assets) throw lastErr||new Error('No search endpoint responded');
          const qlc=q.toLowerCase();
          const filtered=(assets||[]).filter(a=>{
            const hay=[a.title,a.description,a.station,a.tags,a.submitted_by].map(v=>(v||'').toLowerCase()).join(' ');
            return !qlc || hay.includes(qlc);
          }).map(x=>({
            id:'xano:'+x.id, source:'xano',
            title:x.title||'Untitled', description:x.description||'',
            station:x.station||'', tags:x.tags||'',
            thumbnail:x.thumbnail||'',
            media_url:x.database_url||x.file_url||x.url||'',
            file_type:x.file_type||'',
            submitted_by:x.submitted_by||'',
            created_at:x.created_at||''
          }));
          data={results:filtered};
        }
        unifiedResults=data.results||[];
        renderMediaBrowser();
        reportUrlCoverage('search', unifiedResults);
        setConn(true);
        resolve(unifiedResults);
      }catch(e){
        console.error(e); setConn(false); show('error','Search failed'); resolve([]);
      }
    },180);
  });
}

/* ===== LIST RENDER ===== */
function renderMediaBrowser(){
  if(!unifiedResults.length){
    mediaBrowser.innerHTML='<div class="row"><div class="info">No media found</div></div>'; return;
  }
  mediaBrowser.innerHTML='';
  unifiedResults.forEach((r)=>{
    const row=document.createElement('div'); row.className='row'; row.dataset.id=String(r.id);
    const thumb=document.createElement('div'); thumb.className='thumb'; thumb.innerHTML='<div class="icon">📁</div>';
    const info=document.createElement('div'); info.className='info';
    info.innerHTML=`<div class="title">${esc(r.title||'Untitled')}</div><div class="meta">${esc(r.station||'Unknown')} • ${esc(r.source||'')}</div>`;
    row.appendChild(thumb); row.appendChild(info); mediaBrowser.appendChild(row);
    (async()=>{ try{ const html=await createThumbnail(r); if(row.isConnected) thumb.innerHTML=html; }catch(e){ console.warn('thumb',e);} })();
    row.addEventListener('click',()=>{
      mediaBrowser.querySelectorAll('.row').forEach(n=>n.classList.remove('selected'));
      row.classList.add('selected');
      const asset=unifiedResults.find(x=>String(x.id)===String(r.id));
      if(asset) selectUnifiedAsset(asset);
    });
    row.addEventListener('dblclick',()=>{
      const asset=unifiedResults.find(x=>String(x.id)===String(r.id));
      if(asset) openMediaModal(asset);
    });
  });
}
function selectUnifiedAsset(asset){
  selectedUnified=asset;
  setSelectionDiagnostics(asset);
  titleInput.value=asset.title||'';
  descriptionInput.value=asset.description||'';
  stationInput.value=asset.station||'';
  tagsInput.value=asset.tags||'';
  submittedByInput.value=asset.submitted_by||'';
  const editable=asset.source==='xano';
  [titleInput,descriptionInput,stationInput,tagsInput,submittedByInput].forEach(i=>{i.readOnly=!editable});
}

/* ===== ASSIGNMENTS ===== */
async function loadAssignments(){
  if(!assignmentsList.querySelector('.row')){
    assignmentsList.innerHTML='<div class="row"><div class="info">Loading assignments…</div></div>';
  }
  const data=await xano('voxpro_assignments');
  if(!data){
    assignments=[]; assignmentsList.innerHTML='<div class="row"><div class="info">No assignments (server unreachable)</div></div>';
    assignmentsListManager.innerHTML='<div class="row"><div class="info">No assignments (server error)</div></div>';
    updateKeyButtons(); return;
  }
  try{
    assignments=(Array.isArray(data)?data:[]).sort((a,b)=>(a.key_number||0)-(b.key_number||0));
    renderAssignments(); renderAssignmentsManager();

    await Promise.all(assignments.map(async (a,idx)=>{
      if(a && a.asset_id!=null){
        const asset=await xano('asset/'+a.asset_id);
        assignments[idx].asset = asset || { id:a.asset_id, title:`Missing Asset ${a.asset_id}`, station:'Unknown', file_type:'unknown' };
      }else{
        assignments[idx].asset = { title:'No Asset ID', station:'Unknown', file_type:'none' };
      }
    }));

    renderAssignments(); renderAssignmentsManager(); updateKeyButtons();
    reportUrlCoverage('assignments', assignments.map(a=>a.asset||{}));
  }catch(e){
    console.error('assignments parse',e);
    show('error','Could not parse assignments');
    assignments=[]; assignmentsList.innerHTML='<div class="row"><div class="info">No assignments (parse error)</div></div>';
    assignmentsListManager.innerHTML='<div class="row"><div class="info">No assignments (parse error)</div></div>';
    updateKeyButtons();
  }
}
function renderAssignments(){
  if(!assignments.length){
    assignmentsList.innerHTML='<div class="row"><div class="info">No assignments yet</div></div>'; return;
  }
  assignmentsList.innerHTML=assignments.map(a=>{
    const asset=a.asset||{};
    return `<div class="row" data-assign-id="${a.id}">
      <div class="thumb"><div class="icon">📁</div></div>
      <div class="info">
        <div class="title">Key ${a.key_number||'?'} — ${esc(asset.title||'Unknown')}</div>
        <div class="meta">${esc(asset.station||'Unknown')} • ${esc(asset.file_type||'')}</div>
      </div>
    </div>`;
  }).join('');
  assignmentsList.querySelectorAll('.row').forEach(async (row,idx)=>{
    const a=assignments[idx]; if(!a||!a.asset) return;
    const thumb=row.querySelector('.thumb');
    try{ const html=await createThumbnail(a.asset); if(row.isConnected) thumb.innerHTML=html; }catch{}
  });
}
function renderAssignmentsManager(){
  if(!assignments.length){
    assignmentsListManager.innerHTML='<div class="row"><div class="info">No assignments yet</div></div>'; return;
  }
  assignmentsListManager.innerHTML=assignments.map(a=>{
    const asset=a.asset||{};
    return `<div class="row">
      <div class="info">
        <div class="title">Key ${a.key_number||'?'}</div>
        <div class="meta">${esc(asset.title||'Unknown')} • ${esc(asset.station||'Unknown')}</div>
      </div>
      <div><button class="btn btn-danger" data-del-id="${a.id}">Remove</button></div>
    </div>`;
  }).join('');
  assignmentsListManager.querySelectorAll('[data-del-id]').forEach(btn=>{
    btn.addEventListener('click',()=>deleteAssignment(btn.getAttribute('data-del-id')));
  });
}
function updateKeyButtons(){
  keyButtons.forEach(btn=>{
    btn.classList.remove('assigned','playing');
    const key=Number(btn.dataset.key);
    const asn=assignments.find(a=>Number(a.key_number)===key);
    if(asn) btn.classList.add('assigned');
  });
  reflectPlaying();
}
function reflectPlaying(){
  keyButtons.forEach(btn=>btn.classList.remove('playing'));
  if(playing&&playing.key){
    const btn=keyButtons.find(b=>Number(b.dataset.key)===Number(playing.key));
    if(btn) btn.classList.add('playing');
    currentInfo.style.display='block';
    currentTitle.textContent=playing.asset?.title?`Now Playing — ${playing.asset.title}`:'Now Playing';
    currentMeta.textContent=[playing.asset?.station||'',playing.asset?.file_type||''].filter(Boolean).join(' • ');
  } else {
    currentInfo.style.display='none';
  }
}

/* ===== ASSIGN / DELETE ===== */
async function ensureXanoAssetFromUnified(asset){
  if(!asset) return null;
  if(asset.source==='xano'){
    const idStr=String(asset.id||'').split(':')[1]||String(asset.id);
    const nid=Number(idStr); return Number.isFinite(nid)?nid:null;
  }
  const payload={
    title:asset.title||'Untitled', description:asset.description||'',
    station:asset.station||'', tags:asset.tags||'',
    thumbnail:asset.thumbnail||'',
    database_url:asset.media_url||asset.url||'', file_url:asset.file_url||'',
    file_type:asset.file_type||'', submitted_by:asset.submitted_by||''
  };
  const created=await xano('asset',{method:'POST',body:JSON.stringify(payload)});
  return created&&created.id?Number(created.id):null;
}
async function assignSelectedToKey(){
  const key=Number(keySelect.value);
  if(!key){ show('error','Choose a key slot'); return; }
  if(!selectedUnified){ show('error','Select a media item first'); return; }
  const assetId=await ensureXanoAssetFromUnified(selectedUnified);
  if(!assetId){ show('error','Could not resolve asset'); return; }
  if(selectedUnified.source==='xano'){
    const updates={ title:titleInput.value||'', description:descriptionInput.value||'',
      station:stationInput.value||'', tags:tagsInput.value||'',
      submitted_by:submittedByInput.value||'' };
    await xano('asset/'+assetId,{method:'PUT',body:JSON.stringify(updates)});
  }
  addMemory();
  const existing=assignments.find(a=>Number(a.key_number)===key);
  if(existing){
    await xano('voxpro_assignments/'+existing.id,{method:'PUT',body:JSON.stringify({key_number:key,asset_id:assetId})});
  }else{
    await xano('voxpro_assignments',{method:'POST',body:JSON.stringify({key_number:key,asset_id:assetId})});
  }
  show('success','Key assigned'); await loadAssignments(); updateKeyButtons();
}
async function deleteAssignment(id){
  if(!id) return;
  await xano('voxpro_assignments/'+id,{method:'DELETE'});
  show('success','Assignment removed'); await loadAssignments();
}

/* ===== PLAYER / MODAL ===== */
function clearActiveMedia(){ try{ if(activeMediaEl){ activeMediaEl.pause?.(); activeMediaEl.src=''; } }catch{} activeMediaEl=null; }
function openMediaModal(asset){
  mediaPlayer.innerHTML='';
  tapOverlay.style.display='none';
  mediaPlayer.appendChild(tapOverlay);

  mediaDescription.textContent=asset.description||'';
  modalTitle.textContent=asset.title||'Player';

  const raw=assetUrlRaw(asset);
  const url=raw?proxied(raw):'';
  if(!url){
    mediaPlayer.innerHTML = '<div style="padding:12px;color:#b0b0b0;text-align:center">No media URL on this asset.</div>';
    mediaModal.style.display='block'; return;
  }

  const type=(asset.file_type||detectType(asset)||'').toLowerCase();
  if(type.includes('audio')){
    const audio=document.createElement('audio');
    audio.controls=true; audio.autoplay=false; audio.playsInline=true;
    audio.style.width='100%'; audio.crossOrigin='anonymous'; audio.src=url;
    audio.onerror=()=>show('error','Audio failed to load');
    mediaPlayer.prepend(audio); activeMediaEl=audio; mediaModal.style.display='block'; return;
  }
  if(type.includes('video')){
    const video=document.createElement('video');
    video.controls=true; video.autoplay=false; video.playsInline=true;
    video.style.maxWidth='100%'; video.style.maxHeight='100%';
    video.crossOrigin='anonymous'; video.src=url+(url.includes('#')?'':'#t=0.1');
    video.onerror=()=>show('error','Video failed to load');
    mediaPlayer.prepend(video); activeMediaEl=video; mediaModal.style.display='block'; return;
  }
  if(type.includes('image')){
    const img=document.createElement('img');
    img.alt=asset.title||''; img.src=url; img.style.maxWidth='100%'; img.style.maxHeight='100%';
    img.onerror=()=>show('error','Image failed to load');
    mediaPlayer.prepend(img); mediaModal.style.display='block'; return;
  }
  if(type.includes('pdf')){
    const emb=document.createElement('embed');
    emb.type='application/pdf'; emb.src=url; emb.style.width='100%'; emb.style.height='100%';
    mediaPlayer.prepend(emb); mediaModal.style.display='block'; return;
  }
  mediaPlayer.innerHTML='<div style="padding:12px">Preview not available.</div>';
  mediaModal.style.display='block';
}
function closeMediaModal(){ clearActiveMedia(); mediaModal.style.display='none'; }
function playKey(keyNum){
  const asn=assignments.find(a=>Number(a.key_number)===Number(keyNum));
  if(!asn){ show('error','No assignment for that key'); return; }
  const asset=asn.asset||{}; playing={key:keyNum,asset}; reflectPlaying(); openMediaModal(asset);
}
function stopPlayback(){ playing=null; reflectPlaying(); clearActiveMedia(); }
function reflectPlaying(){
  keyButtons.forEach(btn=>btn.classList.remove('playing'));
  if(playing&&playing.key){
    const btn=keyButtons.find(b=>Number(b.dataset.key)===Number(playing.key));
    if(btn) btn.classList.add('playing');
    currentInfo.style.display='block';
    currentTitle.textContent=playing.asset?.title?`Now Playing — ${playing.asset.title}`:'Now Playing';
    currentMeta.textContent=[playing.asset?.station||'',playing.asset?.file_type||''].filter(Boolean).join(' • ');
  } else {
    currentInfo.style.display='none';
  }
}

/* ===== DRAG + RESIZE ===== */
(function dragAndResize(){
  const modal=sheet, header=sheetHeader, grip=sheetResize;
  let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;
  function onDown(x,y){dragging=true;const r=modal.getBoundingClientRect();startLeft=r.left;startTop=r.top;startX=x;startY=y;modal.style.right='auto';modal.style.bottom='auto';document.body.style.userSelect='none'}
  function onMove(x,y){if(!dragging)return;const dx=x-startX,dy=y-startY;modal.style.left=(startLeft+dx)+'px';modal.style.top=(startTop+dy)+'px'}
  function onUp(){dragging=false;document.body.style.userSelect=''}
  header.addEventListener('mousedown',e=>onDown(e.clientX,e.clientY));
  document.addEventListener('mousemove',e=>onMove(e.clientX,e.clientY));
  document.addEventListener('mouseup',onUp);
  header.addEventListener('touchstart',e=>{const t=e.touches[0];onDown(t.clientX,t.clientY)},{passive:true});
  document.addEventListener('touchmove',e=>{const t=e.touches[0];onMove(t.clientX,t.clientY)},{passive:true});
  document.addEventListener('touchend',onUp);

  let resizing=false,rStartX=0,rStartY=0,startW=0,startH=0;
  function rDown(x,y){resizing=true;rStartX=x;rStartY=y;const r=modal.getBoundingClientRect();startW=r.width;startH=r.height;document.body.style.userSelect='none'}
  function rMove(x,y){if(!resizing)return;const dx=x-rStartX,dy=y-rStartY;modal.style.width=Math.max(360,startW+dx)+'px';modal.style.height=Math.max(320,startH+dy)+'px'}
  function rUp(){resizing=false;document.body.style.userSelect=''}
  if(grip){
    grip.addEventListener('mousedown',e=>{e.stopPropagation();rDown(e.clientX,e.clientY)});
    document.addEventListener('mousemove',e=>rMove(e.clientX,e.clientY));
    document.addEventListener('mouseup',rUp);
    grip.addEventListener('touchstart',e=>{e.stopPropagation();const t=e.touches[0];rDown(t.clientX,t.clientY)},{passive:true});
    document.addEventListener('touchmove',e=>{const t=e.touches[0];rMove(t.clientX,t.clientY)},{passive:true});
    document.addEventListener('touchend',rUp);
  }
})();

/* ===== COVERAGE NOTICE ===== */
function reportUrlCoverage(label, items){
  let have=0, total=items.length;
  for (const a of items){ if (assetUrlRaw(a)) have++; }
  if (total){
    alertBox.className='alert success';
    alertBox.textContent=`Media URLs found: ${have}/${total}`;
    alertBox.style.display='block';
    clearTimeout(reportUrlCoverage._t);
    reportUrlCoverage._t=setTimeout(()=>{alertBox.style.display='none'}, 3000);
  }
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async ()=>{
  populateDatalistsFromMemory();
  await loadAssignments();
  await unifiedSearch('');
  setInterval(loadAssignments, ASSIGNMENTS_REFRESH_MS);
});
searchInput.addEventListener('input',()=>unifiedSearch(searchInput.value));
assignButton.addEventListener('click',assignSelectedToKey);
keyButtons.forEach(btn=>btn.addEventListener('click',()=>playKey(btn.dataset.key)));
stopButton.addEventListener('click',stopPlayback);
modalClose.addEventListener('click',()=>mediaModal.style.display='none');
mediaModal.addEventListener('click',e=>{if(e.target===mediaModal) mediaModal.style.display='none';});
window.addEventListener('keydown',e=>{
  const k=e.key;
  if(/[1-5]/.test(k)){ playKey(Number(k)); }
  else if(k===' '){ e.preventDefault(); stopPlayback(); }
  else if(k==='Escape'){ mediaModal.style.display='none'; }
});
