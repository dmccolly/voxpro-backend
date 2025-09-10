// Updated Netlify function for creating or updating blog posts.
//
// This version accepts both the original field names (title,
// slug, author, tags, summary, body, heroUrl, heroAlt,
// scheduleAt) used by the new Blog Manager as well as the older
// names (name, featureImageUrl, publishDate).  It generates a
// slug automatically if none is provided, normalises tags into an
// array, and chooses the publish date based on scheduleAt or the
// current time.  When an item ID is provided, it performs a
// PATCH request to update the existing item; otherwise it creates a
// new item with a POST request.
exports.handler = async (event) => {
  // Allow CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200 };
  }
  // Require POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }
  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  // Determine the post title from either title or name.  This
  // corresponds to the "Title" field in Webflow.  If no title is
  // provided, return a 400 error.
  const title = data.title || data.name;
  if (!title) {
    return { statusCode: 400, body: 'Title required' };
  }
  // Slug: generate from title if not provided.
  const slug = data.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Author is optional; default to empty string.
  const author = data.author || '';
  // Normalise tags into an array.  Accept both an array or a
  // comma‑separated string.
  let tags = [];
  if (Array.isArray(data.tags)) {
    tags = data.tags;
  } else if (typeof data.tags === 'string') {
    tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  const summary = data.summary || '';
  const bodyContent = data.body || '';
  // Hero image and alt text can come from either heroUrl/heroAlt or
  // featureImageUrl.
  const heroUrl = data.heroUrl || data.featureImageUrl || null;
  const heroAlt = data.heroAlt || '';
  const scheduleAt = data.scheduleAt || data.publishDate || null;
  // Assemble the fieldData for Webflow.  These keys must match your
  // collection's field slugs.  Adjust them as necessary.
  const fieldData = {
    name: title,
    slug,
    Summary: summary,
    Body: bodyContent,
    // If heroUrl is provided, pass an object with a url property;
    // otherwise set to null.
    'Feature Image': heroUrl ? { url: heroUrl } : null,
    'Publish Date': scheduleAt || new Date().toISOString(),
    Author: author || undefined,
    Tags: tags.length ? tags : undefined,
    'Hero Alt': heroAlt || undefined,
  };
  // Remove undefined values to avoid sending empty keys to Webflow.
  Object.keys(fieldData).forEach((key) => {
    if (fieldData[key] === undefined) {
      delete fieldData[key];
    }
  });
  const payload = {
    isArchived: false,
    fieldData,
  };
  // If an ID is provided in the request, update the existing item.
  // Otherwise create a new item.  Webflow API v2 uses different
  // endpoints for create and update operations.
  const itemId = data.id || data.itemId || null;
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const baseUrl = `https://api.webflow.com/v2/collections/${collectionId}/items`;
  let url;
  let method;
  if (itemId) {
    url = `${baseUrl}/${itemId}`;
    method = 'PATCH';
  } else {
    url = baseUrl;
    method = 'POST';
  }
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const resBody = await res.text();
    return { statusCode: res.status, body: resBody };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
