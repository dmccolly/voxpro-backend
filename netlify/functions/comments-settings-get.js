const allowOrigin = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS' ) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requireApproval: false,
      enabled: true
    })
  };
};
