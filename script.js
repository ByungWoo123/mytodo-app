const key = "mytodo.tasks";
const input = document.querySelector("#task");
const notice = document.querySelector("#notice");
let tasks = [];
const deleted = [];
const undoBar = document.querySelector("#undo-bar");
function showUndo() {
  undoBar.hidden = !deleted.length;
  undoBar.querySelector("span").textContent = deleted.length ? "‘" + deleted.at(-1).task.title + "’ 삭제됨" : "";
}
document.querySelector("#undo").addEventListener("click", () => {
  const origin = undoBar.getBoundingClientRect();
  const {task, nextId} = deleted.pop();
  const next = tasks.findIndex(item => item.id === nextId);
  tasks.splice(next < 0 ? tasks.length : next, 0, task);
  const list = document.querySelector(task.completed ? "#done" : "#pending");
  if (list.closest("section").hidden) selectFilter("all");
  save();
  showUndo();
  const row = list.querySelector('[data-task-id="' + CSS.escape(String(task.id)) + '"]');
  animateChange(origin, row, "add");
  row.querySelector("input").focus({preventScroll:true});
});
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
      stopMotion();
      const origin = checkbox.getBoundingClientRect();
      const source = row.getBoundingClientRect();
      task.completed = checkbox.checked;
      save();
      input.focus({ preventScroll: true });
      const moved = document.querySelector('[data-task-id="' + CSS.escape(String(task.id)) + '"]');
      const target = moved.getClientRects().length ? moved : list.closest("section").querySelector("h2");
      if (target === moved && source.bottom > 0 && source.top < innerHeight &&
          moved.getBoundingClientRect().top < innerHeight && moved.getBoundingClientRect().bottom > 0) {
        carryTask(source, moved, task.completed);
      } else animateChange(origin, target, "move", task.completed && tasks.every(item => item.completed) ? celebrateCompletion : undefined);
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
      deleted.push({task, nextId: tasks[tasks.indexOf(task) + 1]?.id});
      tasks = tasks.filter(item => item.id !== task.id);
      save();
      showUndo();
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
  stopMotion();
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
function run(duration, draw, onFinish) {
  const start = performance.now();
  function tick(now) {
    const time = Math.min(duration, now - start);
    draw(time);
    if (time < duration) frame = requestAnimationFrame(tick);
    else {
      stopMotion();
      onFinish?.();
    }
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

function takeNearest(pool, point) {
  const distance = agent => Math.hypot(agent.position.x - point.x, agent.position.y - point.y);
  const closest = pool.reduce((best, agent) => distance(agent) < distance(best) ? agent : best);
  pool.splice(pool.indexOf(closest), 1);
  return closest;
}

function carryTask(source, row, completed) {
  if (motionPreference.matches) return;
  const dest = row.getBoundingClientRect();
  const delta = {x:source.left - dest.left, y:source.top - dest.top};
  const pool = [...agents];
  const grips = [0, 1].map(side => {
    const point = {x:source.left + side * source.width, y:source.top + source.height / 2};
    const agent = takeNearest(pool, point);
    return {agent, from:agent.position, side};
  });
  const remaining = document.querySelector("#remaining");
  const finished = document.querySelector("#finished");
  const pendingTotal = Number(remaining.textContent);
  const doneTotal = Number(finished.textContent);
  remaining.textContent = pendingTotal + (completed ? 1 : -1);
  finished.textContent = doneTotal + (completed ? -1 : 1);
  function land() {
    row.classList.remove("in-transit");
    row.style.removeProperty("--strike");
    row.style.translate = "";
    row.style.width = "";
    remaining.textContent = pendingTotal;
    finished.textContent = doneTotal;
  }
  row.classList.add("in-transit");
  resetTargets = land;
  function draw(time) {
    const progress = phase(time, 235, 850);
    const width = source.width + (dest.width - source.width) * progress;
    const shift = arc(delta, {x:0,y:0}, progress, 12);
    row.style.translate = shift.x + "px " + shift.y + "px";
    row.style.width = width + "px";
    row.style.setProperty("--strike", (completed ? progress : 1-progress)*100 + "%");
    if (time >= 850) land();
    const middle = row.getBoundingClientRect().height / 2;
    for (const {agent, from, side} of grips) {
      const grip = {x:dest.left + shift.x + width * side, y:dest.top + shift.y + middle};
      const point = time < 235 ? arc(from,grip,phase(time,0,235),side ? 15 : -15)
        : arc(grip,home(agent),phase(time,930,1230),side ? -18 : 18);
      place(agent, point);
    }
  }
  draw(0);
  run(1230, draw, completed && pendingTotal === 0 ? celebrateCompletion : undefined);
}

function celebrateCompletion() {
  if (motionPreference.matches) return;
  const area = document.querySelector("#pending").getBoundingClientRect();
  if (!area.width || area.bottom <= 0 || area.top >= innerHeight) return;
  const center = {
    x: area.right - Math.min(54, area.width / 4),
    y: Math.min(innerHeight - 28, Math.max(28, area.top + area.height / 2))
  };
  const points = [[-31,-1],[-21,9],[-11,19],[1,5],[13,-9],[25,-23]];
  const pool = [...agents];
  const formation = points.map(([x,y]) => {
    const target = offset(center,x,y);
    const agent = takeNearest(pool,target);
    return { agent, target, from:agent.position };
  });
  run(1160, time => {
    for (const {agent,target,from} of formation) {
      const point = time < 420 ? arc(from,target,phase(time,0,420),14)
        : arc(target,home(agent),phase(time,750,1160),-14);
      place(agent,point);
    }
  });
}

function build(stages, isOpening, origin, snapInput, onFinish) {
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
  const available = [...agents];
  const jobs = visible.map(({el, rect}, i) => {
    const aim = i === 0 && origin ? {x:origin.left + origin.width/2, y:origin.top + origin.height/2}
      : {x:rect.left, y:rect.top};
    const agent = available.length ? takeNearest(available, aim) : createAgent(colors[i % colors.length], i);
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
    const snap = el === snapInput;
    const carry = snap || (!shell && el.matches(".sheet, .brand, .filters button"));
    const shift = snap ? 6 : carry ? (i % 2 ? -18 : 18) : 0;
    const lift = carry && !snap ? -12 : 0;
    const a = { x: Math.max(0,rect.left), y: Math.max(0,rect.top) };
    const b = { x: Math.min(innerWidth,rect.right), y: Math.min(innerHeight,rect.bottom) };
    const start = offset(a, shift, lift);
    const sweepEnd = offset(b, shift, lift);
    const depart = origin && i === 0 ? 0 : delays.get(bands[i]) + (origin ? 65 : 0);
    const grab = depart + 340 + (i % 6)*8;
    const release = grab + 420 + Math.min(220,rect.width*.25);
    const finish = release + (carry ? 230 : 0) + 175;
    const box = document.createElement("div");
    box.className = "selection-box";
    box.style.setProperty("--selection-color", agent.color);
    box.hidden = true;
    layer.insertBefore(box, layer.firstChild);
    let guide;
    if (snap) {
      const list = el.closest("ul").getBoundingClientRect();
      guide = document.createElement("i");
      guide.className = "alignment-guide";
      Object.assign(guide.style, {left:rect.left+"px", top:Math.max(0,list.top-4)+"px",
        height:Math.min(innerHeight,list.bottom+6)-Math.max(0,list.top-4)+"px", color:agent.color});
      guide.hidden = true;
      layer.prepend(guide);
    }
    return {el, agent, box, guide, mask, shift, lift, carry, start, sweepEnd, b, depart, grab, release, finish,
      from: agent.position};
  });
  const snapJob = jobs.find(job => job.guide);
  const snapRow = snapJob?.el.closest("li");
  if (snapRow) snapRow.style.translate = "6px 0";
  resetTargets = () => jobs.forEach(({el, agent, box, guide, mask}, i) => {
    if (guide) snapRow.style.translate = "";
    el.style.removeProperty(mask);
    el.style.translate = "";
    if (el.classList.contains("painting-surface")) {
      el.classList.remove("painting-surface");
      for (const property of Array.from(el.style)) {
        if (/^--(surface-|edge-)/.test(property)) el.style.removeProperty(property);
      }
    }
    box.remove();
    guide?.remove();
    if (i >= agents.length) agent.icon.remove();
  });
  const waiting = available.map(agent => ({agent, from:agent.position}));
  run(Math.max(...jobs.map(job => job.finish)) + 420, time => {
    const rowOffset = snapJob ? 6*(1-phase(time,snapJob.release+130,snapJob.finish-175)) : 0;
    if (snapRow) snapRow.style.translate = rowOffset ? rowOffset + "px 0" : "";

    for (const {agent, from} of waiting) {
      place(agent, arc(from, home(agent), phase(time, 0, 180)));
    }
    jobs.forEach(({el, agent, box, guide, mask, shift, lift, carry, start, sweepEnd, b, depart, grab, release, finish, from}, i) => {
      const bend = (i % 2 ? 1 : -1)*(18 + i % 6 * 4);
      const follow = !guide && snapRow?.contains(el) ? rowOffset : 0;
      start = offset(start, follow, 0);
      sweepEnd = offset(sweepEnd, follow, 0);
      b = offset(b, follow, 0);
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
        if (guide) guide.hidden = true;
        el.style.removeProperty(mask);
        el.style.translate = "";
        const retreat = phase(time,finish,finish+420);
        place(agent,arc(b,home(agent),retreat,bend));
        if (i >= agents.length) agent.icon.style.opacity = 1-retreat;
        return;
      }
      const sweep = phase(time,grab,release);
      const settled = finish - 175;
      const fit = carry ? phase(time,release + (guide ? 130 : 0),settled) : Number(time >= release);
      const tip = time < release ? arc(start,sweepEnd,sweep) : arc(sweepEnd,b,fit);
      if (carry && !guide) el.style.translate = `${shift*(1-fit)}px ${lift*(1-fit)}px`;
      if (guide) {
        guide.hidden = false;
        guide.style.opacity = phase(time,grab,grab+100)*(1-phase(time,settled+80,finish));
      }
      el.style.setProperty(mask,`inset(0 ${100*(1-sweep)}% ${100*(1-sweep)}% 0)`);
      box.classList.toggle("placed", time >= settled);
      drawBox(offset(start,-shift*fit,-lift*fit),tip,1-phase(time,settled+80,finish),box);
      place(agent,tip,0,1-.1*Math.sin(Math.PI*sweep));
    });
  }, onFinish);
}
function visibleParts(scope, selector) { return Array.from(scope.querySelectorAll(selector)); }
function playAssembly() {
  build([visibleParts(document, [panelSelector, detailSelector, "li", "h2 span", ".sheet.front > *",
    "li input", "li label span", "li button"].join(","))], true);
}
function animateChange(origin, target, action, onFinish) {
  const lists = target.matches(".board") ? visibleParts(target,"section:not([hidden])") : target.matches("h2") ? [...target.children] : [target];
  const contents = action === "filter" ? visibleParts(target,"h2 > *, ul, li") : [];
  const controls = visibleParts(target,rowParts);
  const counts = action === "move" ? visibleParts(document, "h2 span, li.empty")
    : visibleParts(target.closest("section") || target, "h2 span");
  build([lists, contents, counts, controls], false, origin, action === "add" ? target.querySelector("input") : null, onFinish);
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




