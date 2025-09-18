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

    <script src="/assets/voxpro-manager.js"></script>
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

