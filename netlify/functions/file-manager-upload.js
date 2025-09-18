// netlify/functions/file-manager-upload.js
// FIXED VERSION WITH PROPER ERROR HANDLING

const busboy = require('busboy');
const cloudinary = require('cloudinary').v2;
const https = require('https');

// HTML page for GET requests
const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Idaho Broadcasting Media Upload</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; font-weight: 300; }
        .header p { font-size: 1.1em; opacity: 0.9; }
        .form-container { padding: 40px; }
        .form-group { margin-bottom: 25px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 0.95em; }
        .form-group label.required::after { content: ' *'; color: #e74c3c; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px 15px; border: 2px solid #e1e8ed; border-radius: 8px; font-size: 1em; transition: all 0.3s ease; background-color: #fafbfc; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #667eea; background-color: white; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        .form-group textarea { resize: vertical; min-height: 100px; }
        .upload-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 1.1em; font-weight: 600; cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 20px; }
        .upload-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
        .upload-btn:disabled { background: #bdc3c7; cursor: not-allowed; transform: none; box-shadow: none; }
        .back-link { display: inline-block; margin-top: 20px; color: #667eea; text-decoration: none; font-weight: 500; }
        .progress-container { margin-top: 20px; display: none; }
        .progress-bar { width: 100%; height: 20px; background-color: #e1e8ed; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 0%; transition: width 0.3s ease; }
        .message { padding: 15px; border-radius: 8px; margin-top: 20px; display: none; }
        .success-message { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error-message { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
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
                    <input type="file" id="mediaFile" name="attachment" accept="audio/*,video/*,image/*,.pdf,.doc,.docx" required>
                </div>
                <div class="form-group">
                    <label for="title" class="required">Title:</label>
                    <input type="text" id="title" name="title" placeholder="Enter media title" required>
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
                    <label for="submittedBy">Submitted By:</label>
                    <input type="text" id="submittedBy" name="submitted_by" placeholder="Your name">
                </div>
                <button type="submit" class="upload-btn" id="uploadBtn">Upload Media</button>
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
                </div>
                <div class="message success-message" id="successMessage"></div>
                <div class="message error-message" id="errorMessage"></div>
                <a href="/voxpro-manager" class="back-link">← Back to VoxPro Manager</a>
            </form>
        </div>
    </div>
    <script>
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const btn = document.getElementById('uploadBtn');
            const progressContainer = document.getElementById('progressContainer');
            const progressFill = document.getElementById('progressFill');
            const successMsg = document.getElementById('successMessage');
            const errorMsg = document.getElementById('errorMessage');
            
            btn.disabled = true;
            btn.textContent = 'Uploading...';
            progressContainer.style.display = 'block';
            successMsg.style.display = 'none';
            errorMsg.style.display = 'none';
            
            try {
                progressFill.style.width = '50%';
                const response = await fetch('/.netlify/functions/file-manager-upload', {
                    method: 'POST',
                    body: formData
                });
                progressFill.style.width = '100%';
                
                if (response.ok) {
                    successMsg.textContent = 'File uploaded successfully!';
                    successMsg.style.display = 'block';
                    e.target.reset();
                } else {
                    const error = await response.text();
                    throw new Error(error || 'Upload failed');
                }
            } catch (error) {
                errorMsg.textContent = 'Upload failed: ' + error.message;
                errorMsg.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Upload Media';
                setTimeout(() => { progressContainer.style.display = 'none'; progressFill.style.width = '0'; }, 2000);
            }
        });
    </script>
</body>
</html>`;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Serve HTML on GET
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'text/html' },
            body: htmlPage
        };
    }

    // Handle POST upload
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Check environment variables
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error('Missing Cloudinary environment variables');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Server configuration error: Cloudinary credentials not configured',
                help: 'Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to Netlify environment variables'
            })
        };
    }

    // Configure Cloudinary
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
    });

    try {
        // Parse multipart form data
        const contentType = event.headers['content-type'] || event.headers['Content-Type'];
        const bb = busboy({ headers: { 'content-type': contentType } });
        
        const fields = {};
        let fileData = null;
        
        const parsePromise = new Promise((resolve, reject) => {
            bb.on('file', (name, stream, info) => {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    fileData = {
                        filename: info.filename,
                        mimeType: info.mimeType,
                        buffer: Buffer.concat(chunks)
                    };
                });
            });
            
            bb.on('field', (name, value) => {
                fields[name] = value;
            });
            
            bb.on('finish', () => resolve({ fields, file: fileData }));
            bb.on('error', reject);
        });
        
        const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
        bb.end(bodyBuffer);
        
        const { fields: formFields, file } = await parsePromise;
        
        if (!file) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No file uploaded' })
            };
        }

        // Upload to Cloudinary
        console.log('Uploading to Cloudinary...');
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { 
                    resource_type: 'auto',
                    folder: 'voxpro'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(file.buffer);
        });

        console.log('Cloudinary upload successful:', uploadResult.secure_url);

        // Save to database
        const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
        
        const dbData = {
            title: formFields.title || file.filename,
            description: formFields.description || '',
            category: formFields.category || 'Other',
            station: formFields.station || '',
            submitted_by: formFields.submitted_by || '',
            cloudinary_url: uploadResult.secure_url,
            file_url: uploadResult.secure_url,
            thumbnail_url: uploadResult.secure_url,
            file_type: uploadResult.resource_type,
            file_size: uploadResult.bytes,
            created_at: new Date().toISOString()
        };

        // Save to Xano
        const xanoUrl = new URL(`${XANO_API_BASE}/user_submission`);
        const xanoResponse = await new Promise((resolve) => {
            const req = https.request(
                {
                    hostname: xanoUrl.hostname,
                    path: xanoUrl.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': process.env.XANO_API_KEY ? `Bearer ${process.env.XANO_API_KEY}` : undefined
                    }
                },
                (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, body: data }));
                }
            );
            req.on('error', (e) => resolve({ status: 500, body: e.message }));
            req.write(JSON.stringify(dbData));
            req.end();
        });

        if (xanoResponse.status !== 200 && xanoResponse.status !== 201) {
            console.error('Xano save failed:', xanoResponse);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'File uploaded successfully',
                url: uploadResult.secure_url
            })
        };

    } catch (error) {
        console.error('Upload error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Upload failed', 
                message: error.message 
            })
        };
    }
};
