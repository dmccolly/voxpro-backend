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
    const possiblePaths = [
      path.join(__dirname, '../../templates/voxpro-manager.html'),
      path.join(__dirname, '../../../templates/voxpro-manager.html'),
      path.join(__dirname, '../../public/templates/voxpro-manager.html'),
      '/opt/build/repo/public/templates/voxpro-manager.html',
      './templates/voxpro-manager.html'
    ];
    
    let html = null;
    let lastError = null;
    
    for (const templatePath of possiblePaths) {
      try {
        html = fs.readFileSync(templatePath, 'utf8');
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    
    if (!html) {
      throw new Error(`Template not found. Tried paths: ${possiblePaths.join(', ')}. Last error: ${lastError.message}`);
    }
    
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

