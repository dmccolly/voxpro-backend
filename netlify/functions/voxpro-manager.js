const fs = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS, 'content-type': 'text/plain' },
      body: 'Method not allowed'
    };
  }

  try {
    // Read the template file
    const templatePath = path.join(__dirname, '../../templates/voxpro-manager.html');
    const html = fs.readFileSync(templatePath, 'utf8');
    
    return {
      statusCode: 200,
      headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' },
      body: html
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'content-type': 'text/plain' },
      body: 'Error loading VoxPro Manager: ' + error.message
    };
  }
};

