// netlify/functions/canvas-proxy.js
exports.handler = async (event) => {
  const headers = event.headers || {};
  const method  = event.httpMethod || "GET";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Canvas-Token",
    "Access-Control-Expose-Headers": "Link, Content-Type",
    "Vary": "Origin"
  };
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const params = event.queryStringParameters || {};
  const base   = (params.base || "").replace(/\/+$/,"");
  const path   = (params.path || "");
  const token  = headers["x-canvas-token"] || headers["X-Canvas-Token"];

  if (!base || !/^https:\/\/.+\.instructure\.com$/i.test(base))
    return { statusCode: 400, headers: corsHeaders, body: "Invalid base" };
  if (!/^api\/v1\//.test(path))
    return { statusCode: 400, headers: corsHeaders, body: "Only /api/v1/* is allowed." };
  if (!token)
    return { statusCode: 401, headers: corsHeaders, body: "Missing token" };

  const url = `${base}/${path}`;
  try{
    const resp = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        ...(headers["content-type"] ? { "Content-Type": headers["content-type"] } : {})
      },
      body: ["GET","HEAD"].includes(method) ? undefined : event.body
    });

    const buf = Buffer.from(await resp.arrayBuffer());
    const outHeaders = {
      ...corsHeaders,
      "Content-Type": resp.headers.get("content-type") || "application/json"
    };
    const link = resp.headers.get("link");
    if (link) outHeaders["Link"] = link;

    return {
      statusCode: resp.status,
      headers: outHeaders,
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 502, headers: corsHeaders, body: "Upstream fetch failed." };
  }
};
