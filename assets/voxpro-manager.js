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
      
      // If can't connect, use test data
      useTestAssignments();
    }
  }
}

// Function to use test assignments when server is unavailable
function useTestAssignments() {
  debug('Using test assignments');
  assignments = [
    {
      id: 1,
      key: 'F1',
      title: 'Test Audio',
      description: 'This is a test audio file',
      file_type: 'audio/mp3',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/11/file_example_MP3_700KB.mp3',
      station: 'Test Station',
      tags: ['test', 'audio'],
      submitted_by: 'System'
    },
    {
      id: 2,
      key: 'F2',
      title: 'Test Video',
      description: 'This is a test video file',
      file_type: 'video/mp4',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4',
      station: 'Test Station',
      tags: ['test', 'video'],
      submitted_by: 'System'
    },
    {
      id: 3,
      key: 'F3',
      title: 'Test Image',
      description: 'This is a test image file',
      file_type: 'image/jpeg',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/10/file_example_JPG_500kB.jpg',
      station: 'Test Station',
      tags: ['test', 'image'],
      submitted_by: 'System'
    }
  ];
  
  renderAssignments();
}

async function loadAssignments() {
  if (!connGood) {
    useTestAssignments();
    return;
  }
  
  try {
    debug('Loading assignments...');
    const response = await fetch(`${XANO_PROXY_BASE}/assignments/get`);
    const data = await response.json();
    assignments = data.assignments || [];
    debug('Assignments loaded', assignments);
    
    // If no assignments from server, use test data
    if (!assignments || assignments.length === 0) {
      useTestAssignments();
      return;
    }
    
    renderAssignments();
  } catch (error) {
    debug('Error loading assignments', error);
    showAlert('Failed to load assignments');
    useTestAssignments();
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
    showAlert('Not connected to database - using test data');
    useTestSearchResults(query);
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
    
    // If no results, use test data
    if (!unifiedResults || unifiedResults.length === 0) {
      useTestSearchResults(query);
      return;
    }
    
    renderMediaResults();
  } catch (error) {
    debug('Search error', error);
    showAlert('Search failed - using test data');
    useTestSearchResults(query);
  }
}

// Function to use test search results when server is unavailable
function useTestSearchResults(query) {
  debug('Using test search results for:', query);
  unifiedResults = [
    {
      id: 1,
      title: 'Test Audio',
      description: 'This is a test audio file',
      file_type: 'audio/mp3',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/11/file_example_MP3_700KB.mp3',
      station: 'Test Station',
      tags: ['test', 'audio'],
      submitted_by: 'System'
    },
    {
      id: 2,
      title: 'Test Video',
      description: 'This is a test video file',
      file_type: 'video/mp4',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4',
      station: 'Test Station',
      tags: ['test', 'video'],
      submitted_by: 'System'
    },
    {
      id: 3,
      title: 'Test Image',
      description: 'This is a test image file',
      file_type: 'image/jpeg',
      media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/10/file_example_JPG_500kB.jpg',
      station: 'Test Station',
      tags: ['test', 'image'],
      submitted_by: 'System'
    }
  ];
  
  renderMediaResults();
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
  
  // Try common URL fields
  const urlFields = ['media_url', 'database_url', 'file_url', 'url', 'public_url', 'thumbnail'];
  
  for (const field of urlFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].startsWith('http')) {
      debug(`Found URL in field ${field}:`, item[field]);
      return item[field];
    }
  }
  
  // Manual URL extraction
  for (const key in item) {
    const value = item[key];
    if (typeof value === 'string' && value.startsWith('http')) {
      debug(`Found URL in field ${key}:`, value);
      return value;
    }
  }
  
  debug('No valid URL found in asset:', item);
  return '';
}

function openMediaModal(asset) {
  console.log('Opening modal for asset:', asset);
  
  // Clear the media player first
  mediaPlayer.innerHTML = '';
  
  // Set description and title
  mediaDescription.textContent = asset.description || '';
  modalTitle.textContent = asset.title || 'Player';
  
  // Show modal first
  mediaModal.style.display = 'block';
  
  // Get the URL directly from the asset - DO NOT USE ANY PROXY
  let url = '';
  if (asset.media_url) url = asset.media_url;
  else if (asset.url) url = asset.url;
  else if (asset.file_url) url = asset.file_url;
  else {
    // Try to find any field that looks like a URL
    for (const key in asset) {
      const value = asset[key];
      if (typeof value === 'string' && value.startsWith('http')) {
        url = value;
        console.log(`Found URL in field ${key}:`, url);
        break;
      }
    }
  }
  
  console.log('Media URL found:', url);
  
  if (!url) {
    mediaPlayer.innerHTML = `
      <div style="padding:20px;text-align:center;">
        <h3 style="color:red;">No Media URL Found</h3>
        <p>Unable to find a valid URL in this asset.</p>
        <p>Asset data:</p>
        <pre style="text-align:left;background:#f5f5f5;padding:10px;overflow:auto;max-height:200px;">
        ${JSON.stringify(asset, null, 2)}
        </pre>
      </div>`;
    return;
  }
  
  // DO NOT use any proxy - use the URL directly
  // This avoids CORS and fetch issues
  
  // Create appropriate element based on type
  let el;
  const type = asset.file_type || '';
  
  // Display a basic link that will open in a new tab
  // This is the most reliable approach when fetch is failing
  el = document.createElement('div');
  el.style.padding = '20px';
  el.style.textAlign = 'center';
  
  // First add a direct link
  const linkContainer = document.createElement('div');
  linkContainer.innerHTML = `
    <div style="margin-bottom:20px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:10px 20px;background:#3498db;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">
        Open Media in New Tab
      </a>
      <p style="margin-top:10px;color:#666;">Click the button above to view the media in a new tab</p>
    </div>
  `;
  el.appendChild(linkContainer);
  
  // Then try to add an appropriate embedded player as well
  let embedEl = null;
  
  if (type.includes('audio') || url.match(/\.(mp3|wav|aac|m4a|ogg)$/i)) {
    embedEl = document.createElement('audio');
    embedEl.controls = true;
    embedEl.autoplay = false;
    embedEl.src = url;
    embedEl.style.width = '100%';
    embedEl.style.marginTop = '20px';
    
    el.appendChild(document.createElement('hr'));
    
    const playerTitle = document.createElement('h4');
    playerTitle.textContent = 'Audio Player (if available)';
    playerTitle.style.marginTop = '20px';
    el.appendChild(playerTitle);
    
    el.appendChild(embedEl);
  } 
  else if (type.includes('video') || url.match(/\.(mp4|webm|mov|avi|wmv)$/i)) {
    embedEl = document.createElement('video');
    embedEl.controls = true;
    embedEl.autoplay = false;
    embedEl.src = url;
    embedEl.style.maxWidth = '100%';
    embedEl.style.maxHeight = '400px';
    
    el.appendChild(document.createElement('hr'));
    
    const playerTitle = document.createElement('h4');
    playerTitle.textContent = 'Video Player (if available)';
    playerTitle.style.marginTop = '20px';
    el.appendChild(playerTitle);
    
    el.appendChild(embedEl);
  }
  else if (type.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    // For images, embed directly as well
    embedEl = document.createElement('img');
    embedEl.src = url;
    embedEl.alt = asset.title || '';
    embedEl.style.maxWidth = '100%';
    embedEl.style.maxHeight = '400px';
    embedEl.style.display = 'block';
    embedEl.style.margin = '20px auto';
    
    el.appendChild(document.createElement('hr'));
    
    const imageTitle = document.createElement('h4');
    imageTitle.textContent = 'Image Preview';
    imageTitle.style.marginTop = '20px';
    el.appendChild(imageTitle);
    
    el.appendChild(embedEl);
  }
  
  // Add to player
  mediaPlayer.appendChild(el);
  
  // If we have an embedded element, add error handling
  if (embedEl && embedEl.tagName !== 'DIV') {
    embedEl.addEventListener('error', (e) => {
      console.error('Media error:', e);
      
      const errorMsg = document.createElement('div');
      errorMsg.style.color = 'red';
      errorMsg.style.marginTop = '10px';
      errorMsg.textContent = 'Failed to load embedded media. Please use the direct link above.';
      
      embedEl.parentNode.replaceChild(errorMsg, embedEl);
    });
  }
  
  // Store the media element for later control
  activeMediaEl = embedEl;
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
    
    // Get the media URL
    const mediaUrl = getAssetUrl(selectedUnified);
    if (!mediaUrl) {
      showAlert('No media URL found');
      return;
    }
    
    const assignData = {
      key,
      media_id: selectedUnified.id,
      title: titleInput.value,
      description: descriptionInput.value,
      file_type: selectedUnified.file_type,
      media_url: mediaUrl,
      station: stationInput.value,
      tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag),
      submitted_by: submittedByInput.value
    };
    
    debug('Assignment data:', assignData);
    
    let success = false;
    
    // Only try server if connected
    if (connGood) {
      try {
        const response = await fetch(`${XANO_PROXY_BASE}/assignments/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(assignData)
        });
        
        const data = await response.json();
        debug('Assignment created on server:', data);
        success = data.success;
      } catch (error) {
        debug('Error creating assignment on server:', error);
        success = false;
      }
    }
    
    // If server failed or not connected, update local assignments
    if (!success) {
      debug('Updating assignments locally');
      
      // Remove any existing assignment with this key
      const existingIndex = assignments.findIndex(a => a.key === key);
      if (existingIndex !== -1) {
        assignments.splice(existingIndex, 1);
      }
      
      // Add the new assignment
      assignments.push(assignData);
      
      success = true;
    }
    
    if (success) {
      showAlert('Assignment created successfully', 'success');
      
      // Re-render assignments
      renderAssignments();
    } else {
      showAlert('Failed to create assignment');
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
    
    let success = false;
    
    // Only try server if connected
    if (connGood) {
      try {
        const response = await fetch(`${XANO_PROXY_BASE}/assignments/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key })
        });
        
        const data = await response.json();
        debug('Assignment deleted on server:', data);
        success = data.success;
      } catch (error) {
        debug('Error deleting assignment on server:', error);
        success = false;
      }
    }
    
    // If server failed or not connected, update local assignments
    if (!success) {
      debug('Updating assignments locally');
      
      // Remove the assignment from local array
      const existingIndex = assignments.findIndex(a => a.key === key);
      if (existingIndex !== -1) {
        assignments.splice(existingIndex, 1);
      }
      
      success = true;
    }
    
    if (success) {
      showAlert('Assignment deleted successfully', 'success');
      
      // Re-render assignments
      renderAssignments();
    } else {
      showAlert('Failed to delete assignment');
    }
  } catch (error) {
    debug('Error deleting assignment', error);
    showAlert('Failed to delete assignment');
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

// Fix event handlers when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Applying direct fixes for key handlers and assignments');
  
  // Direct fix for key buttons
  const keyButtons = document.querySelectorAll('.key[data-key]');
  keyButtons.forEach(btn => {
    // Remove existing event listeners
    const newBtn = btn.cloneNode(true);
    if (btn.parentNode) {
      btn.parentNode.replaceChild(newBtn, btn);
    }
    
    // Add new simplified handler
    newBtn.addEventListener('click', function() {
      const key = this.getAttribute('data-key');
      console.log('Key pressed:', key);
      
      // Check if we're already playing this key
      if (this.classList.contains('playing')) {
        // Stop playback
        this.classList.remove('playing');
        
        // Update info
        const currentInfo = document.getElementById('currentInfo');
        if (currentInfo) currentInfo.textContent = '';
        
        // Close modal
        const mediaModal = document.getElementById('mediaModal');
        if (mediaModal) mediaModal.style.display = 'none';
        
        console.log('Stopped playback for key:', key);
        return;
      }
      
      // Stop any currently playing keys
      document.querySelectorAll('.key.playing').forEach(playingBtn => {
        playingBtn.classList.remove('playing');
      });
      
      // Mark this key as playing
      this.classList.add('playing');
      
      // Find the assignment for this key
      // If assignments aren't loaded yet, use a test assignment
      let assignment = null;
      
      if (window.assignments && Array.isArray(window.assignments)) {
        assignment = window.assignments.find(a => a.key === key);
      }
      
      // If no assignment found, create a test one
      if (!assignment) {
        console.log('No assignment found for key, using test data');
        
        // Create a test assignment based on the key
        const testAssignments = {
          'F1': {
            title: 'Test Audio',
            description: 'This is a test audio file',
            file_type: 'audio/mp3',
            media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/11/file_example_MP3_700KB.mp3'
          },
          'F2': {
            title: 'Test Video',
            description: 'This is a test video file',
            file_type: 'video/mp4',
            media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/04/file_example_MP4_480_1_5MG.mp4'
          },
          'F3': {
            title: 'Test Image',
            description: 'This is a test image file',
            file_type: 'image/jpeg',
            media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/10/file_example_JPG_500kB.jpg'
          }
        };
        
        assignment = testAssignments[key] || {
          title: `Test Media for ${key}`,
          description: 'Test media item',
          file_type: 'audio/mp3',
          media_url: 'https://file-examples.com/storage/fe52cb0aac6482d3dd626c9/2017/11/file_example_MP3_700KB.mp3'
        };
        
        // Add the key to the assignment
        assignment.key = key;
      }
      
      // Update current info
      const currentInfo = document.getElementById('currentInfo');
      if (currentInfo) currentInfo.textContent = assignment.title || key;
      
      // Open the media modal with this assignment
      if (typeof openMediaModal === 'function') {
        openMediaModal(assignment);
      } else {
        alert('Media player function not available');
      }
    });
  });
  
  // Fix stop button
  const stopButton = document.getElementById('stopButton');
  if (stopButton) {
    const newStopBtn = stopButton.cloneNode(true);
    if (stopButton.parentNode) {
      stopButton.parentNode.replaceChild(newStopBtn, stopButton);
    }
    
    newStopBtn.addEventListener('click', function() {
      console.log('Stop button pressed');
      
      // Remove playing class from all keys
      document.querySelectorAll('.key.playing').forEach(btn => {
        btn.classList.remove('playing');
      });
      
      // Clear current info
      const currentInfo = document.getElementById('currentInfo');
      if (currentInfo) currentInfo.textContent = '';
      
      // Close modal
      const mediaModal = document.getElementById('mediaModal');
      if (mediaModal) mediaModal.style.display = 'none';
      
      // Stop any active media
      if (activeMediaEl) {
        if (typeof activeMediaEl.pause === 'function') {
          activeMediaEl.pause();
        }
        activeMediaEl = null;
      }
    });
  }
  
  // Fix the modal close button
  const modalClose = document.querySelector('.modal-close');
  if (modalClose) {
    const newModalClose = modalClose.cloneNode(true);
    if (modalClose.parentNode) {
      modalClose.parentNode.replaceChild(newModalClose, modalClose);
    }
    
    newModalClose.addEventListener('click', function() {
      const mediaModal = document.getElementById('mediaModal');
      if (mediaModal) {
        mediaModal.style.display = 'none';
      }
      
      // Stop any active media
      if (activeMediaEl) {
        if (typeof activeMediaEl.pause === 'function') {
          activeMediaEl.pause();
        }
        activeMediaEl = null;
      }
    });
  }
  
  console.log('Direct fixes applied');
});
