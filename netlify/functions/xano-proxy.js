} else if (event.httpMethod === 'DELETE') {
    // DELETE request
    const options = {
        hostname: 'xajo-bs7d-cagt.n7e.xano.io',
        path: '/api:pYeQctVX' + endpoint,
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.end();
    });
    
    return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: response.data
    };
}
