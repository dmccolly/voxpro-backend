import https from 'https';
import http from 'http';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 30000
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 30000
});

function makeRequest(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      agent: agent,
      headers: {
        'User-Agent': 'VoxPro-Backend/1.0',
        ...options.headers
      },
      timeout: options.timeout || 30000
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function makeJsonRequest(method, url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await makeRequest(method, url, { ...options, headers });
  
  try {
    const data = JSON.parse(response.data);
    return { ...response, data };
  } catch (e) {
    return response;
  }
}

export { makeRequest, makeJsonRequest };
