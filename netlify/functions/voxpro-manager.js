exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'text/html'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VoxPro Manager</title>
    <style>
        :root {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2d2d2d;
            --bg-tertiary: #404040;
            --text-primary: #ffffff;
            --text-secondary: #b0b0b0;
            --accent: #4a9eff;
            --success: #28a745;
            --error: #dc3545;
            --warning: #ffc107;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }

        .container {
            display: flex;
            min-height: 100vh;
            width: 100%;
        }

        .player-section {
            flex: 1;
            padding: 20px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--bg-tertiary);
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }

        .manager-section {
            flex: 1;
            padding: 20px;
            background: var(--bg-primary);
        }

        .section-title {
            font-size: 1.5rem;
            margin-bottom: 20px;
            color: var(--accent);
        }

        .connection-status {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px;
            border-radius: 5px;
            background: var(--bg-tertiary);
        }

        .status-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 10px;
        }

        .connected { background: var(--success); }
        .disconnected { background: var(--error); }

        .key-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }

        .key-button {
            padding: 20px;
            background: var(--bg-tertiary);
            border: none;
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .key-button:hover {
            background: var(--accent);
            transform: translateY(-2px);
            color: white;
        }

        .key-button.assigned {
            background: var(--accent);
            color: white;
        }

        .stop-button {
            width: 100%;
            padding: 15px;
            background: var(--error);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 20px;
        }

        .assignments-section {
            background: var(--bg-tertiary);
            padding: 15px;
            border-radius: 8px;
        }

        .assignment-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--bg-secondary);
        }

        .assignment-item:last-child {
            border-bottom: none;
        }

        .remove-assignment {
            background: var(--error);
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--text-secondary);
        }

        .form-input, .form-select, .form-textarea {
            width: 100%;
            padding: 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 1rem;
            margin-bottom: 15px;
        }

        .form-textarea {
            resize: vertical;
            min-height: 80px;
        }

        .search-input {
            width: 100%;
            padding: 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 1rem;
            margin-bottom: 15px;
        }

        .media-browser {
            background: var(--bg-secondary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 20px;
        }

        .media-item {
            display: flex;
            align-items: center;
            padding: 12px;
            border-bottom: 1px solid var(--bg-tertiary);
            cursor: pointer;
            transition: background 0.2s ease;
        }

        .media-item:hover {
            background: var(--bg-tertiary);
        }

        .media-item.selected {
            background: var(--accent);
        }

        .media-item:last-child {
            border-bottom: none;
        }

        .media-info {
            flex: 1;
        }

        .media-title {
            font-weight: 500;
            margin-bottom: 4px;
        }

        .media-meta {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-secondary);
        }

        .message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            display: none;
        }

        .message.success {
            background: rgba(40, 167, 69, 0.2);
            border: 1px solid var(--success);
            color: var(--success);
        }

        .message.error {
            background: rgba(220, 53, 69, 0.2);
            border: 1px solid var(--error);
            color: var(--error);
        }

        .message.info {
            background: rgba(74, 158, 255, 0.2);
            border: 1px solid var(--accent);
            color: var(--accent);
        }

        .upload-area {
            border: 2px dashed var(--bg-tertiary);
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            background: var(--bg-secondary);
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 25px;
        }

        .upload-area:hover {
            border-color: var(--accent);
            background: rgba(74, 158, 255, 0.1);
        }

        .upload-area.drag-over {
            border-color: var(--accent);
            background: rgba(74, 158, 255, 0.2);
        }

        .picker-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }

        .preview-section {
            margin: 25px 0;
            display: none;
        }

        .preview-container {
            background: var(--bg-primary);
            border: 1px solid var(--bg-tertiary);
            border-radius: 8px;
            padding: 15px;
            min-height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .preview-controls {
            margin-top: 10px;
            text-align: center;
        }

        .preview-button {
            background: var(--accent);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            margin: 0 5px;
            cursor: pointer;
        }

        .upload-progress {
            margin-top: 15px;
            display: none;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: var(--accent);
            width: 0%;
            transition: width 0.3s ease;
        }

        .progress-text {
            margin-top: 8px;
            font-size: 14px;
            color: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="player-section">
            <h2 class="section-title">VoxPro Media Player</h2>
            
            <div class="connection-status" id="connectionStatus">
                <div class="status-indicator disconnected" id="statusIndicator"></div>
                <span id="statusText">Disconnected</span>
            </div>

            <div class="key-grid">
                <button class="key-button" data-key="1" id="key1">KEY 1</button>
                <button class="key-button" data-key="2" id="key2">KEY 2</button>
                <button class="key-button" data-key="3" id="key3">KEY 3</button>
                <button class="key-button" data-key="4" id="key4">KEY 4</button>
                <button class="key-button" data-key="5" id="key5">KEY 5</button>
            </div>

            <button class="stop-button" id="stopButton">STOP</button>

            <div class="assignments-section">
                <h3 style="margin-bottom: 15px; color: var(--accent);">Current Key Assignments</h3>
                <div id="assignmentsList">
                    <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                        No assignments yet
                    </div>
                </div>
            </div>
        </div>

        <div class="manager-section">
            <h2 class="section-title">VoxPro Manager</h2>
            
            <div class="message" id="messageBox"></div>

            <div class="upload-section" style="margin-bottom: 25px;">
                <label class="form-label">Upload Media</label>
                <div class="upload-area" id="uploadArea">
                    <div class="upload-content">
                        <div style="font-size: 48px; margin-bottom: 15px;">📁</div>
                        <div style="font-size: 18px; margin-bottom: 10px; color: var(--text-primary);">Drop files here or click to browse</div>
                        <div style="font-size: 14px; color: var(--text-secondary);">Supports images, videos, audio, and documents</div>
                        <input type="file" id="fileInput" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display: none;">
                    </div>
                </div>
                <div class="upload-progress" id="uploadProgress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">Uploading...</div>
                </div>
            </div>

            <div class="search-section">
                <label class="form-label">Search Media (title, description, station, tags)</label>
                <div class="picker-controls">
                    <input type="text" class="search-input" id="searchInput" placeholder="Search media files..." style="flex: 1;">
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

            <div class="preview-section" id="previewSection">
                <label class="form-label">Media Preview</label>
                <div class="preview-container" id="previewContainer">
                    <div id="previewContent" style="width: 100%; text-align: center;">
                        <div class="preview-placeholder">
                            <div style="font-size: 48px; margin-bottom: 10px;">🎵</div>
                            <div style="color: var(--text-secondary);">Select media to preview</div>
                        </div>
                    </div>
                </div>
                <div class="preview-controls">
                    <button class="preview-button" id="playButton" onclick="playSelectedMedia()">▶️ Play</button>
                    <button class="preview-button" id="stopButton" onclick="stopPreview()" style="background: var(--error);">⏹️ Stop</button>
                    <button class="preview-button" id="fullscreenButton" onclick="openFullPreview()">🔍 Fullscreen</button>
                </div>
            </div>

            <div class="form-section">
                <label class="form-label">Select Key Slot</label>
                <select class="form-select" id="keySelect">
                    <option value="">Choose a key...</option>
                    <option value="1">Key 1</option>
                    <option value="2">Key 2</option>
                    <option value="3">Key 3</option>
                    <option value="4">Key 4</option>
                    <option value="5">Key 5</option>
                </select>

                <label class="form-label">Title</label>
                <input type="text" class="form-input" id="titleInput" placeholder="Title">

                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="descriptionInput" placeholder="Description"></textarea>

                <label class="form-label">Station</label>
                <input type="text" class="form-input" id="stationInput" placeholder="Station">

                <label class="form-label">Tags</label>
                <input type="text" class="form-input" id="tagsInput" placeholder="Comma-separated">

                <label class="form-label">Submitted By</label>
                <input type="text" class="form-input" id="submittedByInput" placeholder="Name or initials">
                
                <button class="form-button" id="assignButton" style="margin-top: 15px; background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Assign to Key</button>
            </div>
        </div>
    </div>

    <script>
        const CONFIG = {
            LIST_MEDIA_ENDPOINT: '/.netlify/functions/list-media',
            SEARCH_MEDIA_ENDPOINT: '/.netlify/functions/search-media',
            CLOUDINARY_ASSETS_ENDPOINT: '/.netlify/functions/LIst-assets',
            UPLOAD_ENDPOINT: '/.netlify/functions/file-manager-upload',
            XANO_PROXY_ENDPOINT: '/.netlify/functions/xano-proxy',
            DEBOUNCE_MS: 300
        };

        const state = {
            mediaList: [],
            selectedMedia: null,
            keyAssignments: {},
            isConnected: false,
            currentAudio: null
        };

        const elements = {
            searchInput: document.getElementById('searchInput'),
            mediaTypeFilter: document.getElementById('mediaTypeFilter'),
            mediaBrowser: document.getElementById('mediaBrowser'),
            previewSection: document.getElementById('previewSection'),
            previewContent: document.getElementById('previewContent'),
            messageBox: document.getElementById('messageBox'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            assignmentsList: document.getElementById('assignmentsList'),
            keySelect: document.getElementById('keySelect'),
            titleInput: document.getElementById('titleInput'),
            descriptionInput: document.getElementById('descriptionInput'),
            stationInput: document.getElementById('stationInput'),
            tagsInput: document.getElementById('tagsInput'),
            submittedByInput: document.getElementById('submittedByInput'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            uploadProgress: document.getElementById('uploadProgress'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText')
        };

        async function loadAllMedia(query = '', type = '') {
            try {
                console.log('VoxPro Manager: Loading media from Xano endpoint only - v2');
                const xanoMedia = await loadXanoMedia(query);
                
                state.mediaList = xanoMedia;
                
                renderMediaBrowser();
                setConnectionStatus(true);
                
                return xanoMedia;
            } catch (error) {
                console.error('Error loading all media:', error);
                showMessage('error', 'Error loading media: ' + error.message);
                setConnectionStatus(false);
                return [];
            }
        }

        async function loadXanoMedia(query = '') {
            try {
                const response = await fetch('/.netlify/functions/xano-proxy/user_submission');
                
                if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
                
                const data = await response.json();
                const mediaList = Array.isArray(data) ? data : [];
                
                console.log('VoxPro Manager: Received', mediaList.length, 'items from Xano');
                
                return mediaList.filter(item => {
                    if (query && item.title && !item.title.toLowerCase().includes(query.toLowerCase())) {
                        return false;
                    }
                    return item.title && (item.cloudinary_url || item.file_url || item.database_url || item.attachment);
                }).map(item => ({
                    ...item,
                    source: 'xano'
                }));
                
            } catch (error) {
                console.error('Load Xano media error:', error);
                return [];
            }
        }

        async function loadCloudinaryAssets(query = '', type = '') {
            try {
                let endpoint = CONFIG.CLOUDINARY_ASSETS_ENDPOINT;
                const params = new URLSearchParams();
                if (query) params.append('expression', \`filename:*\${query}*\`);
                if (type) params.append('type', type);
                params.append('max', '50');
                
                if (params.toString()) {
                    endpoint += '?' + params.toString();
                }
                
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
                
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

        function renderMediaBrowser() {
            const browser = elements.mediaBrowser;
            if (!browser) return;
            
            if (state.mediaList.length === 0) {
                browser.innerHTML = '<div class="empty-state">No media found</div>';
                return;
            }
            
            browser.innerHTML = state.mediaList.map(item => {
                const thumbnail = getMediaThumbnail(item);
                const title = item.title || 'Untitled';
                const itemId = item.source === 'cloudinary' ? item.id : item.id;
                
                return \`
                    <div class="media-item" data-id="\${itemId}" data-source="\${item.source}">
                        <div class="media-thumbnail" style="width: 60px; height: 60px; margin-right: 12px; border-radius: 4px; overflow: hidden; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">
                            \${thumbnail}
                        </div>
                        <div class="media-info">
                            <div class="media-title">\${title}</div>
                            <div class="media-meta">
                                \${item.station || item.source || 'Unknown'} • \${item.file_type || 'Media'}
                                \${item.file_size ? \` • \${formatFileSize(item.file_size)}\` : ''}
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
            
            browser.querySelectorAll('.media-item').forEach(item => {
                item.addEventListener('click', () => {
                    const source = item.dataset.source;
                    const id = item.dataset.id;
                    if (source === 'cloudinary') {
                        selectCloudinaryAsset(id);
                    } else {
                        selectMedia(parseInt(id));
                    }
                });
            });
        }

        function getMediaThumbnail(item) {
            const mediaUrl = item.cloudinary_url || item.media_url || item.attachment;
            const fileType = (item.file_type || '').toLowerCase();
            
            if (fileType === 'image' && mediaUrl) {
                const thumbnailUrl = mediaUrl.includes('cloudinary.com') 
                    ? mediaUrl.replace('/upload/', '/upload/w_60,h_60,c_fill,f_auto,q_auto/')
                    : mediaUrl;
                return \`<img src="\${thumbnailUrl}" alt="\${item.title || 'Image'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 1.2rem;">🖼️</div>\`;
            } else if (fileType === 'video' && mediaUrl) {
                const thumbnailUrl = mediaUrl.includes('cloudinary.com') 
                    ? mediaUrl.replace('/upload/', '/upload/w_60,h_60,c_fill,f_auto,q_auto/').replace(/\\.(mp4|mov|avi|webm)$/, '.jpg')
                    : null;
                return thumbnailUrl 
                    ? \`<img src="\${thumbnailUrl}" alt="\${item.title || 'Video'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 1.2rem;">🎬</div>\`
                    : \`<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">🎬</div>\`;
            } else {
                const icon = getMediaIcon(fileType);
                return \`<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">\${icon}</div>\`;
            }
        }

        function getMediaIcon(fileType) {
            const type = (fileType || '').toLowerCase();
            if (type.includes('audio') || type === 'audio') return '🎵';
            if (type.includes('video') || type === 'video') return '🎬';
            if (type.includes('image') || type === 'image') return '🖼️';
            if (type.includes('pdf')) return '📄';
            if (type.includes('doc')) return '📝';
            return '📁';
        }

        function selectMedia(mediaId) {
            const media = state.mediaList.find(m => m.id === mediaId && m.source === 'xano');
            if (!media) return;

            state.selectedMedia = media;

            document.querySelectorAll('.media-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            const selectedItem = document.querySelector(\`[data-id="\${mediaId}"][data-source="xano"]\`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }

            if (elements.titleInput) elements.titleInput.value = media.title || '';
            if (elements.descriptionInput) elements.descriptionInput.value = media.description || '';
            if (elements.stationInput) elements.stationInput.value = media.station || '';
            if (elements.tagsInput) elements.tagsInput.value = media.tags || '';
            if (elements.submittedByInput) elements.submittedByInput.value = media.submitted_by || '';
            
            showMediaPreview(media);
        }

        function selectCloudinaryAsset(publicId) {
            const asset = state.mediaList.find(m => m.id === publicId && m.source === 'cloudinary');
            if (!asset) return;

            state.selectedMedia = {
                id: asset.id,
                title: asset.title || asset.public_id,
                description: asset.description || '',
                station: 'Cloudinary',
                tags: Array.isArray(asset.tags) ? asset.tags.join(', ') : (asset.tags || ''),
                submitted_by: 'Cloudinary Import',
                file_type: asset.file_type,
                file_size: asset.file_size,
                cloudinary_url: asset.media_url,
                media_url: asset.media_url,
                attachment: asset.media_url
            };

            document.querySelectorAll('.media-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            const selectedItem = document.querySelector(\`[data-id="\${publicId}"][data-source="cloudinary"]\`);
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

        function showMediaPreview(media) {
            const previewSection = elements.previewSection;
            const previewContent = elements.previewContent;
            
            if (!previewSection || !previewContent) return;
            
            previewSection.style.display = 'block';
            
            const mediaUrl = media.cloudinary_url || media.media_url || media.attachment;
            const title = media.title || media.filename || 'Untitled';
            
            if (!mediaUrl) {
                previewContent.innerHTML = \`
                    <div class="preview-placeholder">
                        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                        <div style="color: var(--text-secondary);">No media URL available</div>
                    </div>
                \`;
                return;
            }
            
            let mediaElement;
            previewContent.innerHTML = '';
            
            if (media.file_type === 'audio') {
                mediaElement = document.createElement('audio');
                mediaElement.controls = true;
                mediaElement.src = mediaUrl;
                mediaElement.style.width = '100%';
                
            } else if (media.file_type === 'video') {
                mediaElement = document.createElement('video');
                mediaElement.controls = true;
                mediaElement.src = mediaUrl;
                mediaElement.style.width = '100%';
                mediaElement.style.maxHeight = '300px';
                
            } else if (media.file_type === 'image') {
                mediaElement = document.createElement('img');
                mediaElement.src = mediaUrl;
                mediaElement.alt = title;
                mediaElement.style.maxWidth = '100%';
                mediaElement.style.maxHeight = '300px';
                mediaElement.style.objectFit = 'contain';
                
            } else {
                previewContent.innerHTML = \`
                    <div class="preview-placeholder">
                        <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
                        <div style="color: var(--text-secondary);">\${title}</div>
                        <button onclick="window.open('\${mediaUrl}', '_blank')" style="margin-top: 12px; padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📥 Open File
                        </button>
                    </div>
                \`;
                return;
            }
            
            if (mediaElement) {
                mediaElement.onerror = function() {
                    previewContent.innerHTML = \`
                        <div class="preview-placeholder">
                            <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                            <div style="color: var(--text-secondary);">Error loading media</div>
                            <button onclick="window.open('\${mediaUrl}', '_blank')" style="margin-top: 12px; padding: 8px 16px; background: var(--error); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                📥 Open Instead
                            </button>
                        </div>
                    \`;
                };
                
                previewContent.appendChild(mediaElement);
            }
        }

        function setupUploadHandlers() {
            const uploadArea = elements.uploadArea;
            const fileInput = elements.fileInput;
            
            if (!uploadArea || !fileInput) return;
            
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });
            
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleFiles(files);
                }
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFiles(e.target.files);
                }
            });
        }

        async function handleFiles(files) {
            const uploadProgress = elements.uploadProgress;
            const progressFill = elements.progressFill;
            const progressText = elements.progressText;
            
            if (!uploadProgress || !progressFill || !progressText) return;
            
            uploadProgress.style.display = 'block';
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progress = ((i + 1) / files.length) * 100;
                
                progressFill.style.width = progress + '%';
                progressText.textContent = \`Uploading \${file.name}... (\${i + 1}/\${files.length})\`;
                
                try {
                    await uploadSingleFile(file);
                    showMessage('success', \`Successfully uploaded \${file.name}\`);
                } catch (error) {
                    console.error('Upload error:', error);
                    showMessage('error', \`Failed to upload \${file.name}: \${error.message}\`);
                }
            }
            
            uploadProgress.style.display = 'none';
            progressFill.style.width = '0%';
            
            loadAllMedia();
        }

        async function uploadSingleFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', file.name);
            formData.append('description', \`Uploaded via VoxPro Manager\`);
            formData.append('station', 'VoxPro');
            formData.append('submitted_by', 'VoxPro Manager');
            
            const response = await fetch(CONFIG.UPLOAD_ENDPOINT, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(\`Upload failed: \${response.status}\`);
            }
            
            return await response.json();
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function showMessage(type, message) {
            const messageBox = elements.messageBox;
            if (!messageBox) return;
            
            messageBox.className = \`message \${type}\`;
            messageBox.textContent = message;
            messageBox.style.display = 'block';
            
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, 5000);
        }

        function setConnectionStatus(connected) {
            state.isConnected = connected;
            const indicator = elements.statusIndicator;
            const text = elements.statusText;
            
            if (indicator && text) {
                if (connected) {
                    indicator.className = 'status-indicator connected';
                    text.textContent = 'Connected';
                } else {
                    indicator.className = 'status-indicator disconnected';
                    text.textContent = 'Disconnected';
                }
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

        async function loadAssignments() {
            try {
                console.log('Loading assignments...');
                const response = await fetch('/.netlify/functions/voxpro_assignments', {
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                const data = await response.json();
                console.log('Raw assignment data:', data);
                const assignments = Array.isArray(data) ? data : [];
                
                state.keyAssignments = {};
                assignments.forEach(assignment => {
                    if (assignment.key_number && assignment.asset_id && state.mediaList.length > 0) {
                        const mediaItem = state.mediaList.find(item => 
                            parseInt(item.id) === parseInt(assignment.asset_id)
                        );
                        if (mediaItem) {
                            state.keyAssignments[assignment.key_number] = {
                                id: assignment.id,
                                title: assignment.title || mediaItem.title || mediaItem.filename || mediaItem.display_name,
                                media_url: mediaItem.attachment || mediaItem.media_url || assignment.cloudinary_url || mediaItem.cloudinary_url || mediaItem.file_url || mediaItem.database_url,
                                file_type: assignment.file_type || mediaItem.file_type,
                                asset: mediaItem
                            };
                        }
                    }
                });
                
                console.log('Populated keyAssignments:', state.keyAssignments);
                renderAssignments();
                updateKeyButtons();
            } catch (error) {
                console.error('Load assignments error:', error);
                state.keyAssignments = {};
            }
        }

        function initialize() {
            console.log('VoxPro Manager initializing - v2.1...');
            setupUploadHandlers();
            
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
            
            loadAllMedia().then(() => {
                loadAssignments();
            });
            setupKeyButtons();
            
            const assignButton = document.getElementById('assignButton');
            if (assignButton) {
                assignButton.addEventListener('click', () => {
                    const keyNumber = elements.keySelect.value;
                    if (keyNumber && state.selectedMedia) {
                        assignMediaToKey(keyNumber, state.selectedMedia);
                        showMessage('success', \`Media assigned to Key \${keyNumber}\`);
                    } else {
                        showMessage('error', 'Please select a key and media');
                    }
                });
            }
        }

        function assignMediaToKey(keyNumber, media) {
            if (!media || !keyNumber) return;
            
            state.keyAssignments[keyNumber] = {
                id: media.id,
                title: media.title,
                media_url: media.attachment || media.media_url || media.cloudinary_url,
                file_type: media.file_type,
                asset: media
            };
            
            updateKeyButtons();
            renderAssignments();
        }

        function updateKeyButtons() {
            for (let i = 1; i <= 5; i++) {
                const button = document.getElementById(\`key\${i}\`);
                const assignment = state.keyAssignments[i];
                
                if (button) {
                    if (assignment) {
                        button.textContent = \`KEY \${i}: \${assignment.title}\`;
                        button.classList.add('assigned');
                    } else {
                        button.textContent = \`KEY \${i}\`;
                        button.classList.remove('assigned');
                    }
                }
            }
        }

        function renderAssignments() {
            const assignmentsList = elements.assignmentsList;
            if (!assignmentsList) return;
            
            const assignments = Object.entries(state.keyAssignments).map(([key, assignment]) => {
                return \`
                    <div class="assignment-item">
                        <span>Key \${key}: \${assignment.title}</span>
                        <button onclick="removeAssignment(\${key})" style="background: var(--error); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Remove</button>
                    </div>
                \`;
            }).join('');
            
            assignmentsList.innerHTML = assignments || '<div class="empty-state">No assignments</div>';
        }

        function removeAssignment(keyNumber) {
            delete state.keyAssignments[keyNumber];
            updateKeyButtons();
            renderAssignments();
            showMessage('success', \`Key \${keyNumber} assignment removed\`);
        }

        window.playSelectedMedia = function() {
            if (!state.selectedMedia) {
                showMessage('error', 'No media selected');
                return;
            }
            
            const mediaUrl = state.selectedMedia.cloudinary_url || state.selectedMedia.media_url || state.selectedMedia.attachment;
            if (!mediaUrl) {
                showMessage('error', 'No media URL available');
                return;
            }
            
            if (state.currentAudio) {
                state.currentAudio.pause();
                state.currentAudio = null;
            }
            
            const audio = new Audio(mediaUrl);
            audio.play().then(() => {
                state.currentAudio = audio;
                showMessage('success', 'Playing: ' + (state.selectedMedia.title || 'Media'));
            }).catch(error => {
                console.error('Playback error:', error);
                showMessage('error', 'Failed to play media');
            });
        };

        window.stopPreview = function() {
            if (state.currentAudio) {
                state.currentAudio.pause();
                state.currentAudio = null;
                showMessage('info', 'Playback stopped');
            }
        };

        window.openFullPreview = function() {
            if (!state.selectedMedia) {
                showMessage('error', 'No media selected');
                return;
            }
            
            const mediaUrl = state.selectedMedia.cloudinary_url || state.selectedMedia.media_url || state.selectedMedia.attachment;
            if (mediaUrl) {
                window.open(mediaUrl, '_blank');
            } else {
                showMessage('error', 'No media URL available');
            }
        }

        function assignMediaToKey(keyNumber, media) {
            if (!media || !keyNumber) return;
            
            state.keyAssignments[keyNumber] = {
                id: media.id,
                title: media.title,
                media_url: media.attachment || media.media_url || media.cloudinary_url,
                file_type: media.file_type,
                asset: media
            };
            
            updateKeyButtons();
            renderAssignments();
        }
        
        function updateKeyButtons() {
            for (let i = 1; i <= 5; i++) {
                const button = document.getElementById(\`key\${i}\`);
                const assignment = state.keyAssignments[i];
                
                if (button) {
                    if (assignment) {
                        button.textContent = \`KEY \${i}: \${assignment.title}\`;
                        button.classList.add('assigned');
                    } else {
                        button.textContent = \`KEY \${i}\`;
                        button.classList.remove('assigned');
                    }
                }
            }
        }
        
        function renderAssignments() {
            const assignmentsList = elements.assignmentsList;
            if (!assignmentsList) return;
            
            const assignments = Object.entries(state.keyAssignments);
            if (assignments.length === 0) {
                assignmentsList.innerHTML = \`
                    <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                        No assignments yet
                    </div>
                \`;
                return;
            }
            
            assignmentsList.innerHTML = assignments.map(([key, assignment]) => \`
                <div class="assignment-item" style="padding: 10px; border: 1px solid var(--bg-tertiary); border-radius: 4px; margin-bottom: 8px;">
                    <div style="font-weight: bold; color: var(--accent);">Key \${key}</div>
                    <div style="color: var(--text-primary);">\${assignment.title}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">\${assignment.file_type || 'Media'}</div>
                </div>
            \`).join('');
        }
        
        function setupKeyButtons() {
            for (let i = 1; i <= 5; i++) {
                const button = document.getElementById(\`key\${i}\`);
                if (button) {
                    button.addEventListener('click', () => {
                        const assignment = state.keyAssignments[i];
                        if (assignment && assignment.media_url) {
                            playMedia(assignment.media_url, assignment.file_type, assignment.title);
                        } else {
                            showMessage('info', \`Key \${i} has no assignment\`);
                        }
                    });
                }
            }
            
            const stopButton = document.getElementById('stopButton');
            if (stopButton) {
                stopButton.addEventListener('click', () => {
                    stopAllMedia();
                });
            }
        }
        
        function playMedia(mediaUrl, fileType, title) {
            stopAllMedia();
            
            let mediaContainer = document.getElementById('playerMediaContainer');
            if (!mediaContainer) {
                const playerSection = document.querySelector('.player-section');
                if (playerSection) {
                    mediaContainer = document.createElement('div');
                    mediaContainer.id = 'playerMediaContainer';
                    mediaContainer.style.cssText = 'margin: 15px 0; padding: 10px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--bg-tertiary);';
                    
                    const stopButton = document.getElementById('stopButton');
                    if (stopButton && stopButton.parentNode) {
                        stopButton.parentNode.insertBefore(mediaContainer, stopButton.nextSibling);
                    } else {
                        playerSection.appendChild(mediaContainer);
                    }
                }
            }
            
            const titleDiv = '<div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Now Playing: ' + title + '</div>';
            
            if (fileType === 'audio') {
                const audio = new Audio(mediaUrl);
                audio.controls = true;
                audio.style.cssText = 'width: 100%; background: var(--bg-primary); border-radius: 4px;';
                
                if (mediaContainer) {
                    mediaContainer.innerHTML = titleDiv;
                    mediaContainer.appendChild(audio);
                }
                
                audio.play();
                state.currentAudio = audio;
                showMessage('success', 'Playing: ' + title);
            } else if (fileType === 'video') {
                const video = document.createElement('video');
                video.src = mediaUrl;
                video.controls = true;
                video.style.cssText = 'width: 100%; max-height: 300px; background: var(--bg-primary); border-radius: 4px;';
                
                if (mediaContainer) {
                    mediaContainer.innerHTML = titleDiv;
                    mediaContainer.appendChild(video);
                }
                
                video.play();
                state.currentVideo = video;
                showMessage('success', 'Playing video: ' + title);
            } else if (fileType === 'image') {
                const img = document.createElement('img');
                img.src = mediaUrl;
                img.style.cssText = 'width: 100%; max-height: 400px; object-fit: contain; background: var(--bg-primary); border-radius: 4px;';
                
                if (mediaContainer) {
                    mediaContainer.innerHTML = titleDiv;
                    mediaContainer.appendChild(img);
                }
                
                showMessage('success', 'Displaying image: ' + title);
            } else if (fileType === 'raw' || fileType === 'document') {
                const fileExtension = (mediaUrl.split('.').pop() || title.split('.').pop() || '').toLowerCase();
                const isPdf = fileExtension === 'pdf' || mediaUrl.includes('.pdf') || title.toLowerCase().includes('pdf');
                const isDocx = fileExtension === 'docx' || fileExtension === 'doc' || mediaUrl.includes('.docx') || mediaUrl.includes('.doc') || title.toLowerCase().includes('doc');
                
                if (isPdf || isDocx) {
                    let thumbnailUrl = mediaUrl;
                    
                    const cloudinaryMatch = mediaUrl.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
                    if (cloudinaryMatch) {
                        const publicId = cloudinaryMatch[1];
                        thumbnailUrl = 'https://res.cloudinary.com/dzrw8nopf/image/upload/c_fit,w_800,h_600,pg_1,f_jpg/' + publicId + '.jpg';
                    }
                    
                    const previewContainer = document.createElement('div');
                    previewContainer.style.cssText = 'width: 100%; background: var(--bg-primary); border-radius: 4px; padding: 15px; border: 1px solid var(--bg-tertiary);';
                    
                    const thumbnailImg = document.createElement('img');
                    thumbnailImg.src = thumbnailUrl;
                    thumbnailImg.style.cssText = 'width: 100%; max-height: 500px; object-fit: contain; border-radius: 4px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
                    
                    thumbnailImg.onload = function() {
                        console.log('Document thumbnail loaded successfully:', thumbnailUrl);
                    };
                    
                    thumbnailImg.onerror = function() {
                        console.error('Failed to load document thumbnail, showing fallback:', thumbnailUrl);
                        previewContainer.innerHTML = 
                            '<div style="text-align: center; padding: 40px;">' +
                                '<div style="font-size: 64px; margin-bottom: 20px; color: var(--text-secondary);">' + (isPdf ? '📄' : '📝') + '</div>' +
                                '<div style="color: var(--text-primary); font-size: 18px; font-weight: 500; margin-bottom: 12px;">' + title + '</div>' +
                                '<div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">' + (isPdf ? 'PDF Document' : 'DOCX Document') + '</div>' +
                                '<button onclick="window.open(\'' + mediaUrl + '\', \'_blank\')" style="background: var(--accent-color); color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; cursor: pointer;">' +
                                    '📥 Open Document' +
                                '</button>' +
                            '</div>';
                    };
                    
                    previewContainer.appendChild(thumbnailImg);
                    
                    if (mediaContainer) {
                        mediaContainer.innerHTML = titleDiv + '<div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">Document Preview (First Page)</div>';
                        mediaContainer.appendChild(previewContainer);
                    }
                } else {
                    const previewDiv = document.createElement('div');
                    previewDiv.style.cssText = 'width: 100%; height: 400px; background: var(--bg-primary); border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed var(--bg-tertiary);';
                    
                    previewDiv.innerHTML = 
                        '<div style="font-size: 48px; margin-bottom: 16px; color: var(--text-secondary);">📄</div>' +
                        '<div style="color: var(--text-primary); font-size: 16px; font-weight: 500; margin-bottom: 8px;">' + title + '</div>' +
                        '<button onclick="window.open(\'' + mediaUrl + '\', \'_blank\')" style="background: var(--accent-color); color: white; border: none; padding: 10px 20px; border-radius: 4px; font-size: 14px; cursor: pointer;">' +
                            '📥 Open File' +
                        '</button>';
                    
                    if (mediaContainer) {
                        mediaContainer.innerHTML = titleDiv + '<div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">Document preview</div>';
                        mediaContainer.appendChild(previewDiv);
                    }
                }
                
                showMessage('success', 'Displaying document: ' + title);
            } else {
                const iframe = document.createElement('iframe');
                iframe.src = mediaUrl;
                iframe.style.cssText = 'width: 100%; height: 400px; border: none; background: var(--bg-primary); border-radius: 4px;';
                
                if (mediaContainer) {
                    mediaContainer.innerHTML = titleDiv + '<div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">Media preview</div>';
                    mediaContainer.appendChild(iframe);
                }
                
                showMessage('success', 'Displaying: ' + title);
            }
        }
        
        function stopAllMedia() {
            if (state.currentAudio) {
                state.currentAudio.pause();
                state.currentAudio = null;
            }
            if (state.currentVideo) {
                state.currentVideo.pause();
                state.currentVideo = null;
            }
            
            const mediaContainer = document.getElementById('playerMediaContainer');
            if (mediaContainer) {
                mediaContainer.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No media playing</div>';
            }
        }

        window.playSelectedMedia = function() {
            const previewContent = elements.previewContent;
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
            const previewContent = elements.previewContent;
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
            loadAllMedia,
            loadAssignments,
            renderAssignments,
            updateKeyButtons,
            playMedia,
            stopAllMedia
        };

        document.addEventListener('DOMContentLoaded', initialize);
    </script>
</body>
</html>`;

    return {
        statusCode: 200,
        headers,
        body: html
    };
};
