// api.js
import { storage } from "./utils.js";

const PROXY_URL = "/.netlify/functions/canvas-proxy";

function parseLinkHeader(h){
  if (!h) return {};
  return h.split(",").map(s=>s.trim()).reduce((acc, part)=>{
    const m = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (m) acc[m[2]] = m[1];
    return acc;
  }, {});
}

export class CanvasAPI {
  constructor(baseUrl, token){
    this.baseUrl = baseUrl;
    this.token = token;
  }
  setAuth(baseUrl, token){ this.baseUrl = baseUrl; this.token = token; }

  async _fetch(path, init={}){
    const url = `${PROXY_URL}?base=${encodeURIComponent(this.baseUrl)}&path=${encodeURIComponent(path)}`;
    const resp = await fetch(url, {
      method: init.method || "GET",
      headers: { "X-Canvas-Token": this.token, "Accept":"application/json", ...(init.headers||{}) },
      body: init.body
    });
    const link = resp.headers.get("Link"); // thanks to exposed header
    const text = await resp.text();
    let json = {};
    try { json = JSON.parse(text); } catch {}
    return { ok: resp.ok, status: resp.status, json, text, link };
  }

  async _fetchAll(pathWithQuery){
    let all = [];
    let path = pathWithQuery;
    for (let i=0; i<8; i++){ // cap pages
      const { ok, json, link, status, text } = await this._fetch(path);
      if (!ok) throw new Error(`Canvas ${status}: ${text || "error"}`);
      if (Array.isArray(json)) all = all.concat(json);
      else all.push(json);
      const links = parseLinkHeader(link);
      if (!links.next) break;
      // links.next is absolute Canvas URL -> convert to /api/v1/.. path
      const u = new URL(links.next);
      path = u.pathname.replace(/^\/+/,"") + (u.search || "");
    }
    return all;
  }

  async getProfile(){
    const r = await this._fetch("api/v1/users/self/profile");
    if (!r.ok) throw new Error(`Auth failed ${r.status}`);
    return r.json;
  }

  async getCourses(){
    // map course_id → name
    const courses = await this._fetchAll("api/v1/courses?enrollment_state=active&per_page=100");
    const map = {};
    for (const c of courses) map[c.id] = c.name || c.course_code || `Course #${c.id}`;
    return map;
  }

  async getTodo(){
    return this._fetchAll("api/v1/users/self/todo?per_page=100");
  }
}

// Cache helpers
export function saveAuthToStorage(auth){
  storage.set("canvasAuth", auth);
}
export function loadAuthFromStorage(){
  return storage.get("canvasAuth", null);
}
export function saveCache(key, data){ storage.set(key, { t: Date.now(), data }); }
export function loadCache(key, maxAgeMs){
  const v = storage.get(key, null);
  if (!v) return null;
  if (Date.now() - v.t > maxAgeMs) return null;
  return v.data;
}
