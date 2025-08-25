// Worker (pdf.js)
window.addEventListener('load', () => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
});

/* ===== Config ===== */
// Use relative paths instead of hard-coded domain
const SEARCH_API_PRIMARY = '/.netlify/functions/search-media';
const SEARCH_API_SECONDARY = '';
const XANO_PROXY_BASE = '/.netlify/functions/xano-proxy';
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
const mediaModal = document.getElementById('mediaModal');
const modalClose = document.querySelector('.modal-close');
const mediaPlayer = document.getElementById('mediaPlayer');
const mediaDescription = document.getElementById('mediaDescription');
const modalTitle = document.querySelector('.modal-title');

/* ===== Event Listeners ===== */
document.addEventListener('DOMContentLoaded', init);
searchInput.addEventListener('input', debounce(handleSearch, 500));
keyButtons.forEach(btn => btn.addEventListener('click', handleKeyPress));
stopButton.addEventListener('click', handleStop);
mediaBrowser.addEventListener('click', handleMediaClick);
assignButton.addEventListener('click', handleAssign);
modalClose.addEventListener('click', () => mediaModal.style.display = 'none');
window.addEventListener('click', e => {
  if (e.target === mediaModal) mediaModal.style.display = 'none';
});

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
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.style.display = 'block';
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 5000);
}

function updateConnectionStatus(isConnected) {
  connGood = isConnected;
  connectionStatus.className = isConnected ? 'connected' : 'disconnected';
  connectionStatus.textContent = isConnected ? 'Connected' : 'Disconnected';
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
  
  // Debug - try loading a test modal
  setTimeout(() => {
    debug('Loading test modal...');
    window.testModal();
  }, 2000);
}

async function checkConnectionAndLoadAssignments() {
  try {
    const response = await fetch(`${XANO_PROXY_BASE}/auth/ping`);
    const data = await response.json();
    updateConnectionStatus(true);
    searchEndpointChosen = SEARCH_API_PRIMARY;
    debug('Connection established', data);
    await loadAssignments();
  } catch (error) {
    debug('Primary endpoint failed, trying secondary...');
    try {
      if (SEARCH_API_SECONDARY) {
        const response = await fetch(`${SEARCH_API_SECONDARY}/auth/ping`);
        const data = await response.json();
        updateConnectionStatus(true);
        searchEndpointChosen = SEARCH_API_SECONDARY;
        debug('Secondary connection established', data);
        await loadAssignments();
      } else {
        updateConnectionStatus(false);
      }
    } catch (e) {
      debug('Connection error', e);
      updateConnectionStatus(false);
    }
  }
}

async function loadAssignments() {
  if (!connGood) return;
  
  try {
    debug('Loading assignments...');
    const response = await fetch(`${XANO_PROXY_BASE}/assignments/get`);
    const data = await response.json();
    assignments = data.assignments || [];
    debug('Assignments loaded', assignments);
    
    renderAssignments();
  } catch (error) {
    debug('Error loading assignments', error);
    showAlert('Failed to load assignments');
  }
}

function renderAssignments() {
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
    const response = await fetch(`${XANO_PROXY_BASE}/media/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    unifiedResults = data.results || [];
    debug('Search results:', unifiedResults);
    
    renderMediaResults();
  } catch (error) {
    debug('Search error', error);
    showAlert('Search failed');
  }
}

function renderMediaResults() {
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
    
    // Add play button for audio/video
    if (item.file_type && (item.file_type.includes('audio') || item.file_type.includes('video'))) {
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
  
  // First check if there's a direct URL field
  const urlFields = ['media_url', 'database_url', 'file_url', 'url', 'public_url', 'thumbnail'];
  
  for (const field of urlFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].startsWith('http')) {
      debug(`Found URL in field ${field}:`, item[field]);
      return item[field];
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
  
  // Clear the media player first
  mediaPlayer.innerHTML = '';
  
  // Set description and title
  mediaDescription.textContent = asset.description || '';
  modalTitle.textContent = asset.title || 'Player';
  
  // Show modal first
  mediaModal.style.display = 'block';
  
  // Get media URL
  const url = getAssetUrl(asset);
  debug('Media URL:', url);
  
  if (!url) {
    mediaPlayer.innerHTML = '<div style="padding:20px;color:red">No media URL found. Check console for details.</div>';
    console.error('Failed to find URL in asset:', asset);
    return;
  }
  
  // Determine if we need to proxy the URL
  const proxyUrl = url.startsWith('/') ? url : `${MEDIA_PROXY}${encodeURIComponent(url)}`;
  debug('Using URL for media player:', proxyUrl);
  
  // Create appropriate element based on type
  let el;
  const type = asset.file_type || '';
  
  if (type.includes('audio') || url.match(/\.(mp3|wav|aac|m4a|ogg)$/i)) {
    el = document.createElement('audio');
    el.controls = true;
    el.autoplay = false;
    el.src = proxyUrl;
    el.style.width = '100%';
    el.style.marginTop = '20px';
    
    // Add direct link as fallback
    const fallbackLink = document.createElement('div');
    fallbackLink.innerHTML = `<p style="margin-top:10px;"><a href="${url}" target="_blank" style="color:#3498db;">Open audio in new tab</a> (if player doesn't work)</p>`;
    mediaPlayer.appendChild(fallbackLink);
  } 
  else if (type.includes('video') || url.match(/\.(mp4|webm|mov|avi|wmv)$/i)) {
    el = document.createElement('video');
    el.controls = true;
    el.autoplay = false;
    el.src = proxyUrl;
    el.style.maxWidth = '100%';
    el.style.maxHeight = '400px';
    
    // Add direct link as fallback
    const fallbackLink = document.createElement('div');
    fallbackLink.innerHTML = `<p style="margin-top:10px;"><a href="${url}" target="_blank" style="color:#3498db;">Open video in new tab</a> (if player doesn't work)</p>`;
    mediaPlayer.appendChild(fallbackLink);
  }
  else if (type.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    el = document.createElement('img');
    el.src = proxyUrl;
    el.alt = asset.title || '';
    el.style.maxWidth = '100%';
    el.style.maxHeight = '400px';
  }
  else if (type.includes('pdf') || url.match(/\.(pdf)$/i)) {
    // For PDF files, create an iframe or object
    el = document.createElement('iframe');
    el.src = proxyUrl;
    el.style.width = '100%';
    el.style.height = '500px';
    el.style.border = 'none';
  }
  else {
    // For other file types, provide a download link
    el = document.createElement('div');
    el.innerHTML = `
      <div style="padding:20px; text-align:center;">
        <p>This file type may not be viewable in the browser.</p>
        <a href="${url}" target="_blank" class="btn" style="display:inline-block; margin-top:15px; padding:10px 20px; background:#3498db; color:white; text-decoration:none; border-radius:4px;">
          Open or Download File
        </a>
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
        <p><a href="${url}" target="_blank" style="color:#3498db;">Try opening directly</a></p>
      `;
      
      mediaPlayer.innerHTML = '';
      mediaPlayer.appendChild(errorDiv);
    });
  }
  
  // Prepend the element to the player (so fallback links appear after)
  mediaPlayer.insertBefore(el, mediaPlayer.firstChild);
  
  // Store the media element for later control
  activeMediaEl = el;
}

function handleMediaClick(e) {
  const mediaItem = e.target.closest('.media-item');
  if (!mediaItem) return;
  
  const index = parseInt(mediaItem.getAttribute('data-index'));
  if (isNaN(index) || index < 0 || index >= unifiedResults.length) return;
  
  selectedUnified = unifiedResults[index];
  debug('Selected media:', selectedUnified);
  
  // Update form
  titleInput.value = selectedUnified.title || '';
  descriptionInput.value = selectedUnified.description || '';
  stationInput.value = selectedUnified.station || '';
  tagsInput.value = selectedUnified.tags?.join(', ') || '';
  submittedByInput.value = selectedUnified.submitted_by || '';
  
  // Update selected media preview
  selectedMedia.innerHTML = '';
  
  const mediaItem = document.createElement('div');
  mediaItem.className = 'media-item selected';
  
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail large';
  
  const typeIcon = document.createElement('span');
  typeIcon.className = 'type-icon';
  typeIcon.textContent = getTypeIcon(selectedUnified.file_type || '');
  
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = selectedUnified.title || 'Untitled';
  
  mediaItem.appendChild(thumbnail);
  thumbnail.appendChild(typeIcon);
  mediaItem.appendChild(title);
  
  // Add play button for audio/video
  if (selectedUnified.file_type && (selectedUnified.file_type.includes('audio') || selectedUnified.file_type.includes('video'))) {
    const playBtn = document.createElement('button');
    playBtn.className = 'play-btn';
    playBtn.innerHTML = '▶';
    playBtn.addEventListener('click', () => {
      openMediaModal(selectedUnified);
    });
    mediaItem.appendChild(playBtn);
  }
  
  selectedMedia.appendChild(mediaItem);
}

async function handleAssign() {
  if (!selectedUnified) {
    showAlert('No media selected');
    return;
  }
  
  const key = keySelect.value;
  if (!key) {
    showAlert('No key selected');
    return;
  }
  
  try {
    debug('Assigning to key:', key);
    
    const assignData = {
      key,
      media_id: selectedUnified.id,
      title: titleInput.value,
      description: descriptionInput.value,
      file_type: selectedUnified.file_type,
      media_url: getAssetUrl(selectedUnified),
      station: stationInput.value,
      tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
      submitted_by: submittedByInput.value
    };
    
    debug('Assignment data:', assignData);
    
    const response = await fetch(`${XANO_PROXY_BASE}/assignments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assignData)
    });
    
    const data = await response.json();
    debug('Assignment created:', data);
    
    if (data.success) {
      showAlert('Assignment created successfully', 'success');
      await loadAssignments();
    } else {
      showAlert(data.message || 'Failed to create assignment');
    }
  } catch (error) {
    debug('Error creating assignment', error);
    showAlert('Failed to create assignment');
  }
}

async function deleteAssignment(key) {
  if (!key) return;
  
  if (!confirm(`Are you sure you want to delete the assignment for key ${key}?`)) {
    return;
  }
  
  try {
    debug('Deleting assignment for key:', key);
    
    const response = await fetch(`${XANO_PROXY_BASE}/assignments/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key })
    });
    
    const data = await response.json();
    debug('Assignment deleted:', data);
    
    if (data.success) {
      showAlert('Assignment deleted successfully', 'success');
      await loadAssignments();
    } else {
      showAlert(data.message || 'Failed to delete assignment');
    }
  } catch (error) {
    debug('Error deleting assignment', error);
    showAlert('Failed to delete assignment');
  }
}

function handleKeyPress(e) {
  const key = e.target.getAttribute('data-key');
  const assignment = assignments.find(a => a.key === key);
  
  if (!assignment) {
    debug('No assignment for key:', key);
    return;
  }
  
  if (playing === key) {
    handleStop();
    return;
  }
  
  handleStop(); // Stop any currently playing
  
  debug('Playing assignment:', assignment);
  playing = key;
  e.target.classList.add('playing');
  
  // Update current info
  currentInfo.textContent = assignment.title || 'Unknown';
  
  // Play the media
  openMediaModal(assignment);
}

function handleStop() {
  if (!playing) return;
  
  debug('Stopping playback');
  const playingButton = keyButtons.find(btn => btn.getAttribute('data-key') === playing);
  if (playingButton) {
    playingButton.classList.remove('playing');
  }
  
  playing = null;
  currentInfo.textContent = '';
  
  // Close modal
  mediaModal.style.display = 'none';
  
  // Stop any active media
  if (activeMediaEl) {
    if (typeof activeMediaEl.pause === 'function') {
      activeMediaEl.pause();
    }
    activeMediaEl = null;
  }
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
      const response = await fetch(`${XANO_PROXY_BASE}/auth/ping`);
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
  }
};
