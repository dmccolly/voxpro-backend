// Complete function: fetches a remote media URL and streams it back with CORS,
// including Range support for video/audio scrubbing.
//
// Usage from the browser:
//   https://<your-functions-site>/.netlify/functions/fetch-media?url=<encoded absolute URL>

export async function handler(event) {
  try {
    const url = (event.queryStringParameters && event.queryStringParameters.url) || '';
    if (!url || !/^https?:\/\//i.test(url)) {
      return resp(400, 'Missing or invalid ?url');
    }

    const headersOut = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Vary': 'Origin, Range',
      // You may tweak caching here:
      'Cache-Control': 'public, max-age=300'
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: headersOut, body: '' };
    }

    // Forward Range header if present (important for video)
    const fHeaders = {};
    const range = event.headers && (event.headers.Range || event.headers.range);
    if (range) fHeaders['Range'] = range;

    const upstream = await fetch(url, { headers: fHeaders });

    // Copy through relevant headers
    const pass = [
      'content-type', 'content-length', 'accept-ranges',
      'content-range', 'last-modified', 'etag', 'date'
    ];
    for (const k of pass) {
      const v = upstream.headers.get(k);
      if (v) headersOut[k] = v;
    }

    // If upstream didn’t declare Accept-Ranges, add it for better player UX
    if (!headersOut['accept-ranges']) headersOut['accept-ranges'] = 'bytes';

    // Stream body back
    const buf = await upstream.arrayBuffer();
    return {
      statusCode: upstream.status,
      headers: headersOut,
      body: Buffer.from(buf).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return resp(502, 'fetch-media error: ' + (e && e.message ? e.message : String(e)));
  }
}

function resp(code, text) {
  return {
    statusCode: code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body: text
  };
}
