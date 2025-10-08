/* =========================================================
   Canvas Homework Tracker — Premium UI + Enhanced Features
   - Theme toggle (dark/light) + keyboard shortcuts (D, R, /)
   - Connect screen → Dashboard transition
   - Fetch To-Do items (paginated), Course map, caching
   - Search, filter (Today/Week/Later/Past/Dones), sort
   - Local "Done" + "Snooze" (kept in localStorage)
   - Skeleton loading, toasts, micro-animations
   - Netlify Function proxy path: /.netlify/functions/canvas-proxy
========================================================= */

console.log("[tracker] app.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[tracker] DOM ready");

  /* ---------- Elements ---------- */
  const html = document.documentElement;

  const connectSection = $("#connectSection");
  const dashSection    = $("#dashSection");

  // connect
  const form      = $("#authForm");
  const statusEl  = $("#status");
  const verifyBtn = $("#verifyBtn");
  const toggleBtn = $("#toggleToken");
  const baseUrlInput = $("#baseUrl");
  const tokenInput   = $("#token");

  // header / global
  const openCanvas = $("#openCanvas");
  const themeBtn   = $("#themeBtn");
  const toastEl    = $("#toast");

  // dashboard
  const studentName = $("#studentName");
  const refreshBtn  = $("#refreshBtn");
  const disconnectBtn = $("#disconnectBtn");
  const dashStatus  = $("#dashStatus");

  const listToday = $("#listToday");
  const listWeek  = $("#listWeek");
  const listLater = $("#listLater");
  const listAll   = $("#listAll");

  const skToday = $("#skToday");
  const skWeek  = $("#skWeek");
  const skLater = $("#skLater");
  const skAll   = $("#skAll");

  const kpiToday = $("#kpiToday");
  const kpiWeek  = $("#kpiWeek");
  const kpiLater = $("#kpiLater");
  const kpiPast  = $("#kpiPast");

  const ctToday = $("#ctToday");
  const ctWeek  = $("#ctWeek");
  const ctLater = $("#ctLater");
  const ctAll   = $("#ctAll");

  const searchInput = $("#searchInput");
  const filterSelect = $("#filterSelect");
  const sortSelect   = $("#sortSelect");
  const hideDoneCB   = $("#hideDone");

  // API proxy
  const PROXY_URL = "/.netlify/functions/canvas-proxy";

  /* ---------- State ---------- */
  let state = {
    baseUrl: null,
    token: null,
    profile: null,
    courses: null,   // map by id
    todo: [],        // raw API items
    ui: {
      search: "",
      filter: "all", // all | today | week | later | past | done
      sort: "dueAsc",
      hideDone: false,
    }
  };

  /* ---------- Utils ---------- */
  function $(s){ return document.querySelector(s); }
  function setStatus(type, msg){
    statusEl.className = `status ${type}`;
    statusEl.textContent = msg;
  }
  function setDashStatus(type, msg){
    dashStatus.className = `status ${type}`;
    dashStatus.textContent = msg;
  }
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(()=> toastEl.classList.remove("show"), 1500);
  }
  function normalizeUrl(u){
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u.replace(/\/+$/,"");
  }
  function isValidUrl(u){
    try { new URL(u); return true; } catch { return false; }
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
  function saveCache(key, data){
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); } catch {}
  }
  function loadCache(key, maxAgeMs){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.t > maxAgeMs) return null;
      return obj.data;
    } catch { return null; }
  }
  function showDashboard(){
    connectSection.classList.add("hidden");
    dashSection.classList.remove("hidden");
    window.scrollTo({ top:0, behavior:"smooth" });
  }
  function showConnect(){
    dashSection.classList.add("hidden");
    connectSection.classList.remove("hidden");
  }
  function setOpenCanvasHref(){
    if (state.baseUrl) {
      openCanvas.href = state.baseUrl;
    } else {
      openCanvas.href = "#";
    }
  }

  // Theming
  function toggleTheme(){
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }
  function initTheme(){
    const saved = localStorage.getItem("theme");
    if (saved) html.setAttribute("data-theme", saved);
  }

  // Colors for courses
  function colorForCourse(courseId){
    if (!courseId) return "#7aa7ff";
    let x = courseId;
    x = ((x<<13) ^ x) >>> 0;
    const hue = x % 360;
    return `hsl(${hue} 70% 60%)`;
  }

  // Dates
  function parseDue(item){
    return item.assignment?.due_at || item.due_at || null;
  }
  function dueCategory(iso){
    if (!iso) return "later";
    const t = new Date(iso).getTime();
    const now = Date.now();
    const endToday = new Date(); endToday.setHours(23,59,59,999);
    const endWeek  = new Date(); endWeek.setDate(endWeek.getDate()+7); endWeek.setHours(23,59,59,999);
    if (t < now) return "past";
    if (t <= endToday.getTime()) return "today";
    if (t <= endWeek.getTime()) return "week";
    return "later";
  }
  function formatDue(iso){
    if (!iso) return ["No due date", "ok"];
    const t = new Date(iso);
    const now = new Date();
    const diff = t.getTime() - now.getTime();
    const days = Math.floor(diff/(24*3600*1000));
    const pretty = t.toLocaleString(undefined, { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
    if (diff < 0) return [`Past Due • ${pretty}`, "bad"];
    if (days === 0) return [`Due Today • ${pretty}`, "bad"];
    if (days === 1) return [`Due Tomorrow • ${pretty}`, "warn"];
    if (days <= 7) return [`Due in ${days}d • ${pretty}`, "warn"];
    return [`Due ${pretty}`, "ok"];
  }

  // Local Done / Snooze
  function doneKey(item){ return `done:${item.html_url || item.assignment?.id || item.id}`; }
  function snoozeKey(item){ return `snooze:${item.html_url || item.assignment?.id || item.id}`; }
  function isDone(item){ return localStorage.getItem(doneKey(item)) === "1"; }
  function setDone(item, v){ if (v) localStorage.setItem(doneKey(item), "1"); else localStorage.removeItem(doneKey(item)); }
  function getSnooze(item){ const v = localStorage.getItem(snoozeKey(item)); return v ? Number(v) : 0; }
  function setSnooze(item, ts){ if (ts) localStorage.setItem(snoozeKey(item), String(ts)); else localStorage.removeItem(snoozeKey(item)); }
  function applySnoozeFilter(items){
    const now = Date.now();
    return items.filter(it => {
      const sn = getSnooze(it);
      if (sn && sn > now) return false; // hide snoozed until time
      return true;
    });
  }

  // DOM helpers
  function clearLists(){
    [listToday,listWeek,listLater,listAll].forEach(ul => ul.innerHTML = "");
  }
  function showSkeletons(show){
    [skToday, skWeek, skLater, skAll].forEach(s => s.style.display = show ? "block" : "none");
  }
  function badge(text, style){
    const span = document.createElement("span");
    span.className = `badge ${style||""}`;
    span.textContent = text;
    return span;
  }

  function renderItem(ul, item, courseName){
    const li = document.createElement("li");
    li.className = "item";

    const left = document.createElement("div");
    left.className = "item-left";

    // title
    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = item.title || item.assignment?.name || "Untitled";

    // meta
    const meta = document.createElement("div");
    meta.className = "item-meta";

    const course = document.createElement("span");
    course.className = "badge";
    const dot = document.createElement("i");
    dot.className = "course-dot";
    dot.style.background = colorForCourse(item.assignment?.course_id || item.course_id);
    course.appendChild(dot);
    const cn = document.createElement("span");
    cn.textContent = " " + (courseName || item.context_name || `Course #${item.assignment?.course_id || ""}`).trim();
    course.appendChild(cn);

    const [dueText, dueStyle] = formatDue(parseDue(item));
    const due = document.createElement("span");
    due.className = `badge dot ${dueStyle === "bad" ? "bad" : dueStyle === "warn" ? "warn" : "ok"}`;
    due.textContent = dueText;

    meta.appendChild(course);
    meta.appendChild(due);

    left.appendChild(title);
    left.appendChild(meta);

    // right
    const right = document.createElement("div");
    right.className = "item-right";

    // done
    const done = document.createElement("input");
    done.type = "checkbox";
    done.className = "toggle";
    done.checked = isDone(item);
    done.title = "Mark as done (local)";
    done.addEventListener("change", () => {
      setDone(item, done.checked);
      toast(done.checked ? "Marked done" : "Marked not done");
      renderAll(); // re-apply filters if Hide Done
    });

    // link
    const link = document.createElement("a");
    link.className = "pill link";
    link.href = item.html_url || item.assignment?.html_url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open";

    // menu (snooze)
    const menu = document.createElement("div");
    menu.className = "menu";
    const mbtn = document.createElement("button");
    mbtn.textContent = "More ▾";
    mbtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
      document.addEventListener("click", closeMenuOnce, { once: true });
    });
    function closeMenuOnce(){ menu.classList.remove("open"); }

    const list = document.createElement("div");
    list.className = "menu-list";
    const m1 = document.createElement("button"); m1.className="menu-item"; m1.textContent="Snooze: Tonight 8pm";
    const m2 = document.createElement("button"); m2.className="menu-item"; m2.textContent="Snooze: +1 day";
    const m3 = document.createElement("button"); m3.className="menu-item"; m3.textContent="Snooze: +3 days";
    const m4 = document.createElement("button"); m4.className="menu-item"; m4.textContent="Clear Snooze";

    m1.onclick = () => { const d = new Date(); d.setHours(20,0,0,0); setSnooze(item, d.getTime()); toast("Snoozed to tonight"); renderAll(); };
    m2.onclick = () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(8,0,0,0); setSnooze(item, d.getTime()); toast("Snoozed +1 day"); renderAll(); };
    m3.onclick = () => { const d = new Date(); d.setDate(d.getDate()+3); d.setHours(8,0,0,0); setSnooze(item, d.getTime()); toast("Snoozed +3 days"); renderAll(); };
    m4.onclick = () => { setSnooze(item, 0); toast("Snooze cleared"); renderAll(); };

    list.append(m1,m2,m3,m4);
    menu.append(mbtn, list);

    const act = document.createElement("div");
    act.className = "act";
    act.append(done, link, menu);

    right.appendChild(act);

    li.append(left, right);
    ul.appendChild(li);
  }

  /* ---------- API ---------- */
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

  async function fetchAllPages(pathBase, perPage = 100, maxPages = 5){
    const out = [];
    for (let page = 1; page <= maxPages; page++){
      const pagePath = `${pathBase}${pathBase.includes("?") ? "&" : "?"}per_page=${perPage}&page=${page}`;
      const data = await apiFetch(pagePath);
      if (!Array.isArray(data) || data.length === 0) break;
      out.push(...data);
      if (data.length < perPage) break;
    }
    return out;
  }

  async function getCourses(){
    const cache = loadCache("cache:courses", 1000*60*60*6); // 6h
    if (cache) return cache;
    const list = await fetchAllPages("api/v1/courses?enrollment_state=active");
    const map = {};
    for (const c of list) map[c.id] = c;
    saveCache("cache:courses", map);
    return map;
  }

  async function getTodo(){
    const cache = loadCache("cache:todo", 1000*60*5); // 5min
    if (cache) return cache;
    const items = await fetchAllPages("api/v1/users/self/todo");
    saveCache("cache:todo", items);
    return items;
  }

  /* ---------- Rendering pipeline ---------- */
  function filterSort(items){
    let arr = items.slice();

    // Apply snooze (hide snoozed)
    arr = applySnoozeFilter(arr);

    // Attach course names
    arr = arr.map(x => {
      const courseId = x.assignment?.course_id || x.course_id || null;
      const courseName = courseId && state.courses?.[courseId]?.name || x.context_name || null;
      return { ...x, _courseName: courseName };
    });

    // Search
    const q = state.ui.search.trim().toLowerCase();
    if (q){
      arr = arr.filter(x =>
        (x.title || x.assignment?.name || "").toLowerCase().includes(q) ||
        (x._courseName || "").toLowerCase().includes(q)
      );
    }

    // Hide done
    if (state.ui.hideDone){
      arr = arr.filter(x => !isDone(x));
    }

    // Filter by time bucket
    if (state.ui.filter !== "all"){
      arr = arr.filter(x => {
        if (state.ui.filter === "done") return isDone(x);
        const cat = dueCategory(parseDue(x));
        return cat === state.ui.filter;
      });
    }

    // Sort
    if (state.ui.sort === "dueAsc"){
      arr.sort((a,b) => (new Date(parseDue(a)||8640000000000000) - new Date(parseDue(b)||8640000000000000)));
    } else if (state.ui.sort === "dueDesc"){
      arr.sort((a,b) => (new Date(parseDue(b)||8640000000000000) - new Date(parseDue(a)||8640000000000000)));
    } else if (state.ui.sort === "courseAsc"){
      arr.sort((a,b) => ( (a._courseName||"").localeCompare(b._courseName||"") ));
    }

    return arr;
  }

  function renderAll(){
    clearLists();

    const items = filterSort(state.todo);

    let cToday=0, cWeek=0, cLater=0, cPast=0;

    for (const it of items){
      const cat = dueCategory(parseDue(it));
      const courseName = it._courseName;

      // All
      renderItem(listAll, it, courseName);

      // Buckets
      if (cat === "today"){ renderItem(listToday, it, courseName); cToday++; }
      else if (cat === "week"){ renderItem(listWeek, it, courseName); cWeek++; }
      else if (cat === "past"){ /* Past goes only to KPIs */ cPast++; }
      else { renderItem(listLater, it, courseName); cLater++; }
    }

    // Empty states
    if (!listToday.children.length) listToday.innerHTML = empty("Nothing due today 🎉", "You’re all caught up.");
    if (!listWeek.children.length)  listWeek.innerHTML  = empty("No items in the next 7 days", "Nice! Keep it rolling.");
    if (!listLater.children.length) listLater.innerHTML = empty("No later items", "When new assignments appear they’ll show here.");
    if (!listAll.children.length)   listAll.innerHTML   = empty("No To-Do items", "Add assignments in Canvas and refresh.");

    // KPIs & chips
    kpiToday.textContent = cToday;
    kpiWeek.textContent  = cWeek;
    kpiLater.textContent = cLater;
    kpiPast.textContent  = cPast;

    ctToday.textContent = cToday;
    ctWeek.textContent  = cWeek;
    ctLater.textContent = cLater;
    ctAll.textContent   = items.length;
  }

  function empty(title, subtitle){
    return `
      <li class="item">
        <div class="item-left">
          <p class="item-title">${title}</p>
          <div class="item-meta">${subtitle}</div>
        </div>
      </li>
    `;
  }

  /* ---------- Load pipeline ---------- */
  async function loadDashboard(){
    setDashStatus("warn","Loading…");
    showSkeletons(true);
    try{
      if (!state.courses) state.courses = await getCourses();
      state.todo = await getTodo();
      renderAll();
      setDashStatus("ok","Loaded.");
    } catch (err){
      console.error(err);
      setDashStatus("err", err.message || "Failed to load data.");
    } finally {
      showSkeletons(false);
    }
  }

  /* ---------- Events ---------- */
  // Connect form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const baseRaw  = baseUrlInput.value.trim();
    const tokenRaw = tokenInput.value.trim();
    if (!baseRaw || !tokenRaw){ setStatus("err","Please fill both fields."); return; }
    const base = normalizeUrl(baseRaw);
    if (!isValidUrl(base)){ setStatus("err","Enter a valid Canvas URL (https://…)"); return; }

    setStatus("warn","Verifying…");
    verifyBtn.disabled = true;

    try{
      const resp = await fetch(`${PROXY_URL}?base=${encodeURIComponent(base)}&path=${encodeURIComponent("api/v1/users/self/profile")}`, {
        headers: { "X-Canvas-Token": tokenRaw, "Accept":"application/json" }
      });
      const text = await resp.text();
      let profile = {};
      try { profile = JSON.parse(text); } catch {}

      if (resp.status === 401){ setStatus("err","Unauthorized (401). Token invalid or expired."); return; }
      if (!resp.ok){ setStatus("err", `Proxy error ${resp.status}: ${text || resp.statusText}`); return; }

      state.baseUrl = base;
      state.token   = tokenRaw;
      state.profile = profile;
      saveAuth();
      setOpenCanvasHref();

      setStatus("ok", `Connected! Hi, ${profile.name}.`);
      studentName.textContent = (profile.name || "Student").toUpperCase();
      showDashboard();
      await loadDashboard();
    } catch (err){
      console.error(err);
      setStatus("err","Network error. Make sure your Netlify site is deployed.");
    } finally {
      verifyBtn.disabled = false;
    }
  });

  // Token show/hide
  toggleBtn.addEventListener("click", () => {
    const isPw = tokenInput.type === "password";
    tokenInput.type = isPw ? "text" : "password";
    toggleBtn.textContent = isPw ? "Hide" : "Show";
  });

  // Toolbar controls
  refreshBtn.addEventListener("click", async () => {
    // Clear cache and reload
    localStorage.removeItem("cache:todo");
    await loadDashboard();
    toast("Refreshed");
  });

  disconnectBtn.addEventListener("click", () => {
    if (!confirm("Disconnect and clear local token?")) return;
    localStorage.removeItem("canvasAuth");
    localStorage.removeItem("cache:courses");
    localStorage.removeItem("cache:todo");
    // Keep done/snooze by design (local study workflow), but could clear if wanted
    state = { ...state, baseUrl:null, token:null, profile:null, courses:null, todo:[] };
    showConnect();
    setOpenCanvasHref();
    toast("Disconnected");
  });

  // Filters
  searchInput.addEventListener("input", () => { state.ui.search = searchInput.value; renderAll(); });
  filterSelect.addEventListener("change", () => { state.ui.filter = filterSelect.value; renderAll(); });
  sortSelect.addEventListener("change", () => { state.ui.sort = sortSelect.value; renderAll(); });
  hideDoneCB.addEventListener("change", () => { state.ui.hideDone = hideDoneCB.checked; renderAll(); });

  // Theme
  themeBtn.addEventListener("click", toggleTheme);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "/"){ e.preventDefault(); searchInput.focus(); }
    if (e.key.toLowerCase() === "r"){ e.preventDefault(); refreshBtn.click(); }
    if (e.key.toLowerCase() === "d"){ e.preventDefault(); toggleTheme(); }
  });

  /* ---------- Init ---------- */
  (function init(){
    initTheme();
    const saved = loadAuth();
    if (saved?.baseUrl && saved?.token){
      state.baseUrl = saved.baseUrl;
      state.token   = saved.token;
      state.profile = saved.profile || null;
      if (state.profile?.name) studentName.textContent = (state.profile.name || "Student").toUpperCase();
      setOpenCanvasHref();
      showDashboard();

      // Optimistic render from cache, then refresh
      const cachedCourses = loadCache("cache:courses", 1000*60*60*24);
      const cachedTodo    = loadCache("cache:todo",    1000*60*60*24);
      if (cachedCourses) state.courses = cachedCourses;
      if (cachedTodo)    state.todo    = cachedTodo;
      if (cachedCourses || cachedTodo) renderAll();
      loadDashboard();
    } else {
      showConnect();
    }
  })();
});
