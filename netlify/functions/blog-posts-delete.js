// netlify/functions/blog-posts-delete.js
const API = "https://api.webflow.com/v2";

const allowOrigin = process.env.ALLOW_ORIGIN || "*";
const ok = (body) => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  },
  body: JSON.stringify(body)
});
const err = (code, msg) => ({
  statusCode: code,
  headers: { "Access-Control-Allow-Origin": allowOrigin },
  body: typeof msg === "string" ? msg : JSON.stringify(msg)
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return ok({ ok: true });
  if (event.httpMethod !== "POST") return err(405, "Method Not Allowed");

  const token = process.env.WEBFLOW_API_TOKEN;
  const collectionId = process.env.WEBFLOW_POSTS_COLLECTION_ID;
  if (!token || !collectionId) return err(500, "Missing WEBFLOW_API_TOKEN or WEBFLOW_POSTS_COLLECTION_ID");

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const id = (body.id || "").trim();
  if (!id) return err(400, "Missing id");

  try {
    // Webflow v2 delete
    const res = await fetch(`${API}/collections/${collectionId}/items/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return err(res.status, await res.text());
    return ok({ ok: true, id, deleted: true });
  } catch (e) {
    return err(500, { error: String(e.message || e), id });
  }
};
