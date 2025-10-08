// app.js
import { normalizeUrl, isValidUrl, initThemeToggle, storage } from "./utils.js";
import { CanvasAPI, saveAuthToStorage, loadAuthFromStorage, saveCache, loadCache } from "./api.js";
import { show, hide, setStatus, clearLists, renderItem, renderEmpty, notifySuccess, notifyError } from "./ui.js";

console.log("[tracker] app.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[tracker] DOM ready");

  // Elements
  const connectSection = $("#connectSection");
  const dashSection    = $("#dashSection");
  const themeToggle    = $("#themeToggle");

  const form      = $("#authForm");
  const statusEl  = $("#status");
  const verifyBtn = $("#verifyBtn");
  const toggleBtn = $("#toggleToken");

  const dashStatus  = $("#dashStatus");
  const studentName = $("#studentName");
  const listToday   = $("#listToday");
  const listWeek    = $("#listWeek");
  const listAll     = $("#listAll");
  const skeleton    = $("#skeleton");
  const listsWrap   = $("#lists");

  const refreshBtn    = $("#refreshBtn");
  const disconnectBtn = $("#disconnectBtn");

  // Theme
  initThemeToggle(themeToggle);

  // State
  const authSaved = loadAuthFromStorage();
  const api = new CanvasAPI(authSaved?.baseUrl || "", authSaved?.token || "");
  let courseMap = {};

  function showDashboard(name){
    studentName.textContent = (name || "Student").toUpperCase();
    hide(connectSection); show(dashSection);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showConnect(){
    hide(dashSection); show(connectSection);
  }

  // Token show/hide
  toggleBtn?.addEventListener("click", () => {
    const tokenInput = $("#token");
    const isPw = tokenInput.type === "password";
    tokenInput.type = isPw ? "text" : "password";
    toggleBtn.textContent = isPw ? "Hide" : "Show";
  });

  async function loadDashboard(){
    setStatus(dashStatus, "warn", "Loading your dashboard…");
    show(skeleton); hide(listsWrap);
    clearLists(listToday, listWeek, listAll);

    try{
      // courses cache (5 min)
      courseMap = loadCache("coursesMap", 5*60*1000) || {};
      if (!Object.keys(courseMap).length) {
        courseMap = await api.getCourses();
        saveCache("coursesMap", courseMap);
      }

      // todo cache (2 min) – fast refresh
      let todo = loadCache("todoItems", 2*60*1000);
      if (!todo) {
        todo = await api.getTodo();
        saveCache("todoItems", todo);
      }

      // sort by due date asc (missing due at bottom)
      const norm = todo.map(x => ({...x, _due:new Date(x.assignment?.due_at || x.due_at || 8640000000000000).getTime()}))
                       .sort((a,b)=>a._due-b._due);

      // fill lists
      const now=new Date();
      const endToday=new Date(now); endToday.setHours(23,59,59,999);
      const endWeek=new Date(now); endWeek.setDate(endWeek.getDate()+7); endWeek.setHours(23,59,59,999);

      let cntT=0, cntW=0, cntA=0;
      for (const item of norm){
        const dueIso = item.assignment?.due_at || item.due_at || null;
        const due = dueIso ? new Date(dueIso) : null;

        renderItem(listAll, item, courseMap); cntA++;
        if (due && due <= endToday){ renderItem(listToday, item, courseMap); cntT++; }
        else if (due && due <= endWeek){ renderItem(listWeek, item, courseMap); cntW++; }
      }

      if (!cntT) renderEmpty(listToday, "Nothing due today 🎉", "You’re all caught up.");
      if (!cntW) renderEmpty(listWeek, "No items in next 7 days", "Check ‘All To‑Do’ below.");
      if (!cntA) renderEmpty(listAll, "No To‑Do items", "New assignments will appear once added in Canvas.");

      setStatus(dashStatus, "ok", "Loaded");
      hide(skeleton); show(listsWrap);
      notifySuccess("Dashboard updated");
    }catch(err){
      console.error(err);
      hide(skeleton); show(listsWrap);
      setStatus(dashStatus, "err", err.message || "Failed to load data");
      notifyError("Couldn’t load data");
    }
  }

  // Submit (Verify & Save)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const baseRaw = $("#baseUrl")?.value.trim();
    const token   = $("#token")?.value.trim();
    if (!baseRaw || !token){ setStatus(statusEl, "err", "Please fill both fields."); return; }

    const base = normalizeUrl(baseRaw);
    if (!isValidUrl(base)){ setStatus(statusEl, "err", "Enter a valid Canvas URL."); return; }

    setStatus(statusEl, "warn", "Verifying…");
    verifyBtn.disabled = true;

    try{
      api.setAuth(base, token);
      const profile = await api.getProfile();

      // Save and go
      const auth = { baseUrl: base, token, profile };
      saveAuthToStorage(auth);
      storage.del("todoItems"); // reset caches
      storage.del("coursesMap");

      setStatus(statusEl, "ok", `Connected! Hi, ${profile.name}.`);
      showDashboard(profile.name);
      await loadDashboard();
    }catch(err){
      console.error(err);
      setStatus(statusEl, "err", "Auth failed. Check your token and URL.");
    }finally{
      verifyBtn.disabled = false;
    }
  });

  refreshBtn?.addEventListener("click", async ()=>{
    storage.del("todoItems"); // force refresh
    await loadDashboard();
  });

  disconnectBtn?.addEventListener("click", ()=>{
    storage.del("canvasAuth");
    storage.del("todoItems");
    storage.del("coursesMap");
    showConnect();
  });

  // Auto-load if saved auth exists
  if (authSaved?.baseUrl && authSaved?.token){
    api.setAuth(authSaved.baseUrl, authSaved.token);
    showDashboard(authSaved?.profile?.name || "Student");
    loadDashboard(); // best-effort
  } else {
    showConnect();
  }
});
