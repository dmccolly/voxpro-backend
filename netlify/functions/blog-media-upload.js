// netlify/functions/blog-media-upload.js
const cloudinary = require("cloudinary").v2;
const Busboy = require("busboy");

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
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return ok({ ok: true });
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: "Method Not Allowed" };

  const contentType = event.headers["content-type"] || event.headers["Content-Type"];
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return { statusCode: 400, body: "Expected multipart/form-data" };
  }

  const busboy = Busboy({
    headers: { "content-type": contentType }
  });

  const scope =
    (new URLSearchParams(event.rawQuery || "")).get("collection") ||
    (new URLSearchParams(event.rawQuery || "")).get("folder") ||
    (new URLSearchParams(event.rawQuery || "")).get("tag") ||
    (new URLSearchParams(event.rawQuery || "")).get("scope") ||
    "blog";

  const buf = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "binary");

  const result = await new Promise((resolve, reject) => {
    let resolved = false;

    busboy.on("file", (_name, file, info) => {
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("end", async () => {
        try {
          const upload = await new Promise((res, rej) => {
            const stream = cloudinary.uploader.upload_stream(
              { resource_type: "auto", tags: [scope] },
              (err, r) => (err ? rej(err) : res(r))
            );
            stream.end(Buffer.concat(chunks));
          });

          const type = upload.resource_type;
          let thumb = "";
          if (type === "image") {
            thumb = cloudinary.url(upload.public_id, {
              secure: true, width: 320, height: 220, crop: "fill", quality: "auto", fetch_format: "auto"
            });
          } else if (type === "video") {
            thumb = cloudinary.url(upload.public_id, {
              secure: true, resource_type: "video", format: "jpg",
              transformation: [{ start_offset: "0" }, { width: 320, height: 220, crop: "fill" }]
            });
          }

          if (!resolved) {
            resolved = true;
            resolve({
              id: upload.public_id,
              public_id: upload.public_id,
              url: upload.secure_url || upload.url,
              secure_url: upload.secure_url || upload.url,
              resource_type: type,
              filename: upload.original_filename,
              width: upload.width,
              height: upload.height,
              tags: upload.tags || [],
              thumb
            });
          }
        } catch (e) {
          if (!resolved) { resolved = true; reject(e); }
        }
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (!resolved) reject(new Error("No file found in form data"));
    });

    busboy.end(buf);
  });

  return ok(result);
};
