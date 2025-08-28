const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
    try {
        // Read the working VoxPro Manager HTML file
        const htmlPath = path.join(__dirname, '../../working-voxpro-final.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache'
            },
            body: htmlContent
        };
    } catch (error) {
        console.error('Error serving VoxPro Manager:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/plain'
            },
            body: 'Error loading VoxPro Manager'
        };
    }
};

