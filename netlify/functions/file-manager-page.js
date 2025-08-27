// netlify/functions/file-manager-page.js
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
    <title>Simple File Upload</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input, textarea { width: 100%; padding: 8px; }
        button { padding: 10px 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        .alert { padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .alert-success { background-color: #dff0d8; color: #3c763d; }
        .alert-danger { background-color: #f2dede; color: #a94442; }
    </style>
</head>
<body>
    <h1>Simple File Upload</h1>
    
    <div id="message" style="display: none;"></div>
    
    <form id="uploadForm">
        <div class="form-group">
            <label for="title">Title (required):</label>
            <input type="text" id="title" required>
        </div>
        
        <div class="form-group">
            <label for="description">Description:</label>
            <textarea id="description"></textarea>
        </div>
        
        <button type="submit">Upload to Xano</button>
    </form>
    
    <div style="margin-top: 20px;">
        <a href="/voxpro-manager">Back to VoxPro Manager</a>
    </div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const messageDiv = document.getElementById('message');
            messageDiv.style.display = 'none';
            
            try {
                // Simple test data
                const data = {
                    title: document.getElementById('title').value,
                    description: document.getElementById('description').value,
                    filename: 'test-file.txt',
                    file_type: 'text/plain',
                    file_size: 0,
                    upload_date: new Date().toISOString()
                };
                
                console.log('Sending data to Xano:', data);
                
                const response = await fetch('https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV/voxpro', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                console.log('Response status:', response.status);
                
                const responseText = await response.text();
                console.log('Response text:', responseText);
                
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    console.error('Failed to parse response as JSON:', e);
                    throw new Error('Invalid response from server');
                }
                
                if (response.ok) {
                    messageDiv.className = 'alert alert-success';
                    messageDiv.textContent = 'Upload successful!';
                    document.getElementById('uploadForm').reset();
                } else {
                    messageDiv.className = 'alert alert-danger';
                    messageDiv.textContent = result.error || 'Upload failed.';
                }
                
                messageDiv.style.display = 'block';
            } catch (error) {
                console.error('Error:', error);
                messageDiv.className = 'alert alert-danger';
                messageDiv.textContent = 'Error: ' + error.message;
                messageDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
    `
  };
};
