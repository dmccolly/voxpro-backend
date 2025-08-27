// netlify/functions/simple-uploader.js
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    },
    body: `
<!DOCTYPE html>
<html>
<head>
    <title>Direct Xano Upload</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; text-align: center; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-weight: bold; margin-bottom: 5px; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
        .message { padding: 10px; margin: 20px 0; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .navigation { margin-top: 20px; }
        .navigation a { color: #3498db; text-decoration: none; }
        .navigation a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Direct Xano Upload</h1>
    
    <div id="message" style="display: none;"></div>
    
    <form id="uploadForm">
        <div class="form-group">
            <label for="title">Title (required):</label>
            <input type="text" id="title" name="title" required>
        </div>
        
        <div class="form-group">
            <label for="description">Description:</label>
            <textarea id="description" name="description"></textarea>
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
            <input type="text" id="tags" name="tags" placeholder="Enter tags">
        </div>
        
        <button type="submit">Create Test Record in Xano</button>
    </form>
    
    <div class="navigation">
        <a href="/voxpro-manager">← Back to VoxPro Manager</a>
    </div>

    <script>
        // Form submission handler
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const messageDiv = document.getElementById('message');
            messageDiv.style.display = 'none';
            messageDiv.className = '';
            
            const submitButton = this.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Uploading...';
            
            try {
                // Prepare data for Xano
                const data = {
                    title: document.getElementById('title').value,
                    description: document.getElementById('description').value,
                    station: document.getElementById('station').value,
                    tags: document.getElementById('tags').value,
                    filename: 'test-direct-upload.txt',
                    file_type: 'text/plain',
                    file_size: 0,
                    upload_date: new Date().toISOString()
                };
                
                console.log('Sending data to Xano:', data);
                
                // Direct POST to Xano
                const response = await fetch('https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV/voxpro', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                console.log('Response status:', response.status);
                
                // Get response text
                const responseText = await response.text();
                console.log('Response text:', responseText);
                
                // Try to parse as JSON
                let result;
                try {
                    result = JSON.parse(responseText);
                    console.log('Parsed result:', result);
                } catch (e) {
                    console.error('Failed to parse response as JSON:', e);
                }
                
                if (response.ok) {
                    messageDiv.textContent = 'Success! Test record created in Xano.';
                    messageDiv.className = 'message success';
                    document.getElementById('uploadForm').reset();
                } else {
                    const errorMsg = result?.error || 'Upload failed with status: ' + response.status;
                    messageDiv.textContent = errorMsg;
                    messageDiv.className = 'message error';
                }
            } catch (error) {
                console.error('Error:', error);
                messageDiv.textContent = 'Error: ' + error.message;
                messageDiv.className = 'message error';
            } finally {
                messageDiv.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = 'Create Test Record in Xano';
            }
        });
    </script>
</body>
</html>
    `
  };
};
