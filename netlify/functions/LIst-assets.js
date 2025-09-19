// CommonJS Netlify Function for Cloudinary Admin Search
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
    const safe = q.replace(/["]/g, '\\"'); // escape quotes
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

exports.handler = async (event) => {
  try {
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing Cloudinary env vars" }),
      };
    }

    const params = new URL(event.rawUrl).searchParams;
    const q = params.get("q") || "";
    const type = params.get("type") || "";

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(API_KEY, API_SECRET),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        expression: buildExpressionFromQuery(q, type),
        max_results: 50,
        sort_by: [{ public_id: "desc" }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return {
        statusCode: 502,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Cloudinary error", status: res.status, body: txt }),
      };
    }

    const data = await res.json();
    const resources = (data.resources || []).map((r) => ({
      public_id: r.public_id,
      display_name: r.display_name || r.filename || r.public_id,
      filename: r.filename,
      secure_url: r.secure_url,
      resource_type: r.resource_type, // 'image' | 'video' | 'raw'
      format: r.format,               // 'jpg' | 'mp4' | 'pdf' | 'docx' ...
      bytes: r.bytes,
    }));

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resources }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
