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
        assignments: [],
        playing: null,
        connected: false,
        currentPreviewMedia: null
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
        try {
            console.log('Loading media...');
            setConnectionStatus(false);
            
            let url = CONFIG.LIST_MEDIA_ENDPOINT;
            if (query) {
                url = `${CONFIG.SEARCH_MEDIA_ENDPOINT}?q=${encodeURIComponent(query)}`;
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Media loaded:', data);
            
            if (data.results) {
                state.mediaList = data.results;
            } else if (Array.isArray(data)) {
                state.mediaList = data;
            } else {
                state.mediaList = [];
            }

            // Filter out invalid entries
            state.mediaList = state.mediaList.filter(item => {
                const hasUrl = item.cloudinary_url || item.file_url || item.database_url || item.media_url;
                const hasSize = item.file_size && item.file_size > 100;
                
                return hasUrl && hasSize;
            });

            console.log('Media loaded:', state.mediaList.length, 'items');
            renderMediaBrowser();
            setConnectionStatus(true);
            
        } catch (error) {
            console.error('Load media error:', error);
            showMessage('error', 'Failed to load media: ' + error.message);
            setConnectionStatus(false);
        }
    }

    function renderMediaBrowser() {
        const browser = elements.mediaBrowser;
        if (!browser) return;
        
        if (!state.mediaList || state.mediaList.length === 0) {
            browser.innerHTML = '<div class="empty-state">No media found</div>';
            return;
        }

        browser.innerHTML = state.mediaList.map(item => {
            const icon = getMediaIcon(item.file_type || item.category || '');
            return `
                <div class="media-item" data-id="${item.id}">
                    <div class="media-icon">${icon}</div>
                    <div class="media-info">
                        <div class="media-title">${item.title || 'Untitled'}</div>
                        <div class="media-meta">
                            ${item.station || 'Unknown'} • ${item.category || 'Media'}
                            ${item.file_size ? ` • ${formatFileSize(item.file_size)}` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        browser.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => selectMedia(parseInt(item.dataset.id)));
        });
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

        showMediaPreview(state.selectedMedia);

        // Populate form
        if (elements.titleInput) elements.titleInput.value = state.selectedMedia.title || '';
        if (elements.descriptionInput) elements.descriptionInput.value = state.selectedMedia.description || '';
        if (elements.stationInput) elements.stationInput.value = state.selectedMedia.station || '';
        if (elements.tagsInput) elements.tagsInput.value = state.selectedMedia.tags || '';
        if (elements.submittedByInput) elements.submittedByInput.value = state.selectedMedia.submitted_by || '';
    }

    // Assignment functions
    async function loadAssignments() {
        try {
            console.log('Loading assignments...');
            
            const response = await fetch(`${CONFIG.XANO_PROXY_BASE}/voxpro_assignments`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            state.assignments = Array.isArray(data) ? data : [];
            
            console.log('Assignments loaded:', state.assignments);
            renderAssignments();
            updateKeyButtons();
            
        } catch (error) {
            console.error('Load assignments error:', error);
            state.assignments = [];
            renderAssignments();
        }
    }

    function renderAssignments() {
        const container = elements.assignmentsList;
        if (!container) return;
        
        if (!state.assignments || state.assignments.length === 0) {
            container.innerHTML = '<div class="empty-state">No assignments yet</div>';
            return;
        }

        const enrichedAssignments = state.assignments.map(assignment => {
            const mediaItem = state.mediaList.find(media => media.id === assignment.asset_id);
            return {
                ...assignment,
                title: assignment.title || mediaItem?.title || 'Unknown',
                description: assignment.description || mediaItem?.description || '',
                cloudinary_url: assignment.cloudinary_url || mediaItem?.cloudinary_url || mediaItem?.file_url || mediaItem?.database_url || mediaItem?.media_url,
                file_type: assignment.file_type || mediaItem?.file_type
            };
        });

        container.innerHTML = enrichedAssignments.map(assignment => `
            <div class="assignment-item">
                <span class="assignment-key">
                    Key ${assignment.key_number} — ${assignment.title}
                </span>
                <button class="remove-button" data-id="${assignment.id}">×</button>
            </div>
        `).join('');
        
        // Update state with enriched assignments for playback
        state.assignments = enrichedAssignments;
        
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

    function showMediaPreview(mediaItem) {
        if (!mediaItem) return;
        
        const previewContent = elements.previewContent;
        if (!previewContent) return;
        
        const mediaUrl = mediaItem.cloudinary_url || mediaItem.file_url || mediaItem.database_url || mediaItem.media_url;
        
        if (!mediaUrl) {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <div class="placeholder-icon">❌</div>
                    <div class="placeholder-text">No media URL available</div>
                </div>
            `;
            return;
        }
        
        previewContent.innerHTML = '';
        
        // Create container for media and description
        const mediaContainer = document.createElement('div');
        mediaContainer.style.cssText = 'position: relative; width: 100%; height: 100%;';
        
        let mediaElement;
        const fileType = (mediaItem.file_type || '').toLowerCase();
        
        if (fileType === 'audio' || fileType.includes('audio')) {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
            mediaElement.src = mediaUrl;
            mediaElement.style.width = '100%';
            
        } else if (fileType === 'video' || fileType.includes('video')) {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.src = mediaUrl;
            mediaElement.style.width = '100%';
            mediaElement.style.maxHeight = '300px';
            
        } else if (fileType === 'image' || fileType.includes('image')) {
            mediaElement = document.createElement('img');
            mediaElement.src = mediaUrl;
            mediaElement.alt = mediaItem.title || 'Image';
            mediaElement.style.maxWidth = '100%';
            mediaElement.style.maxHeight = '300px';
            mediaElement.style.objectFit = 'contain';
            
        } else if (mediaUrl.toLowerCase().includes('.pdf')) {
            // Create container for PDF rendering
            mediaElement = document.createElement('div');
            mediaElement.style.cssText = `
                width: 100%; height: 500px; border: none; border-radius: 4px;
                display: flex; align-items: center; justify-content: center;
                background: var(--bg-tertiary);
            `;
            mediaElement.innerHTML = '<div style="color: var(--text-secondary);">Loading PDF...</div>';
            
            renderPDF(mediaUrl, mediaElement, mediaItem);
            
        } else if (mediaUrl.toLowerCase().match(/\.(doc|docx|txt|rtf)$/)) {
            // Create container for DOCX rendering
            mediaElement = document.createElement('div');
            mediaElement.style.cssText = `
                width: 100%; height: 500px; border: 1px solid var(--bg-tertiary); 
                border-radius: 4px; padding: 20px; overflow-y: auto;
                background: white; color: black;
            `;
            mediaElement.innerHTML = '<div style="text-align: center; color: #666;">Loading document...</div>';
            
            renderDOCX(mediaUrl, mediaElement, mediaItem);
            
        } else {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <div class="placeholder-icon">📄</div>
                    <div class="placeholder-text">${mediaItem.title || 'File'}</div>
                    <button onclick="window.open('${mediaUrl}', '_blank')" style="margin-top: 12px; padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        📥 Download File
                    </button>
                </div>
            `;
            return;
        }
        
        if (mediaElement) {
            mediaElement.onerror = function() {
                previewContent.innerHTML = `
                    <div class="preview-placeholder">
                        <div class="placeholder-icon">⚠️</div>
                        <div class="placeholder-text">Error loading media</div>
                        <button onclick="window.open('${mediaUrl}', '_blank')" style="margin-top: 12px; padding: 8px 16px; background: var(--error); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📥 Download Instead
                        </button>
                    </div>
                `;
            };
            
            mediaContainer.appendChild(mediaElement);
            
            const description = mediaItem.description || mediaItem.asset?.description;
            if (description && description.trim()) {
                const descriptionOverlay = document.createElement('div');
                descriptionOverlay.style.cssText = `
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0,0,0,0.8));
                    color: white;
                    padding: 20px 16px 12px;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    border-radius: 0 0 8px 8px;
                    pointer-events: none;
                `;
                descriptionOverlay.textContent = description;
                mediaContainer.appendChild(descriptionOverlay);
            }
            
            previewContent.appendChild(mediaContainer);
        }
        
        state.currentPreviewMedia = mediaItem;
    }

    async function renderPDF(url, container, mediaItem) {
        try {
            // Configure PDF.js worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            }
            
            const proxyUrl = `/.netlify/functions/fetch-media?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type') || '';
            console.log('Received content type:', contentType);
            
            // Check if we received image data (from Cloudinary f_auto transformation)
            if (contentType.startsWith('image/')) {
                console.log('Received image data, displaying as image instead of PDF');
                
                container.innerHTML = '';
                container.style.cssText = `
                    width: 100%; height: 500px; border: none; border-radius: 4px;
                    overflow: auto; background: #f5f5f5; padding: 10px; display: flex;
                    flex-direction: column; align-items: center;
                `;
                
                const img = document.createElement('img');
                img.style.cssText = 'max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
                img.src = proxyUrl;
                img.alt = 'Document preview';
                
                container.appendChild(img);
                
                const info = document.createElement('div');
                info.style.cssText = 'text-align: center; margin-top: 10px; color: var(--text-secondary); font-size: 0.9rem;';
                info.textContent = `${mediaItem.title || 'PDF Document'} - Converted to image for preview`;
                container.appendChild(info);
                
                console.log('Document displayed as image successfully');
                return;
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            container.innerHTML = '';
            container.style.cssText = `
                width: 100%; height: 500px; border: none; border-radius: 4px;
                overflow-y: auto; background: #f5f5f5; padding: 10px;
            `;
            
            const page = await pdf.getPage(1);
            const scale = 1.2;
            const viewport = page.getViewport({ scale: scale });
            
            // Create canvas for PDF rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.cssText = 'max-width: 100%; height: auto; display: block; margin: 0 auto;';
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            container.appendChild(canvas);
            
            const pageInfo = document.createElement('div');
            pageInfo.style.cssText = 'text-align: center; margin-top: 10px; color: var(--text-secondary); font-size: 0.9rem;';
            pageInfo.textContent = `${mediaItem.title || 'PDF Document'} - Page 1 of ${pdf.numPages}`;
            container.appendChild(pageInfo);
            
        } catch (error) {
            console.error('PDF rendering error:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📄</div>
                    <div style="font-size: 1.1rem; margin-bottom: 12px; color: var(--text-primary);">${mediaItem.title || 'PDF Document'}</div>
                    <div style="color: var(--text-secondary); margin-bottom: 16px;">Unable to display PDF</div>
                    <button onclick="window.open('${url}', '_blank')" style="padding: 12px 20px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">
                        📥 Open PDF in New Tab
                    </button>
                </div>
            `;
        }
    }

    async function renderDOCX(url, container, mediaItem) {
        try {
            const proxyUrl = `/.netlify/functions/fetch-media?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            
            container.innerHTML = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">
                    <h3 style="margin-top: 0; color: var(--text-primary); border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        ${mediaItem.title || 'Document'}
                    </h3>
                    <div style="margin-top: 20px;">
                        ${result.value}
                    </div>
                </div>
            `;
            
            if (result.messages && result.messages.length > 0) {
                console.log('Mammoth conversion messages:', result.messages);
            }
            
        } catch (error) {
            console.error('DOCX rendering error:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📄</div>
                    <div style="font-size: 1.1rem; margin-bottom: 12px; color: var(--text-primary);">${mediaItem.title || 'Document'}</div>
                    <div style="color: var(--text-secondary); margin-bottom: 16px;">Unable to display document</div>
                    <button onclick="window.open('${url}', '_blank')" style="padding: 12px 20px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">
                        📥 Open Document in New Tab
                    </button>
                </div>
            `;
        }
    }

    function setupUploadHandlers() {
        const uploadArea = elements.uploadArea;
        const fileInput = elements.fileInput;
        
        if (!uploadArea || !fileInput) return;
        
        fileInput.addEventListener('change', handleFileSelect);
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
    }
    
    function handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            uploadFiles(files);
        }
    }
    
    function handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }
    
    function handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }
    
    function handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) {
            uploadFiles(files);
        }
    }
    
    async function uploadFiles(files) {
        const progressContainer = elements.progressContainer;
        const progressFill = elements.progressFill;
        const progressText = elements.progressText;
        
        if (!progressContainer || !progressFill || !progressText) return;
        
        progressContainer.style.display = 'block';
        let successCount = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const percent = Math.round(((i + 1) / files.length) * 100);
            progressFill.style.width = percent + '%';
            progressText.textContent = `Uploading ${file.name} (${i + 1}/${files.length})...`;
            
            try {
                await uploadSingleFile(file);
                successCount++;
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
                showMessage('error', `Failed to upload ${file.name}: ${error.message}`);
            }
        }
        
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';
        
        await loadMedia();
        
        showMessage('success', `Upload completed: ${successCount} of ${files.length} file${files.length !== 1 ? 's' : ''} uploaded`);
    }
    
    async function uploadSingleFile(file) {
        const formData = new FormData();
        formData.append('attachment', file);
        formData.append('title', file.name);
        formData.append('category', 'Media');
        formData.append('submitted_by', 'VoxPro Manager');
        
        const response = await fetch('/.netlify/functions/file-manager-upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Upload failed');
        }
        
        return await response.json();
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
        
        showMediaPreview(assignment);
        
        const previewContent = elements.previewContent;
        if (previewContent) {
            const audioElement = previewContent.querySelector('audio');
            const videoElement = previewContent.querySelector('video');
            
            if (audioElement) {
                audioElement.play().catch(() => {
                });
            } else if (videoElement) {
                videoElement.play().catch(() => {
                });
            }
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
        
        const previewContent = elements.previewContent;
        if (previewContent) {
            const audioElement = previewContent.querySelector('audio');
            const videoElement = previewContent.querySelector('video');
            
            if (audioElement) {
                audioElement.pause();
                audioElement.currentTime = 0;
            }
            if (videoElement) {
                videoElement.pause();
                videoElement.currentTime = 0;
            }
        }
        
        document.querySelectorAll('.key-button').forEach(btn => 
            btn.classList.remove('playing')
        );
        
        state.playing = null;
        showMessage('info', 'Playback stopped');
    }

    // Initialization
    function initializeElements() {
        elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            connectionText: document.getElementById('connectionText'),
            messageBox: document.getElementById('messageBox'),
            searchInput: document.getElementById('searchInput'),
            mediaBrowser: document.getElementById('mediaBrowser'),
            keySelect: document.getElementById('keySelect'),
            titleInput: document.getElementById('titleInput'),
            descriptionInput: document.getElementById('descriptionInput'),
            stationInput: document.getElementById('stationInput'),
            tagsInput: document.getElementById('tagsInput'),
            submittedByInput: document.getElementById('submittedByInput'),
            assignButton: document.getElementById('assignButton'),
            assignmentsList: document.getElementById('assignmentsList'),
            stopButton: document.getElementById('stopButton'),
            previewContent: document.getElementById('previewContent'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            progressContainer: document.getElementById('progressContainer'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText')
        };
    }

    function attachEventListeners() {
        // Search with debounce
        if (elements.searchInput) {
            const debouncedSearch = debounce(e => loadMedia(e.target.value.trim()), CONFIG.DEBOUNCE_MS);
            elements.searchInput.addEventListener('input', debouncedSearch);
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
        
        if (elements.fullscreenBtn) {
            elements.fullscreenBtn.addEventListener('click', () => {
                if (state.currentPreviewMedia) {
                    const mediaUrl = state.currentPreviewMedia.cloudinary_url || 
                                   state.currentPreviewMedia.file_url || 
                                   state.currentPreviewMedia.database_url || 
                                   state.currentPreviewMedia.media_url;
                    if (mediaUrl) window.open(mediaUrl, '_blank');
                }
            });
        }
        
        if (elements.downloadBtn) {
            elements.downloadBtn.addEventListener('click', () => {
                if (state.currentPreviewMedia) {
                    const mediaUrl = state.currentPreviewMedia.cloudinary_url || 
                                   state.currentPreviewMedia.file_url || 
                                   state.currentPreviewMedia.database_url || 
                                   state.currentPreviewMedia.media_url;
                    if (mediaUrl) {
                        const link = document.createElement('a');
                        link.href = mediaUrl;
                        link.download = state.currentPreviewMedia.title || 'download';
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                }
            });
        }
        
        setupUploadHandlers();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const activeElement = document.activeElement;
            const isInputField = activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable ||
                activeElement.classList.contains('ql-editor')
            );
            
            // Number keys 1-5 for playing
            if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey) {
                if (!isInputField) {
                    e.preventDefault();
                    playForKey(e.key);
                }
            }
            
            // Spacebar or ESC to stop (only when not in input fields)
            if (e.key === 'Escape' || (e.key === ' ' && !isInputField)) {
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
        await loadMedia();
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
    
    // Export for debugging
    window.voxProManager = {
        state,
        loadMedia,
        loadAssignments,
        stopPlayback,
        playForKey
    };
})();
