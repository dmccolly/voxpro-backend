const https = require('https');

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
    const XANO_URL = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX/voxpro_assignments';
    const XANO_API_KEY = process.env.XANO_API_KEY;
    
    console.log('VoxPro Assignments API:', event.httpMethod, XANO_URL);
    
    if (event.httpMethod === 'GET') {
      const urlObj = new URL(XANO_URL);
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
      if (XANO_API_KEY) {
        options.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
      }
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.end();
      });
      
      console.log('Assignment fetch response:', response.status);
      
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
      };
      
    } else if (event.httpMethod === 'POST') {
      const options = {
        hostname: 'xajo-bs7d-cagt.n7e.xano.io',
        path: '/api:pYeQctVX/voxpro_assignments',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': event.body ? Buffer.byteLength(event.body) : 0
        }
      };
      
      // Add API key if provided
      if (XANO_API_KEY) {
        options.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
      }
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        if (event.body) req.write(event.body);
        req.end();
      });
      
      console.log('Assignment create response:', response.status);
      
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
      };
      
    } else if (event.httpMethod === 'PATCH') {
      const options = {
        hostname: 'xajo-bs7d-cagt.n7e.xano.io',
        path: '/api:pYeQctVX/voxpro_assignments',
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': event.body ? Buffer.byteLength(event.body) : 0
        }
      };
      
      // Add API key if provided
      if (XANO_API_KEY) {
        options.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
      }
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        if (event.body) req.write(event.body);
        req.end();
      });
      
      console.log('Assignment update response:', response.status);
      
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
      };
      
    } else if (event.httpMethod === 'DELETE') {
      const options = {
        hostname: 'xajo-bs7d-cagt.n7e.xano.io',
        path: '/api:pYeQctVX/voxpro_assignments',
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': event.body ? Buffer.byteLength(event.body) : 0
        }
      };
      
      // Add API key if provided
      if (XANO_API_KEY) {
        options.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
      }
      
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        if (event.body) req.write(event.body);
        req.end();
      });
      
      console.log('Assignment delete response:', response.status);
      
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
      };
    }
    
  } catch (error) {
    console.error('VoxPro Assignments API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
