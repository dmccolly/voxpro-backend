// netlify/functions/list-media.js
const https = require('https');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Use environment variable or fallback to your Xano API
    const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
    const XANO_API_KEY = process.env.XANO_API_KEY || '';
    
    // Fetch from user_submission endpoint
    const url = `${XANO_API_BASE}/user_submission`;
    console.log('Fetching from:', url);
    
    const response = await makeRequest(url, XANO_API_KEY);
    
    return {
      statusCode: 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('List media error:', error);
    return {
      statusCode: 500,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Failed to fetch media',
        message: error.message 
      })
    };
  }
};

function makeRequest(url, apiKey) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    // Add API key if provided
    if (apiKey) {
      options.headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          // If parsing fails, return empty array
          resolve([]);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}
