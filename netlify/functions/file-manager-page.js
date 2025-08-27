<script>
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file');
    const fileInfo = document.getElementById('fileInfo');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    // File size limit: 250MB
    const MAX_FILE_SIZE = 250 * 1024 * 1024;
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                showError('File size exceeds 250MB limit. Please choose a smaller file.');
                fileInput.value = '';
                fileInfo.style.display = 'none';
                return;
            }
            
            fileInfo.innerHTML = \`
                <strong>Selected file:</strong> \${file.name}<br>
                <strong>Size:</strong> \${(file.size / (1024 * 1024)).toFixed(2)} MB<br>
                <strong>Type:</strong> \${file.type || 'Unknown'}
            \`;
            fileInfo.style.display = 'block';
        }
    });
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            showError('Please select a file to upload.');
            return;
        }
        
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        progressBar.style.display = 'block';
        hideMessages();
        
        try {
            // Create FormData with the correct field names for Xano
            const formData = new FormData();
            formData.append('attachment', file);  // Changed from 'file' to 'attachment'
            formData.append('title', document.getElementById('title').value || 'Untitled');
            formData.append('description', document.getElementById('description').value || '');
            formData.append('submitted_by', document.getElementById('submittedBy').value || 'Anonymous');
            formData.append('notes', document.getElementById('notes').value || '');
            
            // Combine tags from multiple fields
            const tags = [];
            if (document.getElementById('tags').value) {
                tags.push(document.getElementById('tags').value);
            }
            if (document.getElementById('category').value) {
                tags.push(document.getElementById('category').value);
            }
            if (document.getElementById('station').value) {
                tags.push(document.getElementById('station').value);
            }
            formData.append('tags', tags.join(', '));
            formData.append('is_approved', 'false');
            
            progressFill.style.width = '30%';
            
            // Send directly to Xano's user_submission endpoint
            const response = await fetch('https://x8ki-letl-twmt.n7.xano.io/api:pYeQctVX/user_submission', {
                method: 'POST',
                body: formData
            });
            
            progressFill.style.width = '80%';
            
            const responseText = await response.text();
            console.log('Response:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                result = { message: responseText };
            }
            
            if (response.ok) {
                showSuccess('File uploaded successfully! You can now find it in VoxPro Manager.');
                form.reset();
                fileInfo.style.display = 'none';
                progressFill.style.width = '100%';
            } else {
                showError(result.message || 'Upload failed. Please try again.');
                progressFill.style.width = '0%';
            }
        } catch (error) {
            console.error('Upload error:', error);
            showError('Upload failed: ' + error.message);
            progressFill.style.width = '0%';
        }
        
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Media';
        setTimeout(() => {
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);
    });
    
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
