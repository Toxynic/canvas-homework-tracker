// utils.js
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => Array.from(document.querySelectorAll(s));

export const storage = {
  get(key, fallback=null){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{ return fallback } },
  set(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} },
  del(key){ try{ localStorage.removeItem(key); }catch{} }
};

export function normalizeUrl(u){
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/,"");
}
export function isValidUrl(u){ try{ new URL(u); return true; } catch { return false; } }

export function formatDue(iso){
  if (!iso) return "No due date";
  const d = new Date(iso); const now = new Date();
  const opts = { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" };
  const datePart = d.toLocaleString(undefined, opts);
  const diff = d - now;
  const day = 24*3600*1000;
  if (diff < 0) return `Past Due • ${datePart}`;
  if (diff <= day) return `Due Today • ${datePart}`;
  if (diff <= 2*day) return `Due Tomorrow • ${datePart}`;
  if (diff <= 7*day) return `Due in ${Math.ceil(diff/day)}d • ${datePart}`;
  return datePart;
}
export function dueUrgency(iso){
  if (!iso) return "ok";
  const diff = new Date(iso) - new Date();
  if (diff < 0) return "bad";
  if (diff <= 24*3600*1000) return "bad";
  if (diff <= 7*24*3600*1000) return "warn";
  return "ok";
}

// Theme
export function initThemeToggle(btn){
  const root = document.documentElement;
  function setTheme(t){ root.setAttribute("data-theme", t); storage.set("theme", t); }
  const saved = storage.get("theme","dark"); setTheme(saved);
  btn?.addEventListener("click", ()=>{
    const next = root.getAttribute("data-theme")==="dark" ? "light" : "dark";
    setTheme(next);
    btn.textContent = next==="dark" ? "🌙" : "☀️";
  });
  btn.textContent = saved==="dark" ? "🌙" : "☀️";
}

// Toasts
export function toast(msg, type="ok"){
  const host = $("#toastHost");
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.textContent = msg;
  host.appendChild(div);
  setTimeout(()=>div.classList.add("show"), 10);
  setTimeout(()=>{
    div.classList.remove("show");
    setTimeout(()=>div.remove(), 200);
  }, 2800);
}
