const fs = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS, 'content-type': 'text/plain' },
      body: 'Method not allowed'
    };
  }

  try {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VoxPro Manager</title>
    <style>
        :root {
            --bg-primary: #0b1220;
            --bg-secondary: #0f172a;
            --bg-tertiary: #1f2937;
            --text-primary: #e5e7eb;
            --text-secondary: #9ca3af;
            --text-accent: #10b981;
            --accent: #667eea;
            --accent-secondary: #764ba2;
            --success: #10b981;
            --error: #ef4444;
            --warning: #f59e0b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 20px;
            min-height: 100vh;
        }

        .panel {
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 12px;
            padding: 20px;
            height: fit-content;
        }

        .panel-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--text-accent);
            text-align: center;
        }

        .form-section {
            margin-bottom: 25px;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--text-secondary);
        }

        .form-input, .form-select {
            width: 100%;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 1px solid #374151;
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 14px;
        }

        .form-input:focus, .form-select:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .search-input {
            width: 100%;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 1px solid #374151;
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 14px;
            margin-bottom: 15px;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .media-browser {
            background: var(--bg-tertiary);
            border-radius: 8px;
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
            margin-bottom: 20px;
        }

        .media-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 8px;
            background: var(--bg-secondary);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .media-item:hover {
            background: #374151;
            transform: translateY(-1px);
        }

        .media-item.selected {
            background: var(--accent);
            color: white;
        }

        .media-thumbnail {
            width: 40px;
            height: 40px;
            border-radius: 4px;
            margin-right: 12px;
            object-fit: cover;
            background: var(--bg-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }

        .media-info {
            flex: 1;
        }

        .media-title {
            font-weight: 500;
            margin-bottom: 2px;
        }

        .media-meta {
            font-size: 12px;
            color: var(--text-secondary);
        }

        .btn {
            background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            width: 100%;
            margin-bottom: 10px;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid #374151;
        }

        .btn-secondary:hover {
            background: #374151;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .status-connected {
            background: var(--success);
        }

        .status-disconnected {
            background: var(--error);
        }

        .connection-status {
            text-align: center;
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 6px;
            font-weight: 500;
        }

        .connection-status.connected {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .connection-status.disconnected {
            background: rgba(239, 68, 68, 0.1);
            color: var(--error);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .empty-state {
            text-align: center;
            color: var(--text-secondary);
            padding: 40px 20px;
        }

        .key-assignments {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }

        .key-slot {
            background: var(--bg-tertiary);
            border: 1px solid #374151;
            border-radius: 6px;
            padding: 8px;
            text-align: center;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .key-slot:hover {
            border-color: var(--accent);
        }

        .key-slot.assigned {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
        }

        .key-number {
            font-weight: bold;
            margin-bottom: 4px;
        }

        .key-title {
            font-size: 10px;
            opacity: 0.8;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .picker-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }

        .picker-controls input {
            flex: 1;
        }

        .picker-controls select {
            width: 150px;
        }

        .preview-section {
            margin: 25px 0;
            display: none;
        }

        .preview-container {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 15px;
            min-height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .preview-content {
            width: 100%;
            text-align: center;
        }

        .preview-placeholder {
            font-size: 48px;
            margin-bottom: 10px;
        }

        .preview-controls {
            margin-top: 10px;
            text-align: center;
        }

        .preview-button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            margin: 0 5px;
            cursor: pointer;
        }

        .preview-button:hover {
            opacity: 0.8;
        }

        #stopButton {
            background: #f44336;
        }

        #fullscreenButton {
            background: #2196F3;
        }

        @media (max-width: 768px) {
            .container {
                grid-template-columns: 1fr;
                padding: 10px;
            }
            
            .key-assignments {
                grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- VoxPro Player Panel -->
        <div class="panel">
            <h2 class="panel-title">VoxPro Media Player</h2>
            
            <div class="connection-status" id="connectionStatus">
                <span class="status-indicator status-disconnected"></span>
                Checking connection...
            </div>
            
            <div class="key-assignments" id="keyAssignments">
                <!-- Key slots will be populated by JavaScript -->
            </div>
            
            <div class="form-section">
                <button class="btn" onclick="playAllAssigned()">▶️ Play All Assigned</button>
                <button class="btn btn-secondary" onclick="stopAll()">⏹️ Stop All</button>
            </div>
        </div>

        <!-- VoxPro Manager Panel -->
        <div class="panel">
            <h2 class="panel-title">
                <a href="/hoibf-file-manager.html" style="color: var(--text-accent); text-decoration: none;">
                    📁 VoxPro Manager
                </a>
            </h2>

            <div class="search-section">
                <label class="form-label">Search Media (title, description, station, tags)</label>
                <div class="picker-controls" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" class="search-input" id="searchInput" placeholder="Search all media (Cloudinary + Xano)..." style="flex: 1;">
                    <select class="form-select" id="mediaTypeFilter" style="width: 150px;">
                        <option value="">All Types</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                        <option value="audio">Audio</option>
                        <option value="raw">Documents</option>
                    </select>
                </div>
            </div>

            <div class="media-browser" id="mediaBrowser">
                <div class="empty-state">Loading media...</div>
            </div>

            <div class="preview-section" id="previewSection" style="margin: 25px 0; display: none;">
                <label class="form-label">Media Preview</label>
                <div class="preview-container" id="previewContainer" style="background: #2a2a2a; border-radius: 8px; padding: 15px; min-height: 200px; display: flex; align-items: center; justify-content: center;">
                    <div id="previewContent" style="width: 100%; text-align: center;">
                        <div class="preview-placeholder">
                            <div style="font-size: 48px; margin-bottom: 10px;">🎵</div>
                            <div style="color: #888;">Select media to preview</div>
                        </div>
                    </div>
                </div>
                <div class="preview-controls" style="margin-top: 10px; text-align: center;">
                    <button class="preview-button" id="playButton" onclick="playSelectedMedia()" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 0 5px; cursor: pointer;">▶️ Play</button>
                    <button class="preview-button" id="stopButton" onclick="stopPreview()" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 0 5px; cursor: pointer;">⏹️ Stop</button>
                    <button class="preview-button" id="fullscreenButton" onclick="openFullPreview()" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin: 0 5px; cursor: pointer;">🔍 Fullscreen</button>
                </div>
            </div>

            <div class="form-section">
                <label class="form-label">Assign to Key</label>
                <select class="form-select" id="keySelect">
                    <option value="">Select key slot...</option>
                </select>
            </div>

            <div class="form-section">
                <label class="form-label">Title</label>
                <input type="text" class="form-input" id="titleInput" placeholder="Enter title...">
            </div>

            <div class="form-section">
                <label class="form-label">Description</label>
                <input type="text" class="form-input" id="descriptionInput" placeholder="Enter description...">
            </div>

            <div class="form-section">
                <label class="form-label">Station</label>
                <input type="text" class="form-input" id="stationInput" placeholder="Enter station...">
            </div>

            <div class="form-section">
                <label class="form-label">Tags</label>
                <input type="text" class="form-input" id="tagsInput" placeholder="Enter tags (comma separated)...">
            </div>

            <div class="form-section">
                <button class="btn" onclick="assignMedia()">🎯 Assign Selected Media</button>
                <button class="btn btn-secondary" onclick="uploadFile()">📤 Upload New File</button>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
        const LIST_MEDIA_ENDPOINT = '/.netlify/functions/list-media';
        const SEARCH_MEDIA_ENDPOINT = '/.netlify/functions/search-media';
        const CLOUDINARY_LIST_ENDPOINT = '/.netlify/functions/LIst-assets';

        let selectedMedia = null;
        let currentPage = 1;
        const itemsPerPage = 50;
        let isLoading = false;
        let allMedia = [];
        let filteredMedia = [];
        let currentPreviewElement = null;

        document.addEventListener('DOMContentLoaded', function() {
            initializeElements();
            loadAllMedia();
            checkConnection();
        });

        function initializeElements() {
            const searchInput = document.getElementById('searchInput');
            const mediaTypeFilter = document.getElementById('mediaTypeFilter');
            
            if (searchInput) {
                searchInput.addEventListener('input', debounce(handleSearch, 300));
            }
            
            if (mediaTypeFilter) {
                mediaTypeFilter.addEventListener('change', handleSearch);
            }
            
            populateKeySlots();
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

        async function loadAllMedia() {
            if (isLoading) return;
            isLoading = true;
            
            const mediaBrowser = document.getElementById('mediaBrowser');
            if (mediaBrowser) {
                mediaBrowser.innerHTML = '<div class="empty-state">Loading media...</div>';
            }

            try {
                const [xanoMedia, cloudinaryMedia] = await Promise.all([
                    loadXanoMedia(),
                    loadCloudinaryMedia()
                ]);

                allMedia = [...xanoMedia, ...cloudinaryMedia];
                filteredMedia = allMedia;
                renderMediaBrowser(filteredMedia);
                
            } catch (error) {
                console.error('Error loading media:', error);
                if (mediaBrowser) {
                    mediaBrowser.innerHTML = '<div class="empty-state">Error loading media. Please try again.</div>';
                }
            } finally {
                isLoading = false;
            }
        }

        async function loadXanoMedia() {
            try {
                const response = await fetch(LIST_MEDIA_ENDPOINT);
                if (!response.ok) throw new Error('Failed to load Xano media');
                const data = await response.json();
                return data.map(item => ({
                    ...item,
                    source: 'xano',
                    type: getMediaType(item.media_url || item.attachment),
                    thumbnail: getFileThumbnail(item.media_url || item.attachment, getMediaType(item.media_url || item.attachment))
                }));
            } catch (error) {
                console.error('Error loading Xano media:', error);
                return [];
            }
        }

        async function loadCloudinaryMedia() {
            try {
                const response = await fetch(CLOUDINARY_LIST_ENDPOINT);
                if (!response.ok) throw new Error('Failed to load Cloudinary media');
                const data = await response.json();
                return data.resources.map(item => ({
                    id: item.public_id,
                    title: item.display_name || item.public_id,
                    media_url: item.secure_url,
                    source: 'cloudinary',
                    type: item.resource_type,
                    format: item.format,
                    size: item.bytes,
                    thumbnail: getFileThumbnail(item.secure_url, item.resource_type)
                }));
            } catch (error) {
                console.error('Error loading Cloudinary media:', error);
                return [];
            }
        }

        function getMediaType(url) {
            if (!url) return 'unknown';
            const extension = url.split('.').pop().toLowerCase();
            
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'image';
            if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(extension)) return 'video';
            if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(extension)) return 'audio';
            if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) return 'raw';
            
            return 'unknown';
        }

        function getFileThumbnail(url, type) {
            if (!url) return '📄';
            
            if (type === 'image') {
                return url.includes('cloudinary.com') ? 
                    url.replace('/upload/', '/upload/w_40,h_40,c_fill/') : url;
            }
            
            if (type === 'video') {
                return url.includes('cloudinary.com') ? 
                    url.replace('/upload/', '/upload/w_40,h_40,c_fill/').replace(/\.[^.]+$/, '.jpg') : '🎬';
            }
            
            const typeIcons = {
                'audio': '🎵',
                'raw': '📄',
                'unknown': '📄'
            };
            
            return typeIcons[type] || '📄';
        }

        function renderMediaBrowser(media) {
            const mediaBrowser = document.getElementById('mediaBrowser');
            if (!mediaBrowser) return;

            if (!media || media.length === 0) {
                mediaBrowser.innerHTML = '<div class="empty-state">No media found</div>';
                return;
            }

            const mediaHTML = media.map(item => {
                const thumbnail = item.thumbnail;
                const isImage = typeof thumbnail === 'string' && (thumbnail.startsWith('http') || thumbnail.startsWith('data:'));
                const itemId = item.id || item.public_id;
                const itemTitle = item.title || 'Untitled';
                const itemType = item.type;
                const itemSize = formatFileSize(item.size || 0);
                
                return '<div class="media-item" onclick="selectMedia(\'' + itemId + '\', \'' + item.source + '\')" data-id="' + itemId + '">' +
                    '<div class="media-thumbnail">' +
                    (isImage ? '<img src="' + thumbnail + '" alt="' + itemTitle + '" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">' : thumbnail) +
                    '</div>' +
                    '<div class="media-info">' +
                    '<div class="media-title">' + itemTitle + '</div>' +
                    '<div class="media-meta">' + itemType + ' • ' + itemSize + '</div>' +
                    '</div>' +
                    '</div>';
            }).join('');

            mediaBrowser.innerHTML = mediaHTML;
        }

        function formatFileSize(bytes) {
            if (!bytes) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function handleSearch() {
            const searchInput = document.getElementById('searchInput');
            const mediaTypeFilter = document.getElementById('mediaTypeFilter');
            
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const typeFilter = mediaTypeFilter ? mediaTypeFilter.value : '';

            filteredMedia = allMedia.filter(item => {
                const matchesSearch = !searchTerm || 
                    (item.title && item.title.toLowerCase().includes(searchTerm)) ||
                    (item.description && item.description.toLowerCase().includes(searchTerm)) ||
                    (item.station && item.station.toLowerCase().includes(searchTerm)) ||
                    (item.tags && item.tags.toLowerCase().includes(searchTerm));

                const matchesType = !typeFilter || item.type === typeFilter;

                return matchesSearch && matchesType;
            });

            renderMediaBrowser(filteredMedia);
        }

        window.selectMedia = function(mediaId, source) {
            const media = allMedia.find(item => 
                (item.id === mediaId || item.public_id === mediaId) && item.source === source
            );
            
            if (!media) return;

            selectedMedia = media;
            
            // Update UI selection
            document.querySelectorAll('.media-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            const selectedElement = document.querySelector('[data-id="' + mediaId + '"]');
            if (selectedElement) {
                selectedElement.classList.add('selected');
            }

            showMediaPreview(media);
            
            populateFormFields(media);
        };

        function showMediaPreview(media) {
            const previewSection = document.getElementById('previewSection');
            const previewContent = document.getElementById('previewContent');
            
            if (!previewSection || !previewContent) return;

            previewSection.style.display = 'block';
            
            const mediaUrl = media.media_url || media.secure_url;
            const mediaType = media.type;
            
            let previewHTML = '';
            
            if (mediaType === 'image') {
                previewHTML = '<img src="' + mediaUrl + '" alt="' + media.title + '" style="max-width: 100%; max-height: 300px; object-fit: contain;">';
            } else if (mediaType === 'video') {
                previewHTML = '<video controls style="max-width: 100%; max-height: 300px;"><source src="' + mediaUrl + '" type="video/mp4">Your browser does not support video playback.</video>';
            } else if (mediaType === 'audio') {
                previewHTML = '<audio controls style="width: 100%;"><source src="' + mediaUrl + '" type="audio/mpeg">Your browser does not support audio playback.</audio>';
            } else {
                previewHTML = '<div style="text-align: center; padding: 40px;">' +
                    '<div style="font-size: 48px; margin-bottom: 10px;">📄</div>' +
                    '<div style="color: #888; margin-bottom: 15px;">' + media.title + '</div>' +
                    '<a href="' + mediaUrl + '" target="_blank" style="color: #667eea; text-decoration: none;">Open File</a>' +
                    '</div>';
            }
            
            previewContent.innerHTML = previewHTML;
            currentPreviewElement = previewContent.querySelector('video, audio');
        }

        function populateFormFields(media) {
            const titleInput = document.getElementById('titleInput');
            const descriptionInput = document.getElementById('descriptionInput');
            const stationInput = document.getElementById('stationInput');
            const tagsInput = document.getElementById('tagsInput');

            if (titleInput) titleInput.value = media.title || '';
            if (descriptionInput) descriptionInput.value = media.description || '';
            if (stationInput) stationInput.value = media.station || '';
            if (tagsInput) tagsInput.value = media.tags || '';
        }

        function populateKeySlots() {
            const keySelect = document.getElementById('keySelect');
            const keyAssignments = document.getElementById('keyAssignments');
            
            if (!keySelect || !keyAssignments) return;

            for (let i = 1; i <= 12; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Key ${i}`;
                keySelect.appendChild(option);
            }

            let keyHTML = '';
            for (let i = 1; i <= 12; i++) {
                keyHTML += '<div class="key-slot" id="key-' + i + '">' +
                    '<div class="key-number">KEY ' + i + '</div>' +
                    '<div class="key-title">—</div>' +
                    '</div>';
            }
            keyAssignments.innerHTML = keyHTML;
        }

        async function checkConnection() {
            const statusElement = document.getElementById('connectionStatus');
            if (!statusElement) return;

            try {
                const response = await fetch(LIST_MEDIA_ENDPOINT);
                if (response.ok) {
                    statusElement.innerHTML = '<span class="status-indicator status-connected"></span>Connected';
                    statusElement.className = 'connection-status connected';
                } else {
                    throw new Error('Connection failed');
                }
            } catch (error) {
                statusElement.innerHTML = '<span class="status-indicator status-disconnected"></span>Connection failed';
                statusElement.className = 'connection-status disconnected';
            }
        }

        window.playSelectedMedia = function() {
            if (currentPreviewElement && typeof currentPreviewElement.play === 'function') {
                currentPreviewElement.play();
            }
        };

        window.stopPreview = function() {
            if (currentPreviewElement) {
                if (typeof currentPreviewElement.pause === 'function') {
                    currentPreviewElement.pause();
                }
                if (typeof currentPreviewElement.currentTime !== 'undefined') {
                    currentPreviewElement.currentTime = 0;
                }
            }
        };

        window.openFullPreview = function() {
            if (selectedMedia) {
                const mediaUrl = selectedMedia.media_url || selectedMedia.secure_url;
                window.open(mediaUrl, '_blank');
            }
        };

        window.assignMedia = function() {
            if (!selectedMedia) {
                alert('Please select media first');
                return;
            }

            const keySelect = document.getElementById('keySelect');
            const titleInput = document.getElementById('titleInput');
            
            if (!keySelect || !keySelect.value) {
                alert('Please select a key slot');
                return;
            }

            const keyNumber = keySelect.value;
            const title = titleInput ? titleInput.value : selectedMedia.title;
            
            const keySlot = document.getElementById('key-' + keyNumber);
            if (keySlot) {
                keySlot.classList.add('assigned');
                const keyTitle = keySlot.querySelector('.key-title');
                if (keyTitle) {
                    keyTitle.textContent = title || 'Assigned';
                }
            }

            alert('Media assigned to Key ' + keyNumber);
        };

        window.uploadFile = function() {
            window.open('/hoibf-file-manager.html', '_blank');
        };

        window.playAllAssigned = function() {
            console.log('Playing all assigned media');
        };

        window.stopAll = function() {
            if (currentPreviewElement) {
                stopPreview();
            }
            console.log('Stopping all media');
        };
    </script>
</body>
</html>`;
    
    return {
      statusCode: 200,
      headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' },
      body: html
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'content-type': 'text/plain' },
      body: 'Error loading VoxPro Manager: ' + error.message
    };
  }
};

