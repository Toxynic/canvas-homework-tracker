// ui.js
import { formatDue, dueUrgency, toast } from "./utils.js";

export function show(el){ el.classList.remove("hidden"); }
export function hide(el){ el.classList.add("hidden"); }

export function setStatus(el, type, msg){
  el.className = `status ${type}`;
  el.textContent = msg;
}

export function clearLists(...uls){ uls.forEach(ul => ul.innerHTML = ""); }

export function renderItem(ul, item, courseMap){
  const li = document.createElement("li");
  li.className = "item";

  const title = document.createElement("p");
  title.className = "item-title";
  title.textContent = item.title || item.assignment?.name || "Untitled";

  const meta = document.createElement("div");
  meta.className = "item-meta";
  const courseName = item.context_name
    || courseMap[item.assignment?.course_id]
    || courseMap[item.course_id]
    || "Course";
  meta.textContent = courseName;

  const pills = document.createElement("div"); pills.className = "pills";
  const due = item.assignment?.due_at || item.due_at || null;

  const duePill = document.createElement("span");
  duePill.className = "pill";
  duePill.textContent = formatDue(due);
  const urgency = dueUrgency(due);
  if (urgency === "bad") duePill.classList.add("bad");
  else if (urgency === "warn") duePill.classList.add("warn");

  const link = document.createElement("a");
  link.className = "pill link";
  link.href = item.html_url || item.assignment?.html_url || "#";
  link.target = "_blank"; link.rel = "noopener";
  link.textContent = "Open";

  pills.appendChild(duePill);
  pills.appendChild(link);

  const left = document.createElement("div");
  left.appendChild(title);
  left.appendChild(meta);

  li.appendChild(left);
  li.appendChild(pills);
  ul.appendChild(li);
}

export function renderEmpty(ul, title, sub){
  ul.innerHTML = `
    <li class="item">
      <div>
        <p class="item-title">${title}</p>
        <div class="item-meta">${sub}</div>
      </div>
    </li>`;
}

export function notifySuccess(msg){ toast(msg, "ok"); }
export function notifyWarn(msg){ toast(msg, "warn"); }
export function notifyError(msg){ toast(msg, "err"); }
