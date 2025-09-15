import fetch from 'node-fetch';

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const API_BASE_URL = "https://api.webflow.com/v2";
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        if (!API_TOKEN || !COLLECTION_ID) {
            throw new Error('Missing Webflow API configuration');
        }

        const { id } = JSON.parse(event.body);
        if (!id) throw new Error('Post ID is required');

        const url = `${API_BASE_URL}/collections/${COLLECTION_ID}/items/${id}/unpublish`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Webflow API Error (${response.status}): ${JSON.stringify(data)}`);
        }

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
    } catch (error) {
        console.error('Blog posts archive error:', error);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
