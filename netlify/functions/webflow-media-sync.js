const fetch = require('node-fetch');

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const API_BASE_URL = "https://api.webflow.com/v2";
const SITE_ID = process.env.WEBFLOW_SITE_ID;

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
        if (!API_TOKEN || !SITE_ID) {
            throw new Error('Missing Webflow API configuration');
        }

        const { cloudinaryUrl, fileName, fileSize, fileType } = JSON.parse(event.body);
        
        if (!cloudinaryUrl || !fileName) {
            throw new Error('Missing required parameters: cloudinaryUrl and fileName');
        }

        const createUrl = `${API_BASE_URL}/sites/${SITE_ID}/assets`;
        const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName,
                fileUrl: cloudinaryUrl,
                fileSize: fileSize || 0,
                alt: fileName
            })
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(`Webflow asset creation failed: ${JSON.stringify(errorData)}`);
        }

        const createData = await createResponse.json();

        return { 
            statusCode: 200, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ 
                success: true, 
                webflowAssetId: createData.id,
                webflowUrl: createData.hostedUrl || cloudinaryUrl,
                message: 'Metadata synced to Webflow CMS'
            }) 
        };
        
    } catch (error) {
        console.error('Webflow media sync error:', error);
        return { 
            statusCode: 200, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            }) 
        };
    }
};
