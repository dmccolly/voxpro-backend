const fetch = require('node-fetch');

// Environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;

// Helper function to get Cloudinary assets
async function getCloudinaryAssets() {
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
    
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image`, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Cloudinary API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.resources || [];
    } catch (error) {
        console.error('Cloudinary API error:', error);
        throw error;
    }
}

// Main handler
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        console.log('Starting Webflow media library sync...');
        
        const cloudinaryAssets = await getCloudinaryAssets();
        console.log(`Found ${cloudinaryAssets.length} Cloudinary assets`);
        
        let syncResults = {
            cloudinary_total: cloudinaryAssets.length,
            webflow_media_library_total: 0,
            synced_to_webflow_media: 0,
            errors: []
        };
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                summary: syncResults,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Webflow media library sync error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
