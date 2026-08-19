/* AI Game Factory — клиент веб-интерфейса.
 *
 * Никаких зависимостей: один файл, состояние в памяти, живые события приходят
 * через SSE (/api/events), всё остальное — обычные fetch-запросы к бэкенду.
 */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
};
const esc = (text) => String(text ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const now = () => new Date().toLocaleTimeString("ru-RU", { hour12: false });

async function api(path, options = {}) {
  const opts = { ...options };
  if (opts.body !== undefined && typeof opts.body !== "string") {
    opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    opts.body = JSON.stringify(opts.body);
    opts.method = opts.method || "POST";
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { status: "error", message: text }; }
  if (!res.ok && !data.message) data.message = `HTTP ${res.status}`;
  return data;
}

const state = {
  boot: null,
  view: localStorage.getItem("view") || "studio",
  project: localStorage.getItem("project") || null,
  session: null,
  sessionRunning: false,
  doc: "AI_DEVELOPER_PROMPT.md",
  docRaw: false,
  docContent: "",
  ideas: [],
  playSlug: null,
  quotaTimer: null,
  timerHandle: null,
  elapsed: 0,
  streamBubble: null,
};

/* ── Тосты ────────────────────────────────────────────────────────────── */

function toast(title, text, kind = "", actions = []) {
  const node = el("div", `toast ${kind}`);
  node.appendChild(el("div", "t-title", esc(title)));
  if (text) node.appendChild(el("div", "t-text", esc(text)));
  if (actions.length) {
    const row = el("div", "t-actions");
    actions.forEach(([label, fn]) => {
      const btn = el("button", "btn small", esc(label));
      btn.onclick = () => { node.remove(); fn(); };
      row.appendChild(btn);
    });
    node.appendChild(row);
  }
  node.onclick = (e) => { if (e.target === node) node.remove(); };
  $("toasts").appendChild(node);
  setTimeout(() => node.remove(), 12000);
}

/* ── Переключение вкладок ─────────────────────────────────────────────── */

function showView(name) {
  state.view = name;
  localStorage.setItem("view", name);
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(`view-${name}`).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name));

  if (name === "projects") { loadProjects(); loadChats(); }
  if (name === "studio") loadGallery();
  if (name === "chats") { fillChatProjects(); loadChats(); }
  if (name === "play") { fillPlayProjects(); loadPlayState(); }
  if (name === "quota") { loadQuota(); startQuotaTimer(); } else stopQuotaTimer();
  if (name === "settings") renderSettings();
}

/* ── Markdown ─────────────────────────────────────────────────────────── */

function inlineMd(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(src) {
  const out = [];
  const lines = String(src || "").split("\n");
  let inCode = false, listOpen = false, tableRows = null;

  const closeList = () => { if (listOpen) { out.push("</ul>"); listOpen = false; } };
  const closeTable = () => {
    if (!tableRows) return;
    const [head, ...body] = tableRows;
    out.push("<table><thead><tr>" + head.map((c) => `<th>${inlineMd(c)}</th>`).join("") + "</tr></thead><tbody>");
    body.forEach((row) => out.push("<tr>" + row.map((c) => `<td>${inlineMd(c)}</td>`).join("") + "</tr>"));
    out.push("</tbody></table>");
    tableRows = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().startsWith("```")) {
      closeList(); closeTable();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(esc(raw) + "\n"); continue; }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      closeList();
      (tableRows = tableRows || []).push(cells);
      continue;
    }
    closeTable();

    if (!line.trim()) { closeList(); continue; }
    if (/^#\s/.test(line)) { closeList(); out.push(`<h1>${inlineMd(line.slice(2))}</h1>`); continue; }
    if (/^##\s/.test(line)) { closeList(); out.push(`<h2>${inlineMd(line.slice(3))}</h2>`); continue; }
    if (/^###+\s/.test(line)) { closeList(); out.push(`<h3>${inlineMd(line.replace(/^#+\s/, ""))}</h3>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { closeList(); out.push("<hr />"); continue; }
    if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inlineMd(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }

    const task = line.match(/^\s*[-*]\s\[([ xX])\]\s(.*)$/);
    if (task) {
      if (!listOpen) { out.push("<ul>"); listOpen = true; }
      const done = task[1].toLowerCase() === "x";
      out.push(`<li class="${done ? "done" : "todo"}">${done ? "☑" : "☐"} ${inlineMd(task[2])}</li>`);
      continue;
    }
    const item = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
    if (item) {
      if (!listOpen) { out.push("<ul>"); listOpen = true; }
      out.push(`<li>${inlineMd(item[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeList(); closeTable();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

/* ── Студия ───────────────────────────────────────────────────────────── */

function studioOpts(extra = {}) {
  return {
    prompt: $("studio-prompt").value.trim(),
    provider: $("sel-provider").value,
    renderer: $("sel-renderer").value,
    mode: $("sel-mode").value,
    image_provider: $("sel-image").value,
    ...extra,
  };
}

function appendStudioLog(text) {
  const box = $("studio-log");
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.appendChild(document.createTextNode(text));
  if ($("chk-studio-autoscroll").checked || atBottom) box.scrollTop = box.scrollHeight;
}

function setStudioProgress(percent, step) {
  $("studio-progress").style.width = `${Math.max(0, Math.min(100, percent))}%`;
  $("studio-pct").textContent = `${percent}%`;
  if (step) $("studio-step").textContent = step;
}

function setStudioRunning(running) {
  ["btn-create-full", "btn-create-spec", "btn-analyze"].forEach((id) => { $(id).disabled = running; });
  if (running) {
    showLogPane(true);
    if (!state.timerHandle) {
      state.timerHandle = setInterval(() => {
        state.elapsed += 1;
        const m = String(Math.floor(state.elapsed / 60)).padStart(2, "0");
        const s = String(state.elapsed % 60).padStart(2, "0");
        $("studio-timer").textContent = `⏱️ ${m}:${s}`;
      }, 1000);
    }
  } else if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
}

function showLogPane(visible) {
  $("studio-log-pane").classList.toggle("hidden", !visible);
  $("studio-gallery-pane").classList.toggle("hidden", visible);
  $("btn-toggle-log").textContent = visible ? "🎮 Игры" : "📟 Журнал";
  if (!visible) loadGallery();
}

async function loadStudioState() {
  const st = await api("/api/studio/state");
  $("studio-log").textContent = st.logs || "";
  $("studio-log").scrollTop = $("studio-log").scrollHeight;
  setStudioProgress(st.percent, st.step);
  state.elapsed = st.elapsed || 0;
  setStudioRunning(st.running);
}

async function loadGallery() {
  const { projects } = await api("/api/projects");
  state.projects = projects;
  const box = $("gallery");
  box.innerHTML = "";
  $("gallery-count").textContent = projects.length ? `· ${projects.length} шт.` : "";
  if (!projects.length) {
    box.appendChild(el("div", "muted",
      "Пока ни одной игры. Опишите идею выше и нажмите «🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ» — готовые проекты появятся здесь обложками."));
    return;
  }
  projects.forEach((p) => {
    const card = el("div", "game-card");
    const cover = el("div", "cover");
    if (p.has_preview) {
      const img = el("img");
      img.src = `/api/projects/${encodeURIComponent(p.slug)}/preview.png?v=${p.preview_mtime}`;
      img.loading = "lazy";
      cover.appendChild(img);
    } else cover.textContent = "🖼 превью ещё не создано";
    card.appendChild(cover);

    const body = el("div", "body");
    body.appendChild(el("div", "name", `🎮 ${esc(p.title)}`));
    body.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${esc(p.renderer)} · ⭐ ${esc(p.score)}/10 · ${p.playable ? "💻 код готов" : "📄 только ТЗ"}`));
    card.appendChild(body);

    const actions = el("div", "card-actions");
    const play = el("button", `btn small ${p.playable ? "ok" : ""}`, p.playable ? "▶ Играть" : "▶ Нет кода");
    play.disabled = !p.playable;
    play.onclick = (e) => { e.stopPropagation(); openPlay(p.slug); };
    const open = el("button", "btn small", "📄 Открыть ТЗ");
    open.onclick = (e) => { e.stopPropagation(); selectProject(p.slug); };
    actions.append(play, open);
    card.appendChild(actions);

    card.onclick = () => selectProject(p.slug);
    box.appendChild(card);
  });
}

/* ── Брейнсторм ───────────────────────────────────────────────────────── */

function openBrainstorm() {
  $("brainstorm-modal").classList.remove("hidden");
  if (!state.ideas.length) runBrainstorm();
}

async function runBrainstorm() {
  const btn = $("btn-run-brainstorm");
  btn.disabled = true;
  btn.textContent = "⏳ Генерация идей...";
  $("idea-list").innerHTML = '<div class="muted">ИИ анализирует рынок и генерирует уникальные концепты...</div>';
  const res = await api("/api/brainstorm", {
    body: { provider: $("sel-provider").value, hint: $("brainstorm-hint").value.trim(), count: 10 },
  });
  btn.disabled = false;
  btn.textContent = "⚡ Придумать 10 идей";
  state.ideas = res.ideas || [];
  renderIdeas();
  if (res.status === "error") toast("Брейнсторм", res.message || "Не удалось получить идеи", "err");
}

function renderIdeas() {
  const box = $("idea-list");
  box.innerHTML = "";
  if (!state.ideas.length) {
    box.appendChild(el("div", "muted", "Не удалось получить идеи. Попробуйте ещё раз."));
    updateIdeaCount();
    return;
  }
  state.ideas.forEach((idea, index) => {
    const card = el("div", "idea-card");
    const head = el("div", "idea-head");
    const check = el("input");
    check.type = "checkbox";
    check.dataset.index = index;
    check.onchange = updateIdeaCount;
    head.appendChild(check);
    head.appendChild(el("strong", "", esc(idea.title)));
    head.appendChild(el("span", "badge genre", esc(idea.genre)));
    head.appendChild(el("span", "badge renderer", esc((idea.renderer || "").toUpperCase())));
    card.appendChild(head);
    card.appendChild(el("div", "hook", `🎯 Hook: ${esc(idea.hook)}`));
    if (idea.art_style) card.appendChild(el("div", "seed", `🎨 Стиль: ${esc(idea.art_style)}`));
    card.appendChild(el("div", "seed", esc(idea.prompt_seed)));

    const take = el("button", "btn small primary", "👉 ВЗЯТЬ В СТУДИЮ");
    take.style.marginTop = "8px";
    take.onclick = () => {
      $("studio-prompt").value = idea.prompt_seed;
      if (idea.renderer) $("sel-renderer").value = idea.renderer;
      closeBrainstorm();
      toast("Идея выбрана", idea.title, "ok");
    };
    card.appendChild(take);
    box.appendChild(card);
  });
  updateIdeaCount();
}

function selectedIdeas() {
  return [...$("idea-list").querySelectorAll("input[type=checkbox]")]
    .filter((c) => c.checked)
    .map((c) => state.ideas[Number(c.dataset.index)]);
}

function updateIdeaCount() {
  const count = selectedIdeas().length;
  $("idea-count").textContent = `Выбрано идей: ${count}`;
  $("btn-batch").disabled = count === 0;
  $("btn-batch").textContent = count
    ? `📦 СДЕЛАТЬ ДОКИ ПО ВЫБРАННЫМ (${count})`
    : "📦 СДЕЛАТЬ ДОКИ ПО ВЫБРАННЫМ";
}

function closeBrainstorm() { $("brainstorm-modal").classList.add("hidden"); }

/* ── Проекты ──────────────────────────────────────────────────────────── */

async function loadProjects() {
  const { projects } = await api("/api/projects");
  state.projects = projects;
  const box = $("projects-list");
  box.innerHTML = "";
  if (!projects.length) {
    box.appendChild(el("div", "muted", "Нет проектов в workspace/"));
    return;
  }
  projects.forEach((p) => {
    const item = el("div", `list-item ${p.slug === state.project ? "active" : ""}`);
    if (p.has_preview) {
      const img = el("img", "thumb");
      img.src = `/api/projects/${encodeURIComponent(p.slug)}/preview.png?v=${p.preview_mtime}`;
      img.loading = "lazy";
      item.appendChild(img);
    } else {
      item.appendChild(el("div", "thumb-empty", "🖼 превью ещё не создано"));
    }
    item.appendChild(el("div", "name", `🎮 ${esc(p.title)}`));
    item.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${esc(p.renderer)} · ⭐ ${esc(p.score)}/10 · ${p.playable ? "💻 код" : "📄 только ТЗ"}`));
    item.onclick = () => selectProject(p.slug);
    box.appendChild(item);
  });
  fillPlayProjects();
  fillChatProjects();
}

async function selectProject(slug) {
  state.project = slug;
  localStorage.setItem("project", slug);
  state.session = null;
  showView("projects");
  const detail = await api(`/api/projects/${encodeURIComponent(slug)}`);
  $("project-title").textContent = `🎮 ${detail.title}`;
  $("project-meta").textContent =
    `Slug: ${detail.slug}  |  Жанр: ${detail.genre}  |  Рендерер: ${detail.renderer}  |  Оценка: ⭐ ${detail.score}/10`;
  state.detail = detail;
  $("btn-play-project").disabled = !detail.playable;
  document.querySelectorAll("#projects-list .list-item").forEach((n) => n.classList.remove("active"));
  loadProjects();
  loadChats();
  openDoc(state.doc);
}

function docTabButtons() {
  const box = $("doc-tabs");
  box.innerHTML = "";
  const tabs = [
    { key: "__designos", label: "🧠 Design OS" },
    ...state.boot.doc_tabs,
    { key: "__preview", label: "🎨 Превью" },
    { key: "__rebuild", label: "🔄 Ребилд" },
  ];
  tabs.forEach((tab) => {
    const btn = el("button", `tab ${tab.key === state.doc ? "active" : ""}`, esc(tab.label));
    btn.onclick = () => openDoc(tab.key);
    box.appendChild(btn);
  });
}

async function openDoc(key) {
  state.doc = key;
  docTabButtons();
  const view = $("doc-view");
  if (!state.project) { view.innerHTML = '<div class="muted">Выберите проект.</div>'; return; }

  if (key === "__designos") { renderDesignOsPane(); return; }
  if (key === "__preview") { renderPreviewPane(); return; }
  if (key === "__rebuild") { renderRebuildPane(); return; }

  $("doc-actions").classList.remove("hidden");
  const doc = await api(`/api/projects/${encodeURIComponent(state.project)}/doc?name=${encodeURIComponent(key)}`);
  state.docContent = doc.content || "";
  $("doc-name").textContent = doc.name;
  renderDoc();
}

function renderDoc() {
  const view = $("doc-view");
  if (state.docRaw) {
    view.className = "doc-view grow raw-view";
    view.textContent = state.docContent;
  } else {
    view.className = "doc-view grow md";
    view.innerHTML = renderMarkdown(state.docContent);
  }
  $("btn-doc-raw").textContent = state.docRaw ? "🎨 Форматированный вид" : "📝 Исходный Markdown";
}

/* ── Design OS: обещание, допущения, плотность, ворота ────────────────── */

const GATE_LABELS = { pending: "⏳ Ожидают человека", accepted: "✅ Приняты", rejected: "⛔ Отклонены" };

function dosSection(title, subtitle) {
  const box = el("div", "dos-block");
  box.appendChild(el("h3", "", esc(title)));
  if (subtitle) box.appendChild(el("div", "small dim", esc(subtitle)));
  return box;
}

function dosTable(headers, rows) {
  const table = el("table", "dos-table");
  const head = el("tr");
  headers.forEach((h) => head.appendChild(el("th", "", esc(h))));
  table.appendChild(head);
  rows.forEach((cells) => {
    const tr = el("tr");
    cells.forEach((c) => tr.appendChild(el("td", "", c)));
    table.appendChild(tr);
  });
  return table;
}

async function renderDesignOsPane() {
  $("doc-actions").classList.add("hidden");
  const view = $("doc-view");
  view.className = "doc-view grow";
  view.innerHTML = '<div class="muted">Загружаю слой Design OS...</div>';

  const data = await api(`/api/projects/${encodeURIComponent(state.project)}/design-os`);
  view.innerHTML = "";
  if (!data.available) {
    view.appendChild(el("div", "muted", esc(data.message || "Слой Design OS недоступен для этого проекта.")));
    return;
  }

  // Здоровье проекта
  const health = data.health || { stats: {}, issues: [], warnings: [] };
  const healthBox = dosSection("🩺 Здоровье проекта", `Дизайн-ядро: ${data.nucleus || "не выбрано"}`);
  const stats = el("div", "dos-stats");
  const s = health.stats || {};
  [["Допущений", s.assumptions], ["Экспериментов", s.experiments], ["Событий телеметрии", s.telemetry_events],
   ["Решений", s.decisions], ["Ворот ожидают", s.gates_pending], ["Контракты", s.contracts_ok ? "валидны" : "ошибки"]]
    .forEach(([label, value]) => {
      const card = el("div", "dos-stat");
      card.appendChild(el("div", "dos-stat-value", esc(value ?? "—")));
      card.appendChild(el("div", "small dim", esc(label)));
      stats.appendChild(card);
    });
  healthBox.appendChild(stats);
  (health.issues || []).forEach((issue) =>
    healthBox.appendChild(el("div", "dos-issue", "⛔ " + esc(issue))));
  (health.warnings || []).forEach((warning) =>
    healthBox.appendChild(el("div", "dos-warn", "⚠ " + esc(warning))));
  if (!(health.issues || []).length) healthBox.appendChild(el("div", "dos-ok", "✅ Все допущения покрыты экспериментами, контракты валидны"));
  view.appendChild(healthBox);

  // Человеческие ворота
  const gatesBox = dosSection("🚦 Человеческие ворота",
    "Фабрика проектирует, но необратимые обязательства принимает человек.");
  (data.gates || []).forEach((gate) => {
    const row = el("div", `dos-gate ${gate.status}`);
    row.appendChild(el("div", "dos-gate-title", `${esc(gate.id)} — ${esc(gate.name)}`));
    row.appendChild(el("div", "small", esc(gate.question)));
    row.appendChild(el("div", "small dim", `Блокирует: ${esc(gate.blocks)}`));
    const criteria = el("ul", "dos-criteria");
    (gate.criteria || []).forEach((c) => criteria.appendChild(el("li", "", esc(c))));
    row.appendChild(criteria);

    const actions = el("div", "row");
    actions.appendChild(el("span", "dos-status", esc(GATE_LABELS[gate.status] || gate.status)));
    const setStatus = async (status) => {
      const res = await api(`/api/projects/${encodeURIComponent(state.project)}/gates/${encodeURIComponent(gate.id)}`,
        { body: { status } });
      toast("Ворота", res.message || "Готово", res.status === "success" ? "ok" : "err");
      renderDesignOsPane();
    };
    if (gate.status !== "accepted") {
      const accept = el("button", "btn ok small", "✅ Принять");
      accept.onclick = () => setStatus("accepted");
      actions.appendChild(accept);
    }
    if (gate.status !== "rejected") {
      const reject = el("button", "btn small", "⛔ Отклонить");
      reject.onclick = () => setStatus("rejected");
      actions.appendChild(reject);
    }
    if (gate.status !== "pending") {
      const reset = el("button", "btn small", "↩ Вернуть в ожидание");
      reset.onclick = () => setStatus("pending");
      actions.appendChild(reset);
    }
    row.appendChild(actions);
    gatesBox.appendChild(row);
  });
  view.appendChild(gatesBox);

  // Обещание игроку
  const promise = data.promise || {};
  const promiseBox = dosSection("🤝 Обещание игроку", "Приёмочный критерий, а не маркетинг.");
  [["Витрина платформы", promise.store_promise], ["Первые 60 секунд", promise.first_session_promise],
   ["Долгая игра", promise.long_term_promise]].forEach(([title, layer]) => {
    if (!layer || !layer.claim) return;
    const card = el("div", "dos-card");
    card.appendChild(el("div", "dos-gate-title", esc(title)));
    card.appendChild(el("div", "", esc(layer.claim)));
    const fails = el("div", "small dim", "Сигналы провала: " + esc((layer.failure_signals || []).join(" · ")));
    card.appendChild(fails);
    promiseBox.appendChild(card);
  });
  view.appendChild(promiseBox);

  // Плотность впечатлений
  const density = data.density || {};
  const densityBox = dosSection("🔥 Плотность первой сессии", density.formula || "");
  densityBox.appendChild(dosTable(
    ["Показатель", "Цель"],
    [["Главный рычаг", esc(density.primary_lever)],
     ["Тип скуки", esc(density.boredom_type)],
     ["Значимых решений в минуту", esc(density.md_per_min_target)],
     ["Время до первого действия", `≤ ${esc(density.time_to_first_action_sec)} с`],
     ["Время до первой награды", `≤ ${esc(density.time_to_first_reward_sec)} с`]]));
  if ((density.beats || []).length) {
    densityBox.appendChild(dosTable(
      ["Окно", "Что обязано произойти", "Сигнал провала"],
      density.beats.map((b) => [esc(b.window), esc(b.required_event), esc(b.failure_signal)])));
  }
  if ((density.telemetry || []).length) {
    densityBox.appendChild(el("div", "small dim", "События телеметрии: " +
      esc(density.telemetry.map((t) => t.name).join(", "))));
  }
  view.appendChild(densityBox);

  // Допущения
  const assumptions = data.assumptions || [];
  if (assumptions.length) {
    const box = dosSection("❓ Допущения", "Всё, что не проверено, названо гипотезой, а не фактом.");
    box.appendChild(dosTable(
      ["ID", "Допущение", "Уровень", "Влияние", "Что опровергнет"],
      assumptions.map((a) => [esc(a.id), esc(a.statement), esc(a.ul_level), esc(a.impact), esc(a.falsifier)])));
    view.appendChild(box);
  }

  // Решения
  const decisions = data.decisions || [];
  if (decisions.length) {
    const box = dosSection("🧭 Решения и откаты", "Решение без пути отката не принимается.");
    box.appendChild(dosTable(
      ["ID", "Решение", "Обратимость", "Откат"],
      decisions.map((d) => [esc(d.id), esc(d.title), esc(d.reversibility), esc(d.rollback)])));
    view.appendChild(box);
  }
}

async function renderPreviewPane() {
  $("doc-actions").classList.add("hidden");
  const detail = state.detail || await api(`/api/projects/${encodeURIComponent(state.project)}`);
  const view = $("doc-view");
  view.className = "doc-view grow";
  view.innerHTML = "";
  const pane = el("div", "preview-pane");

  const status = detail.preview_status;
  const badge = el("div", "small",
    status === "skipped" ? "🚫 Превью отключено (режим «Без превью»)"
      : status === "completed" ? "✅ Концепт-превью сгенерировано"
      : `ℹ️ Статус превью: ${esc(status)}`);
  badge.style.color = status === "completed" ? "var(--ok)" : "var(--muted)";
  pane.appendChild(badge);

  const btn = el("button", "btn primary", "🎨 Сгенерировать превью");
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "⏳ Рисуем превью...";
    const res = await api(`/api/projects/${encodeURIComponent(state.project)}/preview`, { method: "POST" });
    btn.disabled = false; btn.textContent = "🎨 Сгенерировать превью";
    toast("Превью", res.message || "Готово", res.status === "success" ? "ok" : "err");
    state.detail = await api(`/api/projects/${encodeURIComponent(state.project)}`);
    renderPreviewPane();
    loadProjects();
  };
  pane.appendChild(btn);

  if (detail.has_preview) {
    const img = el("img");
    img.src = `/api/projects/${encodeURIComponent(state.project)}/preview.png?v=${detail.preview_mtime}`;
    pane.appendChild(img);
  } else {
    pane.appendChild(el("div", "muted", "Изображение превью отсутствует (сгенерирован только PREVIEW_PROMPT.md)."));
  }

  const prompt = await api(`/api/projects/${encodeURIComponent(state.project)}/doc?name=PREVIEW_PROMPT.md`);
  const box = el("pre", "", esc(prompt.content || ""));
  box.style.cssText = "background:#04070d;padding:12px;border-radius:8px;max-height:260px;overflow:auto;white-space:pre-wrap;font-size:12px;width:100%";
  pane.appendChild(box);

  view.appendChild(pane);
}

function renderRebuildPane() {
  $("doc-actions").classList.add("hidden");
  const view = $("doc-view");
  view.className = "doc-view grow";
  view.innerHTML = "";
  view.appendChild(el("h3", "", "🔄 Инкрементальная перегенерация разделов игры"));
  const status = el("div", "small", "");
  const grid = el("div", "rebuild-grid");
  state.boot.rebuild_sections.forEach((section) => {
    const btn = el("button", "btn", esc(section.label));
    btn.onclick = async () => {
      status.style.color = "var(--accent)";
      status.textContent = `⏳ Перегенерация секции «${section.key}»...`;
      const res = await api(`/api/projects/${encodeURIComponent(state.project)}/rebuild`,
        { body: { section: section.key } });
      status.style.color = res.status === "success" ? "var(--ok)" : "var(--err)";
      status.textContent = res.message || "";
    };
    grid.appendChild(btn);
  });
  view.append(grid, status);
}

/* ── Чаты ─────────────────────────────────────────────────────────────── */

function fillChatProjects() {
  const select = $("chat-project");
  const projects = state.projects || [];
  select.innerHTML = "";
  projects.forEach((p) => select.appendChild(new Option(p.slug, p.slug)));
  if (state.project && projects.some((p) => p.slug === state.project)) select.value = state.project;
  else if (projects.length) { state.project = select.value; localStorage.setItem("project", state.project); }
}

async function loadChats() {
  if (!state.project) return;
  const { sessions } = await api(`/api/chats/${encodeURIComponent(state.project)}`);
  state.sessions = sessions;
  $("chats-title").textContent = `💬 Чаты (${sessions.length})`;
  $("chat-side-title").textContent = `💬 Чаты (${sessions.length})`;
  [$("project-chats"), $("chat-list")].forEach((box) => {
    box.innerHTML = "";
    if (!sessions.length) {
      box.appendChild(el("div", "muted small", "Чатов пока нет. Нажмите «➕», чтобы начать разработку с агентом."));
      return;
    }
    sessions.forEach((s) => {
      const row = el("div", `chat-row ${s.id === state.session ? "active" : ""} ${s.running ? "running" : ""}`);
      const when = (s.updated_at || "").slice(5, 16).replace("T", " ");
      const info = s.running ? `⏳ работает ${s.duration}` : `сообщений: ${s.messages}`;
      const open = el("button", "chat-open",
        `<strong>${esc(s.title)}</strong><br /><span class="dim">${s.resumable ? "🔗" : "•"} ${esc(when)} · ${esc(info)}${s.model ? " · " + esc(s.model) : ""}</span>`);
      open.onclick = () => openChat(s.id);
      const del = el("button", "chat-del", "🗑");
      del.onclick = async (e) => {
        e.stopPropagation();
        const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${s.id}`, { method: "DELETE" });
        if (res.status === "error") toast("Чат", res.message, "err");
        if (state.session === s.id) { state.session = null; $("chat-feed").innerHTML = ""; }
        loadChats();
      };
      row.append(open, del);
      box.appendChild(row);
    });
  });
  updateChatButtons();
}

async function newChat() {
  if (!state.project) { toast("Чат", "Сначала выберите проект.", "warn"); return; }
  const res = await api(`/api/chats/${encodeURIComponent(state.project)}`, { method: "POST" });
  await loadChats();
  if (res.session) openChat(res.session.id);
}

async function openChat(sessionId) {
  if (!state.project) return;
  showView("chats");
  const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${sessionId}`);
  if (res.status !== "success") { toast("Чат", res.message || "Не найден", "err"); return; }

  state.session = sessionId;
  state.sessionRunning = res.running;
  const session = res.session;
  $("chat-session-name").textContent = `💬 ${session.title}${session.resumable ? " 🔗" : ""}`;
  if (session.agent) $("chat-agent").value = session.agent;
  if (session.model) ensureModelOption(session.model);

  clearFeed();
  pushChatEvent({ kind: "system", icon: "💬",
    text: `Чат «${session.title}» · проект ${state.project} · агент ${agentLabel(session.agent)}${session.resumable ? " · беседа будет продолжена" : ""}` });
  res.events.forEach(pushChatEvent);
  if (res.running) {
    pushChatEvent({ kind: "system", icon: "⏳",
      text: `Агент работает в этом чате уже ${res.duration} — показываю ход задачи.` });
    res.live_events.forEach(pushChatEvent);
    showTyping(true);
    setChatStatus("● Выполнение...", "var(--accent)");
  } else {
    showTyping(false);
    setChatStatus("● Готов", "var(--ok)");
  }
  loadChats();
  await refreshModels(true);
}

function agentLabel(key) {
  const found = (state.boot.agents || []).find((a) => a.key === key);
  return found ? found.label : (key || "agy");
}

function setChatStatus(text, color) {
  $("chat-status").textContent = text;
  $("chat-status").style.color = color;
}

function clearFeed() {
  $("chat-feed").innerHTML = "";
  state.streamBubble = null;
}

function showTyping(visible) {
  const feed = $("chat-feed");
  let node = feed.querySelector(".typing");
  if (visible) {
    if (!node) {
      node = el("div", "typing", "⚡ агент работает…");
      feed.appendChild(node);
    } else feed.appendChild(node);
    scrollFeed();
  } else if (node) node.remove();
}

function scrollFeed() {
  if (!$("chk-chat-autoscroll").checked) return;
  const feed = $("chat-feed");
  feed.scrollTop = feed.scrollHeight;
}

function addBubble(cls, html) {
  const feed = $("chat-feed");
  const node = el("div", `bubble ${cls}`, html);
  const typing = feed.querySelector(".typing");
  if (typing) feed.insertBefore(node, typing); else feed.appendChild(node);
  scrollFeed();
  return node;
}

function pushChatEvent(event) {
  const kind = event.kind || "raw";

  if (kind === "assistant") {
    if (!state.streamBubble) {
      state.streamBubble = addBubble("assistant",
        `<span class="who">⚡ агент · ${now()}</span><span class="body"></span>`);
    }
    const body = state.streamBubble.querySelector(".body");
    body.textContent += event.text || "";
    scrollFeed();
    return;
  }
  state.streamBubble = null;

  if (kind === "user") {
    addBubble("user", `${esc(event.text)}<span class="stamp">вы · ${now()}</span>`);
  } else if (kind === "assistant_final") {
    addBubble("assistant", `<span class="who">⚡ агент</span>${esc(event.text)}`);
  } else if (kind === "system") {
    addBubble("system", `${esc(event.icon || "⚙")} ${esc(event.text)} <span class="stamp">${now()}</span>`);
  } else if (kind === "tool") {
    const detail = event.detail ? `<div class="tool-detail">${esc(event.detail)}</div>` : "";
    addBubble("tool", `<div class="tool-title">🔧 ${esc(event.title || event.tool || "Инструмент")}</div>${detail}`);
  } else if (kind === "tool_result") {
    const last = [...$("chat-feed").querySelectorAll(".bubble.tool")].pop();
    const html = `<div class="tool-result">↪ ${esc(event.text || "готово")} ${esc(event.meta || "")}</div>`;
    if (last) { last.insertAdjacentHTML("beforeend", html); scrollFeed(); }
    else addBubble("tool", html);
  } else if (kind === "result") {
    const body = event.text ? `<div style="margin-top:6px">${esc(event.text)}</div>` : "";
    addBubble("result",
      `✅ Статус: ${esc(event.status)} · Токенов: ${esc(event.tokens)} · Время: ${esc(event.duration)}${body}`);
  } else if (kind === "error") {
    addBubble("error", `❌ ${esc(event.text)}`);
  } else if (kind === "meta") {
    addBubble("meta", esc(event.text));
  } else if ((event.text || "").trim()) {
    addBubble("meta", esc(event.text));
  }
}

async function sendChatTask() {
  const prompt = $("chat-input").value.trim();
  if (!prompt) return;
  if (!state.project) { toast("Чат", "Сначала выберите проект.", "warn"); return; }

  const model = $("chat-model").value;
  const res = await api(`/api/chats/${encodeURIComponent(state.project)}/send`, {
    body: {
      session_id: state.session,
      prompt,
      agent: $("chat-agent").value,
      model: model === state.boot.model_default ? "" : model,
      yolo: $("chk-yolo").checked,
      continue_dialog: $("chk-continue").checked,
    },
  });
  if (res.status !== "started") {
    pushChatEvent({ kind: "error", text: res.message || "Не удалось запустить задачу." });
    return;
  }
  state.session = res.session.id;
  state.sessionRunning = true;
  $("chat-input").value = "";
  $("chat-session-name").textContent = `💬 ${res.session.title}`;
  showTyping(true);
  setChatStatus("● Выполнение...", "var(--accent)");
  updateChatButtons();
  loadChats();
}

function updateChatButtons() {
  const project = (state.projects || []).find((p) => p.slug === state.project);
  $("btn-chat-play").disabled = !(project && project.playable);
  $("btn-chat-play").textContent = project && project.playable ? "▶ Играть" : "▶ Нет кода";
  $("btn-chat-stop").disabled = !state.sessionRunning;
  const running = (state.sessions || []).filter((s) => s.running).length;
  $("sidebar-running").textContent = running ? `⏳ Работает чатов: ${running}` : "";
}

function ensureModelOption(model) {
  const select = $("chat-model");
  if (![...select.options].some((o) => o.value === model)) select.appendChild(new Option(model, model));
  select.value = model;
}

async function refreshModels(quiet = false) {
  const agent = $("chat-agent").value;
  const btn = $("btn-reload-models");
  btn.disabled = true; btn.textContent = "⏳";
  const res = await api(`/api/agents/${agent}/models`);
  btn.disabled = false; btn.textContent = "🔄";

  const select = $("chat-model");
  const previous = select.value;
  select.innerHTML = "";
  select.appendChild(new Option(state.boot.model_default, ""));
  (res.models || []).forEach((m) => select.appendChild(new Option(m, m)));
  if (previous && [...select.options].some((o) => o.value === previous)) select.value = previous;
  if (!quiet) {
    if (res.models && res.models.length) toast("Модели", `Список обновлён: ${res.models.length} шт.`, "ok");
    else toast("Модели", res.message || "Список получить не удалось", "err");
  }
}

/* ── Играть ───────────────────────────────────────────────────────────── */

function fillPlayProjects() {
  const select = $("play-project");
  const projects = state.projects || [];
  const current = select.value;
  select.innerHTML = "";
  projects.forEach((p) => select.appendChild(new Option(p.slug + (p.playable ? "" : "  (нет кода)"), p.slug)));
  const wanted = state.playSlug || current || state.project;
  if (wanted && projects.some((p) => p.slug === wanted)) select.value = wanted;
  state.playSlug = select.value || null;
}

async function openPlay(slug) {
  state.playSlug = slug;
  showView("play");
  fillPlayProjects();
  $("play-project").value = slug;
  await loadPlayState();
  const state_ = await api(`/api/play/${encodeURIComponent(slug)}`);
  if (!state_.running) startPlay();
  else if (state_.url) window.open(state_.url, "_blank", "noopener");
}

async function loadPlayState() {
  const slug = $("play-project").value;
  if (!slug) return;
  state.playSlug = slug;
  const st = await api(`/api/play/${encodeURIComponent(slug)}`);
  $("play-log").textContent = st.logs || "";
  $("play-log").scrollTop = $("play-log").scrollHeight;
  $("play-url").value = st.url || "";
  setPlayStatus(st.running, st.starting, st.url);
}

function setPlayStatus(running, starting, url) {
  const node = $("play-status");
  if (starting) { node.textContent = "● Запуск сервера..."; node.style.color = "var(--warn)"; }
  else if (running) { node.textContent = `● Сервер работает${url ? " · " + url : ""}`; node.style.color = "var(--ok)"; }
  else { node.textContent = "● Сервер остановлен"; node.style.color = "var(--muted)"; }
}

async function startPlay() {
  const slug = $("play-project").value;
  if (!slug) return;
  const res = await api(`/api/play/${encodeURIComponent(slug)}/start`, { method: "POST" });
  if (res.status === "error") toast("Запуск игры", res.message, "err");
  if (res.url) { $("play-url").value = res.url; window.open(res.url, "_blank", "noopener"); }
}

/* ── Квоты ────────────────────────────────────────────────────────────── */

function quotaColor(percent) {
  if (percent === null || percent === undefined) return "var(--dim)";
  if (percent <= 10) return "var(--err)";
  if (percent <= 30) return "var(--warn)";
  return "var(--ok)";
}

function quotaCard(card) {
  const node = el("div", "quota-card");
  node.appendChild(el("h3", "", esc(card.title)));
  node.appendChild(el("div", "sub", esc(card.subtitle || "")));
  card.rows.forEach((row) => {
    const wrap = el("div", "quota-row");
    wrap.appendChild(el("div", "title", esc(row.title)));
    if (row.percent === null || row.percent === undefined) {
      wrap.appendChild(el("div", "note", esc(row.note)));
    } else {
      const color = quotaColor(row.percent);
      const line = el("div", "bar-line");
      const bar = el("div", "bar");
      const fill = el("div");
      fill.style.width = `${Math.max(0, Math.min(100, row.percent))}%`;
      fill.style.background = color;
      bar.appendChild(fill);
      const pct = el("div", "pct", `${Number(row.percent).toFixed(2)}%`);
      pct.style.color = color;
      line.append(bar, pct);
      wrap.appendChild(line);
      wrap.appendChild(el("div", "note", esc(row.note)));
    }
    node.appendChild(wrap);
  });
  if (!card.live && card.key && card.key !== "gemini" && card.key !== "claude_family") {
    const btn = el("button", "btn small", "▶ Открыть терминал и выполнить /usage");
    btn.style.marginTop = "10px";
    btn.onclick = async () => {
      const res = await api(`/api/quota/${card.key}/terminal`, { method: "POST" });
      toast("Терминал", res.message || "", res.status === "success" ? "ok" : "err");
    };
    node.appendChild(btn);
  }
  return node;
}

async function loadQuota() {
  const data = await api("/api/quota");
  $("quota-source").textContent = data.source;
  $("quota-source").style.color = data.live ? "var(--ok)" : "var(--warn)";
  $("quota-updated").textContent = `обновлено ${data.updated_at} · последний запрос AGY: ${data.last_agy_request}`;
  $("quota-meta").textContent = data.meta;

  const agyBox = $("quota-agy");
  agyBox.innerHTML = "";
  data.agy.forEach((card) => agyBox.appendChild(quotaCard({ ...card, key: null })));

  const agentsBox = $("quota-agents");
  agentsBox.innerHTML = "";
  data.agents.forEach((card) => agentsBox.appendChild(quotaCard(card)));

  const summary = $("sidebar-quota");
  summary.textContent = data.summary.text;
  summary.classList.toggle("critical", data.summary.critical);
}

function startQuotaTimer() {
  stopQuotaTimer();
  state.quotaTimer = setInterval(loadQuota, 30000);
}
function stopQuotaTimer() {
  if (state.quotaTimer) { clearInterval(state.quotaTimer); state.quotaTimer = null; }
}

/* ── Настройки ────────────────────────────────────────────────────────── */

function renderSettings() {
  const settings = state.boot.settings;
  const box = $("settings-agents");
  box.innerHTML = "";

  Object.entries(settings.agents).forEach(([key, agent]) => {
    const card = el("div", "settings-card");
    card.appendChild(el("h3", "", esc(agent.label)));

    const path = el("input");
    path.type = "text";
    path.value = agent.cli_path;
    path.dataset.field = `${key}.cli_path`;
    card.appendChild(el("div", "small muted", "Путь к CLI"));
    card.appendChild(path);

    const modelRow = el("div", "row");
    const model = el("select");
    model.dataset.field = `${key}.model`;
    model.appendChild(new Option(state.boot.model_default, ""));
    if (agent.model) model.appendChild(new Option(agent.model, agent.model));
    model.value = agent.model || "";
    model.style.flex = "1";
    const reload = el("button", "btn small", "🔄");
    reload.onclick = async () => {
      reload.disabled = true; reload.textContent = "⏳";
      const res = await api(`/api/agents/${key}/models`);
      reload.disabled = false; reload.textContent = "🔄";
      const previous = model.value;
      model.innerHTML = "";
      model.appendChild(new Option(state.boot.model_default, ""));
      (res.models || []).forEach((m) => model.appendChild(new Option(m, m)));
      if (previous && ![...model.options].some((o) => o.value === previous)) {
        model.appendChild(new Option(previous, previous));
      }
      model.value = previous;
    };
    modelRow.append(model, reload);
    card.appendChild(el("div", "small muted", "Модель (список от CLI)"));
    card.appendChild(modelRow);

    const effort = el("select");
    effort.dataset.field = `${key}.effort`;
    effort.appendChild(new Option("auto (не передавать)", ""));
    (agent.effort_levels || []).forEach((level) => effort.appendChild(new Option(level, level)));
    effort.value = agent.effort || "";
    effort.disabled = !(agent.effort_levels || []).length;
    card.appendChild(el("div", "small muted",
      (agent.effort_levels || []).length ? "Reasoning Effort" : "Reasoning Effort: нет у этого CLI"));
    card.appendChild(effort);

    const test = el("button", "btn small", `🔌 Проверить ${key}`);
    test.onclick = async () => {
      test.disabled = true; test.textContent = "⏳ Проверка...";
      const res = await api(`/api/agents/${key}/test`, {
        body: { cli_path: path.value, model: model.value, effort: effort.value },
      });
      test.disabled = false;
      const ok = res.status === "success";
      test.textContent = ok ? `✅ ${key} подключен!` : `❌ ${String(res.message || "").slice(0, 40)}`;
      setTimeout(() => { test.textContent = `🔌 Проверить ${key}`; }, 4000);
    };
    card.appendChild(test);
    box.appendChild(card);
  });

  $("set-workspace").value = settings.workspace_dir;
  $("set-notify").checked = settings.notifications;
  $("chk-notify").checked = settings.notifications;

  const defaults = $("set-default-agent");
  defaults.innerHTML = "";
  state.boot.agents.forEach((a) => defaults.appendChild(new Option(a.label, a.key)));
  defaults.value = settings.default_agent;
}

async function saveSettings() {
  const agents = {};
  document.querySelectorAll("#settings-agents [data-field]").forEach((node) => {
    const [key, field] = node.dataset.field.split(".");
    (agents[key] = agents[key] || {})[field] = node.value;
  });
  const res = await api("/api/settings", {
    body: {
      agents,
      default_agent: $("set-default-agent").value,
      workspace_dir: $("set-workspace").value.trim(),
      notifications: $("set-notify").checked,
    },
  });
  $("settings-msg").textContent = res.message || "";
  setTimeout(() => { $("settings-msg").textContent = ""; }, 3000);
  state.boot.settings = await api("/api/settings");
  $("chat-sandbox").textContent = `🔒 Песочница: ${state.boot.settings.sandbox_root}`;
}

/* ── SSE ──────────────────────────────────────────────────────────────── */

function connectEvents() {
  const source = new EventSource("/api/events");
  source.onmessage = (message) => {
    let payload;
    try { payload = JSON.parse(message.data); } catch { return; }
    handleEvent(payload.topic, payload.data || {});
  };
  source.onerror = () => { $("sidebar-status").textContent = "● Переподключение..."; };
  source.onopen = () => { $("sidebar-status").textContent = "● Фабрика запущена"; };
}

function handleEvent(topic, data) {
  switch (topic) {
    case "studio.log":
      appendStudioLog(data.line);
      break;
    case "studio.progress":
      setStudioProgress(data.percent, data.step);
      break;
    case "studio.state":
      if (data.running) state.elapsed = 0;
      setStudioRunning(data.running);
      break;
    case "studio.logs_cleared":
      $("studio-log").textContent = "";
      break;
    case "studio.done":
      toast("Студия", `Проект готов: ${data.slug}`, "ok",
        [["Открыть ТЗ", () => selectProject(data.slug)]]);
      loadGallery();
      break;
    case "projects.changed":
      if (state.view === "studio") loadGallery();
      if (state.view === "projects") loadProjects();
      break;
    case "chats.changed":
      if (data.slug === state.project) loadChats();
      break;
    case "chat.event":
      if (data.session_id === state.session) pushChatEvent(data.event);
      break;
    case "chat.started":
      if (data.session_id === state.session) { state.sessionRunning = true; updateChatButtons(); }
      break;
    case "chat.finished":
      if (data.session_id === state.session) {
        state.sessionRunning = false;
        showTyping(false);
        setChatStatus(`● ${data.text}`, data.status === "done" ? "var(--ok)" : "var(--warn)");
        updateChatButtons();
      }
      notifyChatDone(data);
      break;
    case "play.log":
      if (data.slug === state.playSlug) {
        const box = $("play-log");
        box.appendChild(document.createTextNode(data.line));
        box.scrollTop = box.scrollHeight;
      }
      break;
    case "play.url":
      if (data.slug === state.playSlug) {
        $("play-url").value = data.url;
        setPlayStatus(true, false, data.url);
        toast("Игра запущена", data.url, "ok", [["Открыть", () => window.open(data.url, "_blank", "noopener")]]);
      }
      break;
    case "play.state":
      if (data.slug === state.playSlug) setPlayStatus(data.running, data.starting, data.url);
      break;
    case "quota.changed":
      if (state.view === "quota") loadQuota();
      break;
    default:
      break;
  }
}

function notifyChatDone(data) {
  const actions = [["Открыть чат", () => { state.project = data.slug; localStorage.setItem("project", data.slug); openChat(data.session_id); }]];
  if (data.playable) actions.unshift(["▶ Играть", () => openPlay(data.slug)]);
  toast(`${data.icon} ${data.text}`, `${data.slug} · ${data.title} · ${data.duration}`,
    data.status === "done" ? "ok" : "warn", actions);

  if ($("chk-notify").checked && "Notification" in window && Notification.permission === "granted") {
    new Notification(`${data.icon} ${data.text}`, { body: `${data.slug} · ${data.title} · ${data.duration}` });
  }
}

/* ── Инициализация ────────────────────────────────────────────────────── */

function fillSelect(id, options, value) {
  const select = $(id);
  select.innerHTML = "";
  options.forEach((opt) => select.appendChild(new Option(opt.label, opt.key)));
  if (value) select.value = value;
}

function bindStudio() {
  const presets = $("studio-presets");
  state.boot.studio_presets.forEach((preset) => {
    const btn = el("button", "btn chip", esc(preset.title));
    btn.onclick = () => { $("studio-prompt").value = preset.prompt; };
    presets.appendChild(btn);
  });

  $("btn-create-full").onclick = async () => {
    const res = await api("/api/studio/generate", { body: studioOpts({ kind: "full", model: $("chat-model").value }) });
    if (res.status === "error" || res.status === "busy") toast("Студия", res.message, "warn");
  };
  $("btn-create-spec").onclick = async () => {
    const res = await api("/api/studio/generate", { body: studioOpts({ kind: "spec" }) });
    if (res.status === "error" || res.status === "busy") toast("Студия", res.message, "warn");
  };
  $("btn-analyze").onclick = async () => {
    showLogPane(true);
    const res = await api("/api/studio/analyze", { body: studioOpts() });
    if (res.status === "error") toast("Анализ", res.message, "err");
  };
  $("btn-stop-studio").onclick = () => api("/api/studio/stop", { method: "POST" });
  $("btn-toggle-log").onclick = () => showLogPane($("studio-log-pane").classList.contains("hidden"));
  $("btn-clear-log").onclick = () => api("/api/studio/logs/clear", { method: "POST" });
  $("btn-copy-log").onclick = async () => {
    await navigator.clipboard.writeText($("studio-log").textContent);
    toast("Журнал", "Скопирован в буфер обмена", "ok");
  };
  $("btn-refresh-gallery").onclick = loadGallery;

  $("btn-brainstorm").onclick = openBrainstorm;
  $("btn-close-brainstorm").onclick = closeBrainstorm;
  $("btn-run-brainstorm").onclick = runBrainstorm;
  $("btn-select-all").onclick = () => {
    $("idea-list").querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = true; });
    updateIdeaCount();
  };
  $("btn-select-none").onclick = () => {
    $("idea-list").querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = false; });
    updateIdeaCount();
  };
  $("btn-batch").onclick = async () => {
    const ideas = selectedIdeas();
    if (!ideas.length) return;
    closeBrainstorm();
    showView("studio");
    $("studio-prompt").value = ideas[0].prompt_seed;
    const res = await api("/api/studio/batch", { body: studioOpts({ ideas }) });
    if (res.status !== "started") toast("Пакет", res.message || "Не удалось запустить", "warn");
  };
}

function bindProjects() {
  $("btn-refresh-projects").onclick = loadProjects;
  $("btn-new-chat").onclick = newChat;
  $("btn-new-chat-2").onclick = newChat;

  $("btn-copy-prompt").onclick = async () => {
    const doc = await api(`/api/projects/${encodeURIComponent(state.project)}/doc?name=AI_DEVELOPER_PROMPT.md`);
    await navigator.clipboard.writeText(doc.content || "");
    toast("Master Prompt", "Скопирован в буфер обмена", "ok");
  };
  $("btn-play-project").onclick = () => state.project && openPlay(state.project);
  $("btn-continue-agent").onclick = async () => {
    if (!state.project) return;
    const res = await api(`/api/projects/${encodeURIComponent(state.project)}/continue-prompt`);
    showView("chats");
    fillChatProjects();
    $("chat-project").value = state.project;
    $("chat-input").value = res.prompt || "";
    $("chat-input").focus();
  };
  $("btn-open-project-folder").onclick = async () => {
    const res = await api(`/api/projects/${encodeURIComponent(state.project)}/open-folder`, { method: "POST" });
    if (res.status === "error") toast("Папка", res.message, "err");
  };
  $("btn-export-zip").onclick = () => {
    if (!state.project) return;
    window.location.href = `/api/projects/${encodeURIComponent(state.project)}/export`;
  };
  $("btn-validate").onclick = async () => {
    const btn = $("btn-validate");
    btn.disabled = true; btn.textContent = "⏳ Проверка...";
    const res = await api(`/api/projects/${encodeURIComponent(state.project)}/validate`, { method: "POST" });
    btn.disabled = false; btn.textContent = "✅ Валидация";
    toast("Валидация", res.message || "", res.valid ? "ok" : "warn");
  };
  $("btn-doc-raw").onclick = () => { state.docRaw = !state.docRaw; renderDoc(); };
  $("btn-doc-copy").onclick = async () => {
    await navigator.clipboard.writeText(state.docContent);
    toast("Документ", "Скопирован в буфер обмена", "ok");
  };
}

function bindChats() {
  $("chat-project").onchange = () => {
    state.project = $("chat-project").value;
    localStorage.setItem("project", state.project);
    state.session = null;
    clearFeed();
    loadChats();
  };
  $("chat-agent").onchange = async () => {
    await api("/api/settings/default-agent", { body: { agent: $("chat-agent").value } });
    refreshModels(true);
  };
  $("btn-reload-models").onclick = () => refreshModels(false);
  $("btn-agent-login").onclick = async () => {
    const res = await api(`/api/agents/${$("chat-agent").value}/terminal`, { body: { bare: true } });
    toast("Вход", res.message || "", res.status === "success" ? "ok" : "err");
  };
  $("btn-chat-send").onclick = sendChatTask;
  $("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatTask(); }
  });
  $("btn-chat-stop").onclick = async () => {
    if (!state.session) return;
    const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${state.session}/stop`, { method: "POST" });
    if (res.status === "error") toast("Стоп", res.message, "warn");
    else setChatStatus("● Остановка...", "var(--err)");
  };
  $("btn-chat-clear").onclick = clearFeed;
  $("btn-chat-copy").onclick = async () => {
    await navigator.clipboard.writeText($("chat-feed").innerText);
    toast("Чат", "Лента скопирована", "ok");
  };
  $("btn-chat-play").onclick = () => state.project && openPlay(state.project);
  $("btn-chat-terminal").onclick = async () => {
    const res = await api(`/api/agents/${$("chat-agent").value}/terminal`, {
      body: { slug: state.project, prompt: $("chat-input").value.trim(), yolo: $("chk-yolo").checked },
    });
    toast("Терминал", res.message || "", res.status === "success" ? "ok" : "err");
  };
  $("chk-notify").onchange = async () => {
    const enabled = $("chk-notify").checked;
    await api("/api/settings/notifications", { body: { enabled } });
    $("set-notify").checked = enabled;
    if (enabled && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
  };
  $("chk-chat-autoscroll").onchange = scrollFeed;

  const presets = $("chat-presets");
  state.boot.chat_presets.forEach((preset) => {
    const btn = el("button", "btn chip", esc(preset.title));
    btn.onclick = () => { $("chat-input").value = preset.prompt; };
    presets.appendChild(btn);
  });
}

function bindPlay() {
  $("play-project").onchange = loadPlayState;
  $("btn-play-start").onclick = startPlay;
  $("btn-play-open").onclick = () => {
    const url = $("play-url").value.trim();
    if (url) window.open(url, "_blank", "noopener");
    else toast("Игра", "URL неизвестен — сначала запустите dev-сервер.", "warn");
  };
  $("btn-play-window").onclick = async () => {
    const res = await api(`/api/play/${encodeURIComponent($("play-project").value)}/window`,
      { body: { url: $("play-url").value.trim() } });
    if (res.status === "error") toast("Окно предпросмотра", res.message, "err");
  };
  $("btn-play-build").onclick = () => api(`/api/play/${encodeURIComponent($("play-project").value)}/build`, { method: "POST" });
  $("btn-play-stop").onclick = async () => {
    await api(`/api/play/${encodeURIComponent($("play-project").value)}/stop`, { method: "POST" });
    loadPlayState();
  };
  $("btn-play-clear").onclick = () => { $("play-log").textContent = ""; };
}

function bindCommon() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => showView(btn.dataset.view);
  });
  $("btn-open-workspace").onclick = () => api("/api/open-workspace", { method: "POST" });
  $("btn-open-workspace-2").onclick = () => api("/api/open-workspace", { method: "POST" });
  $("btn-refresh-quota").onclick = loadQuota;
  $("btn-save-settings").onclick = saveSettings;
  $("set-notify").onchange = async () => {
    await api("/api/settings/notifications", { body: { enabled: $("set-notify").checked } });
    $("chk-notify").checked = $("set-notify").checked;
  };
}

async function boot() {
  state.boot = await api("/api/bootstrap");

  fillSelect("sel-provider", state.boot.providers, state.boot.settings.default_agent);
  fillSelect("sel-renderer", state.boot.renderers, "auto");
  fillSelect("sel-mode", state.boot.modes, "standard");
  fillSelect("sel-image", state.boot.image_providers, "qwen");
  fillSelect("chat-agent", state.boot.agents, state.boot.settings.default_agent);
  $("chat-model").appendChild(new Option(state.boot.model_default, ""));
  $("chat-sandbox").textContent = `🔒 Песочница: ${state.boot.settings.sandbox_root}`;

  bindCommon();
  bindStudio();
  bindProjects();
  bindChats();
  bindPlay();
  docTabButtons();
  renderSettings();

  connectEvents();
  await loadProjects();
  await loadStudioState();
  await loadGallery();
  loadQuota();
  refreshModels(true);

  if (state.project) {
    const exists = (state.projects || []).some((p) => p.slug === state.project);
    if (!exists) { state.project = null; localStorage.removeItem("project"); }
  }
  showView(state.view);
  if (state.project && state.view === "projects") selectProject(state.project);
}

boot();
