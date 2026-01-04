const fetch = require('node-fetch');

// Primary Webflow configuration for fetching a single blog post.
const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const API_BASE_URL = 'https://api.webflow.com/v2';
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
// Optional comments collection. If present, comments for the post will be
// retrieved and included in the response.
const COMMENTS_COLLECTION_ID = process.env.COMMENTS_COLLECTION_ID;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  // CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Ensure required configuration is present
    if (!API_TOKEN || !COLLECTION_ID) {
      throw new Error('Missing Webflow API configuration');
    }

    const postId = event.queryStringParameters?.id;
    if (!postId) {
      throw new Error('Post ID is required');
    }

    // Fetch the blog post by ID from Webflow
    const url = `${API_BASE_URL}/collections/${COLLECTION_ID}/items/${postId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        accept: 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Webflow API Error (${response.status}): ${JSON.stringify(data)}`,
      );
    }

    // Map fields from Webflow response to a simplified object for the client
    const mappedData = {
      id: data.id,
      name: data.fieldData?.name || '(untitled)',
      title: data.fieldData?.name || '(untitled)',
      slug: data.fieldData?.slug || '',
      status: data.fieldData?.status || 'published',
      body: data.fieldData?.body || '',
      content: data.fieldData?.body || '',
      summary: data.fieldData?.summary || '',
      updated_at: data.lastUpdated || data.createdOn || '',
      'feature-image-url': data.fieldData?.['feature-image-url'] || '',
    };

    // Initialize comments array. We'll populate it if the comments collection is configured.
    mappedData.comments = [];

    if (COMMENTS_COLLECTION_ID) {
      try {
        // Fetch up to 100 comments from the comments collection; filter to those
        // approved and referencing this post ID.
        const commentsUrl = `${API_BASE_URL}/collections/${COMMENTS_COLLECTION_ID}/items?limit=100`;
        const commentsRes = await fetch(commentsUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            accept: 'application/json',
          },
        });
        const commentsData = await commentsRes.json();
        if (commentsRes.ok && Array.isArray(commentsData.items)) {
          const postComments = commentsData.items
            .filter(
              (item) =>
                item.fieldData?.approved === true &&
                item.fieldData?.post?.reference === postId,
            )
            .sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn))
            .map((item) => ({
              id: item.id,
              authorName: item.fieldData.authorName,
              message: item.fieldData.message,
              createdOn: item.createdOn,
            }));
          mappedData.comments = postComments;
        }
      } catch (err) {
        // If comment retrieval fails, log and continue without comments. Do not throw.
        console.error('Error fetching comments for blog post:', err);
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(mappedData),
    };
  } catch (error) {
    console.error('Blog posts get error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};