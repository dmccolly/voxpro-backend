// Reliable Xano Data Fetch Function
// Based on the working Audio Memory Game implementation

const https = require('https');
const http = require('http');

// Xano configuration - update these with your actual values
const XANO_BASE_URL = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';

exports.handler = async (event, context) => {
  console.log('=== XANO DATA FETCH STARTING ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Extract endpoint from path or query parameters
  const endpoint = event.queryStringParameters?.endpoint || event.path?.replace('/api/', '') || 'voxpro';
  const fullUrl = `${XANO_BASE_URL}/${endpoint}`;
  
  console.log(`Fetching from Xano endpoint: ${fullUrl}`);

  try {
    const data = await makeXanoRequest('GET', fullUrl);
    console.log('✅ Successfully fetched from Xano');
    console.log('Data preview:', JSON.stringify(data).substring(0, 200) + '...');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        success: true,
        data: data,
        endpoint: endpoint,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch from Xano:', error.message);
    console.error('Full error:', error);
    
    // Try alternative endpoints if the main one fails
    const alternativeEndpoints = [
      `${XANO_BASE_URL}/health`,
      `${XANO_BASE_URL}/ping`,
      'https://xajo-bs7d-cagt.n7e.xano.io/api:owXpCDEu/health'
    ];
    
    const testResults = [];
    
    for (const altUrl of alternativeEndpoints) {
      try {
        console.log(`Trying alternative endpoint: ${altUrl}`);
        const altData = await makeXanoRequest('GET', altUrl);
        testResults.push({
          url: altUrl,
          status: 'SUCCESS',
          data: altData
        });
        console.log(`✅ Alternative endpoint worked: ${altUrl}`);
      } catch (altError) {
        testResults.push({
          url: altUrl,
          status: 'FAILED',
          error: altError.message
        });
        console.log(`❌ Alternative endpoint failed: ${altUrl} - ${altError.message}`);
      }
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: `Failed to fetch from Xano: ${error.message}`,
        originalEndpoint: fullUrl,
        alternativeTests: testResults,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          possibleCauses: [
            'Xano API endpoint URL is incorrect',
            'Xano API key/authentication is missing or invalid',
            'Xano API has domain restrictions blocking Netlify',
            'Network connectivity issues',
            'Xano service is temporarily down'
          ],
          nextSteps: [
            'Verify the Xano API URL in your dashboard',
            'Check if API key is set in Netlify environment variables',
            'Test the API directly in Xano dashboard',
            'Check Xano API logs for blocked requests'
          ]
        }
      })
    };
  }
};

// Reliable Xano request function based on Audio Memory Game implementation
function makeXanoRequest(method, urlString, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoxPro-Xano-Client/1.0',
        'Accept': 'application/json'
      },
      timeout: 15000 // 15 second timeout
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    console.log(`Making ${method} request to: ${urlString}`);
    console.log('Request options:', JSON.stringify(options, null, 2));

    const req = client.request(options, (res) => {
      console.log(`Response status: ${res.statusCode}`);
      console.log(`Response headers:`, res.headers);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response data length: ${responseData.length}`);
        console.log(`Response preview: ${responseData.substring(0, 200)}...`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(responseData);
            resolve(jsonData);
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // If it's not JSON, return the raw data
            resolve({ 
              rawData: responseData, 
              contentType: res.headers['content-type'],
              note: 'Response was not valid JSON'
            });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Request timeout after 15 seconds'));
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

