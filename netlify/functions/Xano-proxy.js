// netlify/functions/xano-proxy.js
// Proxies Xano requests to avoid CORS problems when embedding on Webflow/etc.
// Env: XANO_BASE_URL, ALLOW_ORIGINS

function corsHeaders(origin) {
  const allow = (process.env.ALLOW_ORIGINS || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const ok = allow.includes("*") || (origin && allow.some(a => origin === a));
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : "*",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = corsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const base = process.env.XANO_BASE_URL;
  if (!base) return { statusCode: 500, headers, body: JSON.stringify({ error: "XANO_BASE_URL not set" }) };

  try {
    const prefix = "/.netlify/functions/xano-proxy";
    const url = new URL(event.rawUrl);
    const pathSuffix = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : "/";
    const target = base.replace(/\/$/, "") + (pathSuffix || "/") + (url.search || "");

    const upstreamHeaders = {
      "Content-Type": event.headers["content-type"] || event.headers["Content-Type"] || "application/json",
    };
    if (event.headers.Authorization) upstreamHeaders.Authorization = event.headers.Authorization;

    const resp = await fetch(target, {
      method: event.httpMethod,
      headers: upstreamHeaders,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });

    const bodyText = await resp.text();
    const contentType = resp.headers.get("content-type") || "application/json";

    return { statusCode: resp.status, headers: { ...headers, "Content-Type": contentType }, body: bodyText };
  } catch (e) {
    console.error("xano-proxy error:", e);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Proxy failed", detail: String(e) }) };
  }
};
