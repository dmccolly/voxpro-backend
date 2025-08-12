// netlify/functions/xano-proxy.js
// Proxies requests to Xano with CORS for Webflow/other domains.
// Required env:
//   XANO_BASE_URL        e.g. https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX
//   ALLOW_ORIGINS        e.g. https://history-of-idaho-broadcasting--717ee2.webflow.io,https://www.streamofdan.com

function corsHeaders(origin) {
  const allow = (process.env.ALLOW_ORIGINS || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const ok =
    allow.includes("*") ||
    (origin && allow.some(a => origin === a));

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
  if (!base) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "XANO_BASE_URL not set" }) };
  }

  try {
    // Everything after the function name becomes the Xano path suffix
    // e.g. /.netlify/functions/xano-proxy/asset/123?foo=bar -> /asset/123?foo=bar
    const fnPrefix = "/.netlify/functions/xano-proxy";
    const suffix = (event.path || "").startsWith(fnPrefix)
      ? event.path.slice(fnPrefix.length)
      : (new URL(event.rawUrl)).pathname.replace(fnPrefix, "");

    const qs = event.rawUrl.includes("?") ? "?" + event.rawUrl.split("?")[1] : "";
    const target = base.replace(/\/$/, "") + (suffix || "") + qs;

    const upstreamHeaders = {
      "Content-Type": event.headers["content-type"] || event.headers["Content-Type"] || "application/json",
    };
    if (event.headers.Authorization) upstreamHeaders.Authorization = event.headers.Authorization;

    const resp = await fetch(target, {
      method: event.httpMethod,
      headers: upstreamHeaders,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "application/json";

    return {
      statusCode: resp.status,
      headers: { ...headers, "Content-Type": contentType },
      body: text,
    };
  } catch (e) {
    console.error("Proxy error:", e);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Proxy failed", detail: String(e) }) };
  }
};
