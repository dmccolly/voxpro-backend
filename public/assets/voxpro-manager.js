// VoxPro Manager JavaScript
// Main application logic for VoxPro Manager interface

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        XANO_PROXY_BASE: '/.netlify/functions/xano-proxy',
        LIST_MEDIA_ENDPOINT: '/.netlify/functions/list-media',
        SEARCH_MEDIA_ENDPOINT: '/.netlify/functions/search-media',
        ASSIGNMENTS_REFRESH_MS: 30000,
        DEBOUNCE_MS: 300
    };

    // Global state
    let state = {
        selectedMedia: null,
        mediaList: [],
        cloudinaryAssets: [],
        assignments: [],
        playing: null,
        connected: false
    };

    // DOM elements cache
    let elements = {};

    // Utility functions
    function showMessage(type, message) {
        const messageBox = elements.messageBox;
        if (!messageBox) return;
        
        messageBox.textContent = message;
        messageBox.className = `message ${type}`;
        messageBox.style.display = 'block';
        
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }

    function setConnectionStatus(connected) {
        state.connected = connected;
        const statusEl = elements.connectionStatus;
        const textEl = elements.connectionText;
        
        if (statusEl && textEl) {
            statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
            textEl.textContent = connected ? 'Connected' : 'Disconnected';
        }
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

    // API functions
    async function xanoRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${CONFIG.XANO_PROXY_BASE}${endpoint}`, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            setConnectionStatus(true);
            return data;
            
        } catch (error) {
            console.error('Xano request error:', error);
            setConnectionStatus(false);
            showMessage('error', `Connection error: ${error.message}`);
            return null;
        }
    }

    // Media functions
    async function loadMedia(query = '') {
        return await loadAllMedia(query);
    }

    async function loadAllMedia(query = '', type = '') {
        try {
            const xanoMedia = await loadXanoMedia(query);
            const cloudinaryAssets = await loadCloudinaryAssets(query, type);
            
            const allMedia = [...xanoMedia, ...cloudinaryAssets];
            state.mediaList = allMedia;
            
            renderMediaBrowser();
            setConnectionStatus(true);
            
            return allMedia;
        } catch (error) {
            console.error('Error loading all media:', error);
            showMessage('error', 'Error loading media: ' + error.message);
            setConnectionStatus(false);
            return [];
        }
    }

    async function loadXanoMedia(query = '') {
        try {
            let endpoint = CONFIG.LIST_MEDIA_ENDPOINT;
            if (query) {
                endpoint = `${CONFIG.SEARCH_MEDIA_ENDPOINT}?q=${encodeURIComponent(query)}`;
            }
            
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            let data = await response.json();
            
            // Handle search results format
            let mediaList = [];
            if (data.results) {
                mediaList = data.results;
            } else {
                mediaList = Array.isArray(data) ? data : [];
            }
            
            // Filter out test/invalid data and add source
            return mediaList.filter(item => {
                return item.file_size && item.file_size > 100 && 
                       (item.cloudinary_url || item.file_url || item.database_url || item.media_url || item.attachment);
            }).map(item => ({
                ...item,
                source: 'xano',
                file_type: item.file_type || getMediaTypeFromUrl(item.media_url || item.attachment)
            }));
            
        } catch (error) {
            console.error('Load Xano media error:', error);
            return [];
        }
    }

    function getMediaTypeFromUrl(url) {
        if (!url) return 'unknown';
        const ext = url.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
        if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video';
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
        return 'raw';
    }

    async function loadCloudinaryAssets(query = '', type = '') {
        try {
            let endpoint = '/.netlify/functions/LIst-assets';
            const params = new URLSearchParams();
            if (query) params.append('expression', `filename:*${query}*`);
            if (type) params.append('type', type);
            params.append('max', '50');
            
            if (params.toString()) {
                endpoint += '?' + params.toString();
            }
            
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            return (data.resources || []).map(asset => ({
                id: asset.public_id,
                title: asset.display_name || asset.filename || asset.public_id,
                media_url: asset.secure_url,
                attachment: asset.secure_url,
                source: 'cloudinary',
                file_type: asset.resource_type,
                file_size: asset.bytes,
                cloudinary_data: asset
            }));
            
        } catch (error) {
            console.error('Load Cloudinary assets error:', error);
            return [];
        }
    }


    function selectCloudinaryAsset(publicId) {
        const asset = state.cloudinaryAssets.find(a => a.public_id === publicId);
        if (!asset) return;

        state.selectedMedia = {
            id: asset.public_id,
            title: asset.title || asset.public_id,
            description: asset.description || '',
            station: asset.station || 'Cloudinary',
            tags: Array.isArray(asset.tags) ? asset.tags.join(', ') : (asset.tags || ''),
            submitted_by: 'Cloudinary Import',
            file_type: asset.resource_type,
            file_size: asset.bytes,
            cloudinary_url: asset.secure_url,
            media_url: asset.secure_url,
            attachment: asset.secure_url
        };

        document.querySelectorAll('.media-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-cloudinary-id="${publicId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        if (elements.titleInput) elements.titleInput.value = state.selectedMedia.title || '';
        if (elements.descriptionInput) elements.descriptionInput.value = state.selectedMedia.description || '';
        if (elements.stationInput) elements.stationInput.value = state.selectedMedia.station || '';
        if (elements.tagsInput) elements.tagsInput.value = state.selectedMedia.tags || '';
        if (elements.submittedByInput) elements.submittedByInput.value = state.selectedMedia.submitted_by || '';
        
        showMediaPreview(state.selectedMedia);
    }

    function renderMediaBrowser() {
        const browser = elements.mediaBrowser;
        if (!browser) return;
        
        if (!state.mediaList || state.mediaList.length === 0) {
            browser.innerHTML = '<div class="empty-state">No media found</div>';
            return;
        }

        browser.innerHTML = state.mediaList.map(item => {
            const thumbnail = getMediaThumbnail(item);
            const title = item.title || item.filename || item.display_name || 'Untitled';
            const itemId = item.source === 'cloudinary' ? item.id : item.id;
            const clickHandler = item.source === 'cloudinary' ? 
                `selectCloudinaryAsset('${item.id}')` : 
                `selectMedia(${item.id})`;
            
            return `
                <div class="media-item" data-id="${itemId}" data-source="${item.source}" onclick="${clickHandler}">
                    <div class="media-thumbnail" style="width: 60px; height: 60px; margin-right: 12px; border-radius: 4px; overflow: hidden; background: #333; display: flex; align-items: center; justify-content: center;">
                        ${thumbnail}
                    </div>
                    <div class="media-info" style="flex: 1;">
                        <div class="media-title" style="font-weight: 500; margin-bottom: 4px;">${title}</div>
                        <div class="media-meta" style="font-size: 12px; color: #888;">
                            ${getMediaMetadata(item)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        browser.querySelectorAll('.media-item').forEach(item => {
            if (!item.onclick) {
                const itemId = item.dataset.id;
                const source = item.dataset.source;
                if (source === 'cloudinary') {
                    item.addEventListener('click', () => selectCloudinaryAsset(itemId));
                } else {
                    item.addEventListener('click', () => selectMedia(parseInt(itemId)));
                }
            }
        });
    }

    function getMediaMetadata(item) {
        const parts = [];
        
        if (item.source === 'cloudinary') {
            parts.push('Cloudinary');
            if (item.file_type) parts.push(item.file_type);
            if (item.file_size) parts.push(formatFileSize(item.file_size));
        } else {
            if (item.station) parts.push(item.station);
            if (item.submitted_by) parts.push(`by ${item.submitted_by}`);
            if (item.file_type) parts.push(item.file_type);
            if (item.file_size) parts.push(formatFileSize(item.file_size));
        }
        
        return parts.join(' • ') || 'Media';
    }

    function getMediaIcon(fileType) {
        const type = (fileType || '').toLowerCase();
        if (type.includes('audio')) return '🎵';
        if (type.includes('video')) return '🎬';
        if (type.includes('image')) return '🖼️';
        if (type.includes('photo')) return '📷';
        if (type.includes('document')) return '📄';
        return '📁';
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    function getCloudinaryThumbnail(item) {
        if (item.resource_type === 'image') {
            return `<img src="${item.secure_url.replace('/upload/', '/upload/w_60,h_60,c_fill/')}" alt="${item.display_name || item.public_id}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (item.resource_type === 'video') {
            return `<img src="${item.secure_url.replace('/upload/', '/upload/w_60,h_60,c_fill/').replace(/\.[^.]+$/, '.jpg')}" alt="${item.display_name || item.public_id}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (item.resource_type === 'raw') {
            return '<div style="font-size: 24px; color: #888;">📄</div>';
        } else {
            return '<div style="font-size: 24px; color: #888;">🎵</div>';
        }
    }

    function getMediaThumbnail(item) {
        const mediaUrl = item.cloudinary_url || item.media_url || item.attachment;
        
        if (item.file_type === 'image' && mediaUrl) {
            if (mediaUrl.includes('cloudinary.com')) {
                return `<img src="${mediaUrl.replace('/upload/', '/upload/w_60,h_60,c_fill/')}" alt="${item.title || 'Image'}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                return `<img src="${mediaUrl}" alt="${item.title || 'Image'}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
        } else if (item.file_type === 'video' && mediaUrl) {
            if (mediaUrl.includes('cloudinary.com')) {
                return `<img src="${mediaUrl.replace('/upload/', '/upload/w_60,h_60,c_fill/').replace(/\.[^.]+$/, '.jpg')}" alt="${item.title || 'Video'}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                return '<div style="font-size: 24px; color: #888;">🎬</div>';
            }
        } else if (item.file_type === 'audio') {
            return '<div style="font-size: 24px; color: #888;">🎵</div>';
        } else {
            return '<div style="font-size: 24px; color: #888;">📄</div>';
        }
    }

    function showMediaPreview(media) {
        if (!media) return;
        
        const previewSection = document.getElementById('previewSection');
        const previewContent = document.getElementById('previewContent');
        
        if (!previewSection || !previewContent) return;
        
        previewSection.style.display = 'block';
        
        const mediaUrl = media.cloudinary_url || media.media_url || media.attachment;
        const title = media.title || media.filename || 'Untitled';
        
        if (!mediaUrl) {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                    <div style="color: #888;">No media URL available</div>
                </div>
            `;
            return;
        }
        
        previewContent.innerHTML = '';
        
        let mediaElement;
        
        if (media.file_type === 'audio') {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
            mediaElement.src = mediaUrl;
            mediaElement.style.width = '100%';
            
            const overlay = document.createElement('div');
            overlay.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.7); border-radius: 4px; color: white;';
            overlay.textContent = `🎵 ${title}`;
            previewContent.appendChild(overlay);
            
        } else if (media.file_type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.src = mediaUrl;
            mediaElement.style.width = '100%';
            mediaElement.style.maxHeight = '300px';
            
            const overlay = document.createElement('div');
            overlay.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.7); border-radius: 4px; color: white;';
            overlay.textContent = `🎬 ${title}`;
            previewContent.appendChild(overlay);
            
        } else if (media.file_type === 'image') {
            mediaElement = document.createElement('img');
            mediaElement.src = mediaUrl;
            mediaElement.alt = title;
            mediaElement.style.maxWidth = '100%';
            mediaElement.style.maxHeight = '300px';
            mediaElement.style.objectFit = 'contain';
            
            const overlay = document.createElement('div');
            overlay.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.7); border-radius: 4px; color: white;';
            overlay.textContent = `🖼️ ${title}`;
            previewContent.appendChild(overlay);
            
        } else {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
                    <div style="color: #888;">${title}</div>
                    <button onclick="window.open('${mediaUrl}', '_blank')" style="margin-top: 12px; padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        📥 Open File
                    </button>
                </div>
            `;
            return;
        }
        
        if (mediaElement) {
            mediaElement.onerror = function() {
                previewContent.innerHTML = `
                    <div class="preview-placeholder">
                        <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                        <div style="color: #888;">Error loading media</div>
                        <button onclick="window.open('${mediaUrl}', '_blank')" style="margin-top: 12px; padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📥 Open Instead
                        </button>
                    </div>
                `;
            };
            
            previewContent.appendChild(mediaElement);
        }
    }

    function selectMedia(id) {
        state.selectedMedia = state.mediaList.find(m => m.id === id);
        if (!state.selectedMedia) return;

        // Update UI selection
        document.querySelectorAll('.media-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-id="${id}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Populate form
        if (elements.titleInput) elements.titleInput.value = state.selectedMedia.title || '';
        if (elements.descriptionInput) elements.descriptionInput.value = state.selectedMedia.description || '';
        if (elements.stationInput) elements.stationInput.value = state.selectedMedia.station || '';
        if (elements.tagsInput) elements.tagsInput.value = state.selectedMedia.tags || '';
        if (elements.submittedByInput) elements.submittedByInput.value = state.selectedMedia.submitted_by || '';
        
        showMediaPreview(state.selectedMedia);
    }

    // Assignment functions
    async function loadAssignments() {
        try {
            const data = await xanoRequest('/voxpro_assignments');
            state.assignments = Array.isArray(data) ? data : [];
            renderAssignments();
            updateKeyButtons();
        } catch (error) {
            console.error('Load assignments error:', error);
        }
    }

    function renderAssignments() {
        const container = elements.assignmentsList;
        if (!container) return;
        
        if (!state.assignments || state.assignments.length === 0) {
            container.innerHTML = '<div class="empty-state">No assignments yet</div>';
            return;
        }

        container.innerHTML = state.assignments.map(assignment => `
            <div class="assignment-item">
                <span class="assignment-key">
                    Key ${assignment.key_number} — ${assignment.title || assignment.asset?.title || 'Unknown'}
                </span>
                <button class="remove-button" data-id="${assignment.id}">×</button>
            </div>
        `).join('');
        
        // Add delete handlers
        container.querySelectorAll('.remove-button').forEach(btn => {
            btn.addEventListener('click', () => deleteAssignment(parseInt(btn.dataset.id)));
        });
    }

    function updateKeyButtons() {
        document.querySelectorAll('.key-button').forEach(button => {
            const keyNum = parseInt(button.dataset.key);
            const assignment = state.assignments.find(a => parseInt(a.key_number) === keyNum);
            
            if (assignment) {
                button.classList.add('assigned');
                const title = assignment.title || assignment.asset?.title || 'Assigned';
                button.innerHTML = `KEY ${keyNum}<br><small style="font-size: 0.8em; opacity: 0.8;">${title}</small>`;
            } else {
                button.classList.remove('assigned');
                button.innerHTML = `KEY ${keyNum}`;
            }
        });
    }

    async function createAssignment() {
        if (!state.selectedMedia) {
            showMessage('error', 'Please select a media item first');
            return;
        }
        
        const keySlot = elements.keySelect?.value;
        if (!keySlot) {
            showMessage('error', 'Please select a key slot');
            return;
        }
        
        try {
            // Check if assignment exists for this key
            const existingAssignment = state.assignments.find(a => 
                parseInt(a.key_number) === parseInt(keySlot)
            );
            
            const assignmentData = {
                asset_id: state.selectedMedia.id,
                key_number: parseInt(keySlot),
                title: elements.titleInput?.value || state.selectedMedia.title,
                description: elements.descriptionInput?.value || state.selectedMedia.description,
                station: elements.stationInput?.value || state.selectedMedia.station,
                tags: elements.tagsInput?.value || state.selectedMedia.tags,
                submitted_by: elements.submittedByInput?.value || state.selectedMedia.submitted_by,
                file_type: state.selectedMedia.file_type,
                cloudinary_url: state.selectedMedia.cloudinary_url || state.selectedMedia.file_url || state.selectedMedia.database_url
            };
            
            if (existingAssignment) {
                // Update existing assignment
                await xanoRequest(`/voxpro_assignments/${existingAssignment.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(assignmentData)
                });
                showMessage('success', `Key ${keySlot} updated successfully!`);
            } else {
                // Create new assignment
                await xanoRequest('/voxpro_assignments', {
                    method: 'POST',
                    body: JSON.stringify(assignmentData)
                });
                showMessage('success', `Media assigned to Key ${keySlot}!`);
            }
            
            await loadAssignments();
            
            // Clear selection
            if (elements.keySelect) elements.keySelect.value = '';
            
        } catch (error) {
            console.error('Assignment error:', error);
            showMessage('error', `Assignment failed: ${error.message}`);
        }
    }

    async function deleteAssignment(assignmentId) {
        if (!confirm('Remove this key assignment?')) return;
        
        try {
            await xanoRequest(`/voxpro_assignments/${assignmentId}`, { 
                method: 'DELETE' 
            });
            showMessage('success', 'Assignment removed');
            await loadAssignments();
        } catch (error) {
            console.error('Delete error:', error);
            showMessage('error', 'Failed to remove assignment');
        }
    }

    // Media playback
    async function playForKey(keyNum) {
        const assignment = state.assignments.find(a => 
            parseInt(a.key_number) === parseInt(keyNum)
        );
        
        if (!assignment) {
            showMessage('error', `No media assigned to Key ${keyNum}`);
            return;
        }
        
        const mediaUrl = assignment.cloudinary_url || 
                        assignment.asset?.cloudinary_url || 
                        assignment.asset?.file_url || 
                        assignment.asset?.database_url;
        
        if (!mediaUrl) {
            showMessage('error', 'No media URL found');
            return;
        }
        
        // Visual feedback
        document.querySelectorAll('.key-button').forEach(btn => 
            btn.classList.remove('playing')
        );
        document.getElementById(`key${keyNum}`)?.classList.add('playing');
        
        // Create and play media
        const fileType = (assignment.file_type || assignment.asset?.file_type || '').toLowerCase();
        
        if (fileType.includes('audio')) {
            playAudio(mediaUrl, keyNum);
        } else if (fileType.includes('video')) {
            playVideo(mediaUrl, keyNum);
        } else {
            window.open(mediaUrl, '_blank');
        }
        
        state.playing = { key: keyNum, assignmentId: assignment.id };
        showMessage('success', `Playing: ${assignment.title || 'Media'}`);
    }

    function playAudio(url, keyNum) {
        stopPlayback();
        const audio = new Audio(url);
        audio.play();
        state.currentAudio = audio;
        
        audio.addEventListener('ended', () => {
            document.getElementById(`key${keyNum}`)?.classList.remove('playing');
            state.playing = null;
        });
    }

    function playVideo(url, keyNum) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9); display: flex; 
            align-items: center; justify-content: center; z-index: 9999;
        `;
        
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.autoplay = true;
        video.style.maxWidth = '90%';
        video.style.maxHeight = '90%';
        
        modal.appendChild(video);
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.getElementById(`key${keyNum}`)?.classList.remove('playing');
            }
        });
        
        state.currentModal = modal;
    }

    function stopPlayback() {
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }
        
        if (state.currentModal) {
            state.currentModal.remove();
            state.currentModal = null;
        }
        
        document.querySelectorAll('.key-button').forEach(btn => 
            btn.classList.remove('playing')
        );
        
        state.playing = null;
    }

    // Initialization
    function initializeElements() {
        elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            connectionText: document.getElementById('connectionText'),
            messageBox: document.getElementById('messageBox'),
            searchInput: document.getElementById('searchInput'),
            mediaTypeFilter: document.getElementById('mediaTypeFilter'),
            mediaBrowser: document.getElementById('mediaBrowser'),
            previewSection: document.getElementById('previewSection'),
            previewContent: document.getElementById('previewContent'),
            keySelect: document.getElementById('keySelect'),
            titleInput: document.getElementById('titleInput'),
            descriptionInput: document.getElementById('descriptionInput'),
            stationInput: document.getElementById('stationInput'),
            tagsInput: document.getElementById('tagsInput'),
            submittedByInput: document.getElementById('submittedByInput'),
            assignButton: document.getElementById('assignButton'),
            assignmentsList: document.getElementById('assignmentsList'),
            stopButton: document.getElementById('stopButton')
        };
    }

    function attachEventListeners() {
        // Unified search with debounce
        if (elements.searchInput) {
            const debouncedSearch = debounce(e => {
                const query = e.target.value.trim();
                const type = elements.mediaTypeFilter?.value || '';
                loadAllMedia(query, type);
            }, CONFIG.DEBOUNCE_MS);
            elements.searchInput.addEventListener('input', debouncedSearch);
        }
        
        if (elements.mediaTypeFilter) {
            elements.mediaTypeFilter.addEventListener('change', e => {
                const query = elements.searchInput?.value.trim() || '';
                const type = e.target.value;
                loadAllMedia(query, type);
            });
        }
        
        // Key buttons
        document.querySelectorAll('.key-button').forEach(btn => {
            btn.addEventListener('click', () => playForKey(btn.dataset.key));
        });
        
        // Stop button
        if (elements.stopButton) {
            elements.stopButton.addEventListener('click', stopPlayback);
        }
        
        // Assign button
        if (elements.assignButton) {
            elements.assignButton.addEventListener('click', createAssignment);
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Number keys 1-5 for playing
            if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey) {
                const activeElement = document.activeElement;
                const isInputField = activeElement.tagName === 'INPUT' || 
                                    activeElement.tagName === 'TEXTAREA';
                if (!isInputField) {
                    playForKey(e.key);
                }
            }
            
            // Spacebar or ESC to stop
            if (e.key === 'Escape' || (e.key === ' ' && document.activeElement.tagName !== 'INPUT')) {
                e.preventDefault();
                stopPlayback();
            }
        });
    }

    async function initialize() {
        console.log('VoxPro Manager initializing...');
        
        initializeElements();
        setConnectionStatus(false);
        attachEventListeners();
        
        // Load initial data
        await loadAllMedia();
        await loadAssignments();
        
        // Set up periodic refresh
        setInterval(loadAssignments, CONFIG.ASSIGNMENTS_REFRESH_MS);
        
        console.log('VoxPro Manager initialized');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Global functions for preview controls
    window.playSelectedMedia = function() {
        const previewContent = document.getElementById('previewContent');
        if (!previewContent) return;
        
        const media = previewContent.querySelector('audio, video');
        if (media) {
            media.play().catch(error => {
                console.log('Autoplay blocked:', error);
                showMessage('info', 'Click the media player to start playback');
            });
        }
    };

    window.stopPreview = function() {
        const previewContent = document.getElementById('previewContent');
        if (!previewContent) return;
        
        const media = previewContent.querySelector('audio, video');
        if (media) {
            media.pause();
            media.currentTime = 0;
        }
    };

    window.openFullPreview = function() {
        if (state.selectedMedia) {
            const mediaUrl = state.selectedMedia.cloudinary_url || state.selectedMedia.media_url || state.selectedMedia.attachment;
            if (mediaUrl) {
                window.open(mediaUrl, '_blank');
            } else {
                showMessage('error', 'No media URL available');
            }
        }
    };

    // Export for debugging
    window.voxProManager = {
        state,
        loadMedia,
        loadAssignments,
        stopPlayback,
        playForKey
    };
})();
