// Fixed uploader.js with chunked upload strategy and proper error handling
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

// Configure Cloudinary with proper error handling
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} catch (error) {
  console.error('Cloudinary configuration error:', error);
}

// Constants for chunked upload
const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size

// Helper function to detect file type
function getResourceType(fileName, mimeType) {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  
  if (videoExtensions.includes(extension) || (mimeType && mimeType.startsWith('video/'))) {
    return 'video';
  } else if (imageExtensions.includes(extension) || (mimeType && mimeType.startsWith('image/'))) {
    return 'image';
  }
  
  return 'raw'; // Default fallback
}

// Helper function to convert base64 to buffer
function base64ToBuffer(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

// Helper function for chunked upload
async function uploadLargeFile(fileBuffer, fileName, resourceType, options = {}) {
  try {
    console.log(`Starting chunked upload for ${fileName}, size: ${fileBuffer.length} bytes`);
    
    // Generate unique upload ID
    const uploadId = crypto.randomUUID();
    
    // Calculate number of chunks
    const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
    console.log(`File will be split into ${totalChunks} chunks`);
    
    // Upload chunks
    const uploadPromises = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);
      
      const chunkUploadOptions = {
        public_id: `${fileName}_${uploadId}`,
        resource_type: resourceType,
        chunk_size: CHUNK_SIZE,
        ...options,
      };
      
      // Add transformation parameters for video optimization
      if (resourceType === 'video') {
        chunkUploadOptions.transformation = [
          { quality: 'auto', fetch_format: 'auto' }
        ];
      }
      
      console.log(`Uploading chunk ${i + 1}/${totalChunks}`);
      
      const uploadPromise = cloudinary.uploader.upload_large(chunk, chunkUploadOptions);
      uploadPromises.push(uploadPromise);
    }
    
    // Wait for all chunks to complete
    const results = await Promise.all(uploadPromises);
    console.log(`All chunks uploaded successfully for ${fileName}`);
    
    return results[0]; // Return the first result which contains the final URL
    
  } catch (error) {
    console.error('Chunked upload error:', error);
    throw new Error(`Chunked upload failed: ${error.message}`);
  }
}

// Helper function for regular upload (small files)
async function uploadRegularFile(fileBuffer, fileName, resourceType, options = {}) {
  try {
    console.log(`Starting regular upload for ${fileName}, size: ${fileBuffer.length} bytes`);
    
    const uploadOptions = {
      public_id: fileName,
      resource_type: resourceType,
      ...options,
    };
    
    // Add transformation parameters for video optimization
    if (resourceType === 'video') {
      uploadOptions.transformation = [
        { quality: 'auto', fetch_format: 'auto' }
      ];
    }
    
    const result = await cloudinary.uploader.upload(fileBuffer, uploadOptions);
    console.log(`Regular upload completed for ${fileName}`);
    
    return result;
    
  } catch (error) {
    console.error('Regular upload error:', error);
    throw new Error(`Regular upload failed: ${error.message}`);
  }
}

// Main handler function
exports.handler = async (event, context) => {
  // Set longer timeout for this function
  context.callbackWaitsForEmptyEventLoop = false;
  
  const startTime = Date.now();
  console.log('Upload function started');
  
  try {
    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({ 
          error: 'Method not allowed',
          message: 'Only POST requests are supported'
        }),
      };
    }
    
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: '',
      };
    }
    
    // Validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Bad request',
          message: 'Request body is required'
        }),
      };
    }
    
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        }),
      };
    }
    
    const { file, fileName, mimeType } = requestData;
    
    // Validate required fields
    if (!file || !fileName) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Missing required fields',
          message: 'Both file and fileName are required'
        }),
      };
    }
    
    // Convert base64 to buffer
    let fileBuffer;
    try {
      fileBuffer = base64ToBuffer(file);
    } catch (bufferError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Invalid file data',
          message: 'File data must be valid base64'
        }),
      };
    }
    
    // Check file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return {
        statusCode: 413,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'File too large',
          message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        }),
      };
    }
    
    // Determine resource type
    const resourceType = getResourceType(fileName, mimeType);
    console.log(`Detected resource type: ${resourceType} for file: ${fileName}`);
    
    // Choose upload strategy based on file size
    let uploadResult;
    if (fileBuffer.length > CHUNK_SIZE) {
      // Use chunked upload for large files
      uploadResult = await uploadLargeFile(fileBuffer, fileName, resourceType);
    } else {
      // Use regular upload for small files
      uploadResult = await uploadRegularFile(fileBuffer, fileName, resourceType);
    }
    
    // Generate optimized URL based on resource type
    let optimizedUrl = uploadResult.secure_url;
    if (resourceType === 'video') {
      // Convert raw URL to video URL with optimizations
      optimizedUrl = uploadResult.secure_url
        .replace('/raw/upload/', '/video/upload/')
        .replace('/upload/', '/upload/f_auto,q_auto/');
    } else if (resourceType === 'image') {
      // Add image optimizations
      optimizedUrl = uploadResult.secure_url
        .replace('/upload/', '/upload/f_auto,q_auto/');
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Upload completed successfully in ${duration}ms`);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        url: optimizedUrl,
        originalUrl: uploadResult.secure_url,
        resourceType: resourceType,
        fileSize: fileBuffer.length,
        duration: duration,
        publicId: uploadResult.public_id,
      }),
    };
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Enhanced error logging
    console.error('Upload function error:', {
      message: error.message,
      stack: error.stack,
      duration: duration,
      timestamp: new Date().toISOString(),
    });
    
    // Return specific error information
    let errorMessage = 'An unexpected error occurred during upload';
    let statusCode = 500;
    
    if (error.message.includes('Cloudinary')) {
      errorMessage = 'Cloud storage service error';
      statusCode = 502;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Upload timeout - file may be too large';
      statusCode = 408;
    } else if (error.message.includes('memory')) {
      errorMessage = 'Insufficient memory to process file';
      statusCode = 507;
    }
    
    return {
      statusCode: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        duration: duration,
      }),
    };
  }
};

