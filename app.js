console.log("[tracker] app.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[tracker] DOM ready");

  // Elements
  const connectSection = document.getElementById("connectSection");
  const dashSection    = document.getElementById("dashSection");

  const form      = document.getElementById("authForm");
  const statusEl  = document.getElementById("status");
  const verifyBtn = document.getElementById("verifyBtn");
  const toggleBtn = document.getElementById("toggleToken");

  const dashStatus  = document.getElementById("dashStatus");
  const studentName = document.getElementById("studentName");
  const listToday   = document.getElementById("listToday");
  const listWeek    = document.getElementById("listWeek");
  const listAll     = document.getElementById("listAll");
  const refreshBtn  = document.getElementById("refreshBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");

  // Netlify serverless function endpoint
  const PROXY_URL = "/.netlify/functions/canvas-proxy";

  // App state
  let state = {
    baseUrl: null,
    token: null,
    profile: null,
  };

  // Helpers
  function setStatus(type, msg){
    statusEl.className = `status ${type}`;
    statusEl.textContent = msg;
  }
  function setDashStatus(type, msg){
    dashStatus.className = `status ${type}`;
    dashStatus.textContent = msg;
  }
  function normalizeUrl(u){
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u.replace(/\/+$/,"");
  }
  function isValidUrl(u){
    try { new URL(u); return true; } catch { return false; }
  }
  async function apiFetch(path, opts = {}){
    const url = `${PROXY_URL}?base=${encodeURIComponent(state.baseUrl)}&path=${encodeURIComponent(path)}`;
    const resp = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        "X-Canvas-Token": state.token,
        "Accept": "application/json",
        ...(opts.headers || {})
      },
      body: opts.body
    });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>resp.statusText);
      throw new Error(`Proxy ${resp.status}: ${text || resp.statusText}`);
    }
    return resp.json();
  }
  function saveAuth(){
    try { localStorage.setItem("canvasAuth", JSON.stringify({ baseUrl: state.baseUrl, token: state.token, profile: state.profile })); } catch {}
  }
  function loadAuth(){
    try {
      const raw = localStorage.getItem("canvasAuth");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function showDashboard(){
    if (state.profile?.name) studentName.textContent = state.profile.name.toUpperCase();
    connectSection.classList.add("hidden");
    dashSection.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showConnect(){
    dashSection.classList.add("hidden");
    connectSection.classList.remove("hidden");
  }

  // Populate lists
  function clearLists(){
    for (const ul of [listToday, listWeek, listAll]) ul.innerHTML = "";
  }
  function renderItem(ul, item){
    const li = document.createElement("li");
    li.className = "item";

    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = item.title || item.assignment?.name || "Untitled";

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const courseName = item.context_name || item.course_name || (item.assignment?.course_id ? `Course #${item.assignment.course_id}` : "Course");
    meta.textContent = courseName;

    const right = document.createElement("div");
    right.className = "pills";

    // Due pill
    const due = item.assignment?.due_at || item.due_at || null;
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = due ? formatDue(due) : "No due date";
    // style by urgency
    const urgency = dueUrgency(due);
    if (urgency === "bad") pill.classList.add("bad");
    else if (urgency === "warn") pill.classList.add("warn");

    // Link pill
    const link = document.createElement("a");
    link.className = "pill link";
    link.href = item.html_url || item.assignment?.html_url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open in Canvas";

    right.appendChild(pill);
    right.appendChild(link);

    const leftWrap = document.createElement("div");
    leftWrap.appendChild(title);
    leftWrap.appendChild(meta);

    li.appendChild(leftWrap);
    li.appendChild(right);
    ul.appendChild(li);
  }
  function formatDue(iso){
    try{
      const d = new Date(iso);
      const now = new Date();
      const opts = { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" };
      const datePart = d.toLocaleString(undefined, opts);
      const diff = d.getTime() - now.getTime();
      const days = Math.floor(diff / (24*3600*1000));
      if (days === 0) return `Due Today • ${datePart}`;
      if (days === 1) return `Due Tomorrow • ${datePart}`;
      if (days < 0)  return `Past Due • ${datePart}`;
      return `Due in ${days}d • ${datePart}`;
    }catch{ return "Due date"; }
  }
  function dueUrgency(iso){
    if (!iso) return "ok";
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = d - now;
    if (diff < 0) return "bad";                // past due
    if (diff <= 24*3600*1000) return "bad";    // due within 24h
    if (diff <= 7*24*3600*1000) return "warn"; // within a week
    return "ok";
  }

  async function loadTodo(){
    setDashStatus("warn","Loading your To-Do…");
    clearLists();
    try{
      // Canvas To-Do items for the user
      const items = await apiFetch("api/v1/users/self/todo?per_page=100");
      // Normalize and sort by due date asc
      const withDue = items.map(x => ({
        ...x,
        _due: new Date(x.assignment?.due_at || x.due_at || 8640000000000000).getTime() // far future if none
      })).sort((a,b)=>a._due - b._due);

      const now = new Date();
      const dayEnd = new Date(now); dayEnd.setHours(23,59,59,999);
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate()+7); weekEnd.setHours(23,59,59,999);

      let cntToday=0, cntWeek=0, cntAll=0;

      for (const item of withDue){
        const dueIso = item.assignment?.due_at || item.due_at || null;
        const due = dueIso ? new Date(dueIso) : null;

        renderItem(listAll, item); cntAll++;

        if (due && due <= dayEnd){ renderItem(listToday, item); cntToday++; }
        else if (due && due <= weekEnd){ renderItem(listWeek, item); cntWeek++; }
      }

      if (!cntToday) listToday.innerHTML = `<li class="item"><div><p class="item-title">Nothing due today 🎉</p><div class="item-meta">You’re all caught up.</div></div></li>`;
      if (!cntWeek)  listWeek.innerHTML  = `<li class="item"><div><p class="item-title">No items in the next 7 days</p><div class="item-meta">Check All To-Do below.</div></div></li>`;
      if (!cntAll)   listAll.innerHTML   = `<li class="item"><div><p class="item-title">No To-Do items</p><div class="item-meta">When assignments appear in Canvas, they’ll show here.</div></div></li>`;

      setDashStatus("ok", "Loaded.");
    }catch(err){
      console.error(err);
      setDashStatus("err", err.message || "Failed to load To-Do items.");
    }
  }

  // Token show/hide
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const tokenInput = document.getElementById("token");
      const isPw = tokenInput.type === "password";
      tokenInput.type = isPw ? "text" : "password";
      toggleBtn.textContent = isPw ? "Hide" : "Show";
    });
  }

  // Submit (Verify & Save)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("[tracker] submit intercepted");

    const baseRaw  = document.getElementById("baseUrl").value.trim();
    const tokenRaw = document.getElementById("token").value.trim();

    if (!baseRaw || !tokenRaw) { setStatus("err","Please fill both fields."); return; }

    const base = normalizeUrl(baseRaw);
    if (!isValidUrl(base)) { setStatus("err","Enter a valid Canvas URL (include https://)."); return; }

    setStatus("warn","Verifying…");
    verifyBtn.disabled = true;

    try{
      // Verify profile
      const resp = await fetch(`${PROXY_URL}?base=${encodeURIComponent(base)}&path=${encodeURIComponent("api/v1/users/self/profile")}`, {
        headers: { "X-Canvas-Token": tokenRaw, "Accept": "application/json" }
      });
      const text = await resp.text();
      let profile = {};
      try { profile = JSON.parse(text); } catch {}

      if (resp.status === 401){
        setStatus("err","Unauthorized (401). Token invalid or expired.");
        return;
      }
      if (!resp.ok){
        setStatus("err", `Proxy error ${resp.status}: ${text || resp.statusText}`);
        return;
      }

      // Save auth and show dashboard
      state.baseUrl = base;
      state.token   = tokenRaw;
      state.profile = profile;
      saveAuth();

      setStatus("ok", `Connected! Hi, ${profile.name}.`);
      showDashboard();
      await loadTodo();
    } catch (err){
      console.error(err);
      setStatus("err","Network error. Make sure your Netlify site is deployed.");
    } finally {
      verifyBtn.disabled = false;
    }
  });

  // Refresh
  refreshBtn.addEventListener("click", () => loadTodo());

  // Disconnect
  disconnectBtn.addEventListener("click", () => {
    localStorage.removeItem("canvasAuth");
    state = { baseUrl:null, token:null, profile:null };
    showConnect();
  });

  // Auto-load if saved
  const saved = loadAuth();
  if (saved?.baseUrl && saved?.token){
    state.baseUrl = saved.baseUrl;
    state.token   = saved.token;
    state.profile = saved.profile || null;
    if (state.profile?.name) studentName.textContent = (state.profile.name || "Student").toUpperCase();
    showDashboard();
    loadTodo(); // best-effort; if it fails, user can Disconnect and reconnect
  }
});
