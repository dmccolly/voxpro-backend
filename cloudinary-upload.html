// netlify/functions/webflow-sync.js
const https = require('https');

// Sync uploaded media to Webflow CMS
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Check if it's a trigger request or a manual sync
  const isManualSync = event.httpMethod === 'GET';
  let itemId = null;
  
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body);
      itemId = payload.itemId;
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }
  }

  // Check configuration
  const { 
    WEBFLOW_API_TOKEN, 
    WEBFLOW_SITE_ID, 
    WEBFLOW_COLLECTION_ID,
    XANO_API_BASE
  } = process.env;
  
  if (!WEBFLOW_API_TOKEN || !WEBFLOW_SITE_ID || !WEBFLOW_COLLECTION_ID) {
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Webflow configuration' })
    };
  }

  try {
    // Get data from Xano - either a specific item or all items
    let xanoEndpoint = `${XANO_API_BASE}/user_submission`;
    if (itemId) {
      xanoEndpoint = `${XANO_API_BASE}/user_submission/${itemId}`;
    }

    // Fetch data from Xano
    const xanoData = await makeRequest('GET', xanoEndpoint);
    
    // Process items to sync
    const itemsToSync = itemId ? [xanoData] : xanoData;
    
    if (!itemsToSync || itemsToSync.length === 0) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'No items to sync' })
      };
    }

    console.log(`Found ${itemsToSync.length} items to sync to Webflow`);

    // Get existing items from Webflow
    const webflowItemsUrl = `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/cms/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100`;
    const webflowItems = await makeRequest('GET', webflowItemsUrl, null, {
      'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
      'accept-version': '2.0.0'
    });

    // Map existing Webflow items by Xano ID
    const existingItemsMap = new Map();
    if (webflowItems && webflowItems.items) {
      webflowItems.items.forEach(item => {
        if (item.fieldData && item.fieldData['xano-id']) {
          existingItemsMap.set(String(item.fieldData['xano-id']), item);
        }
      });
    }

    // Process each item
    const results = [];
    for (const item of itemsToSync) {
      try {
        // Prepare Webflow data
        const webflowData = {
          fieldData: {
            'name': item.title || 'Untitled',
            'slug': (item.title || 'untitled').toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, ''),
            'title': item.title || '',
            'description': item.description || '',
            'station': item.station || '',
            'category': item.category || '',
            'tags': item.tags || '',
            'submitted-by': item.submitted_by || '',
            'priority': item.priority || 'normal',
            'notes': item.notes || '',
            'file-type': item.file_type || '',
            'xano-id': String(item.id),
            'media-url': item.cloudinary_url || item.file_url || '',
            'thumbnail': {
              url: item.thumbnail_url || item.cloudinary_url || '',
              alt: item.title || 'Media thumbnail'
            },
            'upload-date': item.created_at || new Date().toISOString()
          }
        };

        // Check if item already exists in Webflow
        const existingItem = existingItemsMap.get(String(item.id));
        let result;

        if (existingItem) {
          // Update existing item
          console.log(`Updating existing Webflow item for Xano ID ${item.id}`);
          const updateUrl = `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/cms/collections/${WEBFLOW_COLLECTION_ID}/items/${existingItem.id}`;
          result = await makeRequest('PATCH', updateUrl, webflowData, {
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
            'Content-Type': 'application/json',
            'accept-version': '2.0.0'
          });
          results.push({ id: item.id, status: 'updated', webflowItemId: existingItem.id });
        } else {
          // Create new item
          console.log(`Creating new Webflow item for Xano ID ${item.id}`);
          const createUrl = `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/cms/collections/${WEBFLOW_COLLECTION_ID}/items`;
          result = await makeRequest('POST', createUrl, webflowData, {
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
            'Content-Type': 'application/json',
            'accept-version': '2.0.0'
          });
          results.push({ id: item.id, status: 'created', webflowItemId: result.id });
        }
      } catch (itemError) {
        console.error(`Error syncing item ${item.id}:`, itemError);
        results.push({ id: item.id, status: 'error', error: itemError.message });
      }
    }

    // Publish the changes
    try {
      const publishUrl = `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/publish`;
      await makeRequest('POST', publishUrl, {
        domains: ['all']
      }, {
        'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
        'Content-Type': 'application/json',
        'accept-version': '2.0.0'
      });
      console.log('Changes published to Webflow');
    } catch (publishError) {
      console.error('Error publishing changes:', publishError);
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Synced ${results.length} items to Webflow`,
        results: results
      })
    };

  } catch (error) {
    console.error('Webflow sync error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Sync failed',
        message: error.message
      })
    };
  }
};

// Helper function for making HTTP requests
function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          // If response is empty or not JSON, handle accordingly
          if (!responseData || responseData.trim() === '') {
            resolve({});
          } else {
            const parsedData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`API error: ${res.statusCode} - ${JSON.stringify(parsedData)}`));
            }
          }
        } catch (parseError) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`API error: ${res.statusCode} - ${responseData}`));
          }
        }
      });
    });

    req.on('error', reject);
    
    // Set timeout
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}
