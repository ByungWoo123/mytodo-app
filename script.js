const key = "mytodo.tasks";
const input = document.querySelector("#task");
const notice = document.querySelector("#notice");
let tasks = [];
const filters = document.querySelectorAll("[data-filter]");
function selectFilter(value) {
  for (const button of filters) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === value));
  }
  document.querySelector("#pending").closest("section").hidden = value === "done";
  document.querySelector("#done").closest("section").hidden = value === "pending";
}
for (const button of filters) {
  button.addEventListener("click", () => {
    const origin = button.getBoundingClientRect();
    selectFilter(button.dataset.filter);
    animateChange(origin, document.querySelector(".board"), "filter");
  });
}
try {
  const saved = JSON.parse(localStorage.getItem(key) || "[]");
  if (Array.isArray(saved)) tasks = saved;
} catch {
  notice.textContent = "저장된 목록을 불러올 수 없어요.";
}

function renderList(selector, completed, counter, emptyMessage) {
  const list = document.querySelector(selector);
  const items = tasks.filter(task => task.completed === completed);
  document.querySelector(counter).textContent = items.length;
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = emptyMessage;
    list.append(empty);
  }
  for (const task of items) {
    const row = document.createElement("li");
    row.dataset.taskId = task.id;
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;
    checkbox.addEventListener("change", () => {
      const origin = checkbox.getBoundingClientRect();
      task.completed = checkbox.checked;
      save();
      input.focus({ preventScroll: true });
      const moved = document.querySelector('[data-task-id="' + CSS.escape(String(task.id)) + '"]');
      const target = moved.getClientRects().length ? moved : list.closest("section").querySelector("h2");
      animateChange(origin, target, "move");
    });
    const title = document.createElement("span");
    title.textContent = task.title;
    label.append(checkbox, title);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "삭제";
    removeButton.setAttribute("aria-label", task.title + " 삭제");
    removeButton.addEventListener("click", () => {
      const origin = removeButton.getBoundingClientRect();
      const index = Array.from(list.children).indexOf(row);
      tasks = tasks.filter(item => item.id !== task.id);
      save();
      input.focus({ preventScroll: true });
      animateChange(origin, list.children[Math.min(index, list.children.length - 1)], "remove");
    });
    row.append(label, removeButton);
    list.append(row);
  }
}

function render() {
  renderList("#pending", false, "#remaining", tasks.length ? "남은 할 일이 없어요." : "첫 번째 할 일을 추가해 보세요.");
  renderList("#done", true, "#finished", "완료한 일이 여기에 표시돼요.");
}

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(tasks));
    notice.textContent = "";
  } catch {
    notice.textContent = "브라우저에 저장할 수 없어요. 현재 창에서만 기록이 유지돼요.";
  }
  render();
}

document.querySelector("form").addEventListener("submit", event => {
  event.preventDefault();
  const title = input.value.trim();
  if (title) {
    tasks.unshift({ id: crypto.randomUUID(), title, completed: false });
    if (document.querySelector("#pending").closest("section").hidden) selectFilter("all");
    save();
    animateChange((event.submitter || input).getBoundingClientRect(), document.querySelector("#pending li"), "add");
  }
  input.value = "";
  input.focus({ preventScroll: true });
});
render();

const date = document.querySelector("#date");
const today = new Date();
date.dateTime = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
date.textContent = today.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

// All coordinates use the viewport so the arrow tip and the selection corner coincide.
const layer = document.createElement("div");
layer.className = "cursor-layer";
layer.setAttribute("aria-hidden", "true");



document.body.append(layer);

const colors = ["#5bbcff", "#bea1ff", "#ffae80", "#8ee4c8", "#ef9dca", "#f1ce7e"];
function createAgent(color, i) {
  const icon = document.createElement("i");
  icon.className = "agent";
  icon.style.setProperty("--color", color);
  layer.append(icon);
  const cell = i % colors.length;
  const rest = {
    x: (cell % 3 + 0.1 + Math.random() * 0.8) / 3,
    y: (Math.floor(cell / 3) + 0.1 + Math.random() * 0.8) / 2
  };
  return { color, rest, icon, position: { x: 0, y: 0 } };
}
const agents = colors.map(createAgent);
let frame = 0;
let opening = false;
let resetTargets = () => {};

function home(agent) {
  return { x: agent.rest.x * (innerWidth - 20), y: agent.rest.y * (innerHeight - 24) };
}
function place(agent, point, tilt = 0, scale = 1) {
  agent.position = point;
  agent.icon.style.transform = `translate3d(${point.x}px,${point.y}px,0) rotate(${tilt}deg) scale(${scale})`;
}
function stopMotion(park = true) {
  cancelAnimationFrame(frame);
  opening = false;
  resetTargets();
  resetTargets = () => {};

  if (park) agents.forEach(agent => place(agent, home(agent)));
}
function phase(time, from, to) {
  const t = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return t * t * (3 - 2 * t);
}
// A curved approach, a small overshoot and a slower correction make each grab legible.
function arc(from, to, t, bend = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sweep = Math.sin(t * Math.PI) * bend / (Math.hypot(dx, dy) || 1);
  return { x: from.x + dx * t - dy * sweep, y: from.y + dy * t + dx * sweep };
}
function offset(point, x, y) { return { x: point.x + x, y: point.y + y }; }
function run(duration, draw) {
  const start = performance.now();
  function tick(now) {
    const time = Math.min(duration, now - start);
    draw(time);
    if (time < duration) frame = requestAnimationFrame(tick);
    else stopMotion();
  }
  frame = requestAnimationFrame(tick);
}
function drawBox(a, b, opacity, box) {
  box.hidden = false;
  Object.assign(box.style, {
    transform: `translate(${Math.min(a.x,b.x)}px,${Math.min(a.y,b.y)}px)`,
    width: Math.abs(b.x - a.x) + "px", height: Math.abs(b.y - a.y) + "px", opacity
  });
}
const panelSelector = "[data-piece]";
const detailSelector = ".brand, #replay, #date, h1, .sheet, form > label, #task, .add, .filters button, h2 > *, ul";
const rowParts = "input, label span, button";
const fullMask = "inset(0 100% 100% 0)";

function build(stages, isOpening, origin) {
  stopMotion(false);
  document.documentElement.classList.remove("preparing");
  if (motionPreference.matches) return stopMotion();
  opening = isOpening;
  const candidates = [...new Set(stages.flat())].filter(Boolean);
  const visible = candidates.map(el => ({el, rect: el.getBoundingClientRect()}))
    .filter(({rect}) => rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight);
  if (!visible.length) return stopMotion();

  // Use rendered positions so side-by-side panels share a beat and stacked panels follow one another.
  const bands = visible.map(({el, rect}) => {
    const group = el.closest(".mast, [data-piece], .filters, li");
    return Math.round(group ? group.getBoundingClientRect().top : rect.top);
  });
  const levels = [...new Set(bands)].sort((a, b) => a - b);
  const gap = Math.min(190, 1350 / Math.max(1, levels.length - 1));
  const delays = new Map(levels.map((level, index) => [level, index * gap]));


  // Paint container borders and backgrounds independently of their children.
  const jobs = visible.map(({el, rect}, i) => {
    const agent = agents[i] || createAgent(colors[i % colors.length], i);
    if (i >= agents.length) place(agent, home(agent));
    const shell = el.matches("[data-piece], ul, li[data-task-id], .sheet.front");
    if (shell) {
      const css = getComputedStyle(el);
      el.style.setProperty("--surface-background", css.background);
      for (const side of ["top","bottom","left","right"]) {
        el.style.setProperty("--surface-" + side, css.getPropertyValue("border-" + side));
        el.style.setProperty("--edge-" + side, "-" + css.getPropertyValue("border-" + side + "-width"));
      }
      el.classList.add("painting-surface");
    }
    const mask = shell ? "--surface-mask" : "clip-path";
    el.style.setProperty(mask, fullMask);
    const carry = !shell && el.matches(".sheet, .brand, .filters button");
    const shift = carry ? (i % 2 ? -18 : 18) : 0;
    const a = { x: Math.max(0,rect.left), y: Math.max(0,rect.top) };
    const b = { x: Math.min(innerWidth,rect.right), y: Math.min(innerHeight,rect.bottom) };
    const start = offset(a, shift, carry ? -12 : 0);
    const sweepEnd = offset(b, shift, carry ? -12 : 0);
    const depart = delays.get(bands[i]);
    const grab = depart + 340 + (i % 6)*8;
    const release = grab + 420 + Math.min(220,rect.width*.25);
    const finish = release + (carry ? 230 : 100);
    const box = document.createElement("div");
    box.className = "selection-box";
    box.style.setProperty("--selection-color", agent.color);
    box.hidden = true;
    layer.insertBefore(box, layer.firstChild);
    return {el, agent, box, mask, shift, carry, start, sweepEnd, b, depart, grab, release, finish,
      from: agent.position};
  });
  resetTargets = () => jobs.forEach(({el, agent, box, mask}, i) => {
    el.style.removeProperty(mask);
    el.style.translate = "";
    if (el.classList.contains("painting-surface")) {
      el.classList.remove("painting-surface");
      for (const property of Array.from(el.style)) {
        if (/^--(surface-|edge-)/.test(property)) el.style.removeProperty(property);
      }
    }
    box.remove();
    if (i >= agents.length) agent.icon.remove();
  });
  const waiting = agents.slice(jobs.length).map(agent => ({agent, from:agent.position}));
  run(Math.max(...jobs.map(job => job.finish)) + 420, time => {

    for (const {agent, from} of waiting) {
      place(agent, arc(from, home(agent), phase(time, 0, 180)));
    }
    jobs.forEach(({el, agent, box, mask, shift, carry, start, sweepEnd, b, depart, grab, release, finish, from}, i) => {
      const bend = (i % 2 ? 1 : -1)*(18 + i % 6 * 4);
      if (time < depart) {
        place(agent, from);
        return;
      }
      if (time < grab) {
        if (origin && i === 0) {
          const click = {x:origin.left + origin.width/2, y:origin.top + origin.height/2};
          const via = depart + (grab-depart)*.45;
          place(agent,time < via ? arc(from,click,phase(time,depart,via),bend) : arc(click,start,phase(time,via,grab),bend));
        } else place(agent,arc(from,start,phase(time,depart,grab),bend));
        return;
      }
      if (time >= finish) {
        box.hidden = true;
        el.style.removeProperty(mask);
        el.style.translate = "";
        const retreat = phase(time,finish,finish+420);
        place(agent,arc(b,home(agent),retreat,bend));
        if (i >= agents.length) agent.icon.style.opacity = 1-retreat;
        return;
      }
      const sweep = phase(time,grab,release);
      const fit = phase(time,release,finish);
      const tip = time < release ? arc(start,sweepEnd,sweep) : arc(sweepEnd,b,fit);
      if (carry) el.style.translate = `${shift*(1-fit)}px ${-12*(1-fit)}px`;
      el.style.setProperty(mask,`inset(0 ${100*(1-sweep)}% ${100*(1-sweep)}% 0)`);
      drawBox(offset(start,-shift*fit,carry ? 12*fit : 0),tip,1-fit,box);
      place(agent,tip,0,1-.1*Math.sin(Math.PI*sweep));
    });
  });
}
function visibleParts(scope, selector) { return Array.from(scope.querySelectorAll(selector)); }
function playAssembly() {
  build([visibleParts(document, [panelSelector, detailSelector, "li", "h2 span", ".sheet.front > *",
    "li input", "li label span", "li button"].join(","))], true);
}
function animateChange(origin, target, action) {
  const lists = target.matches(".board") ? visibleParts(target,"section:not([hidden])") : target.matches("h2") ? [...target.children] : [target];
  const contents = action === "filter" ? visibleParts(target,"h2 > *, ul, li") : [];
  const controls = visibleParts(target,rowParts);
  const counts = action === "move" ? visibleParts(document, "h2 span, li.empty")
    : visibleParts(target.closest("section") || target, "h2 span");
  build([lists, contents, counts, controls], false, origin);
}document.querySelector("#replay").addEventListener("click", playAssembly);
function interruptOpening() { if (opening) stopMotion(); }
document.querySelector("main").addEventListener("pointerdown", interruptOpening, true);
document.addEventListener("keydown", interruptOpening, true);
input.addEventListener("focus", interruptOpening);
window.addEventListener("resize", () => stopMotion());
window.addEventListener("scroll", () => stopMotion(), {passive: true});
motionPreference.addEventListener("change", () => stopMotion());
stopMotion();
playAssembly();




