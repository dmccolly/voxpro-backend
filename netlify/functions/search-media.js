// netlify/functions/search-media.js
const https = require('https');
const http = require('http');

const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const cacheBuster = `?_t=${Date.now()}&_r=${Math.random()}`;
    const fullUrl = url + cacheBuster;
    const protocol = fullUrl.startsWith('https:') ? https : http;
    
    const requestOptions = {
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...options.headers
      }
    };
    
    const req = protocol.get(fullUrl, requestOptions, (res) => {
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
};

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
    const query = event.queryStringParameters?.q || '';
    // FIXED URL
    const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
    const searchUrl = `${XANO_API_BASE}/user_submission`;
    
    console.log(`FRESH SEARCH: ${searchUrl} for query: "${query}"`);
    
    const data = await makeRequest(searchUrl);
    
    if (!Array.isArray(data)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [], total: 0, query })
      };
    }
    
    console.log(`FRESH DATA: Found ${data.length} total records`);
    
    let results = data;
    if (query.trim()) {
      results = data.filter(item => {
        const searchText = [
          item.title || '',
          item.description || '',
          item.station || '',
          item.tags || '',
          item.submitted_by || ''
        ].join(' ').toLowerCase();
        
        return searchText.includes(query.toLowerCase());
      });
    }
    
    results.sort((a, b) => {
      const dateA = a.created_at || 0;
      const dateB = b.created_at || 0;
      return dateB - dateA;
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: results,
        total: results.length,
        query: query
      })
    };
    
  } catch (error) {
    console.error('SEARCH ERROR:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Search failed', 
        message: error.message
      })
    };
  }
};
