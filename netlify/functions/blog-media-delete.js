// netlify/functions/blog-media-delete.js
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const allowOrigin = process.env.ALLOW_ORIGIN || "*";
const ok = (body) => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS"
  },
  body: JSON.stringify(body)
});

async function tryDelete(publicId, resource_type) {
  const r = await cloudinary.api.delete_resources([publicId], { resource_type });
  const status = r.deleted && r.deleted[publicId];
  return status && status !== "not_found";
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return ok({ ok: true });
  if (event.httpMethod !== "DELETE") return { statusCode: 405, body: "Method Not Allowed" };

  const qs = new URLSearchParams(event.rawQuery || "");
  const id = (qs.get("id") || "").trim();
  if (!id) return { statusCode: 400, body: "Missing id (public_id)" };

  try {
    const deleted =
      (await tryDelete(id, "image")) ||
      (await tryDelete(id, "video")) ||
      (await tryDelete(id, "raw"));

    return ok({ ok: true, id, deleted: !!deleted });
  } catch (e) {
    return ok({ error: String(e.message || e), id });
  }
};
