exports.handler = async (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || "";
  const method = event.httpMethod || "GET";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Canvas-Token",
  };
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };

  const params = event.queryStringParameters || {};
  const base = (params.base || "").replace(/\/+$/, "");
  const path = (params.path || "");
  const token = headers["x-canvas-token"];

  if (!base || !/^https:\/\/.+\.instructure\.com/.test(base))
    return { statusCode: 400, headers: corsHeaders, body: "Invalid base" };
  if (!token)
    return { statusCode: 401, headers: corsHeaders, body: "Missing token" };

  const url = `${base}/${path}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await resp.text();

  return {
    statusCode: resp.status,
    headers: { ...corsHeaders, "Content-Type": resp.headers.get("content-type") || "text/plain" },
    body: text,
  };
};
