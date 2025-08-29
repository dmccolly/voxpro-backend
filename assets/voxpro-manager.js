// Fixed VoxPro Manager JavaScript
// Global variables
let assignments = [];
let mediaList = [];
let selectedMedia = null;
let isInitialized = false;

// API Configuration
const API_CONFIG = {
    XANO_PROXY_BASE: 'https://majestic-beijinho-cd3d75.netlify.app/.netlify/functions/xano-proxy'
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

// Enhanced fetch with error handling
async function fetchWithRetry(url, options = {}) {
    try {
        log(`Fetching: ${url}`);
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
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
        log(`Fetch failed:`, error.message);
        throw error;
    }
}

// Load media from Xano
async function loadMedia() {
    try {
        log('Loading media from Xano...');
        
        // Update loading state
        const mediaBrowser = document.getElementById('mediaBrowser');
        if (mediaBrowser) {
            mediaBrowser.innerHTML = '<div class="empty-state">Loading media...</div>';
        }

        // Fetch media from user_submission endpoint
        const data = await fetchWithRetry(`${API_CONFIG.XANO_PROXY_BASE}/user_submission`);
        
        if (Array.isArray(data)) {
            mediaList = data;
        } else if (data && Array.isArray(data.data)) {
            mediaList = data.data;
        } else {
            mediaList = [];
        }

        log(`Loaded ${mediaList.length} media items`, mediaList);
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
        log('Loading assignments from Xano...');
        
        const data = await fetchWithRetry(`${API_CONFIG.XANO_PROXY_BASE}/voxpro_assignments`);
        
        if (Array.isArray(data)) {
            assignments = data;
        } else {
            assignments = [];
        }

        log(`Loaded ${assignments.length} assignments`, assignments);
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
        
        await fetchWithRetry(`${API_CONFIG.XANO_PROXY_BASE}/voxpro_assignments/${assignmentId}`, {
            method: 'DELETE'
        });
        
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
        
        await fetchWithRetry(`${API_CONFIG.XANO_PROXY_BASE}/voxpro_assignments`, {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
        
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
    
    // Update UI
    document.querySelectorAll('.key-button').forEach(btn => {
        btn.classList.remove('playing');
    });
    document.getElementById(`key${keyNumber}`)?.classList.add('playing');
    
    showMessage(`Playing: ${assignment.title || assignment.asset?.title || 'Unknown'}`, 'success');
    
    // Auto-stop after 3 seconds (demo mode)
    setTimeout(() => {
        stopPlayback();
    }, 3000);
}

// Stop playback
function stopPlayback() {
    log('Stopping playback');
    
    document.querySelectorAll('.key-button').forEach(btn => {
        btn.classList.remove('playing');
    });
    
    showMessage('Playback stopped', 'success');
}

// Search media
async function searchMedia(query) {
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVoxPro);
} else {
    initializeVoxPro();
}
