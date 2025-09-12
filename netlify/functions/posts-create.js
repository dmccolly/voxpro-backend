const API_BASE = 'https://api.webflow.com/v2';
const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const allowOrigin = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';

const ok = (body) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const err = (code, message, extra = {}) => ({
  statusCode: code,
  headers: { 'Access-Control-Allow-Origin': allowOrigin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message, ...extra }),
});

// Then inside your handler before calling Webflow:
const token = process.env.WEBFLOW_API_TOKEN;
const collectionId =
  process.env.WEBFLOW_POSTS_COLLECTION_ID || process.env.WEBFLOW_COLLECTION_ID;

if (!token) return err(500, 'Missing WEBFLOW_API_TOKEN');
if (!collectionId)
  return err(500, 'Missing WEBFLOW_POSTS_COLLECTION_ID or WEBFLOW_COLLECTION_ID');
