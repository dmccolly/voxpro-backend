const { getXanoHeaders } = require('./_xano.js');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    if (event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const pathParts = event.path.split('/');
        const recordId = pathParts[pathParts.length - 1];
        
        if (!recordId || recordId === 'update-user-submission') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Record ID required' })
            };
        }

        const updateData = JSON.parse(event.body || '{}');
        
        const baseUrl = event.headers.host ? `https://${event.headers.host}` : 'https://app.streamofdan.com';
        const existingResponse = await fetch(`${baseUrl}/.netlify/functions/xano-proxy/user_submission/${recordId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!existingResponse.ok) {
            return {
                statusCode: existingResponse.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Failed to fetch existing record',
                    details: await existingResponse.text()
                })
            };
        }
        
        const existingRecord = await existingResponse.json();
        
        const processedUpdateData = { ...updateData };
        
        if (Array.isArray(processedUpdateData.tags)) {
            processedUpdateData.tags = processedUpdateData.tags.join(',');
        }
        
        const completeData = { ...existingRecord, ...processedUpdateData };
        
        
        const response = await fetch(`${baseUrl}/.netlify/functions/xano-proxy/user_submission/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completeData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: 'Failed to update record',
                    details: errorText 
                })
            };
        }

        const result = await response.json();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Update error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};
