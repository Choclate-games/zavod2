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
  attachments: [],    // вложения, готовые уйти со следующим сообщением агенту
  ttsVoices: [],
  ttsVoice: localStorage.getItem("ttsVoice") || "",
  playSlug: null,
  gameTabs: {},        // slug → вкладка браузера, которая ждёт URL dev-сервера
  servers: [],
  activity: [],
  activityTimer: null,
  quotaTimer: null,
  timerHandle: null,
  elapsed: 0,
  streamBubble: null,
  streamRaw: "",   // потоковый текст текущего ответа для markdown-рендера
  streamBubbles: [],   // потоковые пузыри текущего ответа — их заменит финальная версия
  gallerySort: localStorage.getItem("gallerySort") || "new",
  showArchived: localStorage.getItem("showArchived") === "1",
  showArchivedList: localStorage.getItem("showArchivedList") === "1",
  hideTools: localStorage.getItem("hideTools") === "1",
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
  if (name === "play") { fillPlayProjects(); loadPlayState(); loadServers(); }
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

function sortProjects(projects, mode) {
  const list = [...projects];
  const byCreated = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
  if (mode === "old") list.sort((a, b) => -byCreated(a, b));
  else if (mode === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || byCreated(a, b));
  else if (mode === "updated") list.sort((a, b) => (b.updated_ts || 0) - (a.updated_ts || 0));
  else list.sort(byCreated);
  return list;
}

function visibleProjects(showArchived, mode) {
  const all = state.projects || [];
  const list = showArchived ? all : all.filter((p) => !p.archived);
  return sortProjects(list, mode || state.gallerySort);
}

/* Оценка игры: пять звёзд, повторный клик по той же звезде снимает оценку. */
function starWidget(project, size = "") {
  const box = el("span", `stars ${size}`);
  for (let i = 1; i <= 5; i += 1) {
    const star = el("button", `star ${i <= (project.rating || 0) ? "on" : ""}`, i <= (project.rating || 0) ? "★" : "☆");
    star.title = `Оценка ${i} из 5`;
    star.onclick = async (e) => {
      e.stopPropagation();
      const value = project.rating === i ? 0 : i;
      const res = await api(`/api/projects/${encodeURIComponent(project.slug)}/rating`, { body: { rating: value } });
      if (res.status === "error") { toast("Оценка", res.message, "err"); return; }
      project.rating = res.rating;
      refreshProjectViews();
    };
    box.appendChild(star);
  }
  return box;
}

async function toggleArchive(project) {
  const res = await api(`/api/projects/${encodeURIComponent(project.slug)}/archive`,
    { body: { archived: !project.archived } });
  if (res.status === "error") { toast("Архив", res.message, "err"); return; }
  project.archived = res.archived;
  toast("Архив", res.message, "ok");
  refreshProjectViews();
}

/* Переименование игры: меняется отображаемое имя, слаг каталога остаётся —
   на него завязаны чаты, снимки для отката и запущенные dev-серверы. */
async function renameProject(project) {
  const current = project.title || project.slug;
  const next = prompt(
    `Новое название игры «${current}»\n\n`
    + `Папка проекта (${project.slug}) не переименовывается: на неё ссылаются чаты,\n`
    + `снимки для отката и запущенные серверы.\n`
    + `Новое имя попадёт и в GAME_DATA.yaml — агент увидит игру так же, как вы.`,
    current);
  if (next === null) return;

  const res = await api(`/api/projects/${encodeURIComponent(project.slug)}/rename`,
    { body: { title: next } });
  if (res.status === "error") { toast("Переименование", res.message, "err"); return; }
  project.title = res.title;
  if (state.detail && state.detail.slug === project.slug) state.detail.title = res.title;
  toast("Переименование", res.message, "ok");
  refreshProjectViews();
  loadChats();
}

async function deleteProject(project) {
  const ok = confirm(
    `Удалить игру «${project.title}» безвозвратно?

` +
    `Будут стёрты код, спецификация и чаты (${project.slug}).
` +
    `Если игра просто мешает — используйте «📦 В архив»: она останется на диске.`);
  if (!ok) return;
  const res = await api(`/api/projects/${encodeURIComponent(project.slug)}`, { method: "DELETE" });
  if (res.status === "error") { toast("Удаление", res.message, "err"); return; }
  toast("Удаление", res.message, "ok");
  if (state.project === project.slug) {
    state.project = null;
    state.session = null;
    state.detail = null;
    localStorage.removeItem("project");
    clearFeed();
    $("project-title").textContent = "Выберите проект из списка слева";
    $("project-meta").textContent = "";
  }
  await loadProjects();
  loadGallery();
}

function refreshProjectViews() {
  loadGallery();
  loadProjects();
  if (state.project && state.detail) renderProjectBanner();
}

async function loadGallery() {
  const { projects } = await api("/api/projects");
  state.projects = projects;
  const box = $("gallery");
  box.innerHTML = "";
  const shown = visibleProjects(state.showArchived);
  const archivedCount = projects.filter((p) => p.archived).length;
  $("gallery-count").textContent = projects.length
    ? `· показано ${shown.length} из ${projects.length}${archivedCount ? ` · 📦 в архиве ${archivedCount}` : ""}`
    : "";
  if (!shown.length) {
    box.appendChild(el("div", "muted", projects.length
      ? "Все игры убраны в архив. Включите галочку «📦 Архив», чтобы увидеть их."
      : "Пока ни одной игры. Опишите идею выше и нажмите «🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ» — готовые проекты появятся здесь обложками."));
    return;
  }
  shown.forEach((p) => {
    const card = el("div", `game-card ${p.archived ? "archived" : ""}`);
    const cover = el("div", "cover");
    if (p.has_preview) {
      const img = el("img");
      img.src = `/api/projects/${encodeURIComponent(p.slug)}/preview.png?v=${p.preview_mtime}`;
      img.loading = "lazy";
      cover.appendChild(img);
    } else cover.textContent = "🖼 превью ещё не создано";
    if (p.archived) cover.appendChild(el("span", "archive-badge", "📦 архив"));
    card.appendChild(cover);

    const body = el("div", "body");
    body.appendChild(el("div", "name", `🎮 ${esc(p.title)}`));
    body.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${esc(p.renderer)} · ⭐ ${esc(p.score)}/10 · ${p.playable ? "💻 код готов" : "📄 только ТЗ"}`));
    const line = el("div", "card-rating");
    line.appendChild(starWidget(p));
    line.appendChild(el("span", "dim", p.created_label ? `создана ${esc(p.created_label)}` : ""));
    body.appendChild(line);
    card.appendChild(body);

    const actions = el("div", "card-actions");
    const play = el("button", `btn small ${p.playable ? "ok" : ""}`, p.playable ? "▶ Играть" : "▶ Нет кода");
    play.disabled = !p.playable;
    play.onclick = (e) => { e.stopPropagation(); openPlay(p.slug); };
    const open = el("button", "btn small", "📄 ТЗ");
    open.onclick = (e) => { e.stopPropagation(); selectProject(p.slug); };
    const rename = el("button", "btn small icon-only", "✏️");
    rename.title = "Переименовать игру";
    rename.onclick = (e) => { e.stopPropagation(); renameProject(p); };
    const archive = el("button", "btn small icon-only", p.archived ? "↩️" : "📦");
    archive.title = p.archived ? "Вернуть из архива" : "Убрать в архив (игра останется на диске)";
    archive.onclick = (e) => { e.stopPropagation(); toggleArchive(p); };
    const remove = el("button", "btn small danger", "🗑");
    remove.title = "Удалить игру безвозвратно";
    remove.onclick = (e) => { e.stopPropagation(); deleteProject(p); };
    actions.append(play, open, rename, archive, remove);
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
  const shown = visibleProjects(state.showArchivedList);
  if (!shown.length) {
    box.appendChild(el("div", "muted", projects.length
      ? "Все проекты в архиве — включите «📦 Архив»."
      : "Нет проектов в workspace/"));
  }
  shown.forEach((p) => {
    const item = el("div", `list-item ${p.slug === state.project ? "active" : ""} ${p.archived ? "archived" : ""}`);
    if (p.has_preview) {
      const img = el("img", "thumb");
      img.src = `/api/projects/${encodeURIComponent(p.slug)}/preview.png?v=${p.preview_mtime}`;
      img.loading = "lazy";
      item.appendChild(img);
    } else {
      item.appendChild(el("div", "thumb-empty", "🖼 превью ещё не создано"));
    }
    item.appendChild(el("div", "name", `${p.archived ? "📦 " : "🎮 "}${esc(p.title)}`));
    item.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${esc(p.renderer)} · ⭐ ${esc(p.score)}/10 · ${p.playable ? "💻 код" : "📄 только ТЗ"}`));
    const line = el("div", "card-rating");
    line.appendChild(starWidget(p, "tiny"));
    line.appendChild(el("span", "dim", p.created_label ? esc(p.created_label) : ""));
    item.appendChild(line);
    item.onclick = () => selectProject(p.slug);
    box.appendChild(item);
  });
  fillPlayProjects();
  fillChatProjects();
}

function renderProjectBanner() {
  const detail = state.detail;
  if (!detail) return;
  const card = (state.projects || []).find((p) => p.slug === detail.slug) || detail;
  $("project-title").textContent = `${card.archived ? "📦 " : "🎮 "}${detail.title}`;
  $("project-meta").textContent =
    `Slug: ${detail.slug}  |  Жанр: ${detail.genre}  |  Рендерер: ${detail.renderer}  |  Оценка ИИ: ⭐ ${detail.score}/10`
    + (detail.created_label ? `  |  Создана: ${detail.created_label}` : "")
    + (card.archived ? "  |  📦 в архиве" : "");
  const stars = $("project-stars");
  stars.innerHTML = "";
  stars.appendChild(starWidget(card));
  $("btn-archive-project").textContent = card.archived ? "↩️ Из архива" : "📦 В архив";
  $("btn-play-project").disabled = !detail.playable;
}

async function selectProject(slug) {
  if (state.project !== slug) clearAttachments();
  state.project = slug;
  localStorage.setItem("project", slug);
  state.session = null;
  showView("projects");
  const detail = await api(`/api/projects/${encodeURIComponent(slug)}`);
  state.detail = detail;
  renderProjectBanner();
  document.querySelectorAll("#projects-list .list-item").forEach((n) => n.classList.remove("active"));
  loadProjects();
  loadChats();
  openDoc(state.doc);
}

function docTabButtons() {
  const box = $("doc-tabs");
  box.innerHTML = "";
  // Вкладка Design OS появляется только когда слой включён на бэкенде.
  const tabs = [
    ...(state.boot.design_os_enabled ? [{ key: "__designos", label: "🧠 Design OS" }] : []),
    ...state.boot.doc_tabs,
    { key: "__preview", label: "🎨 Превью" },
    { key: "__tts", label: "🔊 Озвучка" },
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

  if (key === "__designos") {
    if (!state.boot.design_os_enabled) { openDoc(state.boot.doc_tabs[0].key); return; }
    renderDesignOsPane();
    return;
  }
  if (key === "__preview") { renderPreviewPane(); return; }
  if (key === "__tts") { renderTtsPane(); return; }
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

/* ── Озвучка: Fish Audio TTS ──────────────────────────────────────────────
 *
 * Синтез запускается только отсюда, кнопкой пользователя: озвучка тратит квоту
 * аккаунта, поэтому агентам фабрики она недоступна. Готовые реплики ложатся
 * в assets/audio/voice/ проекта — агент подключит уже существующие файлы.
 */

async function renderTtsPane() {
  $("doc-actions").classList.add("hidden");
  const view = $("doc-view");
  view.className = "doc-view grow";
  view.innerHTML = "";

  const tts = state.boot.tts || {};
  const pane = el("div", "tts-pane");

  pane.appendChild(el("div", "small dim",
    `Голоса синтезирует Fish Audio, модель ${esc(tts.model || tts.free_model)}`
    + (tts.model === tts.free_model ? " (бесплатная)" : " (платная)")
    + `. Файлы сохраняются в ${esc(tts.dir)} проекта. `
    + "Генерацию запускаете только вы — агенты фабрики TTS не вызывают."));

  if (!tts.configured) {
    const warn = el("div", "dos-warn",
      "⚠ Не задан ключ Fish Audio. Откройте «⚙️ Настройки → 🔊 Fish Audio» и вставьте ключ с fish.audio.");
    pane.appendChild(warn);
    const go = el("button", "btn", "⚙️ Перейти в настройки");
    go.onclick = () => showView("settings");
    pane.appendChild(go);
    view.appendChild(pane);
    return;
  }

  // ── Текст реплики ──
  const text = el("textarea");
  text.rows = 4;
  text.placeholder = "Текст реплики: «Внимание! Волна боссов через десять секунд.»";
  pane.appendChild(el("div", "small muted", "Текст для озвучки"));
  pane.appendChild(text);

  // ── Голос ──
  const voiceRow = el("div", "row");
  const voice = el("select");
  voice.style.flex = "1";
  const fillVoices = () => {
    voice.innerHTML = "";
    voice.appendChild(new Option("🎙 голос по умолчанию (без reference_id)", ""));
    state.ttsVoices.forEach((v) => voice.appendChild(new Option(
      `${v.title}${v.languages && v.languages.length ? " · " + v.languages.join("/") : ""}`, v.id)));
    if (state.ttsVoice && [...voice.options].some((o) => o.value === state.ttsVoice)) {
      voice.value = state.ttsVoice;
    }
  };
  fillVoices();
  voice.onchange = () => {
    state.ttsVoice = voice.value;
    localStorage.setItem("ttsVoice", state.ttsVoice);
  };

  const search = el("input");
  search.type = "text";
  search.placeholder = "поиск голоса: russian, narrator, anime…";
  search.style.flex = "0 0 220px";
  const loadVoices = async () => {
    const res = await api(`/api/tts/voices?query=${encodeURIComponent(search.value.trim())}`);
    if (res.status === "error") { toast("Голоса", res.message, "err"); return; }
    state.ttsVoices = res.voices || [];
    fillVoices();
    toast("Голоса", `Найдено: ${state.ttsVoices.length}`, state.ttsVoices.length ? "ok" : "warn");
  };
  const find = el("button", "btn small", "🔎 Найти голоса");
  find.onclick = loadVoices;
  voiceRow.append(voice, search, find);
  pane.appendChild(el("div", "small muted", "Голос из каталога Fish Audio"));
  pane.appendChild(voiceRow);

  // ── Имя файла и формат ──
  const metaRow = el("div", "row");
  const name = el("input");
  name.type = "text";
  name.placeholder = "имя файла, напр. boss-warning";
  name.style.flex = "1";
  const format = el("select");
  format.style.flex = "0 0 120px";
  (tts.formats || ["mp3"]).forEach((f) => format.appendChild(new Option(f, f)));
  metaRow.append(name, format);
  pane.appendChild(el("div", "small muted", "Имя файла и формат"));
  pane.appendChild(metaRow);

  const status = el("div", "small", "");
  const files = el("div", "tts-files");

  const loadFiles = async () => {
    const res = await api(`/api/tts/${encodeURIComponent(state.project)}/files`);
    files.innerHTML = "";
    if (!(res.files || []).length) {
      files.appendChild(el("div", "muted small", "Озвученных реплик пока нет."));
      return;
    }
    res.files.forEach((f) => {
      const row = el("div", "tts-row");
      row.appendChild(el("div", "grow small", `🔊 ${esc(f.name)} · ${esc(f.size_label)} · ${esc(f.created)}`));
      const audio = el("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = `/api/tts/${encodeURIComponent(state.project)}/file/${encodeURIComponent(f.name)}`;
      row.appendChild(audio);
      const del = el("button", "btn small danger", "🗑");
      del.onclick = async () => {
        const res = await api(`/api/tts/${encodeURIComponent(state.project)}/file/${encodeURIComponent(f.name)}`,
          { method: "DELETE" });
        toast("Озвучка", res.message || "", res.status === "success" ? "ok" : "err");
        loadFiles();
      };
      row.appendChild(del);
      files.appendChild(row);
    });
  };

  const generate = el("button", "btn primary big", "🔊 Озвучить реплику");
  generate.onclick = async () => {
    if (!text.value.trim()) { toast("Озвучка", "Введите текст реплики.", "warn"); return; }
    generate.disabled = true;
    generate.textContent = "⏳ Синтезирую…";
    status.style.color = "var(--accent)";
    status.textContent = "Fish Audio генерирует аудио…";
    const res = await api(`/api/tts/${encodeURIComponent(state.project)}/generate`, {
      body: { text: text.value, voice_id: voice.value, name: name.value, format: format.value },
    });
    generate.disabled = false;
    generate.textContent = "🔊 Озвучить реплику";
    status.style.color = res.status === "success" ? "var(--ok)" : "var(--err)";
    status.textContent = res.message || "";
    if (res.status === "success") loadFiles();
  };
  pane.append(generate, status, el("h3", "", "🎧 Готовые реплики проекта"), files);

  view.appendChild(pane);
  loadFiles();
  if (!state.ttsVoices.length) loadVoices();
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

/* В выпадающих списках архив не мешается — кроме случая, когда архивный
   проект открыт прямо сейчас. */
function activeProjects() {
  return (state.projects || []).filter((p) => !p.archived || p.slug === state.project);
}

function fillChatProjects() {
  const select = $("chat-project");
  const projects = activeProjects();
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
  state.streamRaw = "";
  state.streamBubbles = [];
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

/*
 * Длинный ответ агента не должен занимать весь экран: как только блок
 * перерастает лимит, он сворачивается до «шапки» с кнопкой «Показать
 * целиком». Проверка идёт после отрисовки — иначе высоту не измерить.
 */
const CLAMP_HEIGHT = 260;

function attachClamp(bubble, body) {
  requestAnimationFrame(() => {
    const existing = bubble.querySelector(":scope > .clamp-toggle");
    if (existing) {
      if (body.scrollHeight <= CLAMP_HEIGHT && bubble.classList.contains("clamped")) {
        bubble.classList.remove("clamped");
        existing.remove();
      }
      return;
    }
    if (body.scrollHeight <= CLAMP_HEIGHT) return;
    bubble.classList.add("clamped");
    const toggle = el("button", "clamp-toggle", "▾ Показать целиком");
    toggle.onclick = () => {
      const clamped = bubble.classList.toggle("clamped");
      toggle.textContent = clamped ? "▾ Показать целиком" : "▴ Свернуть";
      if (!clamped) scrollFeed();
    };
    bubble.appendChild(toggle);
  });
}

/* Ответ агента приходит потоком и почти всегда является markdown —
   рендерим его как разметку, а не как «сырой» текст с решётками и звёздами. */
let streamFrame = 0;

function renderStream() {
  // Поток идёт мелкими кусками: перерисовываем markdown не чаще кадра,
  // иначе длинный ответ агента начинает подтормаживать ленту.
  if (streamFrame) return;
  streamFrame = requestAnimationFrame(() => {
    streamFrame = 0;
    if (!state.streamBubble) return;
    const body = state.streamBubble.querySelector(".body");
    body.innerHTML = renderMarkdown(state.streamRaw);
    attachClamp(state.streamBubble, body);
    scrollFeed();
  });
}

/* Поток закончился — дорисовываем остаток сразу, не дожидаясь кадра. */
function flushStream() {
  if (streamFrame) { cancelAnimationFrame(streamFrame); streamFrame = 0; }
  if (!state.streamBubble) return;
  const body = state.streamBubble.querySelector(".body");
  body.innerHTML = renderMarkdown(state.streamRaw);
  attachClamp(state.streamBubble, body);
  scrollFeed();
}

function firstLine(text, limit = 90) {
  const line = String(text || "").split("\n").find((l) => l.trim()) || "";
  return line.length > limit ? line.slice(0, limit) + "…" : line;
}

/* Инструментов за задачу набегают десятки — по умолчанию каждый свёрнут
   в одну строку, детали раскрываются кликом по заголовку. */
function addToolBubble(event) {
  const bubble = addBubble("tool collapsed", "");
  if (state.hideTools) bubble.classList.add("hidden");

  const head = el("button", "tool-head");
  head.appendChild(el("span", "chev", "▸"));
  head.appendChild(el("span", "tool-title", `🔧 ${esc(event.title || event.tool || "Инструмент")}`));
  head.appendChild(el("span", "tool-sub", esc(firstLine(event.detail))));
  head.appendChild(el("span", "tool-status", ""));
  head.onclick = () => {
    bubble.classList.toggle("collapsed");
    head.querySelector(".chev").textContent = bubble.classList.contains("collapsed") ? "▸" : "▾";
    scrollFeed();
  };
  bubble.appendChild(head);

  const body = el("div", "tool-body");
  if (event.detail) body.appendChild(el("pre", "tool-detail", esc(event.detail)));
  bubble.appendChild(body);
  return bubble;
}

/**
 * Запрос пользователя: пузырь плюс кнопка отката слева от него — она возвращает
 * проект к состоянию на момент, когда этот запрос был отправлен.
 */
function addUserBubble(event) {
  const feed = $("chat-feed");
  const row = el("div", "user-row");

  if (event.undoable && Number.isInteger(event.index)) {
    const btn = el("button", "btn small undo-here", "↩");
    btn.type = "button";
    btn.title = "Откатить проект к состоянию до этого запроса";
    btn.onclick = () => openUndoModal(event.index);
    row.appendChild(btn);
  }

  row.appendChild(el("div", "bubble user",
    `${esc(event.text)}<span class="stamp">вы · ${now()}</span>`));

  const typing = feed.querySelector(".typing");
  if (typing) feed.insertBefore(row, typing); else feed.appendChild(row);
  scrollFeed();
  return row;
}

/** Финальный ответ агента: Markdown-вид с переключателем на исходник. */
function addAnswerBubble(text) {
  const node = addBubble("assistant answer",
    `<div class="answer-head"><span class="who">⚡ агент · ${now()}</span>` +
    `<button class="btn small answer-toggle" type="button"></button></div>` +
    `<div class="answer-body md"></div>`);
  const body = node.querySelector(".answer-body");
  const toggle = node.querySelector(".answer-toggle");
  let raw = false;

  const render = () => {
    if (raw) {
      body.className = "answer-body raw";
      body.textContent = text;
      toggle.textContent = "🎨 Markdown";
    } else {
      body.className = "answer-body md";
      body.innerHTML = renderMarkdown(text);
      toggle.textContent = "📝 Исходник";
    }
  };
  toggle.onclick = () => { raw = !raw; render(); };
  render();
  scrollFeed();
  return node;
}

function pushChatEvent(event) {
  const kind = event.kind || "raw";

  if (kind === "assistant") {
    if (!state.streamBubble) {
      state.streamBubble = addBubble("assistant",
        `<span class="who">⚡ агент · ${now()}</span><span class="body md"></span>`);
      state.streamRaw = "";
      state.streamBubbles.push(state.streamBubble);
    }
    state.streamRaw += event.text || "";
    renderStream();
    return;
  }
  flushStream();
  state.streamBubble = null;
  state.streamRaw = "";

  if (kind === "user") {
    addUserBubble(event);
    state.streamBubbles = [];
  } else if (kind === "assistant_final") {
    // Пока агент работал, ответ шёл в ленту сырым потоком. Финальный текст
    // содержит его целиком, поэтому потоковые пузыри убираем — иначе один и
    // тот же ответ показался бы дважды.
    if (event.replaces_stream) {
      state.streamBubbles.forEach((node) => node.remove());
      state.streamBubbles = [];
    }
    addAnswerBubble(event.text || "");
  } else if (kind === "system") {
    addBubble("system", `${esc(event.icon || "⚙")} ${esc(event.text)} <span class="stamp">${now()}</span>`);
  } else if (kind === "tool") {
    addToolBubble(event);
  } else if (kind === "tool_result") {
    const last = [...$("chat-feed").querySelectorAll(".bubble.tool")].pop();
    const text = `↪ ${event.text || "готово"} ${event.meta || ""}`.trim();
    const body = last && last.querySelector(".tool-body");
    if (body) {
      body.appendChild(el("div", "tool-result", esc(text)));
      const status = last.querySelector(".tool-status");
      if (status) status.textContent = firstLine(event.meta || event.text || "готово", 40);
      scrollFeed();
    } else {
      addBubble("tool", `<div class="tool-result">${esc(text)}</div>`);
    }
  } else if (kind === "result") {
    const body = event.text ? `<div class="body md">${renderMarkdown(event.text)}</div>` : "";
    const bubble = addBubble("result",
      `<span class="who">✅ ${esc(event.status)} · токенов ${esc(event.tokens)} · ${esc(event.duration)}</span>${body}`);
    const node = bubble.querySelector(".body");
    if (node) attachClamp(bubble, node);
  } else if (kind === "error") {
    addBubble("error", `❌ ${esc(event.text)}`);
  } else if (kind === "meta") {
    addBubble("meta", esc(event.text));
  } else if ((event.text || "").trim()) {
    addBubble("meta", esc(event.text));
  }
}

function applyToolVisibility() {
  document.querySelectorAll("#chat-feed .bubble.tool").forEach((node) => {
    node.classList.toggle("hidden", state.hideTools);
  });
}

/* Одна кнопка на всю ленту: если хоть что-то свёрнуто — разворачиваем всё,
   иначе сворачиваем обратно. */
function toggleAllBlocks() {
  const feed = $("chat-feed");
  const expand = !!(feed.querySelector(".bubble.tool.collapsed") || feed.querySelector(".bubble.clamped"));
  feed.querySelectorAll(".bubble.tool").forEach((node) => {
    node.classList.toggle("collapsed", !expand);
    const chev = node.querySelector(".chev");
    if (chev) chev.textContent = expand ? "▾" : "▸";
  });
  feed.querySelectorAll(".bubble > .clamp-toggle").forEach((btn) => {
    const bubble = btn.parentElement;
    bubble.classList.toggle("clamped", !expand);
    btn.textContent = expand ? "▴ Свернуть" : "▾ Показать целиком";
  });
  $("btn-chat-expand").textContent = expand ? "↕ Свернуть всё" : "↕ Развернуть всё";
}

/* ── Вложения чата: скриншоты и файлы ─────────────────────────────────────
 *
 * Файл уезжает на бэкенд сразу при выборе и ложится во временную папку игры
 * (.factory/uploads). В момент отправки задачи агенту уходят только имена —
 * бэкенд подставит в промпт относительные пути, по которым агент их прочитает.
 * Папка временная: всё старше недели фабрика убирает сама.
 */

function renderAttachments() {
  const bar = $("chat-attachments");
  bar.innerHTML = "";
  bar.classList.toggle("hidden", !state.attachments.length);
  if (!state.attachments.length) return;

  state.attachments.forEach((file) => {
    const chip = el("div", "attach-chip");
    if (file.is_image) {
      const img = el("img");
      img.src = `/api/uploads/${encodeURIComponent(state.project)}/file/${encodeURIComponent(file.name)}`;
      img.loading = "lazy";
      chip.appendChild(img);
    } else chip.appendChild(el("span", "attach-icon", "📄"));

    const info = el("div", "attach-info");
    info.appendChild(el("div", "attach-name", esc(file.original)));
    info.appendChild(el("div", "attach-meta", `${esc(file.size_label)} · ${esc(file.rel)}`));
    chip.appendChild(info);

    const drop = el("button", "attach-del", "✕");
    drop.title = "Убрать вложение и удалить файл из временной папки";
    drop.onclick = async () => {
      state.attachments = state.attachments.filter((f) => f.name !== file.name);
      renderAttachments();
      await api(`/api/uploads/${encodeURIComponent(state.project)}/file/${encodeURIComponent(file.name)}`,
        { method: "DELETE" });
    };
    chip.appendChild(drop);
    bar.appendChild(chip);
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

async function attachFiles(files) {
  const list = [...(files || [])];
  if (!list.length) return;
  if (!state.project) { toast("Вложение", "Сначала выберите проект.", "warn"); return; }

  for (const file of list) {
    try {
      const data = await readAsDataUrl(file);
      const res = await api(`/api/uploads/${encodeURIComponent(state.project)}`, {
        // Скриншот из буфера приходит без имени — бэкенд определит тип по сигнатуре.
        body: { name: file.name || "screenshot.png", data },
      });
      if (res.status !== "success") { toast("Вложение", res.message || "Не принято", "err"); continue; }
      state.attachments.push(res.file);
    } catch (err) {
      toast("Вложение", String(err && err.message || err), "err");
    }
  }
  renderAttachments();
}

/** Файлы уже уехали на диск — после отправки задачи чистим только композер. */
function clearAttachments() {
  state.attachments = [];
  renderAttachments();
}

async function sendChatTask() {
  const prompt = $("chat-input").value.trim();
  if (!prompt && !state.attachments.length) return;
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
      attachments: state.attachments.map((file) => file.name),
    },
  });
  if (res.status !== "started") {
    pushChatEvent({ kind: "error", text: res.message || "Не удалось запустить задачу." });
    return;
  }
  state.session = res.session.id;
  state.sessionRunning = true;
  $("chat-input").value = "";
  clearAttachments();
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
  // Откат живёт в самой ленте — кнопка ↩ у каждого запроса пользователя.
}

/* ── Панель активности сайдбара ───────────────────────────────────────── */

async function loadActivity() {
  const res = await api("/api/activity");
  state.activity = res.chats || [];
  state.servers = res.servers || [];
  renderActivity();
  renderServers();
  renderPlayBadge();
}

function agoText(seconds) {
  if (seconds === null || seconds === undefined) return "";
  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин назад`;
}

const ACT_ICONS = { running: "⏳", done: "✅", failed: "❌", stopped: "⏹" };

function renderActivity() {
  const box = $("sidebar-activity");
  box.innerHTML = "";

  if (!state.activity.length) {
    box.appendChild(el("div", "activity-empty",
      "Сейчас никто не работает. Поставьте задачу агенту во вкладке «💬 Чаты разработки»."));
  }

  state.activity.forEach((item) => {
    const node = el("div", `act-item ${item.running ? "running" : item.status}`);
    node.title = `${item.title}\n${item.slug}`;

    const title = el("div", "act-title");
    title.appendChild(el("span", "act-name",
      `${ACT_ICONS[item.status] || "•"} ${esc(item.title)}`));
    // Крестик убирает тему из панели. Сама беседа остаётся в чатах проекта —
    // уходит только строка активности.
    const close = el("button", "act-close", "✕");
    close.title = item.running
      ? "Тема в работе: сначала «⏹ Стоп»"
      : "Убрать тему из панели (чат останется)";
    close.onclick = (e) => { e.stopPropagation(); dismissActivity(item); };
    title.appendChild(close);
    node.appendChild(title);

    node.appendChild(el("div", "act-meta", esc(
      item.running
        ? `${item.slug} · ${item.stopping ? "останавливаю" : "идёт"} ${item.duration}`
        : `${item.slug} · ${item.duration} · ${agoText(item.finished_ago)}`)));

    const foot = el("div", "act-foot");
    if (item.running) {
      const stop = el("button", "act-mini danger", "⏹ Стоп");
      stop.onclick = async (e) => {
        e.stopPropagation();
        stop.disabled = true;
        const res = await api(`/api/chats/${encodeURIComponent(item.slug)}/${item.session_id}/stop`,
          { method: "POST" });
        if (res.message) toast("Чат", res.message, res.status === "error" ? "err" : "");
        loadActivity();
      };
      foot.appendChild(stop);
    }
    if (item.playable) {
      const play = el("button", "act-mini ok", "▶ Играть");
      play.onclick = (e) => { e.stopPropagation(); openPlay(item.slug); };
      foot.appendChild(play);
    }
    if (foot.children.length) node.appendChild(foot);

    node.onclick = () => {
      state.project = item.slug;
      localStorage.setItem("project", item.slug);
      fillChatProjects();
      openChat(item.session_id);
    };
    box.appendChild(node);
  });

  renderServerStrip();
}

/** Строка «сколько игр держит порты» под списком активности. */
function renderServerStrip() {
  const live = state.servers.filter((s) => s.running || s.starting);
  const strip = $("sidebar-servers");
  strip.classList.toggle("hidden", !live.length);
  if (live.length) {
    strip.textContent = `🎮 Запущено игр: ${live.length} · порты ${live.map((s) => s.port || "?").join(", ")}`;
    strip.onclick = () => showView("play");
  }
}

/** Убирает одну тему из панели активности (чат проекта при этом сохраняется). */
async function dismissActivity(item) {
  const res = await api(`/api/activity/${encodeURIComponent(item.session_id)}`, { method: "DELETE" });
  if (res.status === "error") { toast("Активность", res.message, "warn"); return; }
  state.activity = state.activity.filter((row) => row.session_id !== item.session_id);
  renderActivity();
  loadActivity();
}

async function clearActivity() {
  const res = await api("/api/activity/clear", { method: "POST" });
  toast("Активность", res.message || "", res.removed ? "ok" : "");
  loadActivity();
}

function startActivityTimer() {
  if (state.activityTimer) return;
  state.activityTimer = setInterval(loadActivity, 5000);
}

/* ── Откат запроса ────────────────────────────────────────────────────── */

/** `index` — номер запроса в переписке; без него откатывается последний. */
async function openUndoModal(index) {
  if (!state.project || !state.session) return;
  if (state.sessionRunning) {
    toast("Откат", "Сначала остановите агента — он прямо сейчас правит файлы проекта.", "warn");
    return;
  }
  const info = await api(`/api/chats/${encodeURIComponent(state.project)}/${state.session}/undo`
    + undoQuery(index));
  if (info.status !== "success") { toast("Откат", info.message || "Откатывать нечего", "warn"); return; }

  state.undoIndex = info.index;
  $("undo-prompt").textContent = info.prompt || "";
  const dropped = info.dropped_messages || 0;
  $("undo-note").textContent = dropped > 1
    ? `Из чата уйдёт этот запрос и всё, что было после него: сообщений — ${dropped}.`
    : "Из чата уйдёт этот запрос вместе с ответом на него.";
  const files = info.files || [];
  $("undo-files-title").textContent = files.length
    ? `Файлы, которые вернутся к прежнему состоянию: ${files.length}`
    : "Файлы проекта с тех пор не менялись";
  const box = $("undo-files");
  box.innerHTML = "";
  files.forEach((path) => box.appendChild(el("div", "undo-file", esc(path))));
  $("undo-modal").classList.remove("hidden");
}

function undoQuery(index) {
  return Number.isInteger(index) ? `?index=${index}` : "";
}

function closeUndoModal() {
  $("undo-modal").classList.add("hidden");
  state.undoIndex = null;
}

async function confirmUndo() {
  const btn = $("btn-confirm-undo");
  const index = state.undoIndex;
  btn.disabled = true;
  const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${state.session}/undo`
    + undoQuery(index), { method: "POST" });
  btn.disabled = false;
  closeUndoModal();

  if (res.status !== "success") { toast("Откат", res.message || "Не удалось", "err"); return; }
  toast("↩ Откат выполнен", res.message, "ok");
  await loadChats();
  await openChat(state.session);
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
  const projects = (state.projects || []).filter((p) => !p.archived || p.slug === state.playSlug);
  const current = select.value;
  select.innerHTML = "";
  projects.forEach((p) => select.appendChild(new Option(p.slug + (p.playable ? "" : "  (нет кода)"), p.slug)));
  const wanted = state.playSlug || current || state.project;
  if (wanted && projects.some((p) => p.slug === wanted)) select.value = wanted;
  state.playSlug = select.value || null;
}

/**
 * Открывает (или переиспользует) вкладку игры.
 *
 * Вкладку обязательно создаём синхронно, в том же клике: после `await`
 * блокировщик всплывающих окон уже не пропустит window.open.
 */
function openGameTab(slug) {
  const name = "game_" + String(slug).replace(/[^a-zA-Z0-9]/g, "_");
  const tab = window.open("", name);
  if (!tab) return null;
  try {
    if (!tab.location.href || tab.location.href === "about:blank") {
      tab.document.write(
        `<!doctype html><html lang="ru"><head><meta charset="utf-8">`
        + `<title>🎮 ${slug}</title><style>`
        + `body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;`
        + `justify-content:center;gap:10px;background:#0a0e17;color:#f0f4fc;`
        + `font-family:"Segoe UI",system-ui,sans-serif}`
        + `.s{color:#00f0ff;font-size:18px;font-weight:700}.d{color:#8ea3c0;font-size:13px}`
        + `</style></head><body><div class="s">🚀 Запускаю ${slug}…</div>`
        + `<div class="d">npm run dev поднимается — вкладка обновится сама.</div></body></html>`);
      tab.document.close();
    }
  } catch { /* вкладка уже с чужим origin — просто перейдём по URL */ }
  return tab;
}

/**
 * Адрес игры для запуска «с чистого листа».
 *
 * Сам сброс делает бэкенд (сносит кеш сборщика и поднимает сервер на новом
 * порту — а значит, с пустым localStorage). Здесь добавляем метку времени,
 * чтобы браузер не отдал страницу и ассеты из своего HTTP-кеша.
 */
function freshUrl(url) {
  if (!url) return url;
  const settings = (state.boot && state.boot.settings) || {};
  if (!settings.reset_game_on_launch) return url;
  return url + (url.includes("?") ? "&" : "?") + "factory_fresh=" + Date.now();
}

function navigateGameTab(tab, url) {
  const target = freshUrl(url);
  if (!tab || tab.closed) { window.open(target, "_blank", "noopener"); return; }
  try { tab.location.replace(target); } catch { tab.location = target; }
  try { tab.focus(); } catch { /* фокус не обязателен */ }
}

/** Ждущей вкладке проекта пришёл URL — переводим её на игру. */
function resolveGameTab(slug, url) {
  const pending = state.gameTabs[slug];
  if (!pending || !url) return;
  delete state.gameTabs[slug];
  if (pending.timer) clearTimeout(pending.timer);
  navigateGameTab(pending.tab, url);
}

function dropGameTab(slug, message) {
  const pending = state.gameTabs[slug];
  if (!pending) return;
  delete state.gameTabs[slug];
  if (pending.timer) clearTimeout(pending.timer);
  const tab = pending.tab;
  if (!tab || tab.closed) return;
  try { tab.document.body.innerHTML = `<div class="s">⚠️ ${esc(message)}</div>`; } catch { tab.close(); }
}

/** «Играть» из любого места: поднимает dev-сервер и открывает игру новой вкладкой. */
async function openPlay(slug) {
  if (!slug) return;
  const tab = openGameTab(slug);
  if (!tab) toast("Игра", "Браузер заблокировал новую вкладку — разрешите всплывающие окна для фабрики.", "warn");

  const st = await api(`/api/play/${encodeURIComponent(slug)}`);
  if (st.running && st.url) { navigateGameTab(tab, st.url); loadServers(); return; }

  state.gameTabs[slug] = {
    tab,
    timer: setTimeout(() => dropGameTab(slug,
      "Сервер не отдал URL за 2 минуты — посмотрите вкладку «Играть» в фабрике."), 120000),
  };

  const res = await api(`/api/play/${encodeURIComponent(slug)}/start`, { method: "POST" });
  if (res.status === "error") {
    dropGameTab(slug, res.message || "Не удалось запустить игру");
    toast("Запуск игры", res.message, "err");
    return;
  }
  if (res.url) resolveGameTab(slug, res.url);
  else toast("Запуск игры", `${slug}: поднимаю dev-сервер, вкладка откроется сама.`, "");
  loadServers();
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

function startPlay() {
  const slug = $("play-project").value;
  if (slug) openPlay(slug);
}

/**
 * Собрать игру (npm run build) и сразу скачать ZIP с готовой сборкой.
 * Запрос держится до конца сборки, поэтому ход виден в логе dev-сервера,
 * а кнопка блокируется, чтобы не запустить вторую сборку поверх первой.
 */
async function buildAndDownloadZip(slug, btn, waitLabel = "⏳ Сборка...") {
  if (!slug) { toast("Сборка", "Сначала выберите проект.", "warn"); return; }

  const label = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = waitLabel;
  }
  toast("Сборка", `${slug}: npm run build, это может занять пару минут...`);
  try {
    const res = await fetch(`/api/play/${encodeURIComponent(slug)}/build-zip`, { method: "POST" });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try { message = (await res.json()).detail || message; } catch (_e) { /* не JSON */ }
      toast("Сборка", message, "err");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = el("a");
    link.href = url;
    link.download = `${slug}-build.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast("Сборка", `Готово: ${slug}-build.zip (внутри папка ${slug}/)`, "ok");
  } catch (err) {
    toast("Сборка", String(err), "err");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

/* ── Менеджер запущенных игр ──────────────────────────────────────────── */

async function loadServers() {
  const res = await api("/api/play");
  state.servers = res.servers || [];
  renderServers();
  renderPlayBadge();
  renderServerStrip();
  return state.servers;
}

function renderPlayBadge() {
  const badge = $("nav-play-badge");
  const count = state.servers.filter((s) => s.running).length;
  badge.textContent = count ? String(count) : "";
  badge.classList.toggle("hidden", !count);
}

function renderServers() {
  const box = $("play-servers");
  box.innerHTML = "";
  $("servers-count").textContent = state.servers.length ? `занято портов: ${state.servers.length}` : "";
  if (!state.servers.length) {
    box.appendChild(el("div", "servers-empty",
      "Ни одна игра не запущена — порты свободны."));
    return;
  }
  state.servers.forEach((s) => {
    const row = el("div", "server-row");
    row.appendChild(el("div", "s-slug", esc(s.slug)));
    if (s.port) row.appendChild(el("div", "s-port", `:${s.port}`));
    row.appendChild(el("div", "s-url grow", esc(s.url || "URL ещё не известен")));
    row.appendChild(el("div", `s-state ${s.running ? "" : "starting"}`,
      s.running ? "● работает" : "● запускается"));

    const open = el("button", "btn small ok", "🖥 Открыть");
    open.onclick = () => openPlay(s.slug);
    const logs = el("button", "btn small", "📟 Лог");
    logs.onclick = () => { $("play-project").value = s.slug; loadPlayState(); };
    const stop = el("button", "btn small danger", "⏹ Стоп");
    stop.onclick = async () => {
      stop.disabled = true;
      await api(`/api/play/${encodeURIComponent(s.slug)}/stop`, { method: "POST" });
      await loadServers();
      if (s.slug === state.playSlug) loadPlayState();
    };
    row.append(open, logs, stop);
    box.appendChild(row);
  });
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
  $("set-reset-launch").checked = !!settings.reset_game_on_launch;

  const fish = settings.fish_audio || {};
  $("set-fish-key").value = fish.api_key || "";
  const fishModel = $("set-fish-model");
  fishModel.innerHTML = "";
  (fish.models || []).forEach((m) => fishModel.appendChild(new Option(m.label, m.key)));
  fishModel.value = fish.model || fish.free_model || "";

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
      reset_game_on_launch: $("set-reset-launch").checked,
      fish_audio: { api_key: $("set-fish-key").value.trim(), model: $("set-fish-model").value },
    },
  });
  $("settings-msg").textContent = res.message || "";
  setTimeout(() => { $("settings-msg").textContent = ""; }, 3000);
  state.boot.settings = await api("/api/settings");
  state.boot.tts = await api("/api/tts");
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
  source.onerror = () => {
    $("sidebar-status").classList.add("offline");
    $("sidebar-status").title = "Связь потеряна — переподключаюсь…";
  };
  source.onopen = () => {
    $("sidebar-status").classList.remove("offline");
    $("sidebar-status").title = "Фабрика на связи";
  };
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
    case "activity.changed":
      // Тему убрали из панели (возможно, в другой вкладке) — перечитываем список.
      loadActivity();
      break;
    case "chat.event":
      if (data.session_id === state.session) pushChatEvent(data.event);
      break;
    case "chat.undone":
      // Откат мог прийти из другой вкладки — перечитываем ленту чата.
      if (data.session_id === state.session) openChat(data.session_id);
      break;
    case "chat.started":
      if (data.session_id === state.session) { state.sessionRunning = true; updateChatButtons(); }
      loadActivity();
      break;
    case "chat.finished":
      if (data.session_id === state.session) {
        state.sessionRunning = false;
        showTyping(false);
        setChatStatus(`● ${data.text}`, data.status === "done" ? "var(--ok)" : "var(--warn)");
        updateChatButtons();
      }
      notifyChatDone(data);
      loadActivity();
      break;
    case "play.log":
      if (data.slug === state.playSlug) {
        const box = $("play-log");
        box.appendChild(document.createTextNode(data.line));
        box.scrollTop = box.scrollHeight;
      }
      break;
    case "play.url":
      resolveGameTab(data.slug, data.url);
      if (data.slug === state.playSlug) {
        $("play-url").value = data.url;
        setPlayStatus(true, false, data.url);
        toast("Игра запущена", data.url, "ok", [["Открыть", () => window.open(freshUrl(data.url), "_blank", "noopener")]]);
      }
      loadServers();
      break;
    case "play.state":
      if (data.url) resolveGameTab(data.slug, data.url);
      if (!data.running && !data.starting) {
        dropGameTab(data.slug, "Dev-сервер не работает — смотрите лог во вкладке «Играть».");
      }
      if (data.slug === state.playSlug) setPlayStatus(data.running, data.starting, data.url);
      loadServers();
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
  $("gallery-sort").value = state.gallerySort;
  $("gallery-sort").onchange = () => {
    state.gallerySort = $("gallery-sort").value;
    localStorage.setItem("gallerySort", state.gallerySort);
    loadGallery();
    loadProjects();
  };
  $("chk-archived").checked = state.showArchived;
  $("chk-archived").onchange = () => {
    state.showArchived = $("chk-archived").checked;
    localStorage.setItem("showArchived", state.showArchived ? "1" : "0");
    loadGallery();
  };
  $("chk-archived-list").checked = state.showArchivedList;
  $("chk-archived-list").onchange = () => {
    state.showArchivedList = $("chk-archived-list").checked;
    localStorage.setItem("showArchivedList", state.showArchivedList ? "1" : "0");
    loadProjects();
  };
  $("btn-archive-project").onclick = () => {
    const card = (state.projects || []).find((p) => p.slug === state.project);
    if (card) toggleArchive(card);
  };
  $("btn-delete-project").onclick = () => {
    const card = (state.projects || []).find((p) => p.slug === state.project);
    if (card) deleteProject(card);
  };
  $("btn-rename-project").onclick = () => {
    const card = (state.projects || []).find((p) => p.slug === state.project) || state.detail;
    if (card) renameProject(card);
    else toast("Переименование", "Сначала выберите проект.", "warn");
  };
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
  $("btn-project-build-zip").onclick = () =>
    buildAndDownloadZip(state.project, $("btn-project-build-zip"));
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
    // Вложения лежат в папке прежней игры — в новый проект они не переезжают.
    clearAttachments();
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

  // Вложения: кнопка, Ctrl+V со скриншотом и перетаскивание файлов в композер.
  $("btn-chat-attach").onclick = () => $("chat-file-input").click();
  $("chat-file-input").onchange = async (e) => {
    await attachFiles(e.target.files);
    e.target.value = "";
  };
  $("chat-input").addEventListener("paste", (e) => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (!files.length) return;   // обычный текст вставляем как обычно
    e.preventDefault();
    attachFiles(files);
  });
  const composer = $("chat-composer");
  ["dragenter", "dragover"].forEach((type) => composer.addEventListener(type, (e) => {
    e.preventDefault();
    composer.classList.add("drop-target");
  }));
  ["dragleave", "drop"].forEach((type) => composer.addEventListener(type, (e) => {
    e.preventDefault();
    composer.classList.remove("drop-target");
  }));
  composer.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) attachFiles(e.dataTransfer.files);
  });
  $("btn-chat-stop").onclick = async () => {
    if (!state.session) return;
    const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${state.session}/stop`, { method: "POST" });
    if (res.status === "error") toast("Стоп", res.message, "warn");
    else {
      // Сервер отвечает по-разному: обычная остановка или принудительное
      // освобождение чата по второму нажатию — сообщение стоит показать.
      toast("Стоп", res.message, "warn");
      setChatStatus("● Остановка...", "var(--err)");
    }
  };
  $("btn-close-undo").onclick = closeUndoModal;
  $("btn-confirm-undo").onclick = confirmUndo;
  $("undo-modal").onclick = (e) => { if (e.target === $("undo-modal")) closeUndoModal(); };
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
  $("chk-hide-tools").checked = state.hideTools;
  $("chk-hide-tools").onchange = () => {
    state.hideTools = $("chk-hide-tools").checked;
    localStorage.setItem("hideTools", state.hideTools ? "1" : "0");
    applyToolVisibility();
  };
  $("btn-chat-expand").onclick = toggleAllBlocks;

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
    if (url) window.open(freshUrl(url), "_blank", "noopener");
    else toast("Игра", "URL неизвестен — сначала запустите dev-сервер.", "warn");
  };
  $("btn-play-window").onclick = async () => {
    const res = await api(`/api/play/${encodeURIComponent($("play-project").value)}/window`,
      { body: { url: $("play-url").value.trim() } });
    if (res.status === "error") toast("Окно предпросмотра", res.message, "err");
  };
  $("btn-play-build").onclick = () => api(`/api/play/${encodeURIComponent($("play-project").value)}/build`, { method: "POST" });
  $("btn-play-build-zip").onclick = () =>
    buildAndDownloadZip($("play-project").value, $("btn-play-build-zip"));
  $("btn-play-stop").onclick = async () => {
    await api(`/api/play/${encodeURIComponent($("play-project").value)}/stop`, { method: "POST" });
    loadPlayState();
  };
  $("btn-play-clear").onclick = () => { $("play-log").textContent = ""; };

  $("btn-servers-refresh").onclick = loadServers;
  $("btn-servers-stop-all").onclick = async () => {
    const res = await api("/api/play/stop-all", { method: "POST" });
    toast("Менеджер игр", res.message, res.stopped ? "ok" : "");
    await loadServers();
    loadPlayState();
  };
}

function bindCommon() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => showView(btn.dataset.view);
  });
  $("btn-open-workspace-2").onclick = () => api("/api/open-workspace", { method: "POST" });
  $("btn-refresh-quota").onclick = loadQuota;
  $("btn-save-settings").onclick = saveSettings;
  $("btn-activity-clear").onclick = clearActivity;
  $("btn-fish-test").onclick = async () => {
    const btn = $("btn-fish-test");
    btn.disabled = true; btn.textContent = "⏳ Проверка...";
    // Ключ из поля может быть ещё не сохранён — сохраняем перед проверкой.
    await api("/api/settings", {
      body: { fish_audio: { api_key: $("set-fish-key").value.trim(), model: $("set-fish-model").value } },
    });
    const res = await api("/api/tts/test", { method: "POST" });
    btn.disabled = false; btn.textContent = "🔌 Проверить Fish Audio";
    $("fish-msg").style.color = res.status === "success" ? "var(--ok)" : "var(--err)";
    $("fish-msg").textContent = res.message || "";
    state.boot.tts = await api("/api/tts");
  };
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
  loadActivity();          // панель активности не ждёт медленной витрины проектов
  startActivityTimer();
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
