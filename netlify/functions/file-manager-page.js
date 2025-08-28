// netlify/functions/file-manager-page.js
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .form-container {
            padding: 40px;
        }
        
        .form-group {
            margin-bottom: 25px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
            font-size: 0.95em;
        }
        
        .form-group label.required::after {
            content: ' *';
            color: #e74c3c;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            font-size: 1em;
            transition: all 0.3s ease;
            background-color: #fafbfc;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
            background-color: white;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .form-group input[type="file"] {
            padding: 10px;
            background-color: white;
            cursor: pointer;
        }
        
        .upload-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 1.1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
            margin-top: 20px;
        }
        
        .upload-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .upload-btn:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }
        
        .back-link:hover {
            color: #764ba2;
        }
        
        .progress-container {
            margin-top: 20px;
            display: none;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background-color: #e1e8ed;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .progress-text {
            text-align: center;
            margin-top: 10px;
            font-weight: 500;
            color: #333;
        }
        
        .message {
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }
        
        .success-message {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .error-message {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .form-row {
            display: flex;
            gap: 20px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        @media (max-width: 768px) {
            .form-row {
                flex-direction: column;
                gap: 0;
            }
            
            .container {
                margin: 10px;
                border-radius: 10px;
            }
            
            .form-container {
                padding: 20px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Idaho Broadcasting Media Upload</h1>
            <p>Upload media files to the VoxPro system</p>
        </div>
        
        <div class="form-container">
            <form id="uploadForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label for="mediaFile" class="required">Select Media File:</label>
                    <input type="file" id="mediaFile" name="mediaFile" accept="audio/*,video/*,image/*,.pdf,.doc,.docx" required>
                </div>
                
                <div class="form-group">
                    <label for="title" class="required">Title:</label>
                    <input type="text" id="title" name="title" placeholder="Enter media title" required>
                </div>
                
                <div class="form-group">
                    <label for="description">Description:</label>
                    <textarea id="description" name="description" placeholder="Enter media description"></textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category">
                            <option value="">Select category</option>
                            <option value="Audio">Audio</option>
                            <option value="Video">Video</option>
                            <option value="Photo">Photo</option>
                            <option value="Document">Document</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="priority">Priority:</label>
                        <select id="priority" name="priority">
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="submittedBy">Submitted By:</label>
                        <input type="text" id="submittedBy" name="submittedBy" placeholder="Your name">
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
                </div>
                
                <div class="form-group">
                    <label for="tags">Tags:</label>
                    <input type="text" id="tags" name="tags" placeholder="Enter tags separated by commas">
                </div>
                
                <div class="form-group">
                    <label for="notes">Notes:</label>
                    <textarea id="notes" name="notes" placeholder="Additional notes or comments"></textarea>
                </div>
                
                <button type="submit" class="upload-btn" id="uploadBtn">Upload Media</button>
                
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">Uploading... 0%</div>
                </div>
                
                <div class="message success-message" id="successMessage"></div>
                <div class="message error-message" id="errorMessage"></div>
                
                <a href="/" class="back-link">← Back to VoxPro Manager</a>
            </form>
        </div>
    </div>

    <script>
        const uploadForm = document.getElementById('uploadForm');
        const uploadBtn = document.getElementById('uploadBtn');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const successMessage = document.getElementById('successMessage');
        const errorMessage = document.getElementById('errorMessage');

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(uploadForm);
            const fileInput = document.getElementById('mediaFile');
            
            if (!fileInput.files[0]) {
                showError('Please select a file to upload.');
                return;
            }
            
            if (!formData.get('title').trim()) {
                showError('Please enter a title for the media.');
                return;
            }
            
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            progressContainer.style.display = 'block';
            hideMessages();
            
            try {
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        progressFill.style.width = percentComplete + '%';
                        progressText.textContent = \`Uploading... \${percentComplete}%\`;
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.success) {
                                showSuccess('File uploaded successfully!');
                                uploadForm.reset();
                            } else {
                                showError(response.error || 'Upload failed. Please try again.');
                            }
                        } catch (e) {
                            showError('Upload completed but response was invalid. Please check if the file was uploaded.');
                        }
                    } else {
                        showError(\`Upload failed with status: \${xhr.status}\`);
                    }
                    
                    resetUploadState();
                });
                
                xhr.addEventListener('error', () => {
                    showError('Network error occurred during upload.');
                    resetUploadState();
                });
                
                xhr.open('POST', '/.netlify/functions/file-manager-upload');
                xhr.send(formData);
                
            } catch (error) {
                console.error('Upload error:', error);
                showError('An error occurred during upload: ' + error.message);
                resetUploadState();
            }
        });
        
        function resetUploadState() {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Media';
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            progressText.textContent = 'Uploading... 0%';
        }
        
        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }
        
        function hideMessages() {
            successMessage.style.display = 'none';
            errorMessage.style.display = 'none';
        }
    </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers,
    body: html
  };
};

