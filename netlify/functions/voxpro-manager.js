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
            --accent-secondary: #667eea;
            --success: #28a745;
            --error: #dc3545;
            --warning: #ffc107;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }
        .container { display: flex; min-height: 100vh; width: 100%; }
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
        .section-title { font-size: 1.5rem; margin-bottom: 20px; color: var(--accent); }
        .connection-status {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px;
            border-radius: 5px;
            background: var(--bg-tertiary);
        }
        .status-indicator { width: 10px; height: 10px; border-radius: 50%; margin-right: 10px; }
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
        .key-button:hover { background: var(--accent); transform: translateY(-2px); color: white; }
        .key-button.assigned { background: var(--accent); color: white; }
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
        .assignment-item:last-child { border-bottom: none; }
        .remove-assignment {
            background: var(--error);
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
        }
        .form-label { display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-secondary); }
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
        .form-textarea { resize: vertical; min-height: 80px; }
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
        .media-browser { max-height: 300px; overflow-y: auto; margin-bottom: 25px; border: 1px solid var(--bg-tertiary); border-radius: 8px; }
        .media-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-bottom: 1px solid var(--bg-tertiary);
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .media-item:hover { background: var(--bg-tertiary); }
        .media-item.selected { background: rgba(102, 126, 234, 0.2); border-left: 4px solid var(--accent); }
        .media-item:last-child { border-bottom: none; }
        .media-icon {
            width: 40px;
            height: 40px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }
        .media-info { flex: 1; }
        .media-title { font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
        .media-meta { font-size: 0.85rem; color: var(--text-secondary); }
        .form-button {
            background: var(--accent);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        }
        .message { display: none; margin-bottom: 15px; padding: 10px; border-radius: 4px; }
        .message.success { background: rgba(40, 167, 69, 0.2); color: var(--success); }
        .message.error { background: rgba(220, 53, 69, 0.2); color: var(--error); }
        .message.info { background: rgba(255, 193, 7, 0.2); color: var(--warning); }
    </style>
</head>
<body>
    <div class="container">
        <div class="player-section">
            <h2 class="section-title">VoxPro Media Player</h2>
            <div class="connection-status" id="connectionStatus">
                <div class="status-indicator" id="statusIndicator"></div>
                <span id="statusText">Disconnected</span>
            </div>
            <div class="key-grid">
                <button class="key-button" id="key1">KEY 1</button>
                <button class="key-button" id="key2">KEY 2</button>
                <button class="key-button" id="key3">KEY 3</button>
                <button class="key-button" id="key4">KEY 4</button>
                <button class="key-button" id="key5">KEY 5</button>
                <button class="stop-button" id="stopButton">STOP</button>
            </div>
            <div class="assignments-section" id="assignmentsList">
                <p style="text-align:center; color: var(--text-secondary);">No assignments yet</p>
            </div>
        </div>
        <div class="manager-section">
            <h2 class="section-title">VoxPro Manager</h2>
            <div id="messageBox" class="message info"></div>
            <div class="form-section">
                <label class="form-label" for="searchInput">Search Media (title, description, station, tags)</label>
                <input type="text" class="search-input" id="searchInput" placeholder="Search media files...">
                <select id="mediaTypeFilter" class="form-select">
                    <option value="">All Types</option>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                    <option value="image">Images</option>
                    <option value="pdf">PDFs</option>
                    <option value="office">Office Documents</option>
                </select>
            </div>
            <div class="media-browser" id="mediaBrowser">Loading media...</div>
            <div class="preview-section" id="previewSection">
                <div id="previewContent"></div>
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button onclick="playSelectedMedia()" class="form-button" style="background: var(--success);">Play</button>
                    <button onclick="stopPreview()" class="form-button" style="background: var(--error);">Stop</button>
                    <button onclick="openFullPreview()" class="form-button" style="background: var(--accent);">Open File ↗</button>
                </div>
            </div>
            <div class="form-section">
                <h3 style="margin-bottom: 10px; color: var(--accent);">Assign Media</h3>
                <label class="form-label" for="keySelect">Select Key Slot</label>
                <select class="form-select" id="keySelect">
                    <option value="">Choose a key...</option>
                    <option value="1">Key 1</option>
                    <option value="2">Key 2</option>
                    <option value="3">Key 3</option>
                    <option value="4">Key 4</option>
                    <option value="5">Key 5</option>
                </select>
                <label class="form-label" for="titleInput">Title</label>
                <input type="text" class="form-input" id="titleInput" placeholder="Title">
                <label class="form-label" for="stationInput">Station</label>
                <input type="text" class="form-input" id="stationInput" placeholder="Station">
                <label class="form-label" for="tagsInput">Tags</label>
                <input type="text" class="form-input" id="tagsInput" placeholder="Tags (comma separated)">
                <label class="form-label" for="descriptionInput">Description</label>
                <textarea class="form-textarea" id="descriptionInput" placeholder="Description"></textarea>
                <button class="form-button" id="assignButton" style="margin-top: 15px;">Assign to Key</button>
            </div>
        </div>
    </div>
    <script>
        const CONFIG = {
            LIST_MEDIA_ENDPOINT: '/.netlify/functions/list-media',
            SEARCH_MEDIA_ENDPOINT: '/.netlify/functions/search-media',
            CLOUDINARY_ASSETS_ENDPOINT: '/.netlify/functions/LIst-assets',
            XANO_PROXY_ENDPOINT: '/.netlify/functions/xano-proxy',
            DEBOUNCE_MS: 300
        };
        const state = {
            mediaList: [],
            selectedMedia: null,
            keyAssignments: {},
            isConnected: false,
            currentAudio: null,
            currentVideo: null
        };
        const elements = {
            searchInput: document.getElementById('searchInput'),
            mediaTypeFilter: document.getElementById('mediaTypeFilter'),
            mediaBrowser: document.getElementById('mediaBrowser'),
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
            tagsInput: document.getElementById('tagsInput')
        };
        function showMessage(type, message) {
            const box = elements.messageBox;
            if (!box) return;
            box.textContent = message;
            // Use string concatenation to avoid nested template literals inside the surrounding template
            box.className = 'message ' + type;
            box.style.display = 'block';
            setTimeout(() => { box.style.display = 'none'; }, 5000);
        }
        function setConnectionStatus(connected) {
            state.isConnected = connected;
            const statusEl = elements.connectionStatus;
            const indicator = elements.statusIndicator;
            const text = elements.statusText;
            if (statusEl && indicator && text) {
                // Build classes without backtick interpolation to avoid breaking the outer template literal
                statusEl.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
                indicator.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');
                text.textContent = connected ? 'Connected' : 'Disconnected';
            }
        }
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }
        async function xanoRequest(endpoint, options = {}) {
            try {
                const response = await fetch(CONFIG.XANO_PROXY_ENDPOINT + endpoint, {
                    headers: { 'Content-Type': 'application/json' },
                    ...options
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                setConnectionStatus(true);
                return data;
            } catch (err) {
                console.error('Xano request error:', err);
                setConnectionStatus(false);
                showMessage('error', 'Could not connect to Xano: ' + err.message);
                return null;
            }
        }
        async function loadXanoMedia(query = '') {
            try {
                let endpoint = CONFIG.LIST_MEDIA_ENDPOINT;
                if (query) endpoint = CONFIG.SEARCH_MEDIA_ENDPOINT + '?q=' + encodeURIComponent(query);
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                let list = data.results ? data.results : (Array.isArray(data) ? data : []);
                return list.filter(item => item.file_size && item.file_size > 100 && (item.cloudinary_url || item.file_url || item.database_url))
                           .map(item => ({ ...item, source: 'xano' }));
            } catch (err) {
                console.error('Load Xano media error:', err);
                return [];
            }
        }
        async function loadCloudinaryAssets(query = '', type = '') {
            try {
                console.log('loadCloudinaryAssets called with query:', query, 'type:', type);
                let endpoint = CONFIG.LIST_MEDIA_ENDPOINT;
                if (query) endpoint = CONFIG.SEARCH_MEDIA_ENDPOINT + '?q=' + encodeURIComponent(query);
                console.log('Calling endpoint:', endpoint);
                const response = await fetch(endpoint);
                console.log('Response status:', response.status);
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                console.log('Raw response data:', data);
                let list = data.results ? data.results : (Array.isArray(data) ? data : []);
                console.log('Filtered list length:', list.length);
                console.log('Sample item:', JSON.stringify(list[0], null, 2));
                const filtered = list.filter(item => {
                    const hasUrl = item.attachment || item.media_url || item.cloudinary_url || item.file_url || item.database_url;
                    const hasSize = item.file_size && item.file_size > 100;
                    console.log('Filtering item:', item.id, 'file_size:', item.file_size, 'hasUrl:', !!hasUrl, 'attachment:', item.attachment);
                    return hasSize && hasUrl;
                });
                console.log('After filtering:', filtered.length, 'items');
                return filtered.map(item => {
                    const ext = (item.filename || '').split('.').pop()?.toLowerCase() || '';
                    let ftype = item.file_type || 'unknown';
                    if (ext === 'pdf') ftype = 'document-pdf';
                    else if (['doc','docx','ppt','pptx','xls','xlsx','odt','rtf','txt','csv'].includes(ext)) ftype = 'document-office';
                    else if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) ftype = 'image';
                    else if (['mp4','mov','avi','mkv','webm'].includes(ext)) ftype = 'video';
                    else if (['mp3','wav','ogg','m4a','flac'].includes(ext)) ftype = 'audio';
                    return {
                        id: item.id,
                        title: item.title || item.filename || item.display_name,
                        media_url: item.cloudinary_url || item.file_url || item.database_url,
                        attachment: item.cloudinary_url || item.file_url || item.database_url,
                        source: 'xano',
                        file_type: ftype,
                        file_ext: ext,
                        file_size: item.file_size,
                        cloudinary_data: item
                    };
                });
            } catch (err) {
                console.error('Load Cloudinary assets error:', err);
                return [];
            }
        }
        async function loadAllMedia(query = '', type = '') {
            console.log('loadAllMedia called with query:', query, 'type:', type);
            let xanoMedia = [];
            try {
                xanoMedia = await loadXanoMedia(query);
                console.log('Xano media loaded:', xanoMedia.length, 'items');
            } catch (e) {
                console.warn('Xano unreachable:', e);
            }
            const cloud = await loadCloudinaryAssets(query, type);
            console.log('Cloudinary media loaded:', cloud.length, 'items');
            const all = [...xanoMedia, ...cloud];
            console.log('Total media items:', all.length);
            state.mediaList = all;
            renderMediaBrowser();
            return all;
        }
        function formatFileSize(bytes) {
            if (!bytes) return '';
            const units = ['B','KB','MB','GB','TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024,i)).toFixed(1) + ' ' + units[i];
        }
        function getMediaThumbnail(item) {
            const mediaUrl = item.cloudinary_url || item.media_url || item.attachment;
            const type = (item.file_type || '').toLowerCase();
            const ext = (item.file_ext || '').toLowerCase();
            if (type === 'image' && mediaUrl) {
                const thumb = mediaUrl.includes('cloudinary.com') ? mediaUrl.replace('/upload/', '/upload/w_60,h_60,c_fill,f_auto,q_auto/') : mediaUrl;
                return '<img src="' + thumb + '" alt="' + (item.title || 'Image') + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=&quot;none&quot;; this.nextElementSibling.style.display=&quot;flex&quot;;">' +
                       '<div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:1.2rem;">🖼️</div>';
            }
            if (type === 'video') {
                const still = mediaUrl && mediaUrl.includes('cloudinary.com') ? mediaUrl.replace('/upload/', '/upload/so_0,w_60,h_60,c_fill,f_auto,q_auto/').replace(/\.(mp4|mov|avi|webm)$/i, '.jpg') : '';
                return still ? ('<img src="' + still + '" alt="' + (item.title || 'Video') + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=&quot;none&quot;; this.nextElementSibling.style.display=&quot;flex&quot;;">' +
                                 '<div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:1.2rem;">🎬</div>')
                             : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🎬</div>';
            }
            if ((type === 'document-pdf' || ext === 'pdf') && mediaUrl && mediaUrl.includes('cloudinary.com')) {
                const thumb = mediaUrl.replace('/upload/', '/upload/w_60,h_60,c_fill,f_auto,q_auto,pg_1/');
                return '<img src="' + thumb + '" alt="' + (item.title || 'PDF') + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=&quot;none&quot;; this.nextElementSibling.style.display=&quot;flex&quot;;">' +
                       '<div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:1.2rem;">📄</div>';
            }
            if (type === 'document-office' || type === 'document') {
                return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">📃</div>';
            }
            return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">📁</div>';
        }
        function renderMediaBrowser() {
            const container = elements.mediaBrowser;
            if (!container) return;
            if (!state.mediaList || state.mediaList.length === 0) {
                container.innerHTML = '<div style="padding:12px;color:var(--text-secondary);">No media found</div>';
                return;
            }
            container.innerHTML = state.mediaList.map(item => {
                const thumb = getMediaThumbnail(item);
                const title = item.title || item.filename || item.display_name || 'Untitled';
                const meta = (item.station || item.source || 'Unknown') + ' • ' + (item.file_type || 'Media') + (item.file_size ? (' • ' + formatFileSize(item.file_size)) : '');
                // Build markup without using backtick template strings
                return '<div class="media-item" data-id="' + item.id + '" data-source="' + item.source + '">' +
                       '<div class="media-icon" style="width:60px;height:60px;border-radius:4px;overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">' +
                       thumb +
                       '</div>' +
                       '<div class="media-info">' +
                       '<div class="media-title">' + title + '</div>' +
                       '<div class="media-meta">' + meta + '</div>' +
                       '</div>' +
                       '</div>';
            }).join('');
            container.querySelectorAll('.media-item').forEach(el => {
                el.addEventListener('click', () => {
                    const source = el.dataset.source;
                    const id = el.dataset.id;
                    if (source === 'cloudinary') selectCloudinaryAsset(id);
                    else selectMedia(parseInt(id));
                });
            });
        }
        function selectCloudinaryAsset(id) {
            const item = state.mediaList.find(m => m.id === id && m.source === 'cloudinary');
            if (item) {
                state.selectedMedia = item;
                updatePreview(item);
                updateMetadataForm(item);
            }
        }
        function selectMedia(id) {
            const item = state.mediaList.find(m => m.id === id && m.source === 'xano');
            if (item) {
                state.selectedMedia = item;
                updatePreview(item);
                updateMetadataForm(item);
            }
        }
        function updateMetadataForm(media) {
            elements.titleInput.value = media.title || '';
            elements.stationInput.value = media.station || '';
            elements.tagsInput.value = media.tags || '';
            elements.descriptionInput.value = media.description || '';
        }
        function updatePreview(media) {
            const preview = elements.previewContent;
            preview.innerHTML = '';
            if (!media) return;
            const mediaUrl = media.attachment || media.media_url || media.cloudinary_url;
            const type = media.file_type;
            const title = media.title || '';
            console.log('updatePreview called with media:', title, 'mediaUrl:', mediaUrl, 'type:', type);
            if (!mediaUrl) {
                preview.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No preview available - missing media URL</div>';
                return;
            }
            // Build header using concatenation to avoid nested template literals
            const header = '<div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Preview: ' + title + '</div>';
            let node;
            if (type === 'audio') {
                node = document.createElement('audio');
                node.controls = true;
                node.src = mediaUrl;
                node.style.width = '100%';
            } else if (type === 'video') {
                node = document.createElement('video');
                node.controls = true;
                node.src = mediaUrl;
                node.style.width = '100%';
                node.style.maxHeight = '520px';
            } else if (type === 'image') {
                node = document.createElement('img');
                node.src = mediaUrl;
                node.style.width = '100%';
                node.style.maxHeight = '520px';
                node.style.objectFit = 'contain';
            } else if (type === 'document-pdf' || (media.filename && media.filename.match(/\.pdf$/i))) {
                node = document.createElement('img');
                if (mediaUrl.includes('cloudinary.com')) {
                    node.src = mediaUrl.replace('/upload/', '/upload/w_600,h_800,c_fit,f_jpg,pg_1/');
                } else {
                    node.src = mediaUrl;
                }
                node.style.width = '100%';
                node.style.maxHeight = '520px';
                node.style.objectFit = 'contain';
                node.style.border = '1px solid var(--bg-tertiary)';
                node.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.textAlign = 'center';
                    fallback.style.padding = '20px';
                    fallback.style.color = 'var(--text-secondary)';
                    fallback.textContent = 'PDF preview not available';
                    this.parentNode.appendChild(fallback);
                };
            } else if (type === 'document-office' || type === 'document' || (media.filename && media.filename.match(/\.(docx?|xlsx?|pptx?)$/i))) {
                node = document.createElement('img');
                if (mediaUrl.includes('cloudinary.com')) {
                    node.src = mediaUrl.replace('/upload/', '/upload/w_600,h_800,c_fit,f_jpg,pg_1/');
                } else {
                    node.src = mediaUrl;
                }
                node.style.width = '100%';
                node.style.maxHeight = '520px';
                node.style.objectFit = 'contain';
                node.style.border = '1px solid var(--bg-tertiary)';
                node.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.textAlign = 'center';
                    fallback.style.padding = '20px';
                    fallback.style.color = 'var(--text-secondary)';
                    fallback.textContent = 'Document preview not available';
                    this.parentNode.appendChild(fallback);
                };
            } else {
                node = document.createElement('a');
                node.href = mediaUrl;
                node.target = '_blank';
                node.textContent = 'Open File';
                node.className = 'form-button';
            }
            preview.innerHTML = header;
            preview.appendChild(node);
        }
        function assignMediaToKey(keyNumber, media) {
            if (!keyNumber || !media) return;
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
        function renderAssignments() {
            const list = elements.assignmentsList;
            const entries = Object.entries(state.keyAssignments);
            if (!entries.length) {
                list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">No assignments yet</p>';
                return;
            }
            list.innerHTML = entries.map(([k, v]) => {
                // Build assignment card using concatenation
                return '<div class="assignment-item" style="padding:10px;border:1px solid var(--bg-tertiary);border-radius:4px;margin-bottom:8px;">' +
                       '<div style="font-weight:bold;color:var(--accent);">Key ' + k + '</div>' +
                       '<div style="color:var(--text-primary);">' + v.title + '</div>' +
                       '<div style="color:var(--text-secondary);font-size:12px;">' + (v.file_type || 'Media') + '</div>' +
                       '</div>';
            }).join('');
        }
        function updateKeyButtons() {
            for (let i = 1; i <= 5; i++) {
                const btn = document.getElementById('key' + i);
                const assignment = state.keyAssignments[i];
                if (!btn) continue;
                if (assignment) {
                    btn.classList.add('assigned');
                    // build button label with string concatenation
                    btn.textContent = 'KEY ' + i + ' • ' + assignment.title;
                } else {
                    btn.classList.remove('assigned');
                    btn.textContent = 'KEY ' + i;
                }
            }
        }
        function setupKeyButtons() {
            for (let i = 1; i <= 5; i++) {
                const btn = document.getElementById('key' + i);
                if (!btn) continue;
                btn.addEventListener('click', () => {
                    const assign = state.keyAssignments[i];
                    if (assign && assign.media_url) {
                        playMedia(assign.media_url, assign.file_type, assign.title);
                    } else {
                        // Avoid backtick interpolation within outer template
                        showMessage('info', 'Key ' + i + ' has no assignment');
                    }
                });
            }
            const stopBtn = document.getElementById('stopButton');
            if (stopBtn) stopBtn.addEventListener('click', () => stopAllMedia());
        }
        function playMedia(mediaUrl, type, title) {
            stopAllMedia();
            let container = document.getElementById('playerMediaContainer');
            if (!container) {
                const section = document.querySelector('.player-section');
                container = document.createElement('div');
                container.id = 'playerMediaContainer';
                container.style.margin = '15px 0';
                container.style.padding = '10px';
                container.style.background = 'var(--bg-secondary)';
                container.style.borderRadius = '8px';
                container.style.border = '1px solid var(--bg-tertiary)';
                section.insertBefore(container, document.getElementById('stopButton').nextSibling);
            }
            const header = '<div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">Now Playing: ' + title + '</div>';
            let el;
            if (type === 'audio') {
                el = new Audio(mediaUrl);
                el.controls = true;
                el.style.width = '100%';
                el.play();
                state.currentAudio = el;
                showMessage('success', 'Playing: ' + title);
            } else if (type === 'video') {
                el = document.createElement('video');
                el.controls = true;
                el.src = mediaUrl;
                el.style.width = '100%';
                el.style.maxHeight = '300px';
                el.play();
                state.currentVideo = el;
                showMessage('success', 'Playing video: ' + title);
            } else if (type === 'image') {
                el = document.createElement('img');
                el.src = mediaUrl;
                el.style.width = '100%';
                el.style.maxHeight = '400px';
                el.style.objectFit = 'contain';
                showMessage('success', 'Displaying image: ' + title);
            } else if (type === 'document-pdf') {
                el = document.createElement('img');
                if (mediaUrl.includes('cloudinary.com')) {
                    el.src = mediaUrl.replace('/upload/', '/upload/w_600,h_800,c_fit,f_jpg,pg_1/');
                } else {
                    el.src = mediaUrl;
                }
                el.style.width = '100%';
                el.style.maxHeight = '400px';
                el.style.objectFit = 'contain';
                el.style.border = '1px solid var(--bg-tertiary)';
                el.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.textAlign = 'center';
                    fallback.style.padding = '20px';
                    fallback.style.color = 'var(--text-secondary)';
                    fallback.textContent = 'PDF preview not available';
                    this.parentNode.appendChild(fallback);
                };
                showMessage('success', 'Displaying PDF: ' + title);
            } else if (type === 'document-office' || type === 'document') {
                el = document.createElement('img');
                if (mediaUrl.includes('cloudinary.com')) {
                    el.src = mediaUrl.replace('/upload/', '/upload/w_600,h_800,c_fit,f_jpg,pg_1/');
                } else {
                    el.src = mediaUrl;
                }
                el.style.width = '100%';
                el.style.maxHeight = '400px';
                el.style.objectFit = 'contain';
                el.style.border = '1px solid var(--bg-tertiary)';
                el.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.textAlign = 'center';
                    fallback.style.padding = '20px';
                    fallback.style.color = 'var(--text-secondary)';
                    fallback.textContent = 'Document preview not available';
                    this.parentNode.appendChild(fallback);
                };
                showMessage('success', 'Displaying document: ' + title);
            } else {
                el = document.createElement('a');
                el.href = mediaUrl;
                el.target = '_blank';
                el.textContent = 'Open File';
                el.className = 'form-button';
                showMessage('success', 'Displaying: ' + title);
            }
            container.innerHTML = header;
            if (el) container.appendChild(el);
        }
        function stopAllMedia() {
            if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
            if (state.currentVideo) { state.currentVideo.pause(); state.currentVideo = null; }
            const container = document.getElementById('playerMediaContainer');
            if (container) container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No media playing</div>';
        }
        window.playSelectedMedia = function() {
            const media = elements.previewContent.querySelector('audio, video');
            if (media) {
                media.play().catch(err => {
                    console.log('Autoplay blocked', err);
                    showMessage('info', 'Click the media player to start playback');
                });
            }
        };
        window.stopPreview = function() {
            const media = elements.previewContent.querySelector('audio, video');
            if (media) {
                media.pause();
                media.currentTime = 0;
            }
        };
        window.openFullPreview = function() {
            if (state.selectedMedia) {
                const url = state.selectedMedia.cloudinary_url || state.selectedMedia.media_url || state.selectedMedia.attachment;
                if (url) window.open(url, '_blank');
            }
        };
        function initialize() {
            console.log('VoxPro Manager initializing with enhanced document support...');
            setupKeyButtons();
            if (elements.searchInput) {
                const debounced = debounce(e => {
                    const q = e.target.value.trim();
                    const t = elements.mediaTypeFilter.value || '';
                    loadAllMedia(q, t);
                }, CONFIG.DEBOUNCE_MS);
                elements.searchInput.addEventListener('input', debounced);
            }
            if (elements.mediaTypeFilter) {
                elements.mediaTypeFilter.addEventListener('change', e => {
                    const q = elements.searchInput.value.trim() || '';
                    const t = e.target.value;
                    loadAllMedia(q, t);
                });
            }
            loadAllMedia().then(() => {
                // assignments could be loaded here in future
            });
            const assignBtn = document.getElementById('assignButton');
            if (assignBtn) {
                assignBtn.addEventListener('click', () => {
                    const keyNum = elements.keySelect.value;
                    if (keyNum && state.selectedMedia) {
                        assignMediaToKey(keyNum, state.selectedMedia);
                        // Use concatenation for the success message
                        showMessage('success', 'Media assigned to Key ' + keyNum);
                    } else {
                        showMessage('error', 'Please select a key and media');
                    }
                });
            }
        }
        document.addEventListener('DOMContentLoaded', initialize);
    </script>
</body>
</html>`;
    return { statusCode: 200, headers, body: html };
};
