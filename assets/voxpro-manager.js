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
const MEDIA_PROXY = '/.netlify/functions/fetch-media?url=';
const ASSIGNMENTS_REFRESH_MS = 30000;

/* ===== State ===== */
let unifiedResults = [];
let assignments = [];
let selectedUnified = null;
let playing = null;
let connGood = false;
let searchEndpointChosen = null;
let activeMediaEl = null;
let debugMode = true; // Set to true for debugging

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
// Debug logging helper
function log(message, data = null) {
  if (debugMode) {
    console.log(`[VoxPro] ${message}`, data || '');
  }
}

const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

function show(type, msg) {
  log(`Alert: ${type} - ${msg}`);
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

function proxiedUrl(url) {
  if (!url || typeof url !== 'string' || url.startsWith('blob:')) {
    log('proxiedUrl: URL not processed:', url);
    return url;
  }
  const proxied = MEDIA_PROXY + encodeURIComponent(url);
  log('proxiedUrl: Original:', url);
  log('proxiedUrl: Proxied:', proxied);
  return proxied;
}

function getAssetUrl(item) {
  if (!item || typeof item !== 'object') {
    log('getAssetUrl: Invalid item:', item);
    return '';
  }

  // Debug what fields are available
  console.error('getAssetUrl: Asset fields detailed:', JSON.stringify(item, null, 2));
  
  // Prioritize common top-level URL fields
  let url = item.media_url || item.database_url || item.file_url || item.url || item.public_url || item.signed_url || item.path;
  console.error('getAssetUrl: First attempt URL:', url);
  
  if (typeof url === 'string' && (url.startsWith('http') || url.startsWith('blob:'))) {
    return url;
  }

  // Try additional fields that might contain the URL
  url = item.download_url || item.source_url || item.stream_url;
  console.error('getAssetUrl: Second attempt URL:', url);
  
  if (typeof url === 'string' && (url.startsWith('http') || url.startsWith('blob:'))) {
    return url;
  }

  // Check for a 'file' object, which is a common pattern
  if (item.file && typeof item.file === 'object') {
    console.error('getAssetUrl: Checking file object:', JSON.stringify(item.file, null, 2));
    url = item.file.url || item.file.path || item.file.public_url;
    console.error('getAssetUrl: File object URL:', url);
    
    if (typeof url === 'string' && (url.startsWith('http') || url.startsWith('blob:'))) {
      return url;
    }
  }

  // Last resort: check the thumbnail field if it's a string url
  if (typeof item.thumbnail === 'string' && (item.thumbnail.startsWith('http') || item.thumbnail.startsWith('blob:'))) {
    log('getAssetUrl: Using thumbnail as fallback:', item.thumbnail);
    return item.thumbnail;
  }

  // Fallback for any other string properties that look like URLs
  for (const key in item) {
    const value = item[key];
    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('blob:'))) {
      log('getAssetUrl: Found URL in field:', key, value);
      return value;
    }
  }

  log('getAssetUrl: No URL found in asset:', item);
  return ''; // Always return a string
}

/* ===== API ===== */
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}

async function xano(endpoint, opts = {}) {
  try {
    const url = `${XANO_PROXY_BASE}/${endpoint}`;
    log(`XANO Request -> ${opts.method || 'GET'} ${url}`);
    if (opts.body) {
      try {
        log('XANO Request Body:', JSON.parse(opts.body));
      } catch {
        log('XANO Request Body (non-JSON):', opts.body);
      }
    }

    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });

    const responseText = await r.text();
    if (!r.ok) {
        console.error(`XANO Response Error ${r.status} ${r.statusText} for ${url}`, responseText);
        throw new Error(`${r.status} ${r.statusText}`);
    }

    const j = JSON.parse(responseText);
    log(`XANO Response <- ${url}`, j);

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
  const u = getAssetUrl(item).toLowerCase();
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

let _mammothReady = null;
function loadMammothJs() {
  if (_mammothReady) return _mammothReady;
  _mammothReady = new Promise((res, rej) => {
    if (window.mammoth) return res(window.mammoth);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.10.0/mammoth.browser.js';
    script.onload = () => {
        if(window.mammoth) {
            res(window.mammoth);
        } else {
            rej(new Error('mammoth.js loaded but global not found'));
        }
    };
    script.onerror = () => rej(new Error('Failed to load mammoth.js'));
    document.head.appendChild(script);

    setTimeout(() => { if (!window.mammoth) rej(new Error('mammoth.js not loaded')); }, 5000);
  }).catch(() => null);
  return _mammothReady;
}

async function pdfPageThumb(url) {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return null;
  try {
    const pdf = await pdfjs.getDocument(proxiedUrl(url)).promise;
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

async function renderPdfInModal(url, container) {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) {
    container.textContent = 'Failed to load PDF viewer.';
    return;
  }

  container.innerHTML = '<div>Loading PDF...</div>';
  container.style.overflow = 'auto';
  container.style.height = '100%';
  container.style.textAlign = 'center';

  try {
    const pdf = await pdfjs.getDocument({ url, CMapReaderFactory: null, CMapPacked: true }).promise;
    let currentPageNum = 1;
    const numPages = pdf.numPages;

    const canvas = document.createElement('canvas');
    const controls = document.createElement('div');
    controls.style.padding = '10px';
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Prev';
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    const pageNumSpan = document.createElement('span');
    pageNumSpan.style.margin = '0 10px';

    controls.appendChild(prevButton);
    controls.appendChild(pageNumSpan);
    controls.appendChild(nextButton);

    container.innerHTML = '';
    container.appendChild(controls);
    container.appendChild(canvas);

    const renderPage = async (num) => {
      try {
        const page = await pdf.getPage(num);
        const viewport = page.getViewport({ scale: 1.5 });
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
        pageNumSpan.textContent = `Page ${num} of ${numPages}`;
        prevButton.disabled = num <= 1;
        nextButton.disabled = num >= numPages;
      } catch(e) {
        console.error('Error rendering page', e);
        container.textContent = 'Error rendering PDF page.';
      }
    };

    prevButton.addEventListener('click', () => {
      if (currentPageNum > 1) {
        currentPageNum--;
        renderPage(currentPageNum);
      }
    });

    nextButton.addEventListener('click', () => {
      if (currentPageNum < numPages) {
        currentPageNum++;
        renderPage(currentPageNum);
      }
    });

    renderPage(currentPageNum);

  } catch (error) {
    console.error('Error rendering PDF:', error);
    if (error.message && error.message.includes('CORS')) {
       container.innerHTML = 'Error loading PDF: A Cross-Origin (CORS) issue is preventing the file from being loaded. The server hosting the PDF must allow requests from this website.';
    } else {
       container.textContent = 'Error loading PDF file. It may be corrupt or in an unsupported format.';
    }
  }
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
  const rawMediaUrl = getAssetUrl(item);
  const mediaUrl = proxiedUrl(rawMediaUrl);

  let rawTurl = item.thumbnail || '';
  if (rawTurl && typeof rawTurl !== 'string') {
    rawTurl = getAssetUrl(rawTurl);
  }
  const turl = proxiedUrl(rawTurl);
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
    const data = await pdfPageThumb(rawMediaUrl); // use raw url for thumb
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
  log('Loading assignments from Xano');
  const data = await xano('voxpro_assignments');
  console.error('Raw assignments data from Xano:', JSON.stringify(data, null, 2));
  
  if (!data) { assignments = []; forceUpdateUI(); return; }
  assignments = data.sort((a, b) => (a.key_number || 0) - (b.key_number || 0));

  for (const a of assignments) {
    if (a.asset_id != null) {
      try {
        const asset = await xano('asset/' + a.asset_id);
        console.error('Asset data from Xano for ID ' + a.asset_id + ':', JSON.stringify(asset, null, 2));
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
  // Show overlay only if autoplay/interaction is blocked
  try {
    await el.play();
    tapOverlay.style.display = 'none';
  } catch (err) {
    console.error('Media autoplay error:', err);
    tapOverlay.style.display = 'flex';
    tapOverlay.style.zIndex = '2';
    tapPlayBtn.onclick = async () => {
      try { 
        console.log('User clicked play button, attempting to play media');
        await el.play(); 
        tapOverlay.style.display = 'none'; 
      } catch (err) {
        console.error('Play failed even after user interaction:', err);
      }
    };
  }
}

function openMediaModal(asset) {
  log('Opening media modal for asset:', asset);
  console.error('Asset object in openMediaModal:', JSON.stringify(asset, null, 2));
  // IMPORTANT FIX: Clear the media player first
  mediaPlayer.innerHTML = '';
  mediaPlayer.style.position = 'relative';
  
  // Prepare tap overlay for mobile devices
  tapOverlay.style.display = 'none';
  tapOverlay.style.zIndex = '2';
  mediaPlayer.appendChild(tapOverlay);

  // Set description and title
  mediaDescription.textContent = asset.description || '';
  modalTitle.textContent = asset.title || 'Player';

  // Get media URL
  const rawUrl = getAssetUrl(asset);
  console.error('Raw URL from getAssetUrl:', rawUrl);
  
  log('Raw media URL:', rawUrl);
  if (!rawUrl) { 
    show('error', 'No media URL found on this asset'); 
    console.error('No media URL found on asset:', asset);
    mediaModal.style.display = 'block'; 
    return; 
  }
  
  // Create proxy URL
  const url = proxiedUrl(rawUrl);
  log('Proxied media URL:', url);
  
  // Detect media type
  const type = (asset.file_type || detectType(asset) || '').toLowerCase();
  log('Detected media type:', type);
  let el = null;

  // Create appropriate player based on media type
  if (type.includes('audio')) {
    log('Creating audio player');
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateRows = '1fr auto';
    wrap.style.height = '100%';

    const canvas = document.createElement('canvas');
    canvas.width = 460; canvas.height = 220;
    canvas.style.margin = '8px';
    canvas.style.background = '#0b0b0b';

    const audio = document.createElement('audio');
    audio.controls = true; 
    audio.autoplay = false; 
    audio.style.width = '100%'; 
    audio.playsInline = true;
    audio.crossOrigin = 'anonymous'; // Try with crossOrigin
    
    // Add error handling for audio
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      console.error('Audio error code:', audio.error ? audio.error.code : 'unknown');
      console.error('Audio error message:', audio.error ? audio.error.message : 'unknown');
      show('error', `Audio playback error: ${audio.error ? audio.error.message : 'Unknown error'}`);
    });
    
    // Add debugging for successful load
    audio.addEventListener('loadeddata', () => {
      log('Audio loaded successfully');
    });
    
    const src = document.createElement('source'); 
    src.src = url; 
    audio.appendChild(src);

    wrap.appendChild(canvas); 
    wrap.appendChild(audio);
    mediaPlayer.prepend(wrap);
    activeMediaEl = audio;

    // oscilloscope (best-effort)
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
    } catch (err) {
      console.error('Oscilloscope setup error:', err);
    }

    // IMPORTANT: Show modal before attempting to play
    mediaModal.style.display = 'block';
    ensurePlayable(audio);
    return;
  }

  if (type.includes('video')) {
    log('Creating video player');
    el = document.createElement('video');
    el.controls = true; 
    el.autoplay = false; 
    el.style.maxWidth = '100%'; 
    el.style.maxHeight = '100%'; 
    el.playsInline = true;
    el.crossOrigin = 'anonymous'; // Try with crossOrigin
    
    // Add error handling for video
    el.addEventListener('error', (e) => {
      console.error('Video error:', e);
      console.error('Video error code:', el.error ? el.error.code : 'unknown');
      console.error('Video error message:', el.error ? el.error.message : 'unknown');
      show('error', `Video playback error: ${el.error ? el.error.message : 'Unknown error'}`);
    });
    
    // Add debugging for successful load
    el.addEventListener('loadeddata', () => {
      log('Video loaded successfully');
    });
    
    const s = document.createElement('source'); 
    s.src = url + '#t=0.1'; 
    el.appendChild(s);
    mediaPlayer.prepend(el);
    activeMediaEl = el;

    // IMPORTANT: Show modal before attempting to play
    mediaModal.style.display = 'block';
    ensurePlayable(el);
    return;
  }

  if (type.includes('image')) {
    log('Creating image viewer');
    el = document.createElement('img');
    el.alt = asset.title || '';
    el.src = url;
    el.style.maxWidth = '100%'; 
    el.style.maxHeight = '100%';
    
    // Add error handling for image
    el.addEventListener('error', (e) => {
      console.error('Image error:', e);
      show('error', 'Image failed to load');
    });
    
    // Add debugging for successful load
    el.addEventListener('load', () => {
      log('Image loaded successfully');
    });
    
  } else if (type.includes('pdf')) {
    log('Creating PDF viewer');
    const pdfContainer = document.createElement('div');
    pdfContainer.style.width = '100%';
    pdfContainer.style.height = '100%';
    pdfContainer.style.background = '#333';
    renderPdfInModal(url, pdfContainer);
    el = pdfContainer;
  } else if (type.includes('doc')) {
    log('Creating document viewer');
    const docContainer = document.createElement('div');
    docContainer.style.width = '100%';
    docContainer.style.height = '100%';
    docContainer.style.overflowY = 'auto';
    docContainer.style.background = 'white';
    docContainer.style.color = 'black';
    docContainer.style.padding = '20px';
    docContainer.style.boxSizing = 'border-box';
    docContainer.innerHTML = '<div>Loading document...</div>';

    (async () => {
        const mammoth = await loadMammothJs();
        if (!mammoth) {
            docContainer.innerHTML = 'Failed to load document viewer component.';
            return;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch docx file. Status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            docContainer.innerHTML = result.value;
        } catch (error) {
            console.error('Error rendering DOCX:', error);
            docContainer.innerHTML = 'Error loading DOCX file. It may be corrupt or have network issues.';
        }
    })();
    el = docContainer;
  } else {
    log('No specific viewer available for this type');
    const div = document.createElement('div');
    div.style.padding = '16px';
    div.textContent = 'Preview not available';
    el = div;
  }

  mediaPlayer.prepend(el);
  // IMPORTANT: Always show modal at the end
  mediaModal.style.display = 'block';
}

function closeMediaModal() {
  clearActiveMedia();
  mediaModal.style.display = 'none';
  tapOverlay.style.display = 'none';
}

function playKey(keyNum) {
  log('playKey called for key:', keyNum);
  const asn = assignments.find(a => Number(a.key_number) === Number(keyNum));
  if (!asn) { 
    show('error', 'No assignment for that key'); 
    console.error('No assignment found for key:', keyNum);
    return; 
  }
  
  const asset = asn.asset || {};
  // Add verbose logging for debugging
  console.error('ASSET OBJECT:', JSON.stringify(asset, null, 2));
  console.error('ASSET URL FIELDS:', {
    media_url: asset.media_url,
    database_url: asset.database_url,
    file_url: asset.file_url,
    url: asset.url,
    thumbnail: asset.thumbnail
  });
  
  log('Found asset for key:', asset);
  playing = { key: keyNum, asset };
  reflectPlaying();
  
  // IMPORTANT: Set a short timeout before opening modal
  // This ensures DOM is ready for modal display
  setTimeout(() => {
    openMediaModal(asset);
  }, 50);
}

function stopPlayback() {
  playing = null;
  reflectPlaying();
  clearActiveMedia();
}

/* ===== Drag + Resize ===== */
(function dragAndResize() {
  const modal = sheet, header = sheetHeader, grip = sheetResize;

  // Drag
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  function onDown(x, y) {
    dragging = true;
    const rect = modal.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    startX = x; startY = y;
    modal.style.right = 'auto'; modal.style.bottom = 'auto';
    document.body.style.userSelect = 'none';
  }
  function onMove(x, y) {
    if (!dragging) return;
    const dx = x - startX, dy = y - startY;
    modal.style.left = (startLeft + dx) + 'px';
    modal.style.top = (startTop + dy) + 'px';
  }
  function onUp() { dragging = false; document.body.style.userSelect = ''; }

  header.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  document.addEventListener('mouseup', onUp);

  header.addEventListener('touchstart', e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('touchmove', e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('touchend', onUp);

  // Resize
  let resizing = false, rStartX = 0, rStartY = 0, startW = 0, startH = 0;
  function rDown(x, y) {
    resizing = true; rStartX = x; rStartY = y;
    const rect = modal.getBoundingClientRect();
    startW = rect.width; startH = rect.height;
    document.body.style.userSelect = 'none';
  }
  function rMove(x, y) {
    if (!resizing) return;
    const dx = x - rStartX, dy = y - rStartY;
    modal.style.width = Math.max(360, startW + dx) + 'px';
    modal.style.height = Math.max(320, startH + dy) + 'px';
  }
  function rUp() { resizing = false; document.body.style.userSelect = ''; }

  grip.addEventListener('mousedown', e => { e.stopPropagation(); rDown(e.clientX, e.clientY); });
  document.addEventListener('mousemove', e => rMove(e.clientX, e.clientY));
  document.addEventListener('mouseup', rUp);

  grip.addEventListener('touchstart', e => { e.stopPropagation(); const t = e.touches[0]; rDown(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('touchmove', e => { const t = e.touches[0]; rMove(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('touchend', rUp);
})();

/* ===== Init & Events ===== */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing VoxPro Manager...');
  populateDatalistsFromMemory();
  await loadAssignments();
  await unifiedSearch('');
  setInterval(loadAssignments, ASSIGNMENTS_REFRESH_MS);
  console.log('VoxPro Manager initialized successfully');
  
  // Make debug panel visible if in debug mode
  if (debugMode) {
    const debugPanel = document.createElement('div');
    debugPanel.className = 'panel';
    debugPanel.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">Debug Tools</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <button onclick="window.testModal('https://storage.googleapis.com/webfundamentals-assets/videos/chrome.mp4', 'video')">Test Video</button>
        <button onclick="window.testModal('https://file-examples.com/storage/fe9278ad7f642dbd39ac5c9/2017/11/file_example_MP3_700KB.mp3', 'audio')">Test Audio</button>
        <button onclick="window.testModal('https://picsum.photos/800/600', 'image')">Test Image</button>
        <button onclick="window.testModal('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf')">Test PDF</button>
      </div>
      <div id="debug-log" style="max-height:200px;overflow:auto;background:#0b0b0b;padding:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;"></div>
    `;
    document.body.appendChild(debugPanel);
    
    // Override console.log to also show in debug panel
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      const logEl = document.getElementById('debug-log');
      if (logEl) {
        const msg = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        logEl.innerHTML += `<div>${new Date().toISOString().split('T')[1].split('.')[0]} ${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
      }
    };
  }
});

searchInput.addEventListener('input', () => unifiedSearch(searchInput.value));
assignButton.addEventListener('click', assignSelectedToKey);
keyButtons.forEach(btn => btn.addEventListener('click', () => playKey(btn.dataset.key)));
stopButton.addEventListener('click', stopPlayback);
modalClose.addEventListener('click', closeMediaModal);
mediaModal.addEventListener('click', (e) => { if (e.target === mediaModal) closeMediaModal(); });
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (/[1-5]/.test(k)) { playKey(Number(k)); }
  else if (k === ' ') { e.preventDefault(); stopPlayback(); }
  else if (k === 'Escape') { closeMediaModal(); }
});

// Add test function for manual testing
window.testModal = function(url, type) {
  console.log('Manual test: opening modal with URL:', url, 'type:', type);
  openMediaModal({
    title: 'Test Media',
    description: 'This is a test media item.',
    file_type: type || 'video',
    media_url: url
  });
};

// Direct CORS test function
window.testFetch = async function(url) {
  console.log('Testing direct fetch for URL:', url);
  try {
    const response = await fetch(url, { mode: 'cors' });
    console.log('Fetch response:', response);
    console.log('Response headers:', response.headers);
    console.log('Response status:', response.status);
    if (response.ok) {
      console.log('Direct fetch succeeded');
    } else {
      console.error('Direct fetch failed with status:', response.status);
    }
  } catch (err) {
    console.error('Direct fetch error:', err);
  }
  
  console.log('Testing proxied fetch for URL:', url);
  try {
    const proxiedUrl = MEDIA_PROXY + encodeURIComponent(url);
    const response = await fetch(proxiedUrl);
    console.log('Proxied fetch response:', response);
    console.log('Response headers:', response.headers);
    console.log('Response status:', response.status);
    if (response.ok) {
      console.log('Proxied fetch succeeded');
    } else {
      console.error('Proxied fetch failed with status:', response.status);
    }
  } catch (err) {
    console.error('Proxied fetch error:', err);
  }
};
