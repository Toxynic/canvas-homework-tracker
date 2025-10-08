console.log("[tracker] app.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[tracker] DOM ready");

  const form      = document.getElementById("authForm");
  const statusEl  = document.getElementById("status");
  const verifyBtn = document.getElementById("verifyBtn");
  const toggleBtn = document.getElementById("toggleToken");

  // Your Netlify serverless function path (works locally & on Netlify)
  const PROXY_URL = "/.netlify/functions/canvas-proxy";

  function setStatus(type, msg) {
    if (!statusEl) return;
    statusEl.className = `status ${type}`;
    statusEl.textContent = msg;
  }

  function normalizeUrl(u){
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u.replace(/\/+$/,"");
  }

  function isValidUrl(u){
    try { new URL(u); return true; } catch { return false; }
  }

  // Optional: show/hide token
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const tokenInput = document.getElementById("token");
      const isPw = tokenInput.type === "password";
      tokenInput.type = isPw ? "text" : "password";
      toggleBtn.textContent = isPw ? "Hide" : "Show";
    });
  }

  if (!form) {
    console.error("[tracker] form#authForm not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();            // <-- stops the page from refreshing
    console.log("[tracker] submit intercepted");

    const baseInput  = document.getElementById("baseUrl");
    const tokenInput = document.getElementById("token");

    const baseRaw = (baseInput?.value || "").trim();
    const token   = (tokenInput?.value || "").trim();

    if (!baseRaw || !token) {
      setStatus("err", "Please fill both fields.");
      return;
    }

    const base = normalizeUrl(baseRaw);
    if (!isValidUrl(base)) {
      setStatus("err", "Enter a valid Canvas URL (include https://).");
      return;
    }

    setStatus("warn", "Verifying…");
    verifyBtn.disabled = true;

    const url = `${PROXY_URL}?base=${encodeURIComponent(base)}&path=${encodeURIComponent("api/v1/users/self/profile")}`;

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "X-Canvas-Token": token,
          "Accept": "application/json"
        }
      });

      const text = await resp.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}

      if (resp.status === 401) {
        setStatus("err", "Unauthorized (401). Token invalid or expired.");
      } else if (resp.status === 400 && /Invalid base/i.test(text)) {
        setStatus("err", "Invalid Canvas URL. Use your exact school domain (e.g., https://dubiski.instructure.com).");
      } else if (!resp.ok) {
        setStatus("err", `Proxy error ${resp.status}: ${text || resp.statusText}`);
      } else {
        setStatus("ok", `Connected! Hi, ${data.name || "student"}.`);
        // (Optional) Save locally for later steps
        try {
          localStorage.setItem("canvasAuth", JSON.stringify({ baseUrl: base, token }));
        } catch {}
      }
    } catch (err) {
      console.error(err);
      setStatus("err", "Network error. Make sure your Netlify site is deployed.");
    } finally {
      verifyBtn.disabled = false;
    }
  });
});
