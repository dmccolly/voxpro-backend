const fetch = require('node-fetch');

// Environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const XANO_API_BASE = process.env.XANO_API_BASE;
const XANO_API_KEY = process.env.XANO_API_KEY;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

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

// Helper function to get XANO records
async function getXanoRecords() {
    try {
        const response = await fetch(`${XANO_API_BASE}/user_submission`, {
            headers: {
                'Authorization': `Bearer ${XANO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`XANO API error: ${response.status}`);
        }
        
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('XANO API error:', error);
        throw error;
    }
}

// Helper function to get Webflow CMS items
async function getWebflowItems() {
    try {
        const response = await fetch(`https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`, {
            headers: {
                'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
                'Accept-Version': '1.0.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Webflow API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('Webflow API error:', error);
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
        console.log('Starting comprehensive media sync...');
        
        // Get data from all systems
        const [cloudinaryAssets, xanoRecords, webflowItems] = await Promise.all([
            getCloudinaryAssets(),
            getXanoRecords(),
            getWebflowItems()
        ]);
        
        console.log(`Found ${cloudinaryAssets.length} Cloudinary assets`);
        console.log(`Found ${xanoRecords.length} XANO records`);
        console.log(`Found ${webflowItems.length} Webflow items`);
        
        let syncResults = {
            cloudinary_total: cloudinaryAssets.length,
            xano_total: xanoRecords.length,
            webflow_total: webflowItems.length,
            synced_to_xano: 0,
            synced_to_webflow: 0,
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
        console.error('Sync orchestrator error:', error);
        
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
