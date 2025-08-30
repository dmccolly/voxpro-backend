// Enhanced VoxPro Manager JavaScript
// Global variables
let assignments = [];
let mediaList = [];
let selectedMedia = null;
let isInitialized = false;

// API Configuration
const API_CONFIG = {
    XANO_PROXY_BASE: '/.netlify/functions/xano-proxy',
    LIST_MEDIA: '/.netlify/functions/list-media',
    FETCH_MEDIA: '/.netlify/functions/fetch-media',
    XANO_DATA_FETCH: '/.netlify/functions/xano-data-fetch'
};

// Debug logging
function log(message, data = null) {
    console.log(`[VoxPro] ${message}`, data || '');
}

// Show message function
function showMessage(text, type = 'success') {
    const messageBox = document.getElementById('messageBox');
    if (!messageBox) return;
    
    messageBox.textContent = text;
    messageBox.className = `message ${type}`;
    messageBox.style.display = 'block';
    
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 5000);
}

// Enhanced fetch with error handling and multiple attempts
async function fetchWithRetry(url, options = {}) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            log(`Fetching (attempt ${attempt + 1}): ${url}`);
            
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            log(`Fetch successful`, data);
            return data;
        } catch (error) {
            log(`Fetch attempt ${attempt + 1} failed:`, error.message);
            lastError = error;
            
            // Wait before retrying (exponential backoff)
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    
    throw lastError || new Error(`Failed to fetch from ${url} after ${maxRetries} attempts`);
}

// Load media from multiple potential sources
async function loadMedia() {
    try {
        log('Loading media...');
        
        // Update loading state
        const mediaBrowser = document.getElementById('mediaBrowser');
        if (mediaBrowser) {
            mediaBrowser.innerHTML = '<div class="empty-state">Loading media...</div>';
        }

        // Try multiple endpoints to ensure we get media data
        let data = null;
        const endpoints = [
            API_CONFIG.XANO_PROXY_BASE + '/user_submission',
            API_CONFIG.LIST_MEDIA,
            API_CONFIG.XANO_DATA_FETCH
        ];
        
        // Try each endpoint until we get a successful response
        for (const endpoint of endpoints) {
            try {
                log(`Trying to load media from: ${endpoint}`);
                const result = await fetchWithRetry(endpoint);
                
                if (result) {
                    if (Array.isArray(result)) {
                        data = result;
                        log(`Successfully loaded ${data.length} media items from ${endpoint}`);
                        break;
                    } else if (result.data && Array.isArray(result.data)) {
                        data = result.data;
                        log(`Successfully loaded ${data.length} media items from ${endpoint} (.data)`);
                        break;
                    } else if (result.results && Array.isArray(result.results)) {
                        data = result.results;
                        log(`Successfully loaded ${data.length} media items from ${endpoint} (.results)`);
                        break;
                    }
                }
                log(`Endpoint ${endpoint} returned invalid data format`);
            } catch (endpointError) {
                log(`Endpoint ${endpoint} failed:`, endpointError.message);
            }
        }
        
        // If we still don't have data, use demo data as fallback
        if (!data) {
            log('All endpoints failed, using demo data');
            data = [
                { id: 1, title: 'Demo Audio 1', description: 'For testing only', station: 'Demo', category: 'Audio' },
                { id: 2, title: 'Demo Audio 2', description: 'For testing only', station: 'Demo', category: 'Audio' },
                { id: 3, title: 'Demo Video', description: 'For testing only', station: 'Demo', category: 'Video' }
            ];
        }
        
        mediaList = data;
        log(`Media list set with ${mediaList.length} items`);
        renderMediaBrowser();
        
    } catch (error) {
        log('Failed to load media:', error);
        const mediaBrowser = document.getElementById('mediaBrowser');
        if (mediaBrowser) {
            mediaBrowser.innerHTML = '<div class="empty-state">Failed to load media</div>';
        }
    }
}

// Render media browser
function renderMediaBrowser() {
    const mediaBrowser = document.getElementById('mediaBrowser');
    if (!mediaBrowser) return;

    if (mediaList.length === 0) {
        mediaBrowser.innerHTML = '<div class="empty-state">No media found</div>';
        return;
    }

    mediaBrowser.innerHTML = mediaList.map((media, index) => {
        const title = media.title || `Media Item ${index + 1}`;
        const station = media.station || 'Unknown';
        const category = media.category || 'Other';
        
        return `
            <div class="media-item" data-id="${media.id}" onclick="selectMedia(${media.id})">
                <div class="media-icon">🎵</div>
                <div class="media-info">
                    <div class="media-title">${escapeHtml(title)}</div>
                    <div class="media-meta">${escapeHtml(station)} • ${escapeHtml(category)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// HTML escape helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Select media item
function selectMedia(mediaId) {
    selectedMedia = mediaList.find(m => m.id == mediaId);
    if (!selectedMedia) return;
    
    log('Media selected:', selectedMedia);
    
    // Update UI selection
    document.querySelectorAll('.media-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-id="${mediaId}"]`)?.classList.add('selected');
    
    // Fill form fields
    const titleInput = document.getElementById('titleInput');
    const descriptionInput = document.getElementById('descriptionInput');
    const stationInput = document.getElementById('stationInput');
    const tagsInput = document.getElementById('tagsInput');
    const submittedByInput = document.getElementById('submittedByInput');
    
    if (titleInput) titleInput.value = selectedMedia.title || '';
    if (descriptionInput) descriptionInput.value = selectedMedia.description || '';
    if (stationInput) stationInput.value = selectedMedia.station || '';
    if (tagsInput) tagsInput.value = selectedMedia.tags || '';
    if (submittedByInput) submittedByInput.value = selectedMedia.submitted_by || '';
}

// Load assignments from Xano
async function loadAssignments() {
    try {
        log('Loading assignments...');
        
        // Try multiple endpoints
        const endpoints = [
            API_CONFIG.XANO_PROXY_BASE + '/voxpro_assignments',
            API_CONFIG.XANO_PROXY_BASE + '/assignments',
            API_CONFIG.XANO_PROXY_BASE + '/assignments/get'
        ];
        
        let data = null;
        
        // Try each endpoint
        for (const endpoint of endpoints) {
            try {
                log(`Trying to load assignments from: ${endpoint}`);
                const result = await fetchWithRetry(endpoint);
                
                if (result) {
                    if (Array.isArray(result)) {
                        data = result;
                        log(`Successfully loaded ${data.length} assignments from ${endpoint}`);
                        break;
                    } else if (result.data && Array.isArray(result.data)) {
                        data = result.data;
                        log(`Successfully loaded ${data.length} assignments from ${endpoint} (.data)`);
                        break;
                    }
                }
                log(`Endpoint ${endpoint} returned invalid data format`);
            } catch (endpointError) {
                log(`Endpoint ${endpoint} failed:`, endpointError.message);
            }
        }
        
        // If we couldn't get assignments, use empty array
        if (!data) {
            log('All assignment endpoints failed, using empty array');
            data = [];
        }
        
        assignments = data;
        log(`Loaded ${assignments.length} assignments`);
        renderAssignments();
        updateKeyButtons();
        
    } catch (error) {
        log('Failed to load assignments:', error);
        assignments = [];
        renderAssignments();
    }
}

// Render assignments list with delete buttons
function renderAssignments() {
    const assignmentsList = document.getElementById('assignmentsList');
    if (!assignmentsList) return;

    if (assignments.length === 0) {
        assignmentsList.innerHTML = '<div class="empty-state">No assignments yet</div>';
        return;
    }

    assignmentsList.innerHTML = assignments.map(assignment => {
        const title = assignment.title || assignment.asset?.title || 'Unknown';
        const keyNum = assignment.key_number || assignment.key_slot || 'Unknown';
        
        return `
            <div class="assignment-item">
                <span class="assignment-key">Key ${keyNum} — ${escapeHtml(title)}</span>
                <button class="remove-button" onclick="deleteAssignment(${assignment.id})">×</button>
            </div>
        `;
    }).join('');
}

// Update key button states
function updateKeyButtons() {
    for (let i = 1; i <= 5; i++) {
        const keyButton = document.getElementById(`key${i}`);
        if (!keyButton) continue;
        
        const assignment = assignments.find(a => 
            (a.key_number == i) || (a.key_slot == i)
        );
        
        if (assignment) {
            keyButton.classList.add('assigned');
        } else {
            keyButton.classList.remove('assigned');
        }
    }
}

// Delete assignment
async function deleteAssignment(assignmentId) {
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    
    try {
        log('Deleting assignment:', assignmentId);
        
        // Try multiple endpoints
        const endpoints = [
            `${API_CONFIG.XANO_PROXY_BASE}/voxpro_assignments/${assignmentId}`,
            `${API_CONFIG.XANO_PROXY_BASE}/assignments/${assignmentId}`,
            `${API_CONFIG.XANO_PROXY_BASE}/assignments/delete/${assignmentId}`
        ];
        
        let success = false;
        
        // Try each endpoint
        for (const endpoint of endpoints) {
            try {
                log(`Trying to delete assignment using: ${endpoint}`);
                await fetchWithRetry(endpoint, { method: 'DELETE' });
                success = true;
                log(`Successfully deleted assignment using ${endpoint}`);
                break;
            } catch (endpointError) {
                log(`Endpoint ${endpoint} failed:`, endpointError.message);
            }
        }
        
        if (!success) {
            throw new Error('All delete endpoints failed');
        }
        
        showMessage('Assignment removed successfully!', 'success');
        await loadAssignments(); // Reload assignments
        
    } catch (error) {
        log('Delete assignment failed:', error);
        showMessage(`Delete failed: ${error.message}`, 'error');
    }
}

// Create assignment
async function createAssignment() {
    if (!selectedMedia) {
        showMessage('Please select a media item first', 'error');
        return;
    }
    
    const keySelect = document.getElementById('keySelect');
    const keySlot = keySelect?.value;
    
    if (!keySlot) {
        showMessage('Please select a key slot', 'error');
        return;
    }
    
    try {
        log('Creating assignment:', { mediaId: selectedMedia.id, keySlot });
        
        const assignmentData = {
            asset_id: selectedMedia.id,
            key_number: parseInt(keySlot),
            title: document.getElementById('titleInput')?.value || selectedMedia.title,
            description: document.getElementById('descriptionInput')?.value || selectedMedia.description,
            station: document.getElementById('stationInput')?.value || selectedMedia.station,
            tags: document.getElementById('tagsInput')?.value || selectedMedia.tags,
            submitted_by: document.getElementById('submittedByInput')?.value || selectedMedia.submitted_by
        };
        
        // Try multiple endpoints for creating assignment
        const endpoints = [
            `${API_CONFIG.XANO_PROXY_BASE}/voxpro_assignments`,
            `${API_CONFIG.XANO_PROXY_BASE}/assignments/create`,
            `${API_CONFIG.XANO_PROXY_BASE}/assignments`
        ];
        
        let success = false;
        
        // Try each endpoint
        for (const endpoint of endpoints) {
            try {
                log(`Trying to create assignment using: ${endpoint}`);
                await fetchWithRetry(endpoint, {
                    method: 'POST',
                    body: JSON.stringify(assignmentData)
                });
                success = true;
                log(`Successfully created assignment using ${endpoint}`);
                break;
            } catch (endpointError) {
                log(`Endpoint ${endpoint} failed:`, endpointError.message);
            }
        }
        
        if (!success) {
            throw new Error('All assignment creation endpoints failed');
        }
        
        showMessage('Assignment created successfully!', 'success');
        await loadAssignments(); // Reload assignments
        
        // Clear form
        if (keySelect) keySelect.value = '';
        
    } catch (error) {
        log('Create assignment failed:', error);
        showMessage(`Assignment failed: ${error.message}`, 'error');
    }
}

// Play key function
async function playKey(keyNumber) {
    const assignment = assignments.find(a => 
        (a.key_number == keyNumber) || (a.key_slot == keyNumber)
    );
    
    if (!assignment) {
        showMessage(`No media assigned to Key ${keyNumber}`, 'error');
        return;
    }
    
    log('Playing key:', keyNumber, assignment);
    
    // Try to find media URL
    let mediaUrl = null;
    
    // First check assignment object
    if (assignment.file_url || assignment.cloudinary_url || assignment.media_url) {
        mediaUrl = assignment.file_url || assignment.cloudinary_url || assignment.media_url;
    }
    // Then check if it has an asset object
    else if (assignment.asset && (assignment.asset.file_url || assignment.asset.cloudinary_url || assignment.asset.media_url)) {
        mediaUrl = assignment.asset.file_url || assignment.asset.cloudinary_url || assignment.asset.media_url;
    }
    // If we still don't have a URL, try to find the media in our loaded media list
    else {
        const mediaId = assignment.asset_id || assignment.media_id;
        const media = mediaList.find(m => m.id == mediaId);
        if (media) {
            mediaUrl = media.file_url || media.cloudinary_url || media.media_url;
        }
    }
    
    // Update UI
    document.querySelectorAll('.key-button').forEach(btn => {
        btn.classList.remove('playing');
    });
    document.getElementById(`key${keyNumber}`)?.classList.add('playing');
    
    showMessage(`Playing: ${assignment.title || assignment.asset?.title || 'Unknown'}`, 'success');
    
    // If we have a media URL, show in a modal
    if (mediaUrl) {
        showMediaModal(mediaUrl, assignment.title || assignment.asset?.title || 'Media');
    } else {
        // Otherwise just simulate playback
        setTimeout(() => {
            stopPlayback();
        }, 3000);
    }
}

// Stop playback
function stopPlayback() {
    log('Stopping playback');
    
    // Reset UI
    document.querySelectorAll('.key-button').forEach(btn => {
        btn.classList.remove('playing');
    });
    
    // Close any open media modal
    const modal = document.getElementById('mediaModal');
    if (modal) {
        modal.remove();
    }
    
    showMessage('Playback stopped', 'success');
}

// Show media modal
function showMediaModal(url, title) {
    // Remove any existing modal
    const existingModal = document.getElementById('mediaModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'mediaModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    // Determine media type from URL
    const fileType = determineFileType(url);
    
    // Create content based on type
    let mediaElement = '';
    
    if (fileType === 'audio') {
        mediaElement = `
            <audio controls autoplay style="width: 100%; max-width: 500px;">
                <source src="${url}" type="audio/mpeg">
                Your browser does not support audio playback.
            </audio>
        `;
    } else if (fileType === 'video') {
        mediaElement = `
            <video controls autoplay style="width: 100%; max-width: 800px; max-height: 600px;">
                <source src="${url}" type="video/mp4">
                Your browser does not support video playback.
            </video>
        `;
    } else if (fileType === 'image') {
        mediaElement = `
            <img src="${url}" style="max-width: 90%; max-height: 90vh; object-fit: contain;">
        `;
    } else {
        mediaElement = `
            <div style="color: white; text-align: center; padding: 20px;">
                <p>Unable to display this media type.</p>
                <a href="${url}" target="_blank" style="color: #00d4aa; text-decoration: underline;">Open in new tab</a>
            </div>
        `;
    }
    
    // Set modal content
    modal.innerHTML = `
        <div style="position: relative; background: #2d2d2d; padding: 20px; border-radius: 10px; max-width: 90%; max-height: 90%;">
            <button id="closeModal" style="position: absolute; top: 10px; right: 10px; background: #ff6b6b; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 16px; cursor: pointer;">×</button>
            <h2 style="color: white; margin-bottom: 20px; padding-right: 40px;">${escapeHtml(title)}</h2>
            ${mediaElement}
        </div>
    `;
    
    // Add to document
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('closeModal').addEventListener('click', stopPlayback);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            stopPlayback();
        }
    });
}

// Determine file type from URL or extension
function determineFileType(url) {
    if (!url) return 'unknown';
    
    // Convert to lowercase for comparison
    const lowercaseUrl = url.toLowerCase();
    
    // Check file extension
    if (lowercaseUrl.endsWith('.mp3') || lowercaseUrl.endsWith('.wav') || lowercaseUrl.endsWith('.ogg') || lowercaseUrl.endsWith('.m4a')) {
        return 'audio';
    } else if (lowercaseUrl.endsWith('.mp4') || lowercaseUrl.endsWith('.webm') || lowercaseUrl.endsWith('.avi') || lowercaseUrl.endsWith('.mov')) {
        return 'video';
    } else if (lowercaseUrl.endsWith('.jpg') || lowercaseUrl.endsWith('.jpeg') || lowercaseUrl.endsWith('.png') || lowercaseUrl.endsWith('.gif') || lowercaseUrl.endsWith('.webp')) {
        return 'image';
    } else if (lowercaseUrl.includes('audio')) {
        return 'audio';
    } else if (lowercaseUrl.includes('video')) {
        return 'video';
    } else if (lowercaseUrl.includes('image')) {
        return 'image';
    }
    
    return 'unknown';
}

// Search media
async function searchMedia(query = '') {
    if (!query || query.length < 2) {
        renderMediaBrowser(); // Show all media
        return;
    }
    
    try {
        log('Searching media:', query);
        
        // Filter existing media list
        const filteredMedia = mediaList.filter(media => {
            const searchText = [
                media.title || '',
                media.description || '',
                media.station || '',
                media.tags || '',
                media.submitted_by || ''
            ].join(' ').toLowerCase();
            
            return searchText.includes(query.toLowerCase());
        });
        
        // Temporarily replace mediaList for rendering
        const originalList = mediaList;
        mediaList = filteredMedia;
        renderMediaBrowser();
        mediaList = originalList; // Restore original list
        
    } catch (error) {
        log('Search failed:', error);
        showMessage('Search failed', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            searchMedia(query);
        });
    }
    
    // Assignment button
    const assignButton = document.getElementById('assignButton');
    if (assignButton) {
        assignButton.addEventListener('click', createAssignment);
    }
    
    // Key buttons
    for (let i = 1; i <= 5; i++) {
        const keyButton = document.getElementById(`key${i}`);
        if (keyButton) {
            keyButton.addEventListener('click', () => playKey(i));
        }
    }
    
    // Stop button
    const stopButton = document.getElementById('stopButton');
    if (stopButton) {
        stopButton.addEventListener('click', stopPlayback);
    }
}

// Initialize the application
async function initializeVoxPro() {
    if (isInitialized) return;
    
    log('Initializing VoxPro Manager...');
    
    try {
        // Setup event listeners
        setupEventListeners();
        
        // Load data
        await Promise.all([
            loadMedia(),
            loadAssignments()
        ]);
        
        isInitialized = true;
        log('VoxPro Manager initialized successfully');
        
        // Set up periodic refresh for assignments only
        setInterval(loadAssignments, 30000);
        
    } catch (error) {
        log('Initialization failed:', error);
        showMessage(`Failed to initialize: ${error.message}`, 'error');
    }
}

// Make functions available globally for onclick handlers
window.selectMedia = selectMedia;
window.deleteAssignment = deleteAssignment;
window.playKey = playKey;
window.stopPlayback = stopPlayback;
window.searchMedia = searchMedia;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVoxPro);
} else {
    initializeVoxPro();
}
