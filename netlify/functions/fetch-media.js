// Enhanced fetch-media.js - Improved error handling and CORS support
const fetch = require('node-fetch');

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
  const targetUrl = event.queryStringParameters.url;
  
  if (!targetUrl) {
    console.error('Missing URL parameter');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing URL parameter' })
    };
  }

  console.log(`Fetching media from: ${targetUrl}`);
  console.log(`Full event:`, JSON.stringify(event, null, 2));

  try {
    // Fetch the media with node-fetch
    const response = await fetch(targetUrl, {
      method: 'GET',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'VoxPro Media Manager',
        'Accept': 'image/*, video/*, audio/*, application/octet-stream'
      }
    });

    console.log(`Fetch response status: ${response.status}`);
    console.log(`Fetch response headers:`, response.headers.raw());

    // Check for errors
    if (!response.ok) {
      console.error(`Error fetching media: ${response.status} ${response.statusText}`);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Error fetching media: ${response.status} ${response.statusText}`
        })
      };
    }

    // Get content type from response or determine from URL
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    console.log(`Original content type: ${contentType}`);
    
    // If content type is missing or generic, try to determine from URL
    if (contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
      const fileExtension = targetUrl.split('.').pop().toLowerCase();
      
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
    
    // Get the buffer
    const buffer = await response.buffer();

    console.log(`Successfully fetched media: ${contentType}, size: ${buffer.length} bytes`);

    return {
      statusCode: 200,
      headers,
      body: buffer.toString('base64'),
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
