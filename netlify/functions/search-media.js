// netlify/functions/search-media.js
// Unified search across Xano + Webflow
// Env vars required in Netlify:
//   XANO_BASE_URL              e.g. https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX
//   WEBFLOW_TOKEN              (Private Access Token)
//   WEBFLOW_COLLECTION_IDS     comma-separated list of collection IDs to search
//   WEBFLOW_API_VERSION        (optional) e.g. "1.0.0" or "2024-01-01"
//   ALLOW_ORIGINS              (optional) comma-separated, e.g. "https://www.streamofdan.com,https://*.webflow.io"

const DEFAULT_LIMIT = 50;

const corsHeaders = () => {
  const allow = process.env.ALLOW_ORIGINS || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  try {
    const url = new URL(event.rawUrl || `https://dummy${event.path}${event.queryStringParameters ? "?" + new URLSearchParams(event.queryStringParameters).toString() : ""}`);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || DEFAULT_LIMIT, 10), 200);

    const [xano, webflow] = await Promise.allSettled([
      fetchFromXano(q, limit),
      fetchFromWebflow(q, limit),
    ]);

    const xanoResults = xano.status === "fulfilled" ? xano.value : [];
    const webflowResults = webflow.status === "fulfilled" ? webflow.value : [];

    // Merge + sort (title asc, then source)
    const results = [...xanoResults, ...webflowResults]
      .sort((a, b) => (a.title || "").localeCompare(b.title || "") || (a.source || "").localeCompare(b.source || ""));

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ q, count: results.length, results }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Search failed", detail: String(err) }),
    };
  }
};

// ---------- XANO ----------
async function fetchFromXano(q, limit) {
  const base = process.env.XANO_BASE_URL;
  if (!base) return [];

  // Pull assets; if Xano has a search endpoint, swap the URL below to use it.
  const res = await fetch(`${base}/asset`);
  if (!res.ok) throw new Error(`Xano HTTP ${res.status}`);
  const items = await res.json();

  const pick = (v) => (typeof v === "string" ? v : "");
  const match = (item) => {
    if (!q) return true;
    const hay = [
      pick(item.title),
      pick(item.description),
      pick(item.station),
      pick(item.tags),
      pick(item.submitted_by),
    ].join(" ").toLowerCase();
    return hay.includes(q);
  };

  return items
    .filter(match)
    .slice(0, limit)
    .map((x) => normalize({
      id: `xano:${x.id}`,
      title: x.title || "Untitled",
      description: x.description || "",
      station: x.station || "",
      tags: x.tags || "",
      thumbnail: x.thumbnail || x.thumb_url || "",
      media_url: x.database_url || x.file_url || x.url || "",
      file_type: x.file_type || "",
      submitted_by: x.submitted_by || "",
      created_at: x.created_at || x.created || "",
      source: "xano",
      raw: x,
    }));
}

// ---------- WEBFLOW ----------
async function fetchFromWebflow(q, limit) {
  const token = process.env.WEBFLOW_TOKEN;
  const ids = (process.env.WEBFLOW_COLLECTION_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!token || ids.length === 0) return [];

  const versionHeader = process.env.WEBFLOW_API_VERSION ? { "x-webflow-api-version": process.env.WEBFLOW_API_VERSION } : { "accept-version": "1.0.0" };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...versionHeader,
  };

  // fetch up to 'limit' across all collections (simple pagination)
  const all = [];
  for (const cid of ids) {
    let offset = 0;
    const step = Math.min(limit, 100);
    while (all.length < limit) {
      const url = `https://api.webflow.com/collections/${cid}/items?limit=${step}&offset=${offset}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Webflow HTTP ${res.status} for collection ${cid}`);
      const data = await res.json();
      const items = data.items || data.data || [];

      all.push(...items);
      if (items.length < step) break;
      offset += step;
    }
    if (all.length >= limit) break;
  }

  // normalize + filter by q
  const out = all.map((w) => {
    // Webflow CMS v1: custom fields are at top-level using field slugs.
    const title = w.name || w.title || "";
    const description = w.description || w["long-description"] || w["body"] || "";
    const station = w.station || w["station-name"] || "";
    const tagsField = w.tags || w["tags-text"] || w["tag-list"] || [];
    const tags = Array.isArray(tagsField) ? tagsField.join(", ") : tagsField || "";
    const fileUrl = w.file_url || w["file-url"] || w.media_url || w["media-url"] || w.url || "";
    const thumb = (w.thumbnail && (w.thumbnail.url || w.thumbnail)) || w.thumb || w["main-image"] || "";

    return normalize({
      id: `webflow:${w._id || w.id}`,
      title,
      description,
      station,
      tags,
      thumbnail: thumb,
      media_url: fileUrl,
      file_type: guessType(fileUrl),
      submitted_by: w.submitted_by || "",
      created_at: w.created || w["created-on"] || w["createdAt"] || "",
      source: "webflow",
      raw: w,
    });
  });

  const qlc = q.toLowerCase();
  const match = (r) =>
    !q ||
    [r.title, r.description, r.station, r.tags, r.submitted_by]
      .join(" ")
      .toLowerCase()
      .includes(qlc);

  return out.filter(match).slice(0, limit);
}

// ---------- helpers ----------
function normalize(obj) {
  return {
    id: obj.id,
    source: obj.source, // "xano" | "webflow"
    title: obj.title || "Untitled",
    description: obj.description || "",
    station: obj.station || "",
    tags: obj.tags || "",
    thumbnail: obj.thumbnail || "",
    media_url: obj.media_url || "",
    file_type: obj.file_type || "",
    submitted_by: obj.submitted_by || "",
    created_at: obj.created_at || "",
    raw: obj.raw || null,
  };
}

function guessType(url) {
  if (!url) return "";
  const u = url.toLowerCase();
  if (u.endsWith(".mp3") || u.includes("audio/")) return "audio/mp3";
  if (u.endsWith(".wav")) return "audio/wav";
  if (u.endsWith(".m4a")) return "audio/m4a";
  if (u.endsWith(".mp4")) return "video/mp4";
  if (u.endsWith(".mov")) return "video/quicktime";
  if (u.endsWith(".pdf")) return "application/pdf";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".png")) return "image/png";
  return "";
}
