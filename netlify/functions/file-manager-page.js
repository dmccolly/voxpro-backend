// Simple Netlify File Manager Function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Netlify File Manager</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a87; }
        .success { color: green; margin: 10px 0; }
        .error { color: red; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Netlify File Manager</h1>
    <form id="uploadForm" enctype="multipart/form-data">
        <div class="form-group">
            <label>Select File:</label>
            <input type="file" id="file" name="file" required>
        </div>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="title" name="title" required>
        </div>
        <div class="form-group">
            <label>Description:</label>
            <textarea id="description" name="description"></textarea>
        </div>
        <div class="form-group">
            <label>Station:</label>
            <input type="text" id="station" name="station">
        </div>
        <div class="form-group">
            <label>Tags:</label>
            <input type="text" id="tags" name="tags" placeholder="comma, separated, tags">
        </div>
        <div class="form-group">
            <label>Submitted By:</label>
            <input type="text" id="submitted_by" name="submitted_by">
        </div>
        <button type="submit">Upload to Xano</button>
    </form>
    <div id="result"></div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            const fileInput = document.getElementById('file');
            const file = fileInput.files[0];
            
            if (!file) {
                document.getElementById('result').innerHTML = '<div class="error">Please select a file</div>';
                return;
            }
            
            // Add form data
            formData.append('file', file);
            formData.append('title', document.getElementById('title').value);
            formData.append('description', document.getElementById('description').value);
            formData.append('station', document.getElementById('station').value);
            formData.append('tags', document.getElementById('tags').value);
            formData.append('submitted_by', document.getElementById('submitted_by').value);
            
            try {
                document.getElementById('result').innerHTML = '<div>Uploading...</div>';
                
                const response = await fetch('/.netlify/functions/file-manager-upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('result').innerHTML = '<div class="success">Upload successful! File should now appear in VoxPro search.</div>';
                    document.getElementById('uploadForm').reset();
                } else {
                    document.getElementById('result').innerHTML = '<div class="error">Upload failed: ' + result.error + '</div>';
                }
            } catch (error) {
                document.getElementById('result').innerHTML = '<div class="error">Upload error: ' + error.message + '</div>';
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

