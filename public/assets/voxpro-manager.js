// ========== GLOBAL ERROR SURFACE ==========
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

// ===== pdf.js worker (safe) =====
window.addEventListener('load', () => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
});

/* ===== Config ===== */
const FUNCTIONS_ORIGIN = 'https://majestic-beijinho-cd3d75.netlify.app';
const MEDIA_PROXY = FUNCTIONS_ORIGIN + '/.netlify/functions/fetch-media?url=';

const SEARCH_API_PRIMARY = FUNCTIONS_ORIGIN + '/.netlify/functions/search-media';
const SEARCH_API_SECONDARY = '';
const XANO_PROXY_BASE = FUNCTIONS_ORIGIN + '/.netlify/functions/xano-proxy';
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

/* ===== API wrappers ===== */
async function xano(endpoint, opts = {}) {
  try {
    const url = `${XANO_PROXY_BASE}/${endpoint}`
      .replace(/(?<!:)\/{2,}/g, '/')
      .replace('https:/', 'https://');
    const r = await fetchWithTimeout(url, {
      method: (opts && opts.method) || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      mode: 'cors',
      credentials: 'omit',
      ...opts
    }, 12000);
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`${r.status} ${r.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
    }
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

/* ===== Memory (datalists) ===== */
const LS_TITLES = 'voxpro_titles';
const LS_STATIONS = 'voxpro_stations';
const readSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
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

/* ===== Type detect ===== */
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

/* ===== Build a fetchable URL via the proxy ===== */
function proxied(url) {
  if (!url) return '';
  // If it’s already our proxy, keep it. Otherwise wrap it.
  if (url.startsWith(MEDIA_PROXY)) return url;
  return MEDIA_PROXY + encodeURIComponent(url);
}
function assetUrl(a) {
  return a?.media_url || a?.database_url || a?.file_url || a?.url || '';
}

/* ===== Thumbnails (CORS-safe) ===== */
async function createThumbnail(item) {
  const raw = item.thumbnail || assetUrl(item);
  const url = raw ? proxied(raw) : '';
  const type = detectType(item);

  if (!url) {
    if (type.includes('audio')) return '<div class="icon">🎵</div>';
    if (type.includes('video')) return '<div class="icon">🎬</div>';
    if (type.includes('pdf'))   return '<div class="icon">📄</div>';
    if (type.includes('doc'))   return '<div class="icon">📝</div>';
    if (type.includes('sheet')) return '<div class="icon">📊</div>';
    return '<div class="icon">📁</div>';
  }

  if (type.includes('image')) {
    return `<img src="${esc(url)}" onerror="this.outerHTML='<div class=&quot;icon&quot;>🖼️</div>'" />`;
  }
  if (type.includes('video')) {
    return `<video muted preload="metadata" playsinline onerror="this.outerHTML='<div class=&quot;icon&quot;>🎬</div>'">
              <source src="${esc(url)}#t=0.1">
            </video>`;
  }
  if (type.includes('audio'))  return '<div class="icon">🎵</div>';
  if (type.includes('pdf'))    return '<div class="icon">📄</div>';
  if (type.includes('doc'))    return '<div class="icon">📝</div>';
  if (type.includes('sheet'))  return '<div class="icon">📊</div>';
  return `<img src="${esc(url)}" onerror="this.outerHTML='<div class=&quot;icon&quot;>📁</div>'" />`;
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
            data = await fetchJSON(url, { mode: 'cors' });
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

/* ===== Media list ===== */
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
    thumb.innerHTML = '<div class="icon">📁</div>';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<div class="title">${esc(r.title || 'Untitled')}</div>
                      <div class="meta">${esc(r.station || 'Unknown')} • ${esc(r.source || '')}</div>`;

    row.appendChild(thumb);
    row.appendChild(info);
    mediaBrowser.appendChild(row);

    (async () => {
      try {
        const html = await createThumbnail(r);
        if (row.isConnected) thumb.innerHTML = html;
      } catch (e) { console.warn('thumb error', e); }
    })();

    row.addEventListener('click', () => {
      mediaBrowser.querySelectorAll('.row').forEach(n => n.classList.remove('selected'));
      row.classList.add('selected');
      const asset =
