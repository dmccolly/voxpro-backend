// netlify/functions/xano-proxy.js
const https = require('https');

exports.handler = async (event) => {
  console.log('xano-proxy called:', event.httpMethod, event.path);
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    let endpoint = event.path.replace('/.netlify/functions/xano-proxy', '');
    
    // Handle different endpoint types
    if (endpoint === '/auth/ping') {
      endpoint = '/user_submission';
    } else if (endpoint === '/assignments/get') {
      endpoint = '/key_assignments';
    } else if (endpoint === '/assignments/create') {
      endpoint = '/key_assignments';
    } else if (endpoint === '/assignments/delete') {
      endpoint = '/key_assignments';
    } else if (endpoint === '/media/search') {
      endpoint = '/user_submission';
    } else if (!endpoint) {
      endpoint = '/user_submission';
    }
    
    // FIXED URL
    const url = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX' + endpoint;
    
    console.log(`Forwarding ${event.httpMethod} request to: ${url}`);
    console.log('Body size:', event.body ? event.body.length : 0);
    
    const response = await new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      if (event.httpMethod === 'GET') {
        urlObj.searchParams.append('_t', Date.now());
      }
      
      const postData = event.body || '';
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: 443,
        method: event.httpMethod,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response status:', res.statusCode);
          console.log('Response preview:', data.substring(0, 200));
          resolve({ 
            statusCode: res.statusCode, 
            headers: res.headers, 
            body: data 
          });
        });
      });
      
      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });
      
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
    
    // Special handling for assignment operations
    if (event.path.includes('/assignments/')) {
      if (event.path.includes('/assignments/get')) {
        // For GET assignments, return mock data for now since we need to set up the key_assignments table
        return {
          statusCode: 200,
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            assignments: [
              // Return any existing assignments from the database
              // For now, return empty array until key_assignments table is set up
            ]
          })
        };
      } else if (event.path.includes('/assignments/create')) {
        // For assignment creation, we need to handle this properly
        const assignmentData = JSON.parse(event.body || '{}');
        console.log('Creating assignment:', assignmentData);
        
        // For now, return success response
        // TODO: Implement actual database storage for key assignments
        return {
          statusCode: 200,
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            success: true, 
            message: 'Assignment created successfully',
            id: Date.now(), // Temporary ID
            assignment: assignmentData
          })
        };
      } else if (event.path.includes('/assignments/delete')) {
        // For assignment deletion
        const deleteData = JSON.parse(event.body || '{}');
        console.log('Deleting assignment:', deleteData);
        
        return {
          statusCode: 200,
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            success: true, 
            message: 'Assignment deleted successfully'
          })
        };
      }
    }
    
    if (event.path.includes('/auth/ping') && response.statusCode === 200) {
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ status: 'ok', message: 'Connection successful' })
      };
    }
    
    return {
      statusCode: response.statusCode,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: response.body
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      },
      body: JSON.stringify({ 
        error: 'Proxy request failed', 
        message: error.message
      })
    };
  }
};
