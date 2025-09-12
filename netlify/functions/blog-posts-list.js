const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS' ) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    };
  }

  if (event.httpMethod !== 'GET' ) {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const url = process.env.BLOG_POSTS_LIST_URL;
    if (!url) throw new Error('Missing BLOG_POSTS_LIST_URL');
    
    const res = await fetch(url);
    const body = await res.text();
    
    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Content-Type': 'application/json'
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
