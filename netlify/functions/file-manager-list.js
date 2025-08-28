const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

// Function to make HTTPS requests to Xano
const makeXanoRequest = (method, endpoint, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'xajo-bs7d-cagt.n7e.xano.io',
      path: `/api:pYeQctVX/${endpoint}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XANO_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
};

const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VoxPro File Manager</title>
    <style>
        body {
            margin: 0;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Inter, Arial, sans-serif;
            background: linear-gradient(135deg, #1e3c72, #2a5298);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .back-link {
            color: #fff;
            text-decoration: none;
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            font-weight: 600;
        }
        .back-link:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }
        .file-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }
        .file-card:hover {
            transform: translateY(-2px);
        }
        .file-title {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 10px 0;
            color: #1f2937;
        }
        .file-meta {
            color: #6b7280;
            font-size: 14px;
            margin: 5px 0;
        }
        .file-description {
            color: #374151;
            margin: 10px 0;
            line-height: 1.4;
        }
        .file-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-size: 14px;
        }
        .btn-view {
            background: #3b82f6;
            color: white;
        }
        .btn-delete {
            background: #ef4444;
            color: white;
        }
        .btn:hover {
            opacity: 0.9;
        }
        .loading {
            text-align: center;
            color: white;
            font-size: 18px;
            margin: 50px 0;
        }
        .error {
            background: #fef2f2;
            color: #7f1d1d;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #fecaca;
        }
        .success {
            background: #ecfdf5;
            color: #065f46;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #bbf7d0;
        }
        .empty-state {
            text-align: center;
            color: white;
            margin: 50px 0;
        }
        .empty-state h2 {
            font-size: 24px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VoxPro File Manager</h1>
            <a href="/voxpro-manager" class="back-link">← Back to VoxPro Manager</a>
        </div>
        
        <div id="message"></div>
        <div id="loading" class="loading">Loading files...</div>
        <div id="file-list" class="file-grid" style="display: none;"></div>
        <div id="empty-state" class="empty-state" style="display: none;">
            <h2>No files found</h2>
            <p>Upload some files to get started!</p>
        </div>
    </div>

    <script>
        const API_BASE = '/.netlify/functions';
        
        function showMessage(text, type = 'error') {
            const messageDiv = document.getElementById('message');
            messageDiv.innerHTML = \`<div class="\${type}">\${text}</div>\`;
            setTimeout(() => messageDiv.innerHTML = '', 5000);
        }
        
        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        function formatFileSize(bytes) {
            if (!bytes) return 'Unknown size';
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        }
        
        async function loadFiles() {
            try {
                const response = await fetch(\`\${API_BASE}/list-media\`);
                const data = await response.json();
                
                document.getElementById('loading').style.display = 'none';
                
                if (!data || data.length === 0) {
                    document.getElementById('empty-state').style.display = 'block';
                    return;
                }
                
                const fileList = document.getElementById('file-list');
                fileList.style.display = 'grid';
                
                fileList.innerHTML = data.map(file => \`
                    <div class="file-card" data-id="\${file.id}">
                        <div class="file-title">\${file.title || 'Untitled'}</div>
                        <div class="file-meta">
                            <strong>Type:</strong> \${file.category || 'Unknown'} | 
                            <strong>Size:</strong> \${formatFileSize(file.file_size)}
                        </div>
                        <div class="file-meta">
                            <strong>Uploaded:</strong> \${formatDate(file.created_at)} by \${file.submitted_by || 'Unknown'}
                        </div>
                        \${file.station ? \`<div class="file-meta"><strong>Station:</strong> \${file.station}</div>\` : ''}
                        \${file.description ? \`<div class="file-description">\${file.description}</div>\` : ''}
                        \${file.tags ? \`<div class="file-meta"><strong>Tags:</strong> \${file.tags}</div>\` : ''}
                        <div class="file-actions">
                            \${file.cloudinary_url ? \`<a href="\${file.cloudinary_url}" target="_blank" class="btn btn-view">View File</a>\` : ''}
                            <button onclick="deleteFile(\${file.id}, '\${file.title || 'this file'}')" class="btn btn-delete">Delete</button>
                        </div>
                    </div>
                \`).join('');
                
            } catch (error) {
                document.getElementById('loading').style.display = 'none';
                showMessage('Failed to load files: ' + error.message);
            }
        }
        
        async function deleteFile(fileId, fileName) {
            if (!confirm(\`Are you sure you want to delete "\${fileName}"? This action cannot be undone.\`)) {
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/delete-media\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: fileId })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage(\`"\${fileName}" has been deleted successfully.\`, 'success');
                    // Remove the file card from the UI
                    const fileCard = document.querySelector(\`[data-id="\${fileId}"]\`);
                    if (fileCard) {
                        fileCard.remove();
                    }
                    
                    // Check if no files left
                    const remainingCards = document.querySelectorAll('.file-card');
                    if (remainingCards.length === 0) {
                        document.getElementById('file-list').style.display = 'none';
                        document.getElementById('empty-state').style.display = 'block';
                    }
                } else {
                    showMessage(result.error || 'Failed to delete file');
                }
            } catch (error) {
                showMessage('Failed to delete file: ' + error.message);
            }
        }
        
        // Load files when page loads
        loadFiles();
    </script>
</body>
</html>`;

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

  return {
    statusCode: 200,
    headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' },
    body: htmlPage
  };
};

