import fetch from 'node-fetch';

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
        const response = await fetch('/.netlify/functions/webflow_proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'blog_posts',
                method: 'GET'
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Webflow API error');

        const items = data.items || [];
        const mappedItems = items.map(item => ({
            id: item.id,
            name: item.fieldData?.name || item.fieldData?.title || '(untitled)',
            title: item.fieldData?.name || item.fieldData?.title || '(untitled)',
            slug: item.fieldData?.slug || '',
            status: item.fieldData?.status || 'published',
            updated_at: item.lastUpdated || item.createdOn || '',
            'feature-image-url': item.fieldData?.['feature-image-url'] || ''
        }));

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(mappedItems) };
    } catch (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
