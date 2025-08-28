const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Read the fixed VoxPro Manager HTML file
    const htmlPath = path.join(__dirname, '../../fixed-voxpro-manager.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    return {
      statusCode: 200,
      headers,
      body: html
    };
  } catch (error) {
    console.error('Error serving fixed VoxPro Manager:', error);
    return {
      statusCode: 500,
      headers,
      body: `Error loading VoxPro Manager: ${error.message}`
    };
  }
};

