import fetch from 'node-fetch';

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
        const { id } = JSON.parse(event.body);
        if (!id) throw new Error('Post ID is required');

        const response = await fetch('/.netlify/functions/webflow_proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: `blog_posts/${id}`,
                method: 'DELETE'
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete post');

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
    } catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
