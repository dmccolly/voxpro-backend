// Enhanced fetch-media.js - Improved error handling and CORS support
// Place this file in /netlify/functions/fetch-media.js

const axios = require('axios');

exports.handler = async (event, context) => {
  // Set up response headers with proper CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  // Get the URL parameter
  const url = event.queryStringParameters.url;
  
  if (!url) {
    console.error('Missing URL parameter');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing URL parameter' })
    };
  }

  console.log(`Fetching media from: ${url}`);

  try {
    // Fetch the media with axios (set responseType to arraybuffer)
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      maxContentLength: 100 * 1024 * 1024, // 100MB max size
      validateStatus: false, // Don't throw error on non-2xx
      headers: {
        'User-Agent': 'VoxPro Media Manager',
        'Accept': 'image/*, video/*, audio/*, application/octet-stream'
      }
    });

    // Check for errors
    if (response.status !== 200) {
      console.error(`Error fetching media: ${response.status} ${response.statusText}`);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Error fetching media: ${response.status} ${response.statusText}`
        })
      };
    }

    // Determine content type from response or filename
    let contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // If content type is missing or generic, try to determine from URL
    if (contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
      const fileExtension = url.split('.').pop().toLowerCase();
      
      const contentTypeMap = {
        // Images
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        
        // Videos
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime',
        
        // Audio
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'aac': 'audio/aac',
        'm4a': 'audio/mp4'
      };
      
      if (contentTypeMap[fileExtension]) {
        contentType = contentTypeMap[fileExtension];
        console.log(`Determined content type from extension: ${contentType}`);
      }
    }

    // Add content type to headers
    headers['Content-Type'] = contentType;
    
    // Add additional headers for better browser compatibility
    headers['Accept-Ranges'] = 'bytes';
    headers['Cache-Control'] = 'public, max-age=86400';
    
    // Convert buffer to base64 for response
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const body = Buffer.from(base64, 'base64');

    console.log(`Successfully fetched media: ${contentType}, size: ${body.length} bytes`);

    return {
      statusCode: 200,
      headers,
      body: body.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Error in fetch-media function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `Error fetching media: ${error.message}`,
        details: error.toString()
      })
    };
  }
};
