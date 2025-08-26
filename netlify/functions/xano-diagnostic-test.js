// Xano Connectivity Diagnostic Test
// This function will help identify the exact issue with your Xano connection

const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  console.log('=== XANO DIAGNOSTIC TEST STARTING ===');
  
  // Test different Xano endpoints and configurations
  const tests = [
    {
      name: 'Basic Xano Ping Test',
      url: 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX/health',
      method: 'GET'
    },
    {
      name: 'VoxPro Table Access Test',
      url: 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX/voxpro',
      method: 'GET'
    },
    {
      name: 'Alternative API Endpoint Test',
      url: 'https://xajo-bs7d-cagt.n7e.xano.io/api:owXpCDEu/health',
      method: 'GET'
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n--- Running: ${test.name} ---`);
    
    try {
      const result = await makeXanoRequest(test.method, test.url);
      console.log(`✅ ${test.name}: SUCCESS`);
      console.log('Response:', JSON.stringify(result, null, 2));
      
      results.push({
        test: test.name,
        status: 'SUCCESS',
        data: result,
        url: test.url
      });
      
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED`);
      console.log('Error:', error.message);
      console.log('Full error:', error);
      
      results.push({
        test: test.name,
        status: 'FAILED',
        error: error.message,
        fullError: error.toString(),
        url: test.url
      });
    }
  }

  // Environment variable check
  console.log('\n--- Environment Variables Check ---');
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    NETLIFY: process.env.NETLIFY,
    CONTEXT: process.env.CONTEXT,
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    URL: process.env.URL
  };
  
  console.log('Environment:', envVars);

  // Network connectivity test
  console.log('\n--- Network Connectivity Test ---');
  try {
    const googleTest = await makeXanoRequest('GET', 'https://www.google.com');
    console.log('✅ Internet connectivity: OK');
    results.push({
      test: 'Internet Connectivity',
      status: 'SUCCESS'
    });
  } catch (error) {
    console.log('❌ Internet connectivity: FAILED');
    console.log('Error:', error.message);
    results.push({
      test: 'Internet Connectivity',
      status: 'FAILED',
      error: error.message
    });
  }

  console.log('\n=== DIAGNOSTIC TEST COMPLETE ===');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envVars,
      testResults: results,
      summary: {
        totalTests: results.length,
        passed: results.filter(r => r.status === 'SUCCESS').length,
        failed: results.filter(r => r.status === 'FAILED').length
      }
    }, null, 2)
  };
};

// Helper function using native HTTP/HTTPS (more reliable than fetch in Netlify)
function makeXanoRequest(method, urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoxPro-Diagnostic/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    };

    console.log(`Making request to: ${urlString}`);
    console.log('Options:', JSON.stringify(options, null, 2));

    const req = client.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response data: ${data}`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (parseError) {
            // If it's not JSON, return the raw data
            resolve({ rawData: data, contentType: res.headers['content-type'] });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
      reject(new Error('Request timeout after 10 seconds'));
    });

    req.end();
  });
}

