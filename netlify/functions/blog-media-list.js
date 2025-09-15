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
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return ok({ ok: true });
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };

  const params = new URLSearchParams(event.rawQuery || "");
  const q = (params.get("q") || "").trim();
  const scope =
    params.get("collection") || params.get("folder") ||
    params.get("tag") || params.get("scope") || "blog";

  // accept blog tag OR blog folder
  const parts = [
    "(resource_type:image OR resource_type:video OR resource_type:raw)",
    `(tags:${scope} OR folder:${scope} OR public_id:${scope}/*)`
  ];
  if (q) parts.push(`(filename:${q}* OR public_id:${q}* OR context:${q}*)`);
  const expr = parts.join(" AND ");

  try {
    const res = await cloudinary.search
      .expression(expr)
      .with_field("tags")
      .sort_by("created_at", "desc")
      .max_results(60)
      .execute();

    const items = (res.resources || []).map((r) => {
      const id = r.public_id;
      const type = r.resource_type;
      let thumb = "";

      if (type === "image") {
        thumb = cloudinary.url(id, {
          secure: true, width: 320, height: 220, crop: "fill",
          quality: "auto", fetch_format: "auto"
        });
      } else if (type === "video") {
        thumb = cloudinary.url(id, {
          secure: true, resource_type: "video", format: "jpg",
          transformation: [{ start_offset: "0" }, { width: 320, height: 220, crop: "fill" }]
        });
      }

      return {
        id,
        public_id: id,
        url: r.secure_url || r.url,
        secure_url: r.secure_url || r.url,
        resource_type: type,
        filename: r.original_filename,
        width: r.width, height: r.height,
        tags: r.tags || [],
        thumb
      };
    });

    return ok(items);
  } catch (e) {
    return ok({ error: String(e.message || e) });
  }
};
