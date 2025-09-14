/*
 * Netlify function for creating Blog posts in Webflow (v2 API).
 * Uses correct field slugs: name, slug, summary, body, feature-image, category, publish-date
 */

const API_BASE = 'https://api.webflow.com/v2'; // ✅ Fixed: no trailing spaces

// Polyfill fetch for Node ≤16
const fetch =
  global.fetch ||
  ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

// Allow CORS origins
const allowOrigin =
  process.env.ALLOW_ORIGINS ||
  process.env.ALLOW_ORIGIN ||
  '*';

// Helpers
const ok = (body) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const err = (code, message, extra = {}) => ({
  statusCode: code,
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ error: message, ...extra }),
});

// Normalize slug
function normaliseSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Helper to get tag IDs from names
async function getTagIds(token, collectionId, tagNamesString) {
  if (!tagNamesString?.trim()) return [];

  const names = tagNamesString
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (!names.length) return [];

  try {
    const res = await fetch(
      `${API_BASE}/collections/${collectionId}/tags`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();

    if (!res.ok) {
      console.warn('Failed to fetch tags:', data);
      return [];
    }
