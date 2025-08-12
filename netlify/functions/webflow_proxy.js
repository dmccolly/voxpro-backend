const fetch = require('node-fetch');

const API_TOKEN = process.env.WEBFLOW_API_TOKEN; // Use environment variable
const SITE_ID = "688ed8debc05764047afa2a7";
const COLLECTION_IDS = {
    "media_assets": "6891479d29ed1066b71124e9",
    "voxpro_assignments": "689ac6bdf10259dd9be04e16"
};
const API_BASE_URL = "https://api.webflow.com/v2";

exports.handler = async function(event, context ) {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { endpoint, method, body } = JSON.parse(event.body);
        let url;

        if (!endpoint) {
            return { statusCode: 400, body: JSON.stringify({ error: "Endpoint key is missing" }) };
        }

        const [collection_key, item_id] = endpoint.split('/');
        const collection_id = COLLECTION_IDS[collection_key];

        if (!collection_id) {
            return { statusCode: 400, body: JSON.stringify({ error: `Invalid endpoint key: ${collection_key}` }) };
        }

        url = item_id 
            ? `${API_BASE_URL}/collections/${collection_id}/items/${item_id}`
            : `${API_BASE_URL}/collections/${collection_id}/items`;

        const options = {
            method: method || 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            },
        };

        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            return { statusCode: response.status, body: JSON.stringify({ error: `Webflow API Error: ${errorText}` }) };
        }
        
        // Handle successful but empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
             return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        const responseData = await response.json();
        return { statusCode: 200, body: JSON.stringify(responseData) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
