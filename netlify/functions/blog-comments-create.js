const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

/**
 * Create a comment (reply) for a specific blog post. This function mirrors the existing
 * comments-create endpoint but is scoped for blog posts. It accepts a POST request
 * containing JSON with the required fields `postId`, `authorName`, and `message`.
 * Optionally, `authorEmail` can be provided. The comment is created in the
 * Webflow comments collection with `approved` set to false, awaiting moderation.
 *
 * Request body (JSON):
 *   {
 *     "postId": string,       // required – the blog post ID
 *     "authorName": string,   // required – name of the commenter
 *     "authorEmail": string,  // optional – email of the commenter
 *     "message": string       // required – comment text (max 3000 chars)
 *   }
 *
 * Environment variables required:
 *   - WEBFLOW_API_TOKEN: API token for authenticating with Webflow.
 *   - COMMENTS_COLLECTION_ID: ID of the Webflow collection that stores comments.
 */
exports.handler = async (event) => {
  // Allow CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const token = process.env.WEBFLOW_API_TOKEN;
    const commentsCollection = process.env.COMMENTS_COLLECTION_ID;
    if (!token || !commentsCollection) {
      throw new Error('Missing Webflow comments configuration');
    }

    const { postId, authorName, authorEmail, message } = JSON.parse(event.body || '{}');
    // Basic validation: require postId, authorName, message; limit message length
    if (!postId || !authorName || !message || message.length > 3000) {
      return { statusCode: 400, body: 'Invalid input' };
    }

    // Construct payload per Webflow API for new comment
    const payload = {
      isArchived: false,
      fieldData: {
        post: { reference: postId },
        authorName,
        authorEmail: authorEmail || '',
        message,
        approved: false,
      },
    };

    const res = await fetch(
      `https://api.webflow.com/v2/collections/${commentsCollection}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      return { statusCode: res.status, body: await res.text() };
    }
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
      },
      body: 'OK',
    };
  } catch (err) {
    console.error('Blog comments create error:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};