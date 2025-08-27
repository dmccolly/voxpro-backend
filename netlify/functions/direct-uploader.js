// netlify/functions/direct-uploader.js
const https = require('https');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // For GET requests, return the HTML form
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
<!DOCTYPE html>
<html>
<head>
    <title>Direct Upload to Xano</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f7fa; }
        h1 { color: #3498db; text-align: center; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #3498db; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
        .file-info { background: #f0f8ff; padding: 10px; border-radius: 4px; margin-top: 10px; display: none; }
        .message { padding: 10px; margin-bottom: 15px; border-radius: 4px; display: none; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .back-link { display: block; margin-top: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Idaho Broadcasting Media Upload</h1>
        
        <div id="message" class="message"></div>
        
        <form id="uploadForm">
            <div class="form-group">
                <label for="file">Select Media File:</label>
                <input type="file" id="file" required>
                <div id="fileInfo" class="file-info"></div>
            </div>
            
            <div class="form-group">
                <label for="title">Title:</label>
                <input type="text" id="title" required placeholder="Enter title">
            </div>
            
            <div class="form-group">
                <label for="description">Description:</label>
                <textarea id="description" rows="4" placeholder="Enter description"></textarea>
            </div>
            
            <div class="form-group">
                <label for="station">Station:</label>
                <select id="station">
                    <option value="">Select station</option>
                    <option value="KIVI">KIVI</option>
                    <option value="KNIN">KNIN</option>
                    <option value="KGEM">KGEM</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="submittedBy">Submitted By:</label>
                <input type="text" id="submittedBy" placeholder="Your name">
            </div>
            
            <div class="form-group">
                <label for="tags">Tags:</label>
                <input type="text" id="tags" placeholder="Enter tags (comma separated)">
            </div>
            
            <button type="submit">Upload Media</button>
        </form>
        
        <a href="/voxpro-manager" class="back-link">← Back to VoxPro Manager</a>
    </div>

    <script>
        const form = document.getElementById('uploadForm');
        const fileInput = document.getElementById('file');
        const fileInfo = document.getElementById('fileInfo');
        const messageDiv = document.getElementById('message');
        
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                fileInfo.innerHTML = \`
                    <strong>File:</strong> \${file.name}<br>
                    <strong>Size:</strong> \${(file.size / 1024 / 1024).toFixed(2)} MB<br>
                    <strong>Type:</strong> \${file.type || 'Unknown'}
                \`;
                fileInfo.style.display = 'block';
            } else {
                fileInfo.style.display = 'none';
            }
        });
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const file = fileInput.files[0];
            if (!file) {
                showMessage('Please select a file', 'error');
                return;
            }
            
            const submitButton = form.querySelector('button');
            submitButton.disabled = true;
            submitButton.textContent = 'Uploading...';
            
            try {
                // Read file as base64
                const base64 = await readFileAsBase64(file);
                
                // Prepare data
                const data = {
                    title: document.getElementById('title').value,
                    description: document.getElementById('description').value,
                    station: document.getElementById('station').value,
                    submitted_by: document.getElementById('submittedBy').value,
                    tags: document.getElementById('tags').value,
                    filename: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    file_data: base64
                };
                
                // Send to this same function with POST
                const response = await fetch('/.netlify/functions/direct-uploader', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage('Upload successful!', 'success');
                    form.reset();
                    fileInfo.style.display = 'none';
                } else {
                    showMessage(result.error || 'Upload failed', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Upload failed: ' + error.message, 'error');
            }
            
            submitButton.disabled = false;
            submitButton.textContent = 'Upload Media';
        });
        
        function readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        function showMessage(text, type) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
            
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
    </script>
</body>
</html>
      `
    };
  }

  // For POST requests, send data to Xano
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body);
      
      // Forward to Xano
      const xanoResponse = await new Promise((resolve, reject) => {
        const xanoUrl = 'https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV/voxpro';
        
        const req = https.request(xanoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(responseData));
              } catch (e) {
                resolve({ success: true, message: 'Upload successful' });
              }
            } else {
              reject(new Error(`Xano returned status code ${res.statusCode}: ${responseData}`));
            }
          });
        });
        
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
      });
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: xanoResponse })
      };
    } catch (error) {
      console.error('Upload error:', error);
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: error.message })
      };
    }
  }

  // Default response for other HTTP methods
  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
