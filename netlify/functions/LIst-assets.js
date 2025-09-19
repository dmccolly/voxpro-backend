// ESM Netlify Function (Node 18+)
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function basicAuthHeader(key, secret) {
  const token = Buffer.from(`${key}:${secret}`).toString('base64');
  return `Basic ${token}`;
}

function buildExpressionFromQuery(q = "", type = "") {
  const parts = [];
  if (q) {
    // search in filename, public_id, and tags
    const safe = q.replace(/["]/g, '\\"');
    parts.push(`(filename:${safe}* OR public_id:${safe}* OR tags:${safe})`);
  }
  if (type) {
    if (type === "image" || type === "video" || type === "raw") {
      parts.push(`resource_type:${type}`);
    } else if (type === "pdf") {
      parts.push(`format:pdf`);
    }
  }
  return parts.length ? parts.join(" AND ") : "/*";
}

export async function handler(event) {
  try {
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return new Response(
        JSON.stringify({ error: "Missing Cloudinary env vars" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;
    const params = new URL(event?.rawUrl || "").searchParams;
    const q = params.get("q") || "";
    const type = params.get("type") || "";

    const bod
