exports.handler = async () => {
  const headers = {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Idaho Broadcasting Media Upload</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);min-height:100vh;padding:20px}
.container{max-width:800px;margin:0 auto;background:#fff;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,.1);overflow:hidden}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;text-align:center}
.header h1{font-size:2.2em;margin-bottom:8px;font-weight:300}
.form-container{padding:40px}
.form-group{margin-bottom:20px}
label{display:block;margin-bottom:8px;font-weight:600;color:#333;font-size:14px}
input[type="text"],input[type="file"],textarea,select{width:100%;padding:12px 15px;border:2px solid #e1e5e9;border-radius:8px;font-size:16px;transition:all .3s ease;background:#f8f9fa}
input[type="text"]:focus,textarea:focus,select:focus{outline:none;border-color:#667eea;background:#fff;box-shadow:0 0 0 3px rgba(102,126,234,.1)}
textarea{resize:vertical;min-height:100px}
.upload-btn{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:15px 40px;border:none;border-radius:8px;font-size:18px;font-weight:600;cursor:pointer;width:100%;transition:all .3s ease;margin-top:10px}
.upload-btn:disabled{background:#ccc;cursor:not-allowed}
.success-message{background:#d4edda;color:#155724;padding:15px;border-radius:8px;margin-bottom:20px;border:1px solid #c3e6cb;display:none}
.error-message{background:#f8d7da;color:#721c24;padding:15px;border-radius:8px;margin-bottom:20px;border:1px solid #f5c6cb;display:none}
.file-info{background:#e3f2fd;padding:15px;border-radius:8px;margin-top:10px;display:none}
.progress-bar{width:100%;height:6px;background:#e1e5e9;border-radius:3px;margin-top:15px;overflow:hidden;display:none}
.progress-fill{height:100%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);width:0%;transition:width .3s ease}
.required{color:#e74c3c}
.back-link{display:inline-block;margin-top:20px;color:#667eea;font-weight:600;text-decoration:none}
.back-link:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Idaho Broadcasting Media Upload</h1>
    <p>Upload media files to the VoxPro system</p>
  </div>

  <div class="form-container">
    <div id="successMessage" class="success-message"></div>
    <div id="errorMessage" class="error-message"></div>

    <form id="uploadForm">
      <div class="form-group">
        <label for="file">Select Media File: <span class="required">*</span></label>
        <input type="file" id="file" name="attachment" required
               accept=".mp4,.mov,.avi,.mkv,.wmv,.flv,.mp3,.wav,.aac,.m4a,.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" />
        <div id="fileInfo" class="file-info"></div>
      </div>

      <div class="form-group">
        <label for="title">Title: <span class="required">*</span></label>
        <input type="text" id="title" name="title" required placeholder="Enter media title" />
      </div>

      <div class="form-group">
        <label for="description">Description:</label>
        <textarea id="description" name="description" placeholder="Enter media description"></textarea>
      </div>

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
        <label for="submittedBy">Submitted By:</label>
        <input type="text" id="submittedBy" name="submittedBy" placeholder="Your name" />
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
        <input type="text" id="tags" name="tags" placeholder="Enter tags separated by commas" />
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
        <textarea id="notes" name="notes" placeholder="Additional notes or comments"></textarea>
      </div>

      <div class="progress-bar" id="progressBar">
        <div class="progress-fill" id="progressFill"></div>
      </div>

      <button type="submit" class="upload-btn" id="uploadBtn">Upload Media</button>
    </form>

    <a href="/voxpro-manager" class="back-link">← Back to VoxPro Manager</a>
  </div>
</div>

<script>
const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('file');
const fileInfo = document.getElementById('fileInfo');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');

const MAX_FILE_SIZE = 250 * 1024 * 1024;

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    showError('File size exceeds 250MB limit.');
    fileInput.value = '';
    fileInfo.style.display = 'none';
    return;
  }
  fileInfo.innerHTML = '<strong>Selected file:</strong> ' + file.name + '<br>' +
                       '<strong>Size:</strong> ' + (file.size/(1024*1024)).toFixed(2) + ' MB<br>' +
                       '<strong>Type:</strong> ' + (file.type || 'Unknown');
  fileInfo.style.display = 'block';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = fileInput.files[0];
  if (!file) { showError('Please select a file to upload.'); return; }

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  progressBar.style.display = 'block';
  progressFill.style.width = '30%';
  hideMessages();

  try {
    const fd = new FormData();
    fd.append('attachment', file);
    fd.append('title', document.getElementById('title').value || 'Untitled');
    fd.append('description', document.getElementById('description').value || '');
    fd.append('submittedBy', document.getElementById('submittedBy').value || 'Anonymous');
    fd.append('notes', document.getElementById('notes').value || '');
    fd.append('tags', document.getElementById('tags').value || '');
    fd.append('category', document.getElementById('category').value || 'Other');
    fd.append('station', document.getElementById('station').value || '');
    fd.append('priority', document.getElementById('priority').value || 'Normal');

    const res = await fetch('/.netlify/functions/file-manager-upload', {
      method: 'POST',
      body: fd
    });

    progressFill.style.width = '80%';
    const txt = await res.text();
    let data; try { data = JSON.parse(txt); } catch { data = { message: txt }; }

    if (res.ok) {
      showSuccess('File uploaded successfully! You can now find it in VoxPro Manager.');
      form.reset(); fileInfo.style.display = 'none'; progressFill.style.width = '100%';
    } else {
      showError(data.error || data.message || 'Upload failed.');
      progressFill.style.width = '0%';
    }
  } catch (err) {
    showError('Upload failed: ' + err.message);
    progressFill.style.width = '0%';
  }

  uploadBtn.disabled = false;
  uploadBtn.textContent = 'Upload Media';
  setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 1500);
});

function showSuccess(msg){ successMessage.textContent = msg; successMessage.style.display='block'; errorMessage.style.display='none'; }
function showError(msg){ errorMessage.textContent = msg; errorMessage.style.display='block'; successMessage.style.display='none'; }
function hideMessages(){ successMessage.style.display='none'; errorMessage.style.display='none'; }
</script>
</body>
</html>
  `;

  return { statusCode: 200, headers, body: html };
};
