// Netlify File Manager - HTML Page Function
// Serves the upload form interface

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'text/html'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Idaho Broadcasting Media Upload</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        input, select, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
        }
        textarea {
            height: 100px;
            resize: vertical;
        }
        .upload-btn {
            background-color: #4CAF50;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 18px;
            width: 100%;
            margin-top: 20px;
        }
        .upload-btn:hover {
            background-color: #45a049;
        }
        .upload-btn:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .message {
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            display: none;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .file-info {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        .progress {
            width: 100%;
            height: 20px;
            background-color: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
            display: none;
        }
        .progress-bar {
            height: 100%;
            background-color: #4CAF50;
            width: 0%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Idaho Broadcasting Media Upload</h1>
        
        <div id="message" class="message"></div>
        
        <form id="uploadForm" enctype="multipart/form-data">
            <div class="form-group">
                <label for="file">Select Media File:</label>
                <input type="file" id="file" name="file" required 
                       accept=".png,.jpg,.jpeg,.gif,.mp4,.mov,.avi,.mp3,.wav,.pdf,.doc,.docx,.mkv,.wmv,.flv">
                <div class="file-info">
                    Maximum file size: 250MB<br>
                    Allowed formats: Images (PNG, JPG, GIF), Videos (MP4, MOV, AVI, MKV, WMV, FLV), Audio (MP3, WAV), Documents (PDF, DOC, DOCX)
                </div>
            </div>

            <div class="form-group">
                <label for="title">Title:</label>
                <input type="text" id="title" name="title" required>
            </div>

            <div class="form-group">
                <label for="description">Description:</label>
                <textarea id="description" name="description" placeholder="Describe the media content..."></textarea>
            </div>

            <div class="form-group">
                <label for="category">Category:</label>
                <select id="category" name="category">
                    <option value="Photo">Photo</option>
                    <option value="Video">Video</option>
                    <option value="Audio">Audio</option>
                    <option value="Document">Document</option>
                    <option value="Other">Other</option>
                </select>
            </div>

            <div class="form-group">
                <label for="submitted_by">Submitted By:</label>
                <input type="text" id="submitted_by" name="submitted_by" placeholder="Your name">
            </div>

            <div class="form-group">
                <label for="station">Station:</label>
                <select id="station" name="station">
                    <option value="">Select station</option>
                    <option value="KIVI">KIVI</option>
                    <option value="KNIN">KNIN</option>
                    <option value="KGEM">KGEM</option>
                    <option value="Other">Other</option>
                </select>
            </div>

            <div class="form-group">
                <label for="tags">Tags:</label>
                <input type="text" id="tags" name="tags" placeholder="Comma-separated tags (e.g., news, sports, weather)">
            </div>

            <div class="form-group">
                <label for="priority">Priority:</label>
                <select id="priority" name="priority">
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Low">Low</option>
                </select>
            </div>

            <div class="form-group">
                <label for="notes">Notes:</label>
                <textarea id="notes" name="notes" placeholder="Additional notes or comments..."></textarea>
            </div>

            <div class="progress" id="progress">
                <div class="progress-bar" id="progressBar"></div>
            </div>

            <button type="submit" class="upload-btn" id="uploadBtn">Upload Media</button>
        </form>
    </div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const uploadBtn = document.getElementById('uploadBtn');
            const message = document.getElementById('message');
            const progress = document.getElementById('progress');
            const progressBar = document.getElementById('progressBar');
            
            // Validate file
            const fileInput = document.getElementById('file');
            const file = fileInput.files[0];
            
            if (!file) {
                showMessage('Please select a file to upload.', 'error');
                return;
            }
            
            // Check file size (250MB limit)
            const maxSize = 250 * 1024 * 1024;
            if (file.size > maxSize) {
                showMessage('File is too large. Maximum size is 250MB.', 'error');
                return;
            }
            
            // Show progress and disable button
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            progress.style.display = 'block';
            progressBar.style.width = '0%';
            
            try {
                // Simulate progress (since we can't track real progress with fetch)
                let progressValue = 0;
                const progressInterval = setInterval(() => {
                    progressValue += Math.random() * 30;
                    if (progressValue > 90) progressValue = 90;
                    progressBar.style.width = progressValue + '%';
                }, 500);
                
                const response = await fetch('/.netlify/functions/file-manager-upload', {
                    method: 'POST',
                    body: formData
                });
                
                clearInterval(progressInterval);
                progressBar.style.width = '100%';
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    showMessage('File uploaded successfully! It should now appear in VoxPro search.', 'success');
                    document.getElementById('uploadForm').reset();
                } else {
                    showMessage('Upload failed: ' + (result.error || 'Unknown error'), 'error');
                }
                
            } catch (error) {
                showMessage('Upload failed: ' + error.message, 'error');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Media';
                setTimeout(() => {
                    progress.style.display = 'none';
                }, 2000);
            }
        });
        
        function showMessage(text, type) {
            const message = document.getElementById('message');
            message.textContent = text;
            message.className = 'message ' + type;
            message.style.display = 'block';
            
            // Auto-hide success messages
            if (type === 'success') {
                setTimeout(() => {
                    message.style.display = 'none';
                }, 5000);
            }
        }
        
        // File size validation on selection
        document.getElementById('file').addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const maxSize = 250 * 1024 * 1024;
                if (file.size > maxSize) {
                    showMessage('Selected file is too large. Maximum size is 250MB.', 'error');
                    this.value = '';
                }
            }
        });
    </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers,
    body: html
  };
};

