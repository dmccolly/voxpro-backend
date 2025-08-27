# Complete Solution for VoxPro Upload Function

Based on your screenshots and the described issue, here's a comprehensive solution to fix the file-manager-upload.js function that's returning 404 errors.

## 1. Full File-Manager-Upload.js Code

Save this complete code to `netlify/functions/file-manager-upload.js`:

```javascript
// Complete working file-manager-upload.js - Uses SAME endpoint as search-media.js
const https = require('https');
const http = require('http');

// Use EXACT same API base as search-media.js
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://x8k1-lell-twmt.n7.xano.io/api:pYeQctV';
const DEBUG = true;

// Helper function to make HTTP requests to Xano - SAME as search-media.js
const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const cacheBuster = `?_t=${Date.now()}&_r=${Math.random()}`;
    const fullUrl = url + cacheBuster;
    const protocol = fullUrl.startsWith('https:') ? https : http;
    
    if (DEBUG) {
      console.log(`[DEBUG] Making ${options.method || 'GET'} request to: ${url.toString()}`);
      if (options.body) {
        console.log(`[DEBUG] Request data:`, JSON.stringify(options.body).substring(0, 500));
      }
    }

    const requestOptions = {
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json',
        'User-Agent': 'VoxPro-Netlify-Function/1.0',
        'Accept': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(fullUrl, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
};

// Parse multipart form data
function parseMultipartData(body, boundary) {
  const parts = body.split(`--${boundary}`);
  const fields = {};
  let file = null;

  for (const part of parts) {
    if (part.includes('Content-Disposition: form-data')) {
      const nameMatch = part.match(/name="([^"]+)"/);
      if (nameMatch) {
        const fieldName = nameMatch[1];
        const valueStart = part.indexOf('\r\n\r\n') + 4;
        const valueEnd = part.lastIndexOf('\r\n');
        
        if (valueStart < valueEnd) {
          const value = part.substring(valueStart, valueEnd);
          
          if (part.includes('filename=')) {
            const filenameMatch = part.match(/filename="([^"]+)"/);
            file = {
              fieldName,
              filename: filenameMatch ? filenameMatch[1] : 'unknown',
              data: value,
              headers: {
                'content-type': part.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'application/octet-stream'
              }
            };
          } else {
            fields[fieldName] = value;
          }
        }
      }
    }
  }

  return { fields, file };
}

// Main handler function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
      };
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No boundary found in Content-Type' })
      };
    }

    const body = event.isBase64Encoded ? 
      Buffer.from(event.body, 'base64').toString('binary') : 
      event.body;

    const { fields, file } = parseMultipartData(body, boundary);

    if (DEBUG) {
      console.log('Parsed fields:', Object.keys(fields));
      console.log('File info:', file ? { filename: file.filename, size: file.data.length } : 'No file');
    }

    // Validate required fields
    if (!fields.title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Title is required' })
      };
    }

    // Create the upload data object - SAME structure as existing VoxPro entries
    const uploadData = {
      title: fields.title || 'Untitled',
      description: fields.description || '',
      category: fields.category || 'Other',
      station: fields.station || 'Unknown',
      tags: fields.tags || '',
      submitted_by: fields.submittedBy || 'Unknown',
      priority: fields.priority || 'Normal',
      notes: fields.notes || '',
      filename: file ? file.filename : 'no-file',
      fileSize: file ? file.data.length : 0,
      contentType: file ? file.headers['content-type'] : 'unknown',
      uploadDate: new Date().toISOString(),
      source: 'file-manager'
    };

    if (DEBUG) {
      console.log('Upload data to send to Xano:', uploadData);
    }

    // Send to Xano using EXACT same endpoint as search-media.js
    const xanoUrl = `${XANO_API_BASE}/voxpro`;
    
    const result = await makeRequest(xanoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: uploadData
    });

    if (DEBUG) {
      console.log('Xano response:', result);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Upload successful',
        data: result,
        uploadInfo: {
          title: uploadData.title,
          filename: uploadData.filename,
          size: uploadData.fileSize
        }
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Upload failed',
        details: error.message
      })
    };
  }
};
```

## 2. Create a Simple Test Function

To verify that Netlify functions are working correctly, create this simple test function at `netlify/functions/test-function.js`:

```javascript
// netlify/functions/test-function.js
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Test function is working',
      timestamp: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path
    })
  };
};
```

## 3. Update _redirects File

Ensure your `_redirects` file has the correct rules to handle Netlify functions properly:

```
/voxpro-manager    /templates/voxpro-manager.html    200
/assets/*          /assets/:splat                    200
/file-manager      /.netlify/functions/file-manager-page    200
/.netlify/functions/*  /.netlify/functions/:splat  200
/*                 /index.html                       200
```

## 4. Update netlify.toml Configuration

Update your `netlify.toml` to ensure functions are configured correctly:

```toml
# Netlify Configuration for VoxPro
[build]
  publish = "."
  functions = "netlify/functions"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# Increase timeout for the upload function
[functions."file-manager-upload"]
  timeout = 30
```

## 5. Deployment Instructions

Follow these steps to deploy your fix:

1. Replace the existing `file-manager-upload.js` with the complete code provided above
2. Add the test function to check if Netlify functions are working
3. Update your `_redirects` file if needed
4. Update your `netlify.toml` file if needed
5. Commit these changes to your `Voxpro_Update` branch
6. Deploy to Netlify (either through auto-deploy or manual deploy)

## 6. Verification Steps

After deployment:

1. First, verify the test function works by accessing:
   ```
   https://majestic-beijinho-cd3d75.netlify.app/.netlify/functions/test-function
   ```

2. If the test function works, try the file upload:
   - Go to the file manager page
   - Fill out the form and select a file
   - Submit and check for success

3. Check Netlify function logs for any errors

## 7. Troubleshooting Common Issues

If you're still experiencing issues:

1. **404 Function Not Found**:
   - Check that the function file is in the correct location: `netlify/functions/file-manager-upload.js`
   - Verify that Netlify built and deployed the function by checking the deployment logs
   - Try clearing your Netlify cache and redeploying

2. **Function Deploys But Returns an Error**:
   - Check the Netlify function logs for specific error messages
   - Test the function directly using a tool like Postman to isolate any issues

3. **CORS Issues**:
   - The provided code includes CORS headers, but if you're still having issues, verify your browser console for CORS errors

4. **Xano API Connection Issues**:
   - Verify the `XANO_API_BASE` is correct
   - Test connectivity to Xano with the test function

## 8. Additional Resources

If you need more help, these resources might be useful:

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Netlify Redirects Documentation](https://docs.netlify.com/routing/redirects/)
- [Netlify Troubleshooting Guide](https://docs.netlify.com/configure-builds/troubleshooting-tips/)
