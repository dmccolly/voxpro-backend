import fetch from 'node-fetch';

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const API_BASE_URL = "https://api.webflow.com/v2";
const COLLECTION_IDS = {
    "media_assets": "6891479d29ed1066b71124e9",
    "voxpro_assignments": "689ac6bdf10259dd9be04e16"
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler = async (event ) => {
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { endpoint, method, body } = JSON.parse(event.body);
        const [collection_key, item_id] = endpoint.split('/');
        const collection_id = COLLECTION_IDS[collection_key];

        if (!collection_id) throw new Error(`Invalid endpoint: ${collection_key}`);

        const url = item_id 
            ? `${API_BASE_URL}/collections/${collection_id}/items/${item_id}`
            : `${API_BASE_URL}/collections/${collection_id}/items`;

        const options = {
            method: method || 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        // **THE DEFINITIVE, FINAL FIX**
        // The entire payload, including all custom fields, MUST be inside a `fieldData` object.
        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify({ fieldData: body.fieldData });
        }

        const response = await fetch(url, options);
        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`Webflow API Error (${response.status}): ${responseText}`);
        }
        
        const finalBody = responseText || JSON.stringify({ success: true });
        return { statusCode: 200, headers: CORS_HEADERS, body: finalBody };

    } catch (error) {
        console.error("Handler Error:", error);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
