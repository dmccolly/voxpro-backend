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
        const payload = JSON.parse(event.body);
        const publish = event.queryStringParameters?.publish === 'true';

        const createResponse = await fetch('/.netlify/functions/webflow_proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'blog_posts',
                method: 'POST',
                body: {
                    fieldData: {
                        name: payload.name,
                        slug: payload.slug,
                        summary: payload.summary,
                        body: payload.content || payload.body,
                        'feature-image-url': payload['feature-image-url'] || payload.heroUrl,
                        'feature-image-alt': payload['feature-image-alt'] || payload.heroAlt,
                        status: payload.status || 'published'
                    }
                }
            })
        });

        const createData = await createResponse.json();
        if (!createResponse.ok) throw new Error(createData.error || 'Failed to create post');

        if (publish && createData.id) {
            const publishResponse = await fetch(`https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${createData.id}/publish`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!publishResponse.ok) {
                console.warn('Post created but publish failed:', await publishResponse.text());
            }
        }

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(createData) };
    } catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
