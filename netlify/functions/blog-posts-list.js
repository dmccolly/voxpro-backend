exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS' ) {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET' ) {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const url = process.env.BLOG_POSTS_LIST_URL;
    
    if (!url) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'BLOG_POSTS_LIST_URL not configured' })
      };
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    const data = await response.text();

    return {
      statusCode: response.status,
      headers,
      body: data
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
