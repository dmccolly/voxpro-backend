// Enhanced VoxPro Manager JavaScript
// Fixes modal loading issues and improves error handling

// Global variables
let assignments = [];
let selectedKey = null;
let isInitialized = false;
let modalInstance = null;
let modalContent = null;
let debugMode = true; // Set to false for production

// Debug logging helper
function log(message, data = null) {
  if (debugMode) {
    console.log(`[VoxPro] ${message}`, data || '');
  }
}

// Error display function
function show(type, message) {
  const alertEl = document.getElementById('alert');
  if (!alertEl) {
    log('Alert element not found', { type, message });
    return;
  }
  
  alertEl.innerHTML = message;
  alertEl.className = `alert alert-${type}`;
  alertEl.style.display = 'block';
  
  // Auto-hide non-error alerts after 3 seconds
  if (type !== 'danger') {
    setTimeout(() => {
      alertEl.style.display = 'none';
    }, 3000);
  }
}

// Initialize the application
async function init() {
  if (isInitialized) {
    log('Already initialized, skipping');
    return;
  }
  
  log('Initializing VoxPro Manager');
  
  try {
    // Ensure the modal element exists
    if (!document.getElementById('playerModal')) {
      log('Creating modal element');
      createModalElement();
    }
    
    // Initialize Bootstrap modal
    const modalEl = document.getElementById('playerModal');
    modalInstance = new bootstrap.Modal(modalEl, {
      backdrop: 'static',
      keyboard: true
    });
    
    // Set up modal content reference
    modalContent = document.getElementById('modal-content');
    if (!modalContent) {
      log('Modal content element not found');
      throw new Error('Modal content element not found');
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Load assignments
    await loadAssignments();
    
    isInitialized = true;
    log('Initialization complete');
    
  } catch (error) {
    console.error('Initialization failed:', error);
    show('danger', `Initialization failed: ${error.message}`);
  }
}

// Create modal element if it doesn't exist
function createModalElement() {
  const modalHTML = `
    <div class="modal fade" id="playerModal" tabindex="-1" aria-labelledby="playerModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="playerModalLabel">Media Player</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="modal-content" class="d-flex justify-content-center align-items-center">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);
}

// Set up event listeners
function setupEventListeners() {
  log('Setting up event listeners');
  
  // Key press listeners
  document.addEventListener('keydown', handleKeyPress);
  
  // Modal events
  const playerModal = document.getElementById('playerModal');
  if (playerModal) {
    playerModal.addEventListener('hidden.bs.modal', () => {
      // Clear content when modal is closed
      if (modalContent) {
        modalContent.innerHTML = '';
      }
    });
  }
}

// Handle key press events
function handleKeyPress(event) {
  // Only handle number keys 1-5
  if (event.key >= '1' && event.key <= '5') {
    log(`Key pressed: ${event.key}`);
    playKey(event.key);
  }
}

// Load assignments from Xano API
async function loadAssignments() {
  log('Loading key assignments');
  
  try {
    const response = await fetch('/.netlify/functions/xano-proxy?endpoint=/key_assignments');
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    log('Assignments loaded:', data);
    
    assignments = data;
    displayAssignments();
    
    return data;
  } catch (error) {
    console.error('Failed to load assignments:', error);
    show('danger', `Failed to load assignments: ${error.message}`);
    return [];
  }
}

// Display assignments in the UI
function displayAssignments() {
  log('Displaying assignments');
  
  const container = document.getElementById('assignments');
  if (!container) {
    log('Assignments container not found');
    return;
  }
  
  container.innerHTML = '';
  
  assignments.forEach(assignment => {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">Key ${assignment.key_number}</h5>
        <p class="card-text">${assignment.title || 'No title'}</p>
        <p class="card-text text-muted">${assignment.media_type || 'Unknown'}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

// Play media for a specific key
function playKey(keyNum) {
  log('playKey called for key:', keyNum);
  
  const asn = assignments.find(a => Number(a.key_number) === Number(keyNum));
  
  if (!asn) { 
    show('warning', 'No assignment for that key'); 
    log('No assignment for key', keyNum);
    return;
  }
  
  log('Found assignment:', asn);
  
  try {
    // Show the modal first, then load content
    if (modalInstance) {
      modalInstance.show();
      
      // Set initial loading state
      if (modalContent) {
        modalContent.innerHTML = `
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        `;
      }
      
      // Load the content based on media type
      setTimeout(() => {
        loadMediaContent(asn);
      }, 100);
    } else {
      log('Modal instance not available');
      show('danger', 'Player not initialized properly');
    }
  } catch (error) {
    console.error('Error playing key:', error);
    show('danger', `Error playing media: ${error.message}`);
  }
}

// Load media content based on type
async function loadMediaContent(assignment) {
  log('Loading media content for assignment:', assignment);
  
  if (!modalContent) {
    log('Modal content element not found');
    return;
  }
  
  try {
    const mediaUrl = assignment.media_url;
    if (!mediaUrl) {
      throw new Error('Media URL is empty');
    }
    
    // Determine media type
    const mediaType = determineMediaType(assignment);
    log('Determined media type:', mediaType);
    
    // Create proxy URL for the media
    const proxyUrl = `/.netlify/functions/fetch-media?url=${encodeURIComponent(mediaUrl)}`;
    log('Proxy URL:', proxyUrl);
    
    // Load the appropriate media element
    switch (mediaType) {
      case 'image':
        loadImage(proxyUrl, assignment.title);
        break;
      case 'video':
        loadVideo(proxyUrl, assignment.title);
        break;
      case 'audio':
        loadAudio(proxyUrl, assignment.title);
        break;
      default:
        // Unknown media type, show error
        modalContent.innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i>
            Unknown media type for ${assignment.title || 'this media'}
          </div>
        `;
    }
  } catch (error) {
    console.error('Error loading media:', error);
    modalContent.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        Error loading media: ${error.message}
      </div>
    `;
  }
}

// Determine media type from assignment
function determineMediaType(assignment) {
  // First try the explicit media_type from the assignment
  if (assignment.media_type) {
    const type = assignment.media_type.toLowerCase();
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
  }
  
  // If not specified, try to determine from the URL
  const url = assignment.media_url || '';
  const ext = url.split('.').pop().toLowerCase();
  
  // Check file extension
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'image';
  } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) {
    return 'audio';
  }
  
  // Default to video as fallback
  return 'video';
}

// Load an image
function loadImage(url, title) {
  log('Loading image:', url);
  
  const img = new Image();
  
  // Show loading spinner until image loads
  modalContent.innerHTML = `
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  `;
  
  img.onload = () => {
    log('Image loaded successfully');
    modalContent.innerHTML = '';
    modalContent.appendChild(img);
    
    // Add title if provided
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'text-center mt-2';
      titleEl.textContent = title;
      modalContent.appendChild(titleEl);
    }
  };
  
  img.onerror = (error) => {
    console.error('Image failed to load:', error);
    modalContent.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        Failed to load image. Please try again.
      </div>
    `;
  };
  
  // Set image properties
  img.src = url;
  img.alt = title || 'Media content';
  img.className = 'img-fluid';
  img.style.maxHeight = '70vh';
}

// Load a video
function loadVideo(url, title) {
  log('Loading video:', url);
  
  // Create video element
  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = true;
  video.className = 'w-100';
  video.style.maxHeight = '70vh';
  
  // Add title element if provided
  let titleEl = null;
  if (title) {
    titleEl = document.createElement('div');
    titleEl.className = 'text-center mt-2';
    titleEl.textContent = title;
  }
  
  // Show loading state
  modalContent.innerHTML = `
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  `;
  
  // Video event handlers
  video.onloadeddata = () => {
    log('Video loaded successfully');
    modalContent.innerHTML = '';
    modalContent.appendChild(video);
    
    if (titleEl) {
      modalContent.appendChild(titleEl);
    }
  };
  
  video.onerror = (error) => {
    console.error('Video failed to load:', error);
    modalContent.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        Failed to load video. Please try again.
      </div>
    `;
  };
  
  // Set source and load
  const source = document.createElement('source');
  source.src = url;
  source.type = 'video/mp4'; // Default type
  video.appendChild(source);
  
  // Trigger load
  video.load();
}

// Load audio
function loadAudio(url, title) {
  log('Loading audio:', url);
  
  // Create audio element
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.autoplay = true;
  audio.className = 'w-100';
  
  // Create player container with visualization
  const playerContainer = document.createElement('div');
  playerContainer.className = 'audio-player-container';
  playerContainer.innerHTML = `
    <div class="audio-player-visualization">
      <div class="visualization-bar"></div>
      <div class="visualization-bar"></div>
      <div class="visualization-bar"></div>
      <div class="visualization-bar"></div>
      <div class="visualization-bar"></div>
    </div>
  `;
  
  // Add title element if provided
  let titleEl = null;
  if (title) {
    titleEl = document.createElement('div');
    titleEl.className = 'text-center mt-2 audio-title';
    titleEl.textContent = title;
  }
  
  // Show loading state
  modalContent.innerHTML = `
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  `;
  
  // Audio event handlers
  audio.onloadeddata = () => {
    log('Audio loaded successfully');
    modalContent.innerHTML = '';
    
    // Add elements to container
    playerContainer.insertBefore(audio, playerContainer.firstChild);
    modalContent.appendChild(playerContainer);
    
    if (titleEl) {
      modalContent.appendChild(titleEl);
    }
    
    // Simple animation for visualization bars
    animateVisualization(playerContainer);
  };
  
  audio.onerror = (error) => {
    console.error('Audio failed to load:', error);
    modalContent.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        Failed to load audio. Please try again.
      </div>
    `;
  };
  
  // Set source and load
  const source = document.createElement('source');
  source.src = url;
  source.type = 'audio/mpeg'; // Default type
  audio.appendChild(source);
  
  // Trigger load
  audio.load();
}

// Animate audio visualization
function animateVisualization(container) {
  const bars = container.querySelectorAll('.visualization-bar');
  
  // Simple random animation
  setInterval(() => {
    bars.forEach(bar => {
      const height = 20 + Math.random() * 60;
      bar.style.height = `${height}%`;
    });
  }, 200);
}

// Test functions for debugging
window.testModalWithImage = function() {
  if (modalInstance && modalContent) {
    modalInstance.show();
    modalContent.innerHTML = `<div class="spinner-border text-primary" role="status"></div>`;
    setTimeout(() => {
      loadImage('https://picsum.photos/800/600', 'Test Image');
    }, 100);
  } else {
    console.error('Modal not initialized');
  }
};

window.testModalWithVideo = function() {
  if (modalInstance && modalContent) {
    modalInstance.show();
    modalContent.innerHTML = `<div class="spinner-border text-primary" role="status"></div>`;
    setTimeout(() => {
      loadVideo('https://storage.googleapis.com/webfundamentals-assets/videos/chrome.mp4', 'Test Video');
    }, 100);
  } else {
    console.error('Modal not initialized');
  }
};

window.testModalWithAudio = function() {
  if (modalInstance && modalContent) {
    modalInstance.show();
    modalContent.innerHTML = `<div class="spinner-border text-primary" role="status"></div>`;
    setTimeout(() => {
      loadAudio('https://file-examples.com/storage/fe9278ad7f642dbd39ac5c9/2017/11/file_example_MP3_700KB.mp3', 'Test Audio');
    }, 100);
  } else {
    console.error('Modal not initialized');
  }
};

window.checkModalState = function() {
  console.log({
    isInitialized,
    modalInstance: !!modalInstance,
    modalContent: !!modalContent,
    assignments
  });
};

// Initialize on document load
document.addEventListener('DOMContentLoaded', init);

// Expose functions for external use
window.voxpro = {
  init,
  playKey,
  loadAssignments
};ity .3s">`;
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
  console.log('Opening media modal for asset:', asset);
  mediaPlayer.innerHTML = '';
  mediaPlayer.style.position = 'relative';
  tapOverlay.style.display = 'none';
  tapOverlay.style.zIndex = '2';
  mediaPlayer.appendChild(tapOverlay);

  mediaDescription.textContent = asset.description || '';
  modalTitle.textContent = asset.title || 'Player';

  const rawUrl = getAssetUrl(asset);
  console.log('Raw media URL:', rawUrl);
  const url = proxiedUrl(rawUrl);
  console.log('Proxied media URL:', url);
  
  if (!url) { 
    show('error', 'No media URL found on this asset'); 
    console.error('No media URL found on asset:', asset);
    mediaModal.style.display = 'block'; 
    return; 
  }

  const type = (asset.file_type || detectType(asset) || '').toLowerCase();
  console.log('Detected media type:', type);
  let el = null;

  if (type.includes('audio')) {
    console.log('Creating audio player');
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
      console.log('Audio loaded successfully');
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

    mediaModal.style.display = 'block';
    ensurePlayable(audio);
    return;
  }

  if (type.includes('video')) {
    console.log('Creating video player');
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
      console.log('Video loaded successfully');
    });
    
    const s = document.createElement('source'); 
    s.src = url + '#t=0.1'; 
    el.appendChild(s);
    mediaPlayer.prepend(el);
    activeMediaEl = el;
    mediaModal.style.display = 'block';
    ensurePlayable(el);
    return;
  }

  if (type.includes('image')) {
    console.log('Creating image viewer');
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
      console.log('Image loaded successfully');
    });
    
  } else if (type.includes('pdf')) {
    console.log('Creating PDF viewer');
    const pdfContainer = document.createElement('div');
    pdfContainer.style.width = '100%';
    pdfContainer.style.height = '100%';
    pdfContainer.style.background = '#333';
    renderPdfInModal(url, pdfContainer);
    el = pdfContainer;
  } else if (type.includes('doc')) {
    console.log('Creating document viewer');
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
    console.log('No specific viewer available for this type');
    const div = document.createElement('div');
    div.style.padding = '16px';
    div.textContent = 'Preview not available';
    el = div;
  }

  mediaPlayer.prepend(el);
  mediaModal.style.display = 'block';
}

function closeMediaModal() {
  clearActiveMedia();
  mediaModal.style.display = 'none';
  tapOverlay.style.display = 'none';
}

function playKey(keyNum) {
  console.log('playKey called for key:', keyNum);
  const asn = assignments.find(a => Number(a.key_number) === Number(keyNum));
  if (!asn) { 
    show('error', 'No assignment for that key'); 
    console.error('No assignment found for key:', keyNum);
    return; 
  }
  
  const asset = asn.asset || {};
  console.log('Found asset for key:', asset);
  playing = { key: keyNum, asset };
  reflectPlaying();
  openMediaModal(asset);
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
