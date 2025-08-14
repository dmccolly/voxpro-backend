// Worker (pdf.js)
window.addEventListener('load', () => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
});

/* ===== Config ===== */
const SEARCH_API_PRIMARY = 'https://majestic-beijinho-cd3d75.netlify.app/.netlify/functions/search-media';
const SEARCH_API_SECONDARY = ''; // optional fallback
const XANO_PROXY_BASE = 'https://majestic-beijinho-cd3d75.netlify.app/.netlify/functions/xano-proxy';
const ASSIGNMENTS_REFRESH_MS = 30000;
const FETCH_TIMEOUT_MS = 12000; // 12s safety timeout for each call

/* ===== State ===== */
let unifiedResults = [];
let assignments = [];
let selectedUnified = null;
let playing = null;
let connGood = false;
let searchEndpointChosen = null;
let activeMediaEl = null;

/* ===== DOM ===== */
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
const tapPlayBtn = document.getElementById('tapPlayBtn');
const titleOptions = document.getElementById('titleOptions');
const stationOptions = document.getElementById('stationOptions');

/* ===== Small diagnostics banner (in-page) ===== */
(function ensureDiag() {
  if (document.getElementById('diag')) return;
  const box = document.createElement('div');
  box.id = 'diag';
  box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#111;border:1px solid #333;color:#9fe;padding:8px 10px;border-radius:8px;font:12px/1.3 system-ui;max-width:320px';
  box.innerHTML = `
    <div style="font-weight:800;color:#0f8">Connectivity</div>
    <div id="diag-search" style="margin-top:4px">search-media: <em>pending…</em></div>
    <div id="diag-xano" style="margin-top:2px">xano-proxy: <em>pending…</em></div>
    <div id="diag-last" style="margin-top:6px;color:#bbb;max-height:90px;overflow:auto"></div>
  `;
  document.body.appendChild(box);
})();

const diagSearch = () => document.getElementById('diag-search');
const diagXano = () => document.getElementById('diag-xano');
const diagLast = () => document.getElementById('diag-last');

function logDiag(line) {
  try {
    console.log('[VoxPro]', line);
    if (diagLast()) {
      const div = document.createElement('div');
      div.textContent = String(line);
      diagLast().prepend(div);
    }
  } catch {}
}

/* ===== Utils ===== */
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
  connGood = !!ok;
  connectionStatus.textContent = ok ? 'Connected' : 'Connection Error';
  connectionStatus.classList.toggle('bad', !ok);
}

/* ===== fetch with timeout ===== */
async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/* ===== API ===== */
async function fetchJSON(url, opts) {
  const r = await fetchWithTimeout(url, opts);
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`${r.status} ${r.statusText} @ ${url}\n${txt.slice(0, 240)}`);
  }
  return r.json();
}

async function xano(endpoint, opts = {}) {
  const url = `${XANO_PROXY_BASE}/${endpoint}`;
  try {
    const r = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`${r.status} ${r.statusText} @ ${url}\n${txt.slice(0, 240)}`);
    }
    const j = await r.json();
    setConn(true);
    return j;
  } catch (err) {
    setConn(false);
    logDiag(err.message || err);
    show('error', 'Xano call failed. See console/diagnostics.');
    return null;
  }
}

/* ===== Memory (datalists) ===== */
const LS_TITLES = 'voxpro_titles';
const LS_STATIONS = 'voxpro_stations';

const readSet = (k) => {
  try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); }
  catch { return new Set(); }
};
const writeSet = (k, s) => localStorage.setItem(k, JSON.stringify([...s].slice(0, 300)));

function addMemory() {
  const t = (titleInput.value || '').trim();
  const s = (stationInput.value || '').trim();
  if (t) { const set = readSet(LS_TITLES); set.delete(t); set.add(t); writeSet(LS_TITLES, set); }
  if (s) { const set = readSet(LS_STATIONS); set.delete(s); set.add(s); writeSet(LS_STATIONS, set); }
  populateDatalistsFromMemory();
}

function populateDatalistsFromMemory() {
  const titles = [...readSet(LS_TITLES)];
  const stations = [...readSet(LS_STATIONS)];
  titleOptions.innerHTML = titles.slice(-200).reverse().map(v => `<option value="${esc(v)}">`).join('');
  stationOptions.innerHTML = stations.slice(-200).reverse().map(v => `<option value="${esc(v)}">`).join('');
}

/* ===== Type detect & thumbnails ===== */
function detectType(item) {
  const t = (item.file_type || '').toLowerCase();
  if (t) return t;
  const u = (item.media_url || item.database_url || item.file_url || item.url || '').toLowerCase();
  if (/\.(mp3|m4a|aac|wav|ogg|flac)(\?|$)/.test(u)) return 'audio';
  if (/\.(mp4|mov|mkv|webm)(\?|$)/.test(u)) return 'video';
  if (/\.(png|jpg|jpeg|gif|webp|avif)(\?|$)/.test(u)) return 'image';
  if (/\.pdf(\?|$)/.test(u)) return 'pdf';
  if (/\.(doc|docx)(\?|$)/.test(u)) return 'doc';
  if (/\.(xls|xlsx|csv)(\?|$)/.test(u)) return 'sheet';
  return '';
}

async function createVideoThumb(url) {
  return new Promise((res) => {
    try {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'metadata'; v.src = url + (url.includes('#') ? '' : '#t=0.2'); v.playsInline = true;
      v.onloadeddata = () => {
        try {
          const c = document.createElement('canvas'); c.width = 128; c.height = 128;
          const g = c.getContext('2d');
          const r = Math.min(128 / v.videoWidth, 128 / v.videoHeight);
          const w = v.videoWidth * r, h = v.videoHeight * r;
          g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 128, 128);
          g.drawImage(v, (128 - w) / 2, (128 - h) / 2, w, h);
          res(c.toDataURL('image/png'));
        } catch { res(null); }
      };
      v.onerror = () => res(null);
    } catch { res(null); }
  });
}

let _pdfReady = null;
function loadPdfJs() {
  if (_pdfReady) return _pdfReady;
  _pdfReady = new Promise((res, rej) => {
    function go() {
      try {
        if (!window.pdfjsLib) throw new Error('pdf.js missing');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        res(window.pdfjsLib);
      } catch (e) { rej(e); }
    }
    if (window.pdfjsLib) return go();
    const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); go(); } }, 200);
    setTimeout(() => { if (!window.pdfjsLib) rej(new Error('pdf.js not loaded')); }, 5000);
  }).catch(() => null);
  return _pdfReady;
}

async function pdfPageThumb(url) {
  const pdfjs = await loadPdfJs(); if (!pdfjs) return null;
  try {
    const pdf = await pdfjs.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const v = page.getViewport({ scale: .5 });
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    c.width = 128; c.height = 128;
    const s = Math.min(c.width / v.width, c.height / v.height);
    const v2 = page.getViewport({ scale: s });
    const off = document.createElement('canvas'); off.width = v2.width; off.height = v2.height;
    await page.render({ canvasContext: off.getContext('2d'), viewport: v2 }).promise;
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(off, (c.width - off.width) / 2, (c.height - off.height) / 2);
    return c.toDataURL('image/png');
  } catch { return null; }
}

const audioWaveThumbCache = new Map();
async function renderAudioWaveThumb(url) {
  if (audioWaveThumbCache.has(url)) return audioWaveThumbCache.get(url);
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = new AC();
    const resp = await fetchWithTimeout(url, { mode: 'cors' });
    if (!resp.ok) throw new Error('audio fetch failed');
    const buf = await resp.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const ch = audio.getChannelData(0);
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#00ff88'; g.lineWidth = 1; g.beginPath();
    const samples = 1000, step = Math.max(1, Math.floor(ch.length / samples));
    for (let x = 0; x < 128; x++) {
      const start = Math.min(ch.length - 1, Math.floor((x / 128) * samples) * step);
      const end = Math.min(ch.length - 1, start + step);
      let min = 1, max = -1;
      for (let i = start; i < end; i++) { const v = ch[i]; if (v < min) min = v; if (v > max) max = v; }
      const y1 = 64 + min * 60, y2 = 64 + max * 60;
      g.moveTo(x, y1); g.lineTo(x, y2);
    }
    g.stroke();
    const data = c.toDataURL('image/png');
    audioWaveThumbCache.set(url, data);
    return data;
  } catch { return null; }
}

async function createThumbnail(item) {
  const mediaUrl = item.media_url || item.database_url || item.file_url || item.url || '';
  const turl = item.thumbnail || '';
  const type = detectType(item);
  if (turl) return `<img src="${esc(turl)}" onload="this.style.opacity=1" onerror="this.style.display='none'" style="opacity:0;transition:opacity .3s">`;
  if (type.includes('image') && mediaUrl) return `<img src="${esc(mediaUrl)}" onload="this.style.opacity=1" onerror="this.style.display='none'" style="opacity:0;transition:opacity .3s">`;
  if (type.includes('video') && mediaUrl) { const data = await createVideoThumb(mediaUrl); return data ? `<img src="${data}">` : `<video muted preload="metadata" playsinline><source src="${esc(mediaUrl)}#t=1"></video>`; }
  if (type.includes('pdf') && mediaUrl) { const data = await pdfPageThumb(mediaUrl); return data ? `<img src="${data}">` : '<div class="icon">📄</div>'; }
  if (type.includes('audio') && mediaUrl) { const data = await renderAudioWaveThumb(mediaUrl); return data ? `<img src="${data}" alt="waveform">` : '<div class="icon">🎵</div>'; }
  if (type.includes('doc')) return '<div class="icon">📝</div>';
  if (type.includes('sheet')) return '<div class="icon">📊</div>';
  return '<div class="icon">📁</div>';
}

/* ===== Search ===== */
async function unifiedSearch(term = '') {
  if (unifiedSearch._t) clearTimeout(unifiedSearch._t);
  return new Promise((resolve) => {
    unifiedSearch._t = setTimeout(async () => {
      try {
        const q = term.trim();
        const endpoints = searchEndpointChosen ? [searchEndpointChosen] : [SEARCH_API_PRIMARY, SEARCH_API_SECONDARY].filter(Boolean);
        let data = null, lastErr = null;
        const u = endpoints.map(ep => ep + '?' + (q ? ('q=' + encodeURIComponent(q) + '&') : '') + 'limit=20');

        // Try all endpoints until one returns
        for (const url of u) {
          try {
            const now = Date.now();
            const out = await fetchJSON(url);
            logDiag(`search ok (${Date.now() - now}ms): ${url}`);
            if (diagSearch()) diagSearch().innerHTML = 'search-media: ✅ OK';
            data = out; searchEndpointChosen = url.split('?')[0]; break;
          } catch (e) {
            lastErr = e;
            logDiag(`search fail: ${e.message}`);
            if (diagSearch()) diagSearch().innerHTML = 'search-media: ❌ ' + esc(e.message);
          }
        }

        if (!data) {
          // Fallback to Xano direct listing
          const now = Date.now();
          const assets = await xano('asset');
          if (!assets) throw lastErr || new Error('No search endpoint responded (and Xano fallback failed)');
          logDiag(`xano asset ok (${Date.now() - now}ms)`);
          const qlc = q.toLowerCase();
          const filtered = (assets || []).filter(a => {
            const hay = [a.title, a.description, a.station, a.tags, a.submitted_by]
              .map(v => (v || '').toLowerCase()).join(' ');
            return !qlc || hay.includes(qlc);
          }).map(x => ({
            id: 'xano:' + x.id, source: 'xano',
            title: x.title || 'Untitled', description: x.description || '',
            station: x.station || '', tags: x.tags || '',
            thumbnail: x.thumbnail || '',
            media_url: x.database_url || x.file_url || x.url || '',
            file_type: x.file_type || '',
            submitted_by: x.submitted_by || '',
            created_at: x.created_at || ''
          }));
          data = { results: filtered };
        }

        unifiedResults = data.results || [];
        renderMediaBrowser();
        setConn(true);
        resolve(unifiedResults);
      } catch (e) {
        logDiag('search fatal: ' + (e.message || e));
        setConn(false);
        show('error', 'Search failed — see diagnostics bubble (bottom-right).');
        resolve([]);
      }
    }, 180);
  });
}

/* Render list with async thumbnail updates */
function renderMediaBrowser() {
  if (!unifiedResults.length) {
    mediaBrowser.innerHTML = '<div class="row"><div class="info">No media found</div></div>';
    return;
  }
  mediaBrowser.innerHTML = '';
  unifiedResults.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'row'; row.dataset.id = String(r.id);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.innerHTML = '<div class="icon">📁</div>'; // placeholder immediately

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<div class="title">${esc(r.title || 'Untitled')}</div>
                      <div class="meta">${esc(r.station || 'Unknown')} • ${esc(r.source || '')}</div>`;

    row.appendChild(thumb);
    row.appendChild(info);
    mediaBrowser.appendChild(row);

    // Async thumbnail fill; ignore errors
    (async () => {
      try {
        const html = await createThumbnail(r);
        if (row.isConnected) thumb.innerHTML = html;
      } catch (e) {
        logDiag('thumb error: ' + (e.message || e));
      }
    })();

    row.addEventListener('click', () => {
      mediaBrowser.querySelectorAll('.row').forEach(n => n.classList.remove('selected'));
      row.classList.add('selected');
      const asset = unifiedResults.find(x => String(x.id) === String(r.id));
      if (asset) selectUnifiedAsset(asset);
    });

    row.addEventListener('dblclick', () => {
      const asset = unifiedResults.find(x => String(x.id) === String(r.id));
      if (asset) openMediaModal(asset);
    });
  });
}

function selectUnifiedAsset(asset) {
  selectedUnified = asset;
  selectedMedia.textContent = `Selected (${asset.source}): ${asset.title || 'Untitled'}`;
  titleInput.value = asset.title || '';
  descriptionInput.value = asset.description || '';
  stationInput.value = asset.station || '';
  tagsInput.value = asset.tags || '';
  submittedByInput.value = asset.submitted_by || '';
  const editable = asset.source === 'xano';
  [titleInput, descriptionInput, stationInput, tagsInput, submittedByInput].forEach(i => { i.readOnly = !editable; });
}

/* ===== Assignments ===== */
async function loadAssignments() {
  try {
    if (diagXano()) diagXano().innerHTML = 'xano-proxy: …';
    const now = Date.now();
    const data = await xano('voxpro_assignments');
    if (!data) {
      assignments = [];
      assignmentsList.innerHTML = '<div class="row"><div class="info">Assignments failed to load (see diagnostics)</div></div>';
      return;
    }
    logDiag(`assignments ok (${Date.now() - now}ms)`);
    if (diagXano()) diagXano().innerHTML = 'xano-proxy: ✅ OK';

    assignments = data.sort((a, b) => (a.key_number || 0) - (b.key_number || 0));
    for (const a of assignments) {
      if (a.asset_id != null) {
        try {
          const asset = await xano('asset/' + a.asset_id);
          a.asset = asset || { id: a.asset_id, title: `Missing Asset ${a.asset_id}`, station: 'Unknown', file_type: 'unknown' };
        } catch (e) {
          logDiag('load asset fail: ' + (e.message || e));
          a.asset = { id: a.asset_id, title: `Missing Asset ${a.asset_id}`, station: 'Unknown', file_type: 'unknown' };
        }
      } else {
        a.asset = { title: 'No Asset ID', station: 'Unknown', file_type: 'none' };
      }
    }
    forceUpdateUI();
  } catch (e) {
    logDiag('assignments fatal: ' + (e.message || e));
    assignmentsList.innerHTML = '<div class="row"><div class="info">Assignments failed to load (see diagnostics)</div></div>';
  }
}

function forceUpdateUI() {
  renderAssignments();
  updateKeyButtons();
  renderAssignmentsManager();
}

function renderAssignments() {
  if (!assignments.length) {
    assignmentsList.innerHTML = '<div class="row"><div class="info">No assignments yet</div></div>';
    return;
  }
  assignmentsList.innerHTML = assignments.map(a => {
    const asset = a.asset || {};
    return `<div class="row" data-assign-id="${a.id}">
      <div class="thumb"><div class="icon">📁</div></div>
      <div class="info">
        <div class="title">Key ${a.key_number || '?'} — ${esc(asset.title || 'Unknown')}</div>
        <div class="meta">${esc(asset.station || 'Unknown')} • ${esc(asset.file_type || '')}</div>
      </div>
    </div>`;
  }).join('');

  // Fill thumbs asynchronously
  assignmentsList.querySelectorAll('.row').forEach(async (row, idx) => {
    const a = assignments[idx];
    if (!a || !a.asset) return;
    const thumb = row.querySelector('.thumb');
    try {
      const html = await createThumbnail(a.asset);
      if (row.isConnected) thumb.innerHTML = html;
    } catch (e) {
      logDiag('assign thumb error: ' + (e.message || e));
    }
  });
}

function renderAssignmentsManager() {
  if (!assignments.length) {
    assignmentsListManager.innerHTML = '<div class="row"><div class="info">No assignments yet</div></div>';
    return;
  }
  assignmentsListManager.innerHTML = assignments.map(a => {
    const asset = a.asset || {};
    return `<div class="row">
      <div class="info">
        <div class="title">Key ${a.key_number || '?'}</div>
        <div class="meta">${esc(asset.title || 'Unknown')} • ${esc(asset.station || 'Unknown')}</div>
      </div>
      <div><button class="btn btn-danger" data-del-id="${a.id}">Remove</button></div>
    </div>`;
  }).join('');

  assignmentsListManager.querySelectorAll('[data-del-id]').forEach(btn => {
    btn.addEventListener('click', () => deleteAssignment(btn.getAttribute('data-del-id')));
  });
}

function updateKeyButtons() {
  keyButtons.forEach(btn => {
    btn.classList.remove('assigned', 'playing');
    const key = Number(btn.dataset.key);
    const asn = assignments.find(a => Number(a.key_number) === key);
    if (asn) btn.classList.add('assigned');
  });
  reflectPlaying();
}

function reflectPlaying() {
  keyButtons.forEach(btn => btn.classList.remove('playing'));
  if (playing && playing.key) {
    const btn = keyButtons.find(b => Number(b.dataset.key) === Number(playing.key));
    if (btn) btn.classList.add('playing');
    currentInfo.style.display = 'block';
    currentTitle.textContent = playing.asset?.title ? `Now Playing — ${playing.asset.title}` : 'Now Playing';
    currentMeta.textContent = [playing.asset?.station || '', playing.asset?.file_type || ''].filter(Boolean).join(' • ');
  } else {
    currentInfo.style.display = 'none';
  }
}

async function ensureXanoAssetFromUnified(asset) {
  if (!asset) return null;
  if (asset.source === 'xano') {
    const idStr = String(asset.id || '').split(':')[1] || String(asset.id);
    const nid = Number(idStr);
    return Number.isFinite(nid) ? nid : null;
  }
  const payload = {
    title: asset.title || 'Untitled',
    description: asset.description || '',
    station: asset.station || '',
    tags: asset.tags || '',
    thumbnail: asset.thumbnail || '',
    database_url: asset.media_url || asset.url || '',
    file_url: asset.file_url || '',
    file_type: asset.file_type || '',
    submitted_by: asset.submitted_by || ''
  };
  const created = await xano('asset', { method: 'POST', body: JSON.stringify(payload) });
  return created && created.id ? Number(created.id) : null;
}

async function assignSelectedToKey() {
  const key = Number(keySelect.value);
  if (!key) { show('error', 'Choose a key slot'); return; }
  if (!selectedUnified) { show('error', 'Select a media item first'); return; }

  const assetId = await ensureXanoAssetFromUnified(selectedUnified);
  if (!assetId) { show('error', 'Could not resolve asset'); return; }

  if (selectedUnified.source === 'xano') {
    const updates = {
      title: titleInput.value || '',
      description: descriptionInput.value || '',
      station: stationInput.value || '',
      tags: tagsInput.value || '',
      submitted_by: submittedByInput.value || ''
    };
    await xano('asset/' + assetId, { method: 'PUT', body: JSON.stringify(updates) });
  }

  addMemory();

  const existing = assignments.find(a => Number(a.key_number) === key);
  if (existing) {
    await xano('voxpro_assignments/' + existing.id, {
      method: 'PUT',
      body: JSON.stringify({ key_number: key, asset_id: assetId })
    });
  } else {
    await xano('voxpro_assignments', {
      method: 'POST',
      body: JSON.stringify({ key_number: key, asset_id: assetId })
    });
  }

  show('success', 'Key assigned');
  await loadAssignments();
  updateKeyButtons();
}

async function deleteAssignment(id) {
  if (!id) return;
  await xano('voxpro_assignments/' + id, { method: 'DELETE' });
  show('success', 'Assignment removed');
  await loadAssignments();
}

/* ===== Player / Modal ===== */
function clearActiveMedia() {
  try { if (activeMediaEl) { activeMediaEl.pause?.(); activeMediaEl.src = ''; } } catch {}
  activeMediaEl = null;
}

async function ensurePlayable(el) {
  try {
    await el.play();
    tapOverlay.style.display = 'none';
  } catch {
    tapOverlay.style.display = 'flex';
    tapOverlay.style.zIndex = '2';
    tapPlayBtn.onclick = async () => {
      try { await el.play(); tapOverlay.style.display = 'none'; } catch (e) { logDiag('play blocked: ' + (e?.message || e)); }
    };
  }
}

function openMediaModal(asset) {
  mediaPlayer.innerHTML = '';
  mediaPlayer.style.position = 'relative';
  tapOverlay.style.display = 'none';
  tapOverlay.style.zIndex = '2';
  mediaPlayer.appendChild(tapOverlay);

  mediaDescription.textContent = asset.description || '';
  modalTitle.textContent = asset.title || 'Player';

  const url = asset.media_url || asset.database_url || asset.file_url || asset.url || '';
  if (!url) { show('error', 'No media URL on this asset'); mediaModal.style.display = 'block'; return; }

  const type = (asset.file_type || detectType(asset) || '').toLowerCase();
  let el = null;

  if (type.includes('audio')) {
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateRows = '1fr auto';
    wrap.style.height = '100%';

    const canvas = document.createElement('canvas');
    canvas.width = 460; canvas.height = 220;
    canvas.style.margin = '8px';
    canvas.style.background = '#0b0b0b';

    const audio = document.createElement('audio');
    audio.controls = true; audio.autoplay = false; audio.style.width = '100%'; audio.playsInline = true;
    const src = document.createElement('source'); src.src = url; audio.appendChild(src);

    wrap.appendChild(canvas); wrap.appendChild(audio);
    mediaPlayer.prepend(wrap);
    activeMediaEl = audio;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
        const msrc = ctx.createMediaElementSource(audio);
        msrc.connect(analyser); analyser.connect(ctx.destination);
        const g = canvas.getContext('2d');
        (function draw() {
          requestAnimationFrame(draw);
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteTimeDomainData(data);
          g.clearRect(0, 0, canvas.width, canvas.height);
          g.strokeStyle = '#00ff88'; g.lineWidth = 2; g.beginPath();
          const slice = canvas.width / data.length; let x = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] / 128) - 1;
            const y = (canvas.height / 2) + v * (canvas.height / 2 - 10);
            i ? g.lineTo(x, y) : g.moveTo(x, y); x += slice;
          }
          g.stroke();
        })();
      }
    } catch (e) { logDiag('audio viz error: ' + (e.message || e)); }

    mediaModal.style.display = 'block';
    ensurePlayable(audio);
    return;
  }

  if (type.includes('video')) {
    el = document.createElement('video');
    el.controls = true; el.autoplay = false; el.style.maxWidth = '100%'; el.style.maxHeight = '100%'; el.playsInline = true;
    const s = document.createElement('source'); s.src = url + '#t=0.1'; el.appendChild(s);
    mediaPlayer.prepend(el);
    activeMediaEl = el;
    mediaModal.style.display = 'block';
    ensurePlayable(el);
    return;
  }

  if (type.includes('image')) {
    el = document.createElement('img');
    el.alt = asset.title || '';
    el.src = url;
    el.style.maxWidth = '100%'; el.style.maxHeight = '100%';
  } else if (type.includes('pdf')) {
    el = document.createElement('embed');
    el.type = 'application/pdf'; el.src = url;
    el.style.width = '100%'; el.style.height = '100%';
  } else {
    const div = document.createElement('div');
    div.style.padding = '16px';
    div.textContent = 'Preview not available';
    el = div;
  }

  mediaPlayer.prepend(el);
  mediaModal.style
