// Simple Canvas proxy for Netlify Functions.
// Relays /api/v1/* requests to your Canvas domain using the token sent in X-Canvas-Token.
// CORS: wide-open to simplify first deploy. Lock down later if you want.

exports.handler = async (event) => {
  const headers = event.headers || {};
  const origin  = headers.origin || "";
  const method  = event.httpMethod || "GET";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Canvas-Token",
    "Vary": "Origin"
  };

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const params = event.queryStringParameters || {};
  const base   = (params.base || "").replace(/\/+$/, "");
  const path   = (params.path || "");
  const token  = headers["x-canvas-token"] || headers["X-Canvas-Token"];

  if (!base || !/^https:\/\/.+\.instructure\.com$/i.test(base)) {
    return { statusCode: 400, headers: corsHeaders, body: "Invalid base" };
  }
  if (!/^api\/v1\//.test(path)) {
    return { statusCode: 400, headers: corsHeaders, body: "Only /api/v1/* is allowed." };
  }
  if (!token) {
    return { statusCode: 401, headers: corsHeaders, body: "Missing token" };
  }

  const url = `${base}/${path}${event.rawQuery ? "" : ""}`; // extra safety: ignore other query params
  const init = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      ...(headers["content-type"] ? { "Content-Type": headers["content-type"] } : {})
    },
    body: ["GET","HEAD"].includes(method) ? undefined : event.body
  };

  try {
    const resp = await fetch(url, init);
    const text = await resp.text();
    return {
      statusCode: resp.status,
      headers: { ...corsHeaders, "Content-Type": resp.headers.get("content-type") || "application/json" },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, headers: corsHeaders, body: "Upstream fetch failed." };
  }
};
