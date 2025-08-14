// Worker (pdf.js)
window.addEventListener('load', () => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
});

/* ===== Config ===== */
const SEARCH_API_PRIMARY = 'https://majestic-beijinho-cd3d75.netlify.app/.netlify/functions/search-media';
const SEARCH_API_SECONDARY = '';
const XANO_PROXY_BASE = 'https://majestic-beijinho-cd3d75.netlify.app/.netlify/functions/xano-proxy';
const ASSIGNMENTS_REFRESH_MS = 30000;

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

/* ===== Utils ===== */
const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
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

/* ===== API ===== */
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}

async function xano(endpoint, opts = {}) {
  try {
    const r = await fetch(`${XANO_PROXY_BASE}/${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
    const j = await r.json();
    setConn(true);
    return j;
  } catch (err) {
    console.error('Xano error:', err);
    setConn(false);
    show('error', 'Xano: ' + err.message);
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
      v.muted = true;
      v.preload = 'metadata';
      v.src = url + (url.includes('#') ? '' : '#t=0.2');
      v.playsInline = true;
      v.onloadeddata = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 128; c.height = 128;
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
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return null;
  try {
    const pdf = await pdfjs.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const v = page.getViewport({ scale: .5 });
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    c.width = 128; c.height = 128;
    const s = Math.min(c.width / v.width, c.height / v.height);
    const v2 = page.getViewport({ scale: s });
    const off = document.createElement('canvas');
    off.width = v2.width; off.height = v2.height;
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
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error('audio fetch failed');
    const buf = await resp.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const ch = audio.getChannelData(0);
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
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

  // Prefer server-provided thumbnail (no CORS/canvas needed)
  if (turl) {
    return `<img src="${esc(turl)}" onload="this.style.opacity=1" onerror="this.style.display='none'" style="opacity:0;transition:opacity .3s">`;
  }

  if (type.includes('image') && mediaUrl) {
    // Plain <img> works cross-origin
    return `<img src="${esc(mediaUrl)}" onload="this.style.opacity=1" onerror="this.style.display='none'" style="opacity:0;transition:opacity .3s">`;
  }

  if (type.includes('video') && mediaUrl) {
    // Try canvas thumbnail; fallback to <video> element
    const data = await createVideoThumb(mediaUrl);
    return data ? `<img src="${data}">`
                : `<video muted preload="metadata" playsinline><source src="${esc(mediaUrl)}#t=1"></video>`;
  }

  if (type.includes('pdf') && mediaUrl) {
    const data = await pdfPageThumb(mediaUrl);
    return data ? `<img src="${data}">` : '<div class="icon">📄</div>';
  }

  if (type.includes('audio') && mediaUrl) {
    const data = await renderAudioWaveThumb(mediaUrl);
    return data ? `<img src="${data}" alt="waveform">` : '<div class="icon">🎵</div>';
  }

  if (type.includes('doc'))  return '<div class="icon">📝</div>';
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

        for (const ep of endpoints) {
          try {
            const url = ep + '?' + (q ? ('q=' + encodeURIComponent(q) + '&') : '') + 'limit=100';
            data = await fetchJSON(url);
            searchEndpointChosen = ep;
            break;
          } catch (e) { lastErr = e; }
        }

        if (!data) {
          const assets = await xano('asset');
          if (!assets) throw lastErr || new Error('No search endpoint responded');
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
        console.error(e);
        setConn(false);
        show('error', 'Search failed');
        resolve([]);
      }
    }, 180);
  });
}

/* Render list with async thumbnail updates (no race conditions) */
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
      } catch {}
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
  const data = await xano('voxpro_assignments');
  if (!data) { assignments = []; forceUpdateUI(); return; }
  assignments = data.sort((a, b) => (a.key_number || 0) - (b.key_number || 0));

  for (const a of assignments) {
    if (a.asset_id != null) {
      try {
        const asset = await xano('asset/' + a.asset_id);
        a.asset = asset || { id: a.asset_id, title: `Missing Asset ${a.asset_id}`, station: 'Unknown', file_type: 'unknown' };
      } catch {
        a.asset = { id: a.asset_id, title: `Missing Asset ${a.asset_id}`, station: 'Unknown', file_type: 'unknown' };
      }
    } else {
      a.asset = { title: 'No Asset ID', station: 'Unknown', file_type: 'none' };
    }
  }
  forceUpdateUI();
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
    } catch {}
  });
}

function renderAssignmentsManager() {
  if (!assignments.length) {
    assignmentsListManager.innerHTML = '<div class="row"><div class="info">No assignmen
