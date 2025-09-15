import fetch from 'node-fetch';

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const API_BASE_URL = "https://api.webflow.com/v2";
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        if (!API_TOKEN || !COLLECTION_ID) {
            throw new Error('Missing Webflow API configuration');
        }

        const postId = event.queryStringParameters?.id;
        if (!postId) {
            throw new Error('Post ID is required');
        }

        const url = `${API_BASE_URL}/collections/${COLLECTION_ID}/items/${postId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'accept': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Webflow API Error (${response.status}): ${JSON.stringify(data)}`);
        }

        const mappedData = {
            id: data.id,
            name: data.fieldData?.name || '(untitled)',
            title: data.fieldData?.name || '(untitled)',
            slug: data.fieldData?.slug || '',
            status: data.fieldData?.status || 'published',
            body: data.fieldData?.body || '',
            content: data.fieldData?.body || '',
            summary: data.fieldData?.summary || '',
            updated_at: data.lastUpdated || data.createdOn || '',
            'feature-image-url': data.fieldData?.['feature-image-url'] || ''
        };

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(mappedData) };
    } catch (error) {
        console.error('Blog posts get error:', error);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
