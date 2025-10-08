// Netlify Function — Canvas Proxy with CORS & exposed headers
// SECURITY: Limits to *.instructure.com base. Token via X-Canvas-Token (header).
// Pass a full Canvas API path (including query): e.g. api/v1/users/self/todo?per_page=100

exports.handler = async (event) => {
  const headers = event.headers || {};
  const method  = event.httpMethod || "GET";

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Canvas-Token",
    "Access-Control-Expose-Headers": "Link,X-Canvas-Link,Content-Type",
    "Vary": "Origin"
  };

  if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  try {
    const params = event.queryStringParameters || {};
    const base   = (params.base || "").replace(/\/+$/,"");
    const path   = (params.path || "").replace(/^\/+/,""); // allow query inside

    if (!base || !/^https:\/\/[a-z0-9.-]+\.instructure\.com$/i.test(base)) {
      return { statusCode: 400, headers: CORS, body: "Invalid base" };
    }
    if (!/^api\/v1\//.test(path)) {
      return { statusCode: 400, headers: CORS, body: "Only /api/v1/* is allowed." };
    }

    const token = headers["x-canvas-token"] || headers["X-Canvas-Token"];
    if (!token) {
      return { statusCode: 401, headers: CORS, body: "Missing token" };
    }

    const url = `${base}/${path}`;
    const upstream = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        ...(headers["content-type"] ? { "Content-Type": headers["content-type"] } : {})
      },
      body: ["GET","HEAD"].includes(method) ? undefined : event.body
    });

    const text = await upstream.text();
    const link = upstream.headers.get("link") || "";

    return {
      statusCode: upstream.status,
      headers: { 
        ...CORS,
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Link": link,
        "X-Canvas-Link": link
      },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: "Upstream fetch failed." };
  }
};
