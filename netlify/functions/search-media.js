// /.netlify/functions/search-media.js
// Unified search function for Webflow CMS + Xano database

const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
const XANO_API_BASE = process.env.XANO_API_BASE || 'https://your-workspace.xano.io/api:version';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { q = '', limit = 100 } = event.queryStringParameters || {};
    const searchTerm = q.toLowerCase().trim();
    
    console.log(`Searching for: "${searchTerm}"`);
    
    let allResults = [];

    // 1. Search Webflow CMS (if configured)
    if (WEBFLOW_API_TOKEN && WEBFLOW_COLLECTION_ID) {
      try {
        const webflowUrl = `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items?limit=${limit}`;
        const webflowResponse = await fetch(webflowUrl, {
          headers: {
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
            'Accept-Version': '1.0.0'
          }
        });

        if (webflowResponse.ok) {
          const webflowData = await webflowResponse.json();
          const webflowResults = (webflowData.items || [])
            .filter(item => {
              if (!searchTerm) return true;
              const searchableText = [
                item.name || item.title,
                item.description,
                item.station,
                item.tags,
                item['submitted-by'] || item.submittedBy
              ].join(' ').toLowerCase();
              return searchableText.includes(searchTerm);
            })
            .map(item => ({
              id: `webflow:${item._id}`,
              source: 'webflow',
              title: item.name || item.title || 'Untitled',
              description: item.description || '',
              station: item.station || '',
              tags: item.tags || '',
              thumbnail: item.thumbnail?.url || '',
              media_url: item['media-file']?.url || item.mediaFile?.url || item.url || '',
              file_type: item['file-type'] || item.fileType || '',
              submitted_by: item['submitted-by'] || item.submittedBy || '',
              created_at: item['_archived'] === false ? item['_draft'] === false ? item.updatedOn : item.createdOn : item.createdOn
            }));
          
          allResults.push(...webflowResults);
          console.log(`Found ${webflowResults.length} Webflow results`);
        }
      } catch (error) {
        console.warn('Webflow search failed:', error.message);
      }
    }

    // 2. Search Xano database
    try {
      const xanoUrl = searchTerm 
        ? `${XANO_API_BASE}/asset?search=${encodeURIComponent(searchTerm)}`
        : `${XANO_API_BASE}/asset?limit=${limit}`;
      
      const xanoResponse = await fetch(xanoUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (xanoResponse.ok) {
        const xanoData = await xanoResponse.json();
        const xanoResults = (Array.isArray(xanoData) ? xanoData : [xanoData])
          .filter(item => {
            if (!searchTerm) return true;
            const searchableText = [
              item.title,
              item.description,
              item.station,
              item.tags,
              item.submitted_by
            ].join(' ').toLowerCase();
            return searchableText.includes(searchTerm);
          })
          .map(item => ({
            id: `xano:${item.id}`,
            source: 'xano',
            title: item.title || 'Untitled',
            description: item.description || '',
            station: item.station || '',
            tags: item.tags || '',
            thumbnail: item.thumbnail || '',
            media_url: item.database_url || item.file_url || item.url || '',
            file_type: item.file_type || '',
            submitted_by: item.submitted_by || '',
            created_at: item.created_at || ''
          }));

        allResults.push(...xanoResults);
        console.log(`Found ${xanoResults.length} Xano results`);
      }
    } catch (error) {
      console.warn('Xano search failed:', error.message);
    }

    // Sort by created_at (most recent first) and limit results
    const sortedResults = allResults
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, parseInt(limit));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: sortedResults,
        total: sortedResults.length,
        query: searchTerm
      })
    };

  } catch (error) {
    console.error('Search function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Search failed',
        message: error.message,
        results: []
      })
    };
  }
};
