const fetch = require('node-fetch');

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const API_BASE_URL = "https://api.webflow.com/v2";
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
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

        const payload = JSON.parse(event.body);
        const publish = event.queryStringParameters?.publish === 'true';

        const url = `${API_BASE_URL}/collections/${COLLECTION_ID}/items`;
        const createResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fieldData: {
                    name: payload.name,
                    slug: payload.slug,
                    summary: payload.summary,
                    body: payload.content || payload.body,
                    'feature-image-url': payload['feature-image-url'] || payload.heroUrl,
                    'feature-image-alt': payload['feature-image-alt'] || payload.heroAlt
                }
            })
        });

        const createData = await createResponse.json();
        if (!createResponse.ok) {
            throw new Error(`Webflow API Error (${createResponse.status}): ${JSON.stringify(createData)}`);
        }

        if (publish && createData.id) {
            const publishUrl = `${API_BASE_URL}/collections/${COLLECTION_ID}/items/${createData.id}/publish`;
            const publishResponse = await fetch(publishUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!publishResponse.ok) {
                const publishError = await publishResponse.text();
                console.error('Post created but publish failed:', publishError);
                throw new Error(`Failed to publish post: ${publishError}`);
            }
        }

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(createData) };
    } catch (error) {
        console.error('Blog posts create error:', error);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
