// Worker (pdf.js)
window.addEventListener('load', () => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
});

/* ===== Config ===== */
// Use relative paths instead of hard-coded domain
const SEARCH_API_PRIMARY = '/api/search-media';
const SEARCH_API_SECONDARY = '';
const XANO_API_BASE = '/.netlify/functions/xano-proxy';
const MEDIA_PROXY = '/media-proxy/';
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
let mediaCache = {}; // Cache for processed media URLs
let audioObjects = {}; // Cache for audio objects

/* ===== DOM ===== */
let keyButtons = [];
let stopButton;
let assignmentsList;
let assignmentsListManager;
let connectionStatus;
let searchInput;
let mediaBrowser;
let selectedMedia;
let keySelect;
let titleInput;
let descriptionInput;
let stationInput;
let tagsInput;
let submittedByInput;
let assignButton;
let alertBox;
let currentInfo;
let mediaModal;
let modalClose;
let mediaPlayer;
let mediaDescription;
let modalTitle;

/* ===== Event Listeners ===== */
function initializeDOMElements() {
  keyButtons = [...document.querySelectorAll('.key[data-key]')];
  stopButton = document.getElementById('stopButton');
  assignmentsList = document.getElementById('assignmentsList');
  assignmentsListManager = document.getElementById('assignmentsListManager');
  connectionStatus = document.getElementById('connectionStatus');
  searchInput = document.getElementById('searchInput');
  mediaBrowser = document.getElementById('mediaBrowser');
  selectedMedia = document.getElementById('selectedMedia');
  keySelect = document.getElementById('keySelect');
  titleInput = document.getElementById('titleInput');
  descriptionInput = document.getElementById('descriptionInput');
  stationInput = document.getElementById('stationInput');
  tagsInput = document.getElementById('tagsInput');
  submittedByInput = document.getElementById('submittedByInput');
  assignButton = document.getElementById('assignButton');
  alertBox = document.getElementById('alert');
  currentInfo = document.getElementById('currentInfo');
  mediaModal = document.getElementById('mediaModal');
  modalClose = document.querySelector('.modal-close');
  mediaPlayer = document.getElementById('mediaPlayer');
  mediaDescription = document.getElementById('mediaDescription');
  modalTitle = document.querySelector('.modal-title');
}

function attachEventListeners() {
  if (searchInput) searchInput.addEventListener('input', debounce(handleSearch, 500));
  
  if (keyButtons.length > 0) {
    keyButtons.forEach(btn => {
      // Remove any existing listeners by cloning and replacing
      const newBtn = btn.cloneNode(true);
      if (btn.parentNode) {
        btn.parentNode.replaceChild(newBtn, btn);
      }
      newBtn.addEventListener('click', handleKeyPress);
    });
    
    // Update reference to new buttons
    keyButtons = [...document.querySelectorAll('.key[data-key]')];
  }
  
  if (stopButton) {
    // Clone and replace to remove existing listeners
    const newStopBtn = stopButton.cloneNode(true);
    if (stopButton.parentNode) {
      stopButton.parentNode.replaceChild(newStopBtn, stopButton);
    }
    newStopBtn.addEventListener('click', handleStop);
    stopButton = newStopBtn;
  }
  
  if (mediaBrowser) {
    // Clone and replace to remove existing listeners
    const newMediaBrowser = mediaBrowser.cloneNode(true);
    if (mediaBrowser.parentNode) {
      mediaBrowser.parentNode.replaceChild(newMediaBrowser, mediaBrowser);
    }
    newMediaBrowser.addEventListener('click', handleMediaClick);
    mediaBrowser = newMediaBrowser;
  }
  
  if (assignButton) {
    // Clone and replace to remove existing listeners
    const newAssignBtn = assignButton.cloneNode(true);
    if (assignButton.parentNode) {
      assignButton.parentNode.replaceChild(newAssignBtn, assignButton);
    }
    newAssignBtn.addEventListener('click', handleAssign);
    assignButton = newAssignBtn;
  }
  
  if (modalClose) {
    // Clone and replace to remove existing listeners
    const newModalClose = modalClose.cloneNode(true);
    if (modalClose.parentNode) {
      modalClose.parentNode.replaceChild(newModalClose, modalClose);
    }
    newModalClose.addEventListener('click', () => {
      if (mediaModal) mediaModal.style.display = 'none';
      stopCurrentAudio();
    });
    modalClose = newModalClose;
  }
  
  window.removeEventListener('click', handleWindowClick);
  window.addEventListener('click', handleWindowClick);
}

function handleWindowClick(e) {
  if (mediaModal && e.target === mediaModal) {
    mediaModal.style.display = 'none';
    stopCurrentAudio();
  }
}

/* ===== Utility Functions ===== */
function debug(...args) {
  if (debugMode) console.log('[VoxPro Debug]', ...args);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showAlert(message, type = 'error') {
  if (!alertBox) return;
  
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.style.display = 'block';
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 5000);
}

function updateConnectionStatus(isConnected) {
  connGood = isConnected;
  if (connectionStatus) {
    connectionStatus.className = isConnected ? 'connected' : 'disconnected';
    connectionStatus.textContent = isConnected ? 'Connected' : 'Disconnected';
  }
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/* ===== Core Functions ===== */
async function init() {
  debug('Initializing VoxPro Manager');
  
  // Initialize DOM elements
  initializeDOMElements();
  
  // Attach event listeners
  attachEventListeners();
  
  updateConnectionStatus(false);
  await checkConnectionAndLoadAssignments();
  setInterval(checkConnectionAndLoadAssignments, ASSIGNMENTS_REFRESH_MS);
  
  // Add test function to window for debugging
  window.testModal = function() {
    const testAsset = {
      title: 'Test Media',
      description: 'This is a test media item',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4',
      file_type: 'video/mp4'
    };
    openMediaModal(testAsset);
  };
  
  // Debug - try loading a test modal with delay to ensure DOM is ready
  setTimeout(() => {
    debug('Loading test modal...');
    window.testModal();
  }, 2000);
}

async function checkConnectionAndLoadAssignments() {
  try {
    debug('Checking connection to Xano API...');
    const response = await fetch(`${XANO_API_BASE}/auth/ping`);
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    
    const data = await response.json();
    debug('Connection established', data);
    
    updateConnectionStatus(true);
    searchEndpointChosen = SEARCH_API_PRIMARY;
    await loadAssignments();
  } catch (error) {
    debug('Primary endpoint failed, trying secondary...', error);
    try {
      if (SEARCH_API_SECONDARY) {
        const response = await fetch(`${SEARCH_API_SECONDARY}/auth/ping`);
        if (!response.ok) throw new Error(`Secondary API returned status ${response.status}`);
        
        const data = await response.json();
        debug('Secondary connection established', data);
        
        updateConnectionStatus(true);
        searchEndpointChosen = SEARCH_API_SECONDARY;
        await loadAssignments();
      } else {
        updateConnectionStatus(false);
        showAlert('Unable to connect to API. Using cached data if available.');
        
        // Try to use cached assignments if available
        if (assignments.length > 0) {
          debug('Using cached assignments');
          renderAssignments();
        } else {
          debug('No cached assignments available');
        }
      }
    } catch (e) {
      debug('Connection error', e);
      updateConnectionStatus(false);
      
      // Try to use cached assignments if available
      if (assignments.length > 0) {
        debug('Using cached assignments');
        renderAssignments();
      } else {
        debug('No cached assignments available');
      }
    }
  }
}

async function loadAssignments() {
  if (!connGood) {
    debug('Not connected, using cached assignments if available');
    if (assignments.length > 0) {
      renderAssignments();
    }
    return;
  }
  
  try {
    debug('Loading assignments...');
    const response = await fetch(`${XANO_API_BASE}/assignments/get`);
    
    if (!response.ok) {
      throw new Error(`Failed to load assignments: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    debug('Assignments response:', data);
    
    assignments = data.assignments || [];
    debug('Assignments loaded', assignments);
    
    // Process and cache media URLs for all assignments
    for (const assignment of assignments) {
      cacheMediaUrl(assignment);
    }
    
    renderAssignments();
  } catch (error) {
    debug('Error loading assignments', error);
    showAlert('Failed to load assignments. Using cached data if available.');
    
    // Try to use cached assignments if available
    if (assignments.length > 0) {
      debug('Using cached assignments');
      renderAssignments();
    }
  }
}

// Cache media URL for faster access later
function cacheMediaUrl(item) {
  if (!item) return null;
  
  const id = item.id || item.key || JSON.stringify(item).substring(0, 20);
  debug(`Caching media URL for item: ${id}`);
  
  try {
    // First try to get the URL
    const url = getAssetUrl(item);
    if (!url) {
      debug(`No URL found for item: ${id}`);
      return null;
    }
    
    // Cache the direct URL (not proxied)
    mediaCache[id] = url;
    debug(`Cached media URL for ${id}: ${url}`);
    
    // Preload audio if it's an audio file
    if (item.file_type && item.file_type.includes('audio')) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;
      audio.volume = 0.7;
      
      audio.addEventListener('canplaythrough', () => {
        debug(`Audio preloaded for ${id}`);
      });
      
      audio.addEventListener('error', (e) => {
        debug(`Error preloading audio for ${id}:`, e);
      });
      
      audioObjects[id] = audio;
    }
    
    return url;
  } catch (error) {
    debug(`Error caching media URL for ${id}:`, error);
    return null;
  }
}

function renderAssignments() {
  if (!assignmentsList || !assignmentsListManager) {
    debug('Assignment lists not found in DOM');
    return;
  }

  assignmentsList.innerHTML = '';
  assignmentsListManager.innerHTML = '';

  if (assignments.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'list-item empty';
    emptyItem.textContent = 'No assignments';
    assignmentsList.appendChild(emptyItem);
    
    const emptyItemManager = emptyItem.cloneNode(true);
    assignmentsListManager.appendChild(emptyItemManager);
    return;
  }

  assignments.forEach(assignment => {
    // Player list item
    const listItem = document.createElement('div');
    listItem.className = 'list-item assignment';
    listItem.setAttribute('data-key', assignment.key);
    
    const keyName = document.createElement('div');
    keyName.className = 'key-name';
    keyName.textContent = `${assignment.key}`;
    
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = assignment.title || 'Untitled';
    
    listItem.appendChild(keyName);
    listItem.appendChild(title);
    assignmentsList.appendChild(listItem);
    
    // Manager list item (with delete button)
    const managerItem = listItem.cloneNode(true);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteAssignment(assignment.key);
    });
    
    managerItem.appendChild(deleteBtn);
    assignmentsListManager.appendChild(managerItem);
  });
}

async function handleSearch() {
  if (!searchInput || !mediaBrowser) {
    debug('Search input or media browser not found in DOM');
    return;
  }
  
  const query = searchInput.value.trim();
  
  if (!connGood) {
    showAlert('Not connected to database');
    return;
  }
  
  if (query.length < 2) {
    mediaBrowser.innerHTML = '';
    return;
  }
  
  try {
    debug('Searching for:', query);
    const searchEndpoint = searchEndpointChosen || SEARCH_API_PRIMARY;
    const response = await fetch(`${XANO_API_BASE}/media/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    debug('Search response:', data);
    
    unifiedResults = data.results || [];
    debug('Search results:', unifiedResults);
    
    // Cache media URLs for search results
    for (const item of unifiedResults) {
      cacheMediaUrl(item);
    }
    
    renderMediaResults();
  } catch (error) {
    debug('Search error', error);
    showAlert('Search failed');
  }
}

function renderMediaResults() {
  if (!mediaBrowser) {
    debug('Media browser not found in DOM');
    return;
  }
  
  mediaBrowser.innerHTML = '';
  
  if (unifiedResults.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'media-item empty';
    emptyItem.textContent = 'No results';
    mediaBrowser.appendChild(emptyItem);
    return;
  }
  
  unifiedResults.forEach((item, index) => {
    const mediaItem = document.createElement('div');
    mediaItem.className = 'media-item';
    mediaItem.setAttribute('data-index', index);
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'thumbnail';
    
    const typeIcon = document.createElement('span');
    typeIcon.className = 'type-icon';
    typeIcon.textContent = getTypeIcon(item.file_type || '');
    
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.title || 'Untitled';
    
    const description = document.createElement('div');
    description.className = 'description';
    description.textContent = item.description || '';
    
    mediaItem.appendChild(thumbnail);
    thumbnail.appendChild(typeIcon);
    mediaItem.appendChild(title);
    mediaItem.appendChild(description);
    
    // Add play button for audio/video/images
    const fileType = item.file_type || '';
    const isPlayable = fileType.includes('audio') || 
                      fileType.includes('video') || 
                      fileType.includes('image');
    
    if (isPlayable) {
      const playBtn = document.createElement('button');
      playBtn.className = 'play-btn';
      playBtn.innerHTML = '▶';
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMediaModal(item);
      });
      mediaItem.appendChild(playBtn);
    }
    
    mediaBrowser.appendChild(mediaItem);
  });
}

function getTypeIcon(fileType) {
  if (!fileType) return '?';
  if (fileType.includes('audio')) return '🔊';
  if (fileType.includes('video')) return '🎬';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('pdf')) return '📄';
  return '📁';
}

function getAssetUrl(item) {
  if (!item || typeof item !== 'object') {
    debug('getAssetUrl: Invalid item:', item);
    return '';
  }

  // Log all available fields for debugging
  debug('Asset fields:', Object.keys(item));
  debug('Asset raw data:', JSON.stringify(item, null, 2));
  
  // Check if this item has a cached URL
  const id = item.id || item.key || JSON.stringify(item).substring(0, 20);
  if (mediaCache[id]) {
    debug(`Using cached URL for ${id}: ${mediaCache[id]}`);
    return mediaCache[id];
  }
  
  // First check if there's a direct URL field
  const urlFields = ['media_url', 'database_url', 'file_url', 'url', 'public_url', 'thumbnail'];
  
  for (const field of urlFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].startsWith('http')) {
      debug(`Found URL in field ${field}:`, item[field]);
      return item[field];
    }
  }
  
  // Special handling for database_url when it's an object (Xano format)
  if (item.database_url && typeof item.database_url === 'object') {
    debug('Found database_url object:', item.database_url);
    // Try to construct URL from Xano object format
    if (item.database_url.path && item.database_url.name) {
      const constructedUrl = `https://x8ki-letl-twmt.n7.xano.io/vault/${item.database_url.path}/${item.database_url.name}`;
      debug('Constructed URL from database_url object:', constructedUrl);
      return constructedUrl;
    }
    // If path/name not available, try other object properties
    if (item.database_url.url && typeof item.database_url.url === 'string') {
      debug('Found URL in database_url.url:', item.database_url.url);
      return item.database_url.url;
    }
  }
  
  // Check for nested URL objects (Xano often returns nested objects)
  if (item.file && typeof item.file === 'object') {
    debug('Found file object:', item.file);
    
    // Check if file object has URL
    if (item.file.url && typeof item.file.url === 'string' && item.file.url.startsWith('http')) {
      debug('Found URL in file.url:', item.file.url);
      return item.file.url;
    }
    
    // Check common URL fields in file object
    for (const field of urlFields) {
      if (item.file[field] && typeof item.file[field] === 'string' && item.file[field].startsWith('http')) {
        debug(`Found URL in file.${field}:`, item.file[field]);
        return item.file[field];
      }
    }
  }
  
  // Check for media object
  if (item.media && typeof item.media === 'object') {
    debug('Found media object:', item.media);
    
    // Check if media object has URL
    if (item.media.url && typeof item.media.url === 'string' && item.media.url.startsWith('http')) {
      debug('Found URL in media.url:', item.media.url);
      return item.media.url;
    }
    
    // Check common URL fields in media object
    for (const field of urlFields) {
      if (item.media[field] && typeof item.media[field] === 'string' && item.media[field].startsWith('http')) {
        debug(`Found URL in media.${field}:`, item.media[field]);
        return item.media[field];
      }
    }
  }
  
  // Try to find any string field that looks like a URL
  for (const key in item) {
    const value = item[key];
    
    // Check if it's a string URL
    if (typeof value === 'string') {
      if (value.startsWith('http')) {
        debug(`Found URL in field ${key}:`, value);
        return value;
      }
      
      // Sometimes URLs are stored without the protocol
      if (value.startsWith('//') || value.match(/^(www\.)/)) {
        const fixedUrl = value.startsWith('//') ? `https:${value}` : `https://${value}`;
        debug(`Found and fixed URL in field ${key}:`, fixedUrl);
        return fixedUrl;
      }
    }
    
    // Handle nested objects (one level deep)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nestedKey in value) {
        const nestedValue = value[nestedKey];
        if (typeof nestedValue === 'string' && nestedValue.startsWith('http')) {
          debug(`Found URL in nested field ${key}.${nestedKey}:`, nestedValue);
          return nestedValue;
        }
      }
    }
  }
  
  // Last resort: check if we can find a URL pattern in JSON fields
  const jsonString = JSON.stringify(item);
  const urlRegex = /(https?:\/\/[^\s"]+)/g;
  const matches = jsonString.match(urlRegex);
  
  if (matches && matches.length > 0) {
    debug('Found URL using regex:', matches[0]);
    return matches[0];
  }
  
  debug('No valid URL found in asset:', item);
  return '';
}

function openMediaModal(asset) {
  debug('Opening modal for asset:', asset);
  
  if (!mediaPlayer || !mediaModal || !mediaDescription || !modalTitle) {
    debug('Media modal elements not found in DOM');
    return;
  }
  
  // Clear the media player first
  mediaPlayer.innerHTML = '';
  
  // Set description and title
  mediaDescription.textContent = asset.description || '';
  modalTitle.textContent = asset.title || 'Player';
  
  // Show modal first
  mediaModal.style.display = 'block';
  
  // Get media URL - first check cache, then get from asset
  let url = '';
  const id = asset.id || asset.key || JSON.stringify(asset).substring(0, 20);
  
  if (mediaCache[id]) {
    url = mediaCache[id];
    debug('Using cached URL:', url);
  } else {
    url = getAssetUrl(asset);
    debug('Got URL from asset:', url);
    
    // Cache the URL for future use
    if (url) {
      mediaCache[id] = url;
    }
  }
  
  if (!url) {
    mediaPlayer.innerHTML = '<div style="padding:20px;color:red">No media URL found. Check console for details.</div>';
    console.error('Failed to find URL in asset:', asset);
    return;
  }
  
  // Create appropriate element based on type
  let el;
  const type = asset.file_type || '';
  
  // For all media types, create a direct link as fallback
  const directLinkContainer = document.createElement('div');
  directLinkContainer.style.marginBottom = '15px';
  directLinkContainer.style.textAlign = 'center';
  directLinkContainer.innerHTML = `
    <a href="${url}" target="_blank" style="display:inline-block;padding:10px 15px;background:#3498db;color:white;text-decoration:none;border-radius:5px;margin-bottom:10px;">
      Open Media in New Tab
    </a>
    <p style="margin:5px 0;color:#666;font-size:0.8rem;">If the media doesn't play correctly below, click the button above.</p>
  `;
  mediaPlayer.appendChild(directLinkContainer);
  
  if (type.includes('audio') || url.match(/\.(mp3|wav|aac|m4a|ogg)$/i)) {
    el = document.createElement('audio');
    el.controls = true;
    el.autoplay = false;
    el.crossOrigin = 'anonymous';
    el.style.width = '100%';
    el.style.marginTop = '20px';
    
    // Use cached audio if available
    if (audioObjects[id]) {
      debug(`Using cached audio for ${id}`);
      el = audioObjects[id];
      el.currentTime = 0;
    } else {
      el.src = url;
    }
    
    // Add waveform visualization if Web Audio API is available
    try {
      const visualizer = document.createElement('div');
      visualizer.style.width = '100%';
      visualizer.style.height = '60px';
      visualizer.style.marginTop = '10px';
      visualizer.style.backgroundColor = '#f0f0f0';
      visualizer.style.borderRadius = '4px';
      mediaPlayer.appendChild(visualizer);
    } catch (error) {
      debug('Error creating audio visualizer:', error);
    }
  } 
  else if (type.includes('video') || url.match(/\.(mp4|webm|mov|avi|wmv)$/i)) {
    el = document.createElement('video');
    el.controls = true;
    el.autoplay = false;
    el.crossOrigin = 'anonymous';
    el.src = url;
    el.style.maxWidth = '100%';
    el.style.maxHeight = '400px';
    el.style.display = 'block';
    el.style.margin = '20px auto';
    el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    el.style.borderRadius = '4px';
  }
  else if (type.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    el = document.createElement('img');
    el.crossOrigin = 'anonymous';
    el.src = url;
    el.alt = asset.title || '';
    el.style.maxWidth = '100%';
    el.style.maxHeight = '400px';
    el.style.display = 'block';
    el.style.margin = '20px auto';
    el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    el.style.borderRadius = '4px';
  }
  else if (type.includes('pdf') || url.match(/\.(pdf)$/i)) {
    el = document.createElement('iframe');
    el.src = url;
    el.style.width = '100%';
    el.style.height = '500px';
    el.style.border = 'none';
    el.style.borderRadius = '4px';
    el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
  }
  else {
    el = document.createElement('div');
    el.innerHTML = `
      <div style="padding:20px;text-align:center;background:#f5f5f5;border-radius:4px;margin-top:20px;">
        <p style="margin-bottom:15px;">This file type may not be viewable in the browser.</p>
        <p>File type: ${type || 'Unknown'}</p>
      </div>
    `;
  }
  
  // Add error handling
  if (el.tagName !== 'DIV') {
    el.addEventListener('error', (e) => {
      debug('Media error:', e);
      
      // Create a more helpful error message
      const errorDiv = document.createElement('div');
      errorDiv.style.padding = '20px';
      errorDiv.style.color = 'red';
      errorDiv.style.backgroundColor = '#fee';
      errorDiv.style.borderRadius = '4px';
      errorDiv.style.marginTop = '15px';
      errorDiv.innerHTML = `
        <h3>Error loading media</h3>
        <p><strong>Message:</strong> ${e.message || 'Unknown error'}</p>
        <p><strong>URL:</strong> ${url}</p>
        <p>This could be due to:</p>
        <ul style="margin-left: 20px; text-align: left;">
          <li>CORS restrictions</li>
          <li>The file not being accessible</li>
          <li>The URL format being incorrect</li>
        </ul>
        <p>Please use the direct link above to open the media in a new tab.</p>
      `;
      
      // Replace the media element with the error message
      if (el.parentNode) {
        el.parentNode.replaceChild(errorDiv, el);
      } else {
        mediaPlayer.appendChild(errorDiv);
      }
    });
  }
  
  // Add to player
  mediaPlayer.appendChild(el);
  
  // Store the media element for later control
  activeMediaEl = el;
  
  // For audio/video, add explicit play button for better mobile experience
  if (type.includes('audio') || type.includes('video') || 
      url.match(/\.(mp3|wav|aac|m4a|ogg|mp4|webm|mov|avi|wmv)$/i)) {
    
    const playButtonContainer = document.createElement('div');
    playButtonContainer.style.textAlign = 'center';
    playButtonContainer.style.marginTop = '10px';
    
    const playButton = document.createElement('button');
    playButton.innerHTML = '▶️ Play';
    playButton.style.padding = '8px 16px';
    playButton.style.backgroundColor = '#4CAF50';
    playButton.style.color = 'white';
    playButton.style.border = 'none';
    playButton.style.borderRadius = '4px';
    playButton.style.cursor = 'pointer';
    playButton.style.fontSize = '14px';
    playButton.style.margin = '0 5px';
    
    const pauseButton = document.createElement('button');
    pauseButton.innerHTML = '⏸️ Pause';
    pauseButton.style.padding = '8px 16px';
    pauseButton.style.backgroundColor = '#f44336';
    pauseButton.style.color = 'white';
    pauseButton.style.border = 'none';
    pauseButton.style.borderRadius = '4px';
    pauseButton.style.cursor = 'pointer';
    pauseButton.style.fontSize = '14px';
    pauseButton.style.margin = '0 5px';
    
    playButton.addEventListener('click', () => {
      if (el && typeof el.play === 'function') {
        el.play().catch(e => {
          debug('Error playing media:', e);
          // Show error in case of autoplay restrictions
          const errorMessage = document.createElement('div');
          errorMessage.style.color = 'red';
          errorMessage.style.margin = '10px 0';
          errorMessage.textContent = `Playback error: ${e.message}. Try using the direct link above.`;
          playButtonContainer.appendChild(errorMessage);
        });
      }
    });
    
    pauseButton.addEventListener('click', () => {
      if (el && typeof el.pause === 'function') {
        el.pause();
      }
    });
    
    playButtonContainer.appendChild(playButton);
    playButtonContainer.appendChild(pauseButton);
    mediaPlayer.appendChild(playButtonContainer);
  }
}

function handleMediaClick(e) {
  const mediaItem = e.target.closest('.media-item') || e.target.closest('.row');
  if (!mediaItem) return;
  
  debug('Media item clicked:', mediaItem);
  
  // Remove previous selections
  document.querySelectorAll('.media-item.selected, .row.selected').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Add selection to clicked item
  mediaItem.classList.add('selected');
  
  // Try to get the media data
  let mediaData = null;
  
  // First try to get from data-index (for search results)
  const index = parseInt(mediaItem.getAttribute('data-index'));
  if (!isNaN(index) && index >= 0 && index < unifiedResults.length) {
    mediaData = unifiedResults[index];
    debug('Found media from search results index:', index, mediaData);
  } else {
    // Try to get from data-id (for other media lists)
    const dataId = mediaItem.getAttribute('data-id');
    if (dataId) {
      // Look in unifiedResults first
      mediaData = unifiedResults.find(item => item.id == dataId);
      
      // If not found in unifiedResults, create a basic media object
      if (!mediaData) {
        const titleElement = mediaItem.querySelector('.title') || mediaItem.querySelector('div:nth-child(2)');
        const title = titleElement ? titleElement.textContent.trim() : 'Unknown';
        
        mediaData = {
          id: parseInt(dataId),
          title: title,
          description: '',
          file_type: 'audio/mpeg', // Default assumption
          station: '',
          tags: [],
          submitted_by: ''
        };
        debug('Created basic media object from DOM:', mediaData);
      }
    }
  }
  
  if (!mediaData) {
    debug('Could not determine media data from clicked item');
    return;
  }
  
  selectedUnified = mediaData;
  debug('Selected media set to:', selectedUnified);
  
  if (!titleInput || !descriptionInput || !stationInput || 
      !tagsInput || !submittedByInput || !selectedMedia) {
    debug('Form elements not found in DOM');
    return;
  }
  
  // Update form
  titleInput.value = selectedUnified.title || '';
  descriptionInput.value = selectedUnified.description || '';
  stationInput.value = selectedUnified.station || '';
  tagsInput.value = Array.isArray(selectedUnified.tags) ? selectedUnified.tags.join(', ') : (selectedUnified.tags || '');
  submittedByInput.value = selectedUnified.submitted_by || '';
  
  // Update selected media preview
  selectedMedia.innerHTML = '';
  
  const mediaItemPreview = document.createElement('div');
  mediaItemPreview.className = 'media-item selected';
  
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail large';
  
  const typeIcon = document.createElement('span');
  typeIcon.className = 'type-icon';
  typeIcon.textContent = getTypeIcon(selectedUnified.file_type || '');
  
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = selectedUnified.title || 'Untitled';
  
  mediaItemPreview.appendChild(thumbnail);
  thumbnail.appendChild(typeIcon);
  mediaItemPreview.appendChild(title);
  
  // Add play button for audio/video/images
  const fileType = selectedUnified.file_type || '';
  const isPlayable = fileType.includes('audio') || 
                    fileType.includes('video') || 
                    fileType.includes('image');
  
  if (isPlayable) {
    const playBtn = document.createElement('button');
    playBtn.className = 'play-btn';
    playBtn.innerHTML = '▶';
    playBtn.addEventListener('click', () => {
      openMediaModal(selectedUnified);
    });
    mediaItemPreview.appendChild(playBtn);
  }
  
  selectedMedia.appendChild(mediaItemPreview);
  
  // Update the selected media display text
  const selectedMediaText = document.createElement('div');
  selectedMediaText.textContent = `Selected (undefined): ${selectedUnified.title || 'Unknown'}`;
  selectedMediaText.style.fontSize = '0.9rem';
  selectedMediaText.style.color = '#666';
  selectedMediaText.style.marginTop = '5px';
  selectedMedia.appendChild(selectedMediaText);
}

async function handleAssign() {
  debug('=== ASSIGNMENT BUTTON CLICKED ===');
  
  // First try to get selectedUnified, then fall back to finding selected media in DOM
  let mediaToAssign = selectedUnified;
  
  if (!mediaToAssign) {
    debug('selectedUnified not found, looking for selected media in DOM...');
    
    // Look for selected media in the DOM
    const selectedMediaElement = document.querySelector('.media-item.selected') || 
                                 document.querySelector('.row.selected');
    
    if (selectedMediaElement) {
      // Try to find the media data from unifiedResults using data-index
      const index = parseInt(selectedMediaElement.getAttribute('data-index'));
      if (!isNaN(index) && index >= 0 && index < unifiedResults.length) {
        mediaToAssign = unifiedResults[index];
        debug('Found media from DOM selection:', mediaToAssign);
      } else {
        // Try to find by data-id
        const dataId = selectedMediaElement.getAttribute('data-id');
        if (dataId) {
          mediaToAssign = unifiedResults.find(item => item.id == dataId);
          debug('Found media by data-id:', mediaToAssign);
        }
      }
    }
  }
  
  if (!mediaToAssign) {
    showAlert('No media selected. Please select a media item first.');
    debug('No media found - selectedUnified:', selectedUnified, 'DOM selection:', document.querySelector('.media-item.selected, .row.selected'));
    return;
  }
  
  if (!keySelect) {
    debug('Key select not found in DOM');
    return;
  }
  
  const key = keySelect.value;
  if (!key) {
    showAlert('No key selected');
    return;
  }
  
  try {
    debug('Assigning media to key:', key, 'Media:', mediaToAssign);
    
    // Get the media URL - use cached URL if available
    const id = mediaToAssign.id || JSON.stringify(mediaToAssign).substring(0, 20);
    let mediaUrl = mediaCache[id];
    
    if (!mediaUrl) {
      mediaUrl = getAssetUrl(mediaToAssign);
      
      if (mediaUrl) {
        // Cache for future use
        mediaCache[id] = mediaUrl;
      }
    }
    
    if (!mediaUrl) {
      showAlert('No media URL found');
      debug('No media URL found for:', mediaToAssign);
      return;
    }
    
    const assignData = {
      key,
      media_id: mediaToAssign.id,
      title: titleInput?.value || mediaToAssign.title || '',
      description: descriptionInput?.value || mediaToAssign.description || '',
      file_type: mediaToAssign.file_type || '',
      media_url: mediaUrl,
      station: stationInput?.value || mediaToAssign.station || '',
      tags: tagsInput?.value?.split(',').map(t => t.trim()).filter(Boolean) || mediaToAssign.tags || [],
      submitted_by: submittedByInput?.value || mediaToAssign.submitted_by || ''
    };
    
    debug('Assignment data:', assignData);
    
    const response = await fetch(`${XANO_API_BASE}/assignments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assignData)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    debug('Assignment created:', data);
    
    if (data.success) {
      showAlert('Assignment created successfully', 'success');
      
      // Add to local assignments immediately
      const existingIndex = assignments.findIndex(a => a.key === key);
      if (existingIndex !== -1) {
        assignments[existingIndex] = {
          ...assignData,
          id: data.id || assignData.id
        };
      } else {
        assignments.push({
          ...assignData,
          id: data.id || assignData.id
        });
      }
      
      // Cache the media URL
      cacheMediaUrl(assignData);
      
      // Re-render assignments
      renderAssignments();
    } else {
      showAlert(data.message || 'Failed to create assignment');
    }
  } catch (error) {
    debug('Error creating assignment', error);
    showAlert(`Failed to create assignment: ${error.message}`);
  }
}

async function deleteAssignment(key) {
  if (!key) return;
  
  if (!confirm(`Are you sure you want to delete the assignment for key ${key}?`)) {
    return;
  }
  
  try {
    debug('Deleting assignment for key:', key);
    
    const response = await fetch(`${XANO_API_BASE}/assignments/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    debug('Assignment deleted:', data);
    
    if (data.success) {
      showAlert('Assignment deleted successfully', 'success');
      
      // Remove from local assignments immediately
      const index = assignments.findIndex(a => a.key === key);
      if (index !== -1) {
        assignments.splice(index, 1);
      }
      
      // Re-render assignments
      renderAssignments();
    } else {
      showAlert(data.message || 'Failed to delete assignment');
    }
  } catch (error) {
    debug('Error deleting assignment', error);
    showAlert(`Failed to delete assignment: ${error.message}`);
  }
}

function handleKeyPress(e) {
  const key = e.target.getAttribute('data-key');
  if (!key) return;
  
  debug('Key pressed:', key);
  
  const assignment = assignments.find(a => a.key === key);
  
  if (!assignment) {
    debug('No assignment for key:', key);
    showAlert(`No media assigned to key ${key}`);
    return;
  }
  
  debug('Playing assignment:', assignment);
  
  if (playing === key) {
    handleStop();
    return;
  }
  
  handleStop(); // Stop any currently playing
  
  // Set as playing
  playing = key;
  e.target.classList.add('playing');
  
  // Update current info
  if (currentInfo) {
    currentInfo.textContent = assignment.title || 'Unknown';
  }
  
  // Play the media
  openMediaModal(assignment);
}

function stopCurrentAudio() {
  if (activeMediaEl) {
    if (typeof activeMediaEl.pause === 'function') {
      activeMediaEl.pause();
      if (typeof activeMediaEl.currentTime !== 'undefined') {
        activeMediaEl.currentTime = 0;
      }
    }
    activeMediaEl = null;
  }
}

function handleStop() {
  if (!playing) return;
  
  debug('Stopping playback');
  
  const playingButton = keyButtons.find(btn => btn.getAttribute('data-key') === playing);
  if (playingButton) {
    playingButton.classList.remove('playing');
  }
  
  playing = null;
  
  if (currentInfo) {
    currentInfo.textContent = '';
  }
  
  // Close modal
  if (mediaModal) {
    mediaModal.style.display = 'none';
  }
  
  // Stop any active media
  stopCurrentAudio();
}

// Make testing functions available in global scope
window.voxProDebug = {
  toggleDebug: () => {
    debugMode = !debugMode;
    debug('Debug mode:', debugMode ? 'ON' : 'OFF');
    return debugMode;
  },
  testConnection: async () => {
    try {
      const response = await fetch(`${XANO_API_BASE}/auth/ping`);
      const data = await response.json();
      debug('Connection test result:', data);
      return data;
    } catch (error) {
      debug('Connection test error:', error);
      return { error: error.message };
    }
  },
  testModal: () => {
    const testAsset = {
      title: 'Test Media',
      description: 'This is a test media item',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4',
      file_type: 'video/mp4'
    };
    openMediaModal(testAsset);
  },
  dumpCache: () => {
    debug('Media URL cache:', mediaCache);
    debug('Audio objects cache:', Object.keys(audioObjects));
    return { mediaCache, audioObjectKeys: Object.keys(audioObjects) };
  },
  clearCache: () => {
    mediaCache = {};
    
    // Stop and clear audio objects
    Object.values(audioObjects).forEach(audio => {
      if (audio && typeof audio.pause === 'function') {
        audio.pause();
        audio.src = '';
      }
    });
    audioObjects = {};
    
    debug('Cache cleared');
  },
  fixHandlers: () => {
    attachEventListeners();
    debug('Event handlers fixed');
  },
  showXanoAPI: () => {
    debug('Xano API Base:', XANO_API_BASE);
    debug('Media Proxy:', MEDIA_PROXY);
    return { XANO_API_BASE, MEDIA_PROXY };
  }
};

// Add visual debug panel
function addDebugPanel() {
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debugPanel';
  debugPanel.style.position = 'fixed';
  debugPanel.style.bottom = '10px';
  debugPanel.style.right = '10px';
  debugPanel.style.width = '300px';
  debugPanel.style.maxHeight = '400px';
  debugPanel.style.overflowY = 'auto';
  debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  debugPanel.style.color = '#4CAF50';
  debugPanel.style.padding = '10px';
  debugPanel.style.borderRadius = '5px';
  debugPanel.style.fontFamily = 'monospace';
  debugPanel.style.fontSize = '12px';
  debugPanel.style.zIndex = '9999';
  debugPanel.style.display = 'none';
  
  const panelHeader = document.createElement('div');
  panelHeader.innerHTML = '<strong>VoxPro Debug</strong>';
  panelHeader.style.marginBottom = '10px';
  panelHeader.style.display = 'flex';
  panelHeader.style.justifyContent = 'space-between';
  panelHeader.style.alignItems = 'center';
  
  const closeButton = document.createElement('span');
  closeButton.textContent = 'X';
  closeButton.style.cursor = 'pointer';
  closeButton.style.color = '#FF5555';
  closeButton.addEventListener('click', () => {
    debugPanel.style.display = 'none';
  });
  
  panelHeader.appendChild(closeButton);
  debugPanel.appendChild(panelHeader);
  
  const debugContent = document.createElement('div');
  debugContent.id = 'debugContent';
  debugPanel.appendChild(debugContent);
  
  const controlsContainer = document.createElement('div');
  controlsContainer.style.marginTop = '10px';
  controlsContainer.style.display = 'flex';
  controlsContainer.style.flexWrap = 'wrap';
  controlsContainer.style.gap = '5px';
  
  const createButton = (text, handler) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.fontSize = '10px';
    button.style.padding = '3px 5px';
    button.style.backgroundColor = '#333';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', handler);
    return button;
  };
  
  // Add debug buttons
  controlsContainer.appendChild(createButton('Clear', () => {
    debugContent.innerHTML = '';
  }));
  
  controlsContainer.appendChild(createButton('Test Modal', () => {
    window.voxProDebug.testModal();
  }));
  
  controlsContainer.appendChild(createButton('Test Connection', () => {
    window.voxProDebug.testConnection().then(result => {
      logDebugMessage(JSON.stringify(result, null, 2));
    });
  }));
  
  controlsContainer.appendChild(createButton('Show Cache', () => {
    const cache = window.voxProDebug.dumpCache();
    logDebugMessage(`Media URLs cached: ${Object.keys(cache.mediaCache).length}`);
    logDebugMessage(`Audio objects cached: ${cache.audioObjectKeys.length}`);
  }));
  
  controlsContainer.appendChild(createButton('Fix Handlers', () => {
    window.voxProDebug.fixHandlers();
    logDebugMessage('Event handlers fixed');
  }));
  
  debugPanel.appendChild(controlsContainer);
  document.body.appendChild(debugPanel);
  
  return debugPanel;
}

// Add debug message to panel
function logDebugMessage(message) {
  // Create panel if it doesn't exist
  let debugPanel = document.getElementById('debugPanel');
  let debugContent = document.getElementById('debugContent');
  
  if (!debugPanel) {
    debugPanel = addDebugPanel();
    debugContent = document.getElementById('debugContent');
  }
  
  // Create message element
  const msgEl = document.createElement('div');
  msgEl.style.borderBottom = '1px solid #333';
  msgEl.style.paddingBottom = '5px';
  msgEl.style.marginBottom = '5px';
  
  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  const timeSpan = document.createElement('span');
  timeSpan.textContent = `[${timestamp}] `;
  timeSpan.style.color = '#999';
  msgEl.appendChild(timeSpan);
  
  // Add message content
  if (typeof message === 'object') {
    try {
      const textNode = document.createTextNode(JSON.stringify(message, null, 2));
      msgEl.appendChild(textNode);
    } catch (e) {
      msgEl.appendChild(document.createTextNode('[Object]'));
    }
  } else {
    msgEl.appendChild(document.createTextNode(message));
  }
  
  // Add to debug content
  debugContent.appendChild(msgEl);
  debugContent.scrollTop = debugContent.scrollHeight;
  
  // Show panel
  debugPanel.style.display = 'block';
}

// Override console.log and console.error in debug mode
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
  originalConsoleLog.apply(console, arguments);
  
  if (debugMode) {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    if (message.includes('[VoxPro Debug]')) {
      logDebugMessage(message.replace('[VoxPro Debug] ', ''));
    }
  }
};

console.error = function() {
  originalConsoleError.apply(console, arguments);
  
  if (debugMode) {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    const errorMsg = document.createElement('div');
    errorMsg.textContent = message;
    errorMsg.style.color = '#FF5555';
    
    logDebugMessage(errorMsg.outerHTML);
  }
};

// Add keyboard shortcut to toggle debug panel (Ctrl+Shift+D)
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    
    const debugPanel = document.getElementById('debugPanel') || addDebugPanel();
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  }
});

// Add debug button to UI
function addDebugButton() {
  const container = document.querySelector('.container') || document.body;
  
  const debugButton = document.createElement('button');
  debugButton.textContent = '🐞';
  debugButton.title = 'Show Debug Panel';
  debugButton.style.position = 'fixed';
  debugButton.style.bottom = '10px';
  debugButton.style.left = '10px';
  debugButton.style.zIndex = '9998';
  debugButton.style.backgroundColor = '#333';
  debugButton.style.color = '#4CAF50';
  debugButton.style.border = 'none';
  debugButton.style.borderRadius = '50%';
  debugButton.style.width = '40px';
  debugButton.style.height = '40px';
  debugButton.style.fontSize = '20px';
  debugButton.style.cursor = 'pointer';
  debugButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
  
  debugButton.addEventListener('click', () => {
    const debugPanel = document.getElementById('debugPanel') || addDebugPanel();
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  });
  
  container.appendChild(debugButton);
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

// Add debug button after slight delay
setTimeout(addDebugButton, 2000);
