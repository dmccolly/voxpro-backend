const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: JSON.stringify({ ok: true })
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Use the existing XANO_ADMIN_LIST_URL environment variable
    const url = process.env.XANO_ADMIN_LIST_URL;
    
    if (!url) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing XANO_ADMIN_LIST_URL environment variable' })
      };
    }

    const res = await fetch(url);
    const body = await res.text();
    
    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json'
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://app.streamofdan.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

