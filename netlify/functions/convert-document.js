const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const { url, title } = event.queryStringParameters || {};
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter required' })
      };
    }
    
    console.log('Converting document:', url);
    
    if (url.toLowerCase().includes('.pdf')) {
      const conversionApiUrl = `https://api.pdf24.org/pdf-to-image?url=${encodeURIComponent(url)}&format=jpg&page=1&width=600&height=800`;
      
      try {
        const response = await makeHttpRequest(conversionApiUrl);
        
        if (response.statusCode === 200) {
          return {
            statusCode: 200,
            headers: {
              ...headers,
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=3600'
            },
            body: response.body,
            isBase64Encoded: true
          };
        }
      } catch (error) {
        console.log('PDF conversion failed, trying alternative approach');
      }
    }
    
    if (url.toLowerCase().includes('.docx') || url.toLowerCase().includes('.doc')) {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
      
      try {
        const response = await makeHttpRequest(viewerUrl);
        
        if (response.statusCode === 200) {
          const imageMatch = response.body.match(/src="([^"]*preview[^"]*\.jpg[^"]*)"/i);
          if (imageMatch) {
            const imageUrl = imageMatch[1];
            const imageResponse = await makeHttpRequest(imageUrl);
            
            if (imageResponse.statusCode === 200) {
              return {
                statusCode: 200,
                headers: {
                  ...headers,
                  'Content-Type': 'image/jpeg',
                  'Cache-Control': 'public, max-age=3600'
                },
                body: imageResponse.body,
                isBase64Encoded: true
              };
            }
          }
        }
      } catch (error) {
        console.log('DOCX conversion failed');
      }
    }
    
    const placeholderSvg = `
      <svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#2a2a2a"/>
        <rect x="50" y="50" width="500" height="700" fill="#3a3a3a" stroke="#555" stroke-width="2" rx="8"/>
        <text x="300" y="200" text-anchor="middle" fill="#fff" font-family="Arial" font-size="48">📄</text>
        <text x="300" y="300" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24">${title || 'Document'}</text>
        <text x="300" y="350" text-anchor="middle" fill="#aaa" font-family="Arial" font-size="16">Preview not available</text>
        <text x="300" y="400" text-anchor="middle" fill="#aaa" font-family="Arial" font-size="14">Click to open original file</text>
      </svg>
    `;
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300'
      },
      body: placeholderSvg
    };
    
  } catch (error) {
    console.error('Document conversion error:', error);
    
    const errorSvg = `
      <svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#2a2a2a"/>
        <rect x="50" y="50" width="500" height="700" fill="#3a3a3a" stroke="#555" stroke-width="2" rx="8"/>
        <text x="300" y="200" text-anchor="middle" fill="#ff6b6b" font-family="Arial" font-size="48">⚠️</text>
        <text x="300" y="300" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24">Conversion Error</text>
        <text x="300" y="350" text-anchor="middle" fill="#aaa" font-family="Arial" font-size="16">Unable to preview document</text>
      </svg>
    `;
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'image/svg+xml'
      },
      body: errorSvg
    };
  }
};

function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = client.request(options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: res.headers['content-type'] && res.headers['content-type'].startsWith('image/') 
            ? body.toString('base64') 
            : body.toString()
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}
