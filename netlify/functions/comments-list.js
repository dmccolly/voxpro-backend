const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    };
  }
  
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
    'Content-Type': 'application/json'
  };
  
  const { postId } = event.queryStringParameters || {};
  if (!postId) {
    return { 
      statusCode: 200, 
      headers,
      body: JSON.stringify([]) 
    };
  }

  try {
    const authHeaders = { Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}` };
    const url = `https://api.webflow.com/v2/collections/${process.env.COMMENTS_COLLECTION_ID}/items?limit=100`;
    const res = await fetch(url, { headers: authHeaders });
    const data = await res.json();
    const items = (data.items || []).filter(i =>
      i.fieldData.approved === true &&
      i.fieldData.post?.reference === postId
    ).sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(items.map(i => ({
        id: i.id,
        authorName: i.fieldData.authorName,
        message: i.fieldData.message,
        createdOn: i.createdOn
      })))
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify([])
    };
  }
};

