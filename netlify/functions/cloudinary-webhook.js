const crypto = require('crypto');
const fetch = require('node-fetch');

// Environment variables
const CLOUDINARY_WEBHOOK_SECRET = process.env.CLOUDINARY_WEBHOOK_SECRET;
const XANO_API_BASE = process.env.XANO_API_BASE;
const XANO_API_KEY = process.env.XANO_API_KEY;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

// Verify Cloudinary webhook signature
function verifySignature(body, signature, timestamp) {
    if (!CLOUDINARY_WEBHOOK_SECRET) {
        console.log('No webhook secret configured, skipping signature verification');
        return true; // Allow if no secret is configured
    }
    
    const expectedSignature = crypto
        .createHash('sha1')
        .update(body + timestamp + CLOUDINARY_WEBHOOK_SECRET)
        .digest('hex');
    
    return signature === expectedSignature;
}

// Main handler
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-cloudinary-signature, x-cloudinary-timestamp',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const signature = event.headers['x-cloudinary-signature'];
        const timestamp = event.headers['x-cloudinary-timestamp'];
        const body = event.body;
        
        // Verify signature
        if (!verifySignature(body, signature, timestamp)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }
        
        const payload = JSON.parse(body);
        console.log('Cloudinary webhook received:', payload.notification_type, payload.public_id);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Processed ${payload.notification_type} for ${payload.public_id}`,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Webhook error:', error);
        
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
