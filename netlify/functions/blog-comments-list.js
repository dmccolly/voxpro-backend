const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

/**
 * List comments associated with a specific blog post. This function mirrors the existing
 * comments-list endpoint but is scoped for blog posts. It retrieves all comments from
 * the Webflow comments collection, filters for those that have been approved and
 * reference the given postId, and returns a sorted array of simple comment objects.
 *
 * Query parameters:
 *   - postId (string): the ID of the blog post for which to fetch comments. If omitted
 *     or empty, an empty array is returned.
 *
 * Environment variables required:
 *   - WEBFLOW_API_TOKEN: API token for authenticating with Webflow.
 *   - COMMENTS_COLLECTION_ID: ID of the Webflow collection that stores comments.
 *   - ALLOW_ORIGIN/ALLOW_ORIGINS (optional): override Access-Control-Allow-Origin.
 */
exports.handler = async (event) => {
  // Handle CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
    'Content-Type': 'application/json',
  };

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { postId } = event.queryStringParameters || {};
  if (!postId) {
    // No post specified – return an empty list instead of an error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify([]),
    };
  }

  try {
    const token = process.env.WEBFLOW_API_TOKEN;
    const commentsCollection = process.env.COMMENTS_COLLECTION_ID;
    if (!token || !commentsCollection) {
      throw new Error('Missing Webflow comments configuration');
    }

    const authHeaders = { Authorization: `Bearer ${token}` };
    const url = `https://api.webflow.com/v2/collections/${commentsCollection}/items?limit=100`;
    const res = await fetch(url, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Webflow API Error (${res.status}): ${JSON.stringify(data)}`);
    }

    const comments = (data.items || [])
      .filter((i) => i.fieldData.approved === true && i.fieldData.post?.reference === postId)
      .sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn))
      .map((i) => ({
        id: i.id,
        authorName: i.fieldData.authorName,
        message: i.fieldData.message,
        createdOn: i.createdOn,
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(comments),
    };
  } catch (err) {
    // On error, log and return empty array; avoid leaking internals to client
    console.error('Blog comments list error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify([]),
    };
  }
};