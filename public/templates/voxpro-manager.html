// Enhanced VoxPro Manager JavaScript
// Complete file with corrected API endpoints

// Global variables
let assignments = [];
let selectedKey = null;
let isInitialized = false;
let modalInstance = null;
let modalContent = null;
let debugMode = true;

// API Configuration - CORRECTED ENDPOINTS
const API_CONFIG = {
    XANO_BASE: 'https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX',
    PROXY_BASE: '/.netlify/functions/xano-proxy',
    SEARCH_API: '/.netlify/functions/search-media'
};

// Debug logging helper
function log(message, data = null) {
    if (debugMode) {
        console.log(`[VoxPro] ${message}`, data || '');
    }
}

// Error display helper
function displayError(message) {
    const errorDiv = document.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    console.error('[VoxPro Error]', message);
}

// Clear error messages
function clearError() {
    const errorDiv = document.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Enhanced fetch with better error handling
async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            log(`Attempting fetch to: ${url} (attempt ${i + 1})`);
            
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
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
            log(`Fetch attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Load media assignments
async function loadAssignments() {
    try {
        log('Loading assignments...');
        clearError();
        
        // Update loading state
        const loadingElement = document.querySelector('.loading-message');
        if (loadingElement) {
            loadingElement.textContent = 'Loading media...';
            loadingElement.style.display = 'block';
        }

        // Try direct API call first
        let data;
        try {
            data = await fetchWithRetry(`${API_CONFIG.XANO_BASE}/user_submission`);
            log('Direct API call successful', data);
        } catch (directError) {
            log('Direct API failed, trying proxy:', directError.message);
            data = await fetchWithRetry(`${API_CONFIG.PROXY_BASE}/user_submission`);
            log('Proxy API call successful', data);
        }

        // Process the data
        if (Array.isArray(data)) {
            assignments = data;
        } else if (data && Array.isArray(data.data)) {
            assignments = data.data;
        } else {
            assignments = [];
        }

        log(`Loaded ${assignments.length} assignments`, assignments);
        
        // Hide loading message
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        // Update UI
        updateAssignmentsList();
        
    } catch (error) {
        log('Failed to load assignments:', error);
        displayError(`Failed to load media assignments: ${error.message}`);
        assignments = [];
        updateAssignmentsList();
    }
}

// Update assignments list in the UI
function updateAssignmentsList() {
    const assignmentsList = document.getElementById('assignmentsList');
    const noAssignments = document.querySelector('.no-assignments');
    
    if (!assignmentsList) {
        log('Assignments list element not found');
        return;
    }

    log(`Updating assignments list with ${assignments.length} items`);

    if (assignments.length === 0) {
        assignmentsList.innerHTML = '';
        if (noAssignments) noAssignments.style.display = 'block';
        return;
    }

    if (noAssignments) noAssignments.style.display = 'none';

    // Create assignment items
    assignmentsList.innerHTML = assignments.map((assignment, index) => {
        const title = assignment.title || `Media Item ${index + 1}`;
        const station = assignment.station || 'Unknown';
        const category = assignment.category || 'Other';
        
        return `
            <div class="assignment-item" onclick="selectAssignment(${index})">
                <div class="assignment-title">${escapeHtml(title)}</div>
                <div class="assignment-details">
                    <span class="station">${escapeHtml(station)}</span>
                    <span class="category">${escapeHtml(category)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// HTML escape helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Select an assignment
function selectAssignment(index) {
    if (index >= 0 && index < assignments.length) {
        const assignment = assignments[index];
        log('Assignment selected:', assignment);
        
        // Update selected assignment display
        updateSelectedAssignmentDisplay(assignment);
        
        // Fill form fields
        fillAssignmentForm(assignment);
        
        selectedKey = index;
    }
}

// Update selected assignment display
function updateSelectedAssignmentDisplay(assignment) {
    const titleElement = document.getElementById('selectedTitle');
    const detailsElement = document.getElementById('selectedDetails');
    
    if (titleElement) {
        titleElement.textContent = assignment.title || 'Untitled Media';
    }
    
    if (detailsElement) {
        const station = assignment.station || 'Unknown Station';
        const category = assignment.category || 'Uncategorized';
        const submittedBy = assignment.submitted_by || 'Unknown';
        
        detailsElement.innerHTML = `
            <div><strong>Station:</strong> ${escapeHtml(station)}</div>
            <div><strong>Category:</strong> ${escapeHtml(category)}</div>
            <div><strong>Submitted by:</strong> ${escapeHtml(submittedBy)}</div>
        `;
    }
}

// Fill assignment form
function fillAssignmentForm(assignment) {
    const fields = [
        'title', 'description', 'category', 'station', 
        'tags', 'priority', 'notes'
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element && assignment[field]) {
            element.value = assignment[field];
        }
    });
    
    // Handle submitted_by field
    const submittedByElement = document.getElementById('submittedBy');
    if (submittedByElement && assignment.submitted_by) {
        submittedByElement.value = assignment.submitted_by;
    }
}

// Assign media to key
async function assignToKey(keyNumber) {
    if (!selectedKey && selectedKey !== 0) {
        displayError('Please select a media item first');
        return;
    }

    try {
        log(`Assigning media to key ${keyNumber}`, assignments[selectedKey]);
        clearError();

        const assignment = assignments[selectedKey];
        const keyData = {
            key_number: keyNumber,
            media_id: assignment.id,
            title: assignment.title,
            cloudinary_url: assignment.cloudinary_url,
            assigned_at: new Date().toISOString()
        };

        // Try to save assignment
        let response;
        try {
            response = await fetchWithRetry(`${API_CONFIG.XANO_BASE}/key_assignment`, {
                method: 'POST',
                body: JSON.stringify(keyData)
            });
        } catch (directError) {
            log('Direct API failed for assignment, trying proxy:', directError.message);
            response = await fetchWithRetry(`${API_CONFIG.PROXY_BASE}/key_assignment`, {
                method: 'POST',
                body: JSON.stringify(keyData)
            });
        }

        log('Assignment successful:', response);
        
        // Update key display
        updateKeyDisplay(keyNumber, assignment);
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = `Media assigned to Key ${keyNumber} successfully!`;
        successDiv.style.cssText = `
            background: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border: 1px solid #c3e6cb;
        `;
        
        const container = document.querySelector('.voxpro-container') || document.body;
        container.insertBefore(successDiv, container.firstChild);
        
        setTimeout(() => successDiv.remove(), 3000);
        
    } catch (error) {
        log('Assignment failed:', error);
        displayError(`Failed to assign media to key: ${error.message}`);
    }
}

// Update key display
function updateKeyDisplay(keyNumber, assignment) {
    const keyButton = document.querySelector(`[data-key="${keyNumber}"]`);
    if (keyButton) {
        keyButton.textContent = assignment.title || `Media ${assignment.id}`;
        keyButton.classList.add('assigned');
        keyButton.style.background = '#28a745';
    }
}

// Play media for key
async function playKey(keyNumber) {
    try {
        log(`Playing key ${keyNumber}`);
        
        // Get key assignment
        let keyAssignment;
        try {
            keyAssignment = await fetchWithRetry(`${API_CONFIG.XANO_BASE}/key_assignment?key_number=${keyNumber}`);
        } catch (error) {
            keyAssignment = await fetchWithRetry(`${API_CONFIG.PROXY_BASE}/key_assignment?key_number=${keyNumber}`);
        }

        if (!keyAssignment || (Array.isArray(keyAssignment) && keyAssignment.length === 0)) {
            displayError(`No media assigned to Key ${keyNumber}`);
            return;
        }

        const assignment = Array.isArray(keyAssignment) ? keyAssignment[0] : keyAssignment;
        
        // Show modal with media
        showMediaModal(assignment);
        
    } catch (error) {
        log('Play key failed:', error);
        displayError(`Failed to play Key ${keyNumber}: ${error.message}`);
    }
}

// Show media modal
function showMediaModal(assignment) {
    log('Showing media modal:', assignment);
    
    const modal = document.getElementById('mediaModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) {
        displayError('Modal elements not found');
        return;
    }

    // Set modal title
    if (modalTitle) {
        modalTitle.textContent = assignment.title || 'Media Player';
    }

    // Clear previous content
    modalBody.innerHTML = '';

    // Get media URL
    const mediaUrl = assignment.cloudinary_url || assignment.media_url || assignment.file_url;
    
    if (!mediaUrl) {
        modalBody.innerHTML = '<p class="error">No media URL found for this item.</p>';
        modal.style.display = 'block';
        return;
    }

    log('Media URL:', mediaUrl);

    // Determine media type and create appropriate element
    const fileExtension = mediaUrl.split('.').pop().toLowerCase();
    const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(fileExtension);
    const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileExtension);

    let mediaElement;
    
    if (isVideo) {
        mediaElement = document.createElement('video');
        mediaElement.controls = true;
        mediaElement.style.width = '100%';
        mediaElement.style.maxHeight = '400px';
    } else if (isAudio) {
        mediaElement = document.createElement('audio');
        mediaElement.controls = true;
        mediaElement.style.width = '100%';
    } else {
        // Try video first, fallback to audio
        mediaElement = document.createElement('video');
        mediaElement.controls = true;
        mediaElement.style.width = '100%';
        mediaElement.style.maxHeight = '400px';
    }

    mediaElement.src = mediaUrl;
    mediaElement.preload = 'metadata';
    
    // Error handling for media element
    mediaElement.onerror = function() {
        log('Media element error, trying audio fallback');
        if (mediaElement.tagName === 'VIDEO') {
            const audioElement = document.createElement('audio');
            audioElement.controls = true;
            audioElement.style.width = '100%';
            audioElement.src = mediaUrl;
            
            audioElement.onerror = function() {
                modalBody.innerHTML = `
                    <p class="error">Unable to play this media file.</p>
                    <p><a href="${mediaUrl}" target="_blank">Open file directly</a></p>
                `;
            };
            
            modalBody.innerHTML = '';
            modalBody.appendChild(audioElement);
        } else {
            modalBody.innerHTML = `
                <p class="error">Unable to play this media file.</p>
                <p><a href="${mediaUrl}" target="_blank">Open file directly</a></p>
            `;
        }
    };

    modalBody.appendChild(mediaElement);
    
    // Show modal
    modal.style.display = 'block';
    
    // Auto-play if possible
    mediaElement.play().catch(error => {
        log('Autoplay prevented (this is normal):', error.message);
    });
}

// Search media
async function searchMedia(query = '') {
    try {
        log('Searching media:', query);
        clearError();

        const searchUrl = query 
            ? `${API_CONFIG.SEARCH_API}?q=${encodeURIComponent(query)}`
            : API_CONFIG.SEARCH_API;

        const results = await fetchWithRetry(searchUrl);
        
        log('Search results:', results);
        
        // Update assignments with search results
        if (Array.isArray(results)) {
            assignments = results;
        } else if (results && Array.isArray(results.data)) {
            assignments = results.data;
        } else {
            assignments = [];
        }
        
        updateAssignmentsList();
        
    } catch (error) {
        log('Search failed:', error);
        displayError(`Search failed: ${error.message}`);
    }
}

// Initialize the application
async function initializeVoxPro() {
    if (isInitialized) return;
    
    log('Initializing VoxPro Manager...');
    
    try {
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        await loadAssignments();
        
        isInitialized = true;
        log('VoxPro Manager initialized successfully');
        
    } catch (error) {
        log('Initialization failed:', error);
        displayError(`Failed to initialize VoxPro Manager: ${error.message}`);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 2 || query.length === 0) {
                searchMedia(query);
            }
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const query = searchInput ? searchInput.value.trim() : '';
            searchMedia(query);
        });
    }

    // Modal close functionality
    const modal = document.getElementById('mediaModal');
    const closeButton = document.querySelector('.close-modal');
    
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Stop button functionality
    const stopButton = document.getElementById('stopButton');
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            // Stop all audio/video elements
            document.querySelectorAll('audio, video').forEach(media => {
                media.pause();
                media.currentTime = 0;
            });
            
            // Close modal
            if (modal) modal.style.display = 'none';
        });
    }

    // Key assignment buttons
    document.querySelectorAll('[data-key]').forEach(button => {
        const keyNumber = parseInt(button.dataset.key);
        button.addEventListener('click', () => playKey(keyNumber));
        
        // Right-click for assignment
        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            assignToKey(keyNumber);
        });
    });

    // Upload Files button
    const uploadButton = document.getElementById('uploadButton');
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            window.open('/file-manager.html', '_blank');
        });
    }
}

// Global functions for HTML onclick events
window.selectAssignment = selectAssignment;
window.assignToKey = assignToKey;
window.playKey = playKey;
window.searchMedia = searchMedia;
window.initializeVoxPro = initializeVoxPro;

// Test function to verify functionality
window.testVoxPro = function() {
    log('Testing VoxPro functionality...');
    log('Assignments loaded:', assignments.length);
    log('API Config:', API_CONFIG);
    log('Is initialized:', isInitialized);
    
    // Test API connectivity
    fetchWithRetry(`${API_CONFIG.XANO_BASE}/auth/ping`)
        .then(result => log('API test successful:', result))
        .catch(error => log('API test failed:', error.message));
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVoxPro);
} else {
    initializeVoxPro();
}
