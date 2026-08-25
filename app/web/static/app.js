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
  // Сессия протухла (или сервер перезапустился со сменённым паролем): уводим
  // на форму входа с возвратом на текущую страницу. Без этого интерфейс
  // просто засыпало бы красными «HTTP 401» по всем панелям сразу.
  if (res.status === 401) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login?next=${next}`);
    return { status: "error", message: "Требуется вход." };
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { status: "error", message: text }; }
  if (!res.ok && !data.message) data.message = `HTTP ${res.status}`;
  return data;
}

// Квоты и Хранилище переехали во вкладки внутри «Настроек» — старые сохранённые
// значения раскладки поддерживаем как алиасы, чтобы не сломать закладку в localStorage.
const LEGACY_VIEW_TO_SETTINGS_TAB = { quota: "quota", storage: "storage" };

const state = {
  boot: null,
  view: (() => {
    const saved = localStorage.getItem("view") || "studio";
    return LEGACY_VIEW_TO_SETTINGS_TAB[saved] ? "settings" : saved;
  })(),
  settingsTab: LEGACY_VIEW_TO_SETTINGS_TAB[localStorage.getItem("view")] ||
    localStorage.getItem("settingsTab") || "config",
  project: localStorage.getItem("project") || null,
  session: null,
  sessionRunning: false,
  doc: "AI_DEVELOPER_PROMPT.md",
  docRaw: false,
  docContent: "",
  attachments: [],    // вложения, готовые уйти со следующим сообщением агенту
  studioAttachments: [],  // материалы заказа: они ждут в предбаннике до старта прогона
  ttsVoices: [],
  ttsVoice: localStorage.getItem("ttsVoice") || "",
  playSlug: null,
  demo: null,          // состояние демо-стенда базы знаний (не проект студии)
  gameTabs: {},        // slug → вкладка браузера, которая ждёт URL dev-сервера
  servers: [],
  activity: [],
  activityTimer: null,
  quotaTimer: null,
  timerHandle: null,
  elapsed: 0,
  jobs: [],            // карточки прогонов студии (идут параллельно)
  jobSel: null,        // чей журнал показан; null — общий журнал студии
  maxParallel: 10,
  globalPercent: 0,
  globalStep: "",
  streamBubble: null,
  streamRaw: "",   // потоковый текст текущего ответа для markdown-рендера
  streamBubbles: [],   // потоковые пузыри текущего ответа — их заменит финальная версия
  gallerySort: localStorage.getItem("gallerySort") || "new",
  showArchived: localStorage.getItem("showArchived") === "1",
  showArchivedList: localStorage.getItem("showArchivedList") === "1",
  hideTools: localStorage.getItem("hideTools") === "1",
  theme: localStorage.getItem("theme") || "dark",
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
  if (name === "favorites") loadProjects();
  if (name === "studio") loadGallery();
  if (name === "chats") { fillChatProjects(); loadChats(); }
  if (name === "play") { fillPlayProjects(); loadPlayState(); loadServers(); }
  if (name === "demo") loadDemoState();
  if (name === "settings") { renderSettings(); showSettingsTab(state.settingsTab || "config"); }
  else { stopQuotaTimer(); stopSystemTimer(); }
}

function showSettingsTab(name) {
  state.settingsTab = name;
  localStorage.setItem("settingsTab", name);
  document.querySelectorAll(".settings-tab-panel").forEach((p) =>
    p.classList.toggle("hidden", p.id !== `settings-panel-${name}`));
  document.querySelectorAll("#settings-tabs .tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.settingsTab === name));

  if (name === "quota") { loadQuota(); startQuotaTimer(); } else stopQuotaTimer();
  if (name === "storage") { loadStorage(); loadBuilds(); }
  if (name === "access") loadAccess();
  if (name === "terminals") loadTerminals();
  if (name === "system") { loadSystem(); startSystemTimer(); } else stopSystemTimer();
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
/*
 * Прогонов идёт сколько угодно сразу: каждая идея — своя карточка со своим
 * журналом, прогрессом, таймером и «Стоп». Полоса прогресса и журнал в шапке
 * показывают выбранную карточку; «Общий журнал» — то, что не привязано ни к
 * одному прогону (анализ концепта, брейнсторм, системные сообщения).
 */

const RUN_KIND_ICON = { spec: "📄", full: "🚀" };
const RUN_STATUS_TEXT = {
  queued: "в очереди",
  running: "идёт",
  done: "готово",
  failed: "ошибка",
  paused: "пауза",
  stopped: "остановлен",
};

function studioOpts(extra = {}) {
  return {
    prompt: $("studio-prompt").value.trim(),
    provider: $("sel-provider").value,
    renderer: $("sel-renderer").value,
    mode: $("sel-mode").value,
    image_provider: $("sel-image").value,
    // Имена файлов из предбанника: прогон скопирует их в проект на старте.
    attachments: state.studioAttachments.map((file) => file.name),
    ...extra,
  };
}

function jobById(id) {
  return state.jobs.find((job) => job.id === id) || null;
}

function selectedJob() {
  return state.jobSel ? jobById(state.jobSel) : null;
}

function fmtElapsed(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function jobElapsed(job) {
  // Живой таймер: снимок дал точку отсчёта, дальше считаем в браузере.
  if (!job.active) return job.elapsed || 0;
  const base = job._t0 || (job._t0 = Date.now() - (job.elapsed || 0) * 1000);
  return Math.floor((Date.now() - base) / 1000);
}

function upsertJob(job) {
  const index = state.jobs.findIndex((j) => j.id === job.id);
  if (index >= 0) {
    // Точку отсчёта таймера не сбрасываем — иначе он дёргался бы на каждом шаге.
    job._t0 = state.jobs[index]._t0;
    state.jobs[index] = job;
  } else {
    state.jobs.push(job);
  }
  if (!job.active) job._t0 = null;
  // Ничего не выбрано, а прогон пошёл — показываем его журнал сразу.
  if (!state.jobSel && job.active) { selectJob(job.id); return; }
  renderRuns();
  if (job.id === state.jobSel) syncStudioHead();
}

function setJobs(jobs) {
  state.jobs = jobs || [];
  if (state.jobSel && !jobById(state.jobSel)) state.jobSel = null;
  if (!state.jobSel) {
    const active = state.jobs.find((j) => j.active);
    if (active) state.jobSel = active.id;
  }
  renderRuns();
  syncStudioHead();
}

/* Журнал показывает выбранный прогон; переключение перечитывает его с сервера. */
async function selectJob(jobId, reload = true) {
  state.jobSel = jobId || null;
  renderRuns();
  syncStudioHead();
  const box = $("studio-log");
  if (!jobId) {
    const st = await api("/api/studio/state");
    box.textContent = st.logs || "";
    box.scrollTop = box.scrollHeight;
    return;
  }
  if (!reload) return;
  const res = await api(`/api/studio/jobs/${jobId}`);
  box.textContent = (res.job && res.job.logs) || "";
  box.scrollTop = box.scrollHeight;
}

function syncStudioHead() {
  const job = selectedJob();
  const icon = job ? (RUN_KIND_ICON[job.kind] || "🧵") : "⚡";
  $("studio-log-title").textContent = job
    ? `${icon} Журнал прогона: ${job.title}`
    : "⚡ Общий журнал студии";
  const percent = job ? job.percent : state.globalPercent;
  const step = job ? job.step : state.globalStep;
  $("studio-progress").style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
  $("studio-pct").textContent = `${percent || 0}%`;
  if (step) $("studio-step").textContent = step;
  $("studio-timer").textContent = `⏱️ ${fmtElapsed(job ? jobElapsed(job) : 0)}`;

  const active = state.jobs.filter((j) => j.active).length;
  const badge = $("studio-jobs-count");
  badge.textContent = active ? `🧵 ${active} в работе` : "";
  badge.classList.toggle("hidden", !active);
}

function renderRuns() {
  const strip = $("run-strip");
  const box = $("run-cards");
  strip.classList.toggle("hidden", state.jobs.length === 0);
  box.innerHTML = "";
  if (!state.jobs.length) return;

  const active = state.jobs.filter((j) => j.active).length;
  const queued = state.jobs.filter((j) => j.status === "queued").length;
  $("run-strip-hint").textContent = queued
    ? `${active} в работе, из них ${queued} ждут слота (лимит ${state.maxParallel})`
    : `${active} в работе (лимит ${state.maxParallel})`;

  // Свежие прогоны — слева: только что заказанное видно сразу.
  [...state.jobs].reverse().forEach((job) => {
    const card = el("div", `run-card ${job.status}${job.id === state.jobSel ? " sel" : ""}`);
    card.onclick = () => selectJob(job.id);

    const head = el("div", "run-title");
    head.appendChild(el("span", "", RUN_KIND_ICON[job.kind] || "🧵"));
    head.appendChild(el("span", "run-name", esc(job.title)));
    const act = el("button", "run-act", job.active ? "⏹" : "✕");
    act.title = job.active ? "Остановить прогон" : "Убрать карточку";
    act.onclick = async (event) => {
      event.stopPropagation();
      if (job.active) {
        await api(`/api/studio/jobs/${job.id}/stop`, { method: "POST" });
      } else {
        await api(`/api/studio/jobs/${job.id}/close`, { method: "POST" });
        if (state.jobSel === job.id) selectJob(null);
        await loadJobs();
      }
    };
    head.appendChild(act);
    card.appendChild(head);

    card.appendChild(el("div", "run-step", esc(job.step || RUN_STATUS_TEXT[job.status] || "")));

    const foot = el("div", "run-foot");
    const bar = el("div", "progress");
    const fill = el("div");
    fill.style.width = `${Math.max(0, Math.min(100, job.percent || 0))}%`;
    bar.appendChild(fill);
    foot.appendChild(bar);
    foot.appendChild(el("span", "run-pct", `${job.percent || 0}%`));
    const timer = el("span", "run-time", `⏱️ ${fmtElapsed(jobElapsed(job))}`);
    timer.dataset.job = job.id;
    foot.appendChild(timer);
    card.appendChild(foot);

    // Сорвавшийся прогон продолжают отсюда же. Раньше кнопка жила только в
    // чате проекта, а до чата надо было додуматься: карточка сообщала
    // «Ошибка генерации» и предлагала открыть ТЗ, которого ещё нет.
    if (!job.active && job.run_id && (job.status === "failed" || job.status === "paused")) {
      const again = el("button", "btn small primary", "▶ Продолжить");
      again.style.marginTop = "6px";
      again.title = "Пройденные шаги пропускаются — фабрика переспросит только упавший";
      again.onclick = async (event) => {
        event.stopPropagation();
        again.disabled = true;
        const res = await api(`/api/runs/${encodeURIComponent(job.run_id)}/continue`, { body: {} });
        if (res.status === "started") {
          toast("Прогон", "Продолжаю с упавшего шага", "ok");
          selectJob(res.job_id || null);
        } else {
          toast("Прогон", res.message || "Не удалось продолжить", "err");
          again.disabled = false;
        }
        await loadJobs();
      };
      card.appendChild(again);
    }
    if (job.slug && !job.active) {
      const open = el("button", "btn small", "📁 Открыть ТЗ");
      open.style.marginTop = "6px";
      open.onclick = (event) => { event.stopPropagation(); selectProject(job.slug); };
      card.appendChild(open);
    }
    box.appendChild(card);
  });
}

/* Один общий тикер на все карточки: перерисовывать их целиком раз в секунду
 * ни к чему — обновляем только цифры таймеров. */
function ensureRunTicker() {
  if (state.timerHandle) return;
  state.timerHandle = setInterval(() => {
    if (!state.jobs.some((j) => j.active)) return;
    document.querySelectorAll(".run-time[data-job]").forEach((node) => {
      const job = jobById(node.dataset.job);
      if (job) node.textContent = `⏱️ ${fmtElapsed(jobElapsed(job))}`;
    });
    const sel = selectedJob();
    if (sel) $("studio-timer").textContent = `⏱️ ${fmtElapsed(jobElapsed(sel))}`;
  }, 1000);
}

function appendStudioLog(text, jobId) {
  // Показываем только журнал выбранного прогона: остальные копятся на сервере.
  if ((jobId || null) !== (state.jobSel || null)) return;
  const box = $("studio-log");
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.appendChild(document.createTextNode(text));
  if ($("chk-studio-autoscroll").checked || atBottom) box.scrollTop = box.scrollHeight;
}

function setStudioProgress(percent, step) {
  // Прогресс без прогона — общий журнал студии.
  state.globalPercent = percent;
  state.globalStep = step;
  if (!state.jobSel) syncStudioHead();
}

function showLogPane(visible) {
  $("studio-log-pane").classList.toggle("hidden", !visible);
  $("studio-gallery-pane").classList.toggle("hidden", visible);
  $("btn-toggle-log").textContent = visible ? "🎮 Игры" : "📟 Журнал";
  if (!visible) loadGallery();
}

async function loadJobs() {
  const res = await api("/api/studio/jobs");
  state.maxParallel = res.max_parallel || state.maxParallel;
  setJobs(res.jobs);
}

async function loadStudioState() {
  const st = await api("/api/studio/state");
  state.globalPercent = st.percent || 0;
  state.globalStep = st.step || "";
  state.maxParallel = st.max_parallel || 10;
  setJobs(st.jobs || []);
  await selectJob(state.jobSel, true);
  ensureRunTicker();
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

function visibleProjects(showArchived, mode, query = "") {
  const all = state.projects || [];
  let list = showArchived ? all : all.filter((p) => !p.archived);
  if (query && typeof query === "string" && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((p) =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.slug && p.slug.toLowerCase().includes(q)) ||
      (p.genre && p.genre.toLowerCase().includes(q)) ||
      (p.renderer && p.renderer.toLowerCase().includes(q))
    );
  }
  return sortProjects(list, mode || state.gallerySort);
}

/* Оценка игры: пять звёзд, повторный клик по той же звезде снимает оценку. */
// Строка приёмки на карточке. Оценка «⭐ 8.6/10» ставится моделью до того, как
// написана первая строка кода, и об игре не говорит ничего. Эти числа получены
// запуском: сборка, кадры, вес, ошибки в консоли.
// Запуск приёмки из витрины. Долгая операция — уходит заданием студии, а
// результат прилетает обратно в карточку через projects.changed.
async function runGate(slug) {
  const answer = await api(`/api/projects/${encodeURIComponent(slug)}/gate`, { body: {} });
  if (answer && answer.status === "error") {
    toast("Приёмка", answer.message || "Запустить не удалось", "error");
    return;
  }
  toast("Приёмка пошла", "Сборка, запуск в браузере, проверки — смотрите журнал студии");
}

/* Обложка проекта в кадре 16:9 — она же и есть карточка: на ней лежат
 * название и пометка приёмки. Один конструктор на все списки: витрину,
 * избранное, список проектов и вкладку превью. Раньше каждый список строил
 * картинку сам, пропорции расходились, а под кадром висели три строки
 * подписей — в колонке шириной 268 пикселей они и съедали карточку. */
function coverBox(project, opts = {}) {
  const box = el("div", [
    "cover16",
    project.has_preview ? "" : "empty",
    opts.title ? "titled" : "",
    opts.gate ? `gate-${esc(project.gate_state || "none")}` : "",
  ].filter(Boolean).join(" "));
  if (project.has_preview) {
    const img = el("img");
    img.src = `/api/projects/${encodeURIComponent(project.slug)}/preview.png?v=${project.preview_mtime}`;
    img.loading = "lazy";
    img.alt = project.title || project.slug;
    box.appendChild(img);
  } else {
    box.appendChild(el("span", "", "🖼 превью ещё не создано"));
  }
  if (project.archived) box.appendChild(el("span", "archive-badge", "📦 архив"));
  if (project.packed) {
    // Игра лежит в zip. Это не ограничение, а состояние диска: любое действие
    // (чат, запуск, сборка) развернёт её само, поэтому кнопку тут не рисуем.
    const pill = el("span", "packed-badge", "🗜 сжата");
    pill.title = "Игра упакована в архив и освободила диск. "
      + "Развернётся сама при первом действии.";
    box.appendChild(pill);
  }
  if (opts.gate) {
    const pill = el("span", `gate-pill gate-${esc(project.gate_state || "none")}`, gateBadge(project));
    pill.title = "Состояние приёмки";
    box.appendChild(pill);
  }
  if (opts.title) {
    box.appendChild(el("div", "cover-title", `${opts.mark || ""}${esc(project.title)}`));
  }
  return box;
}

function gateBadge(p) {
  const m = p.gate_metrics || {};
  if (p.gate_state === "pass") {
    const parts = [];
    if (m.fps != null) parts.push(`${m.fps} FPS`);
    if (m.bundle_mb != null) parts.push(`${m.bundle_mb} МБ`);
    if (m.first_frame_ms != null) parts.push(`кадр ${m.first_frame_ms} мс`);
    return `✅ приёмка${parts.length ? " · " + parts.join(" · ") : ""}`;
  }
  if (p.gate_state === "fail") {
    const failed = (p.gate_failed || []).slice(0, 4).join(", ");
    return `❌ приёмка${failed ? ": " + failed : ""}`;
  }
  return "◌ приёмка не гонялась";
}

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

/* Избранное — полка для удачных игр. Каталог на диске не двигается: на слаг
   завязаны чаты, состояние прогона и учёт токенов (см. app/project_meta). */
async function toggleFavorite(project) {
  const res = await api(`/api/projects/${encodeURIComponent(project.slug)}/favorite`,
    { body: { favorite: !project.favorite } });
  if (res.status === "error") { toast("Избранное", res.message, "err"); return; }
  project.favorite = res.favorite;
  if (res.favorite) project.archived = false;
  toast("Избранное", res.message, "ok");
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
    `Удалить игру «${project.title}» безвозвратно?\n\n` +
    `Будут стёрты код, спецификация и чаты (${project.slug}).\n` +
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
  renderFavorites();
  if (state.project && state.detail) renderProjectBanner();
}

/* ── Избранное ────────────────────────────────────────────────────────── */

function renderFavorites() {
  const box = $("favorites-list");
  if (!box) return;
  const shown = (state.projects || []).filter((p) => p.favorite);

  const badge = $("nav-fav-badge");
  if (badge) {
    badge.textContent = shown.length ? String(shown.length) : "";
    badge.classList.toggle("hidden", !shown.length);
  }

  box.className = "card-grid";
  box.innerHTML = "";
  if (!shown.length) {
    box.className = "";
    box.appendChild(el("p", "muted",
      "Пока пусто. Откройте удачную игру в «Проекты и ТЗ» и нажмите «⭐ В избранное»."));
    return;
  }
  shown.forEach((p) => {
    const card = el("div", "game-card");
    card.appendChild(coverBox(p, { title: true, gate: true, mark: "⭐ " }));

    const body = el("div", "body");
    body.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${esc(p.renderer)} · ${p.playable ? "💻 код" : "📄 только ТЗ"}`
      + (p.tokens ? ` · 🎟 ${esc(p.tokens_human)}` : "")));
    const rating = el("div", "card-rating");
    rating.appendChild(starWidget(p, "tiny"));
    rating.appendChild(el("span", "dim", p.created_label ? esc(p.created_label) : ""));
    body.appendChild(rating);
    card.appendChild(body);

    const actions = el("div", "card-actions");
    const play = el("button", "btn small ok grow-btn", "▶ Запустить");
    play.onclick = (e) => { e.stopPropagation(); openPlay(p.slug); };
    const open = el("button", "btn small", "📁 Открыть");
    open.onclick = (e) => { e.stopPropagation(); showView("projects"); selectProject(p.slug); };
    const off = el("button", "btn small icon-only", "☆");
    off.title = "Убрать из избранного";
    off.onclick = (e) => { e.stopPropagation(); toggleFavorite(p); };
    actions.append(play, open, off);
    card.appendChild(actions);

    card.onclick = () => { showView("projects"); selectProject(p.slug); };
    box.appendChild(card);
  });
}

async function loadGallery() {
  const res = await fetchProjectsList();
  const projects = Array.isArray(res.projects) ? res.projects : null;
  if (!projects) {
    toast("Проекты", res.message || "Не удалось обновить список игр", "error");
    return;
  }
  state.projects = projects;
  const box = $("gallery");
  box.innerHTML = "";
  const query = $("gallery-search") ? $("gallery-search").value : "";
  const shown = visibleProjects(state.showArchived, null, query);
  const archivedCount = projects.filter((p) => p.archived).length;
  $("gallery-count").textContent = projects.length
    ? `· ${shown.length} из ${projects.length}${archivedCount ? ` · 📦 ${archivedCount}` : ""}`
    : "";
  if (!shown.length) {
    box.appendChild(el("div", "muted", projects.length
      ? (query ? `Ничего не найдено по запросу «${esc(query)}».` : "Все игры убраны в архив. Включите галочку «📦 Архив», чтобы увидеть их.")
      : "Пока ни одной игры. Опишите идею выше и нажмите «🚀 СОЗДАТЬ ИГРУ ПОД КЛЮЧ» — готовые проекты появятся здесь обложками."));
    return;
  }
  shown.forEach((p) => {
    const card = el("div", `game-card ${p.archived ? "archived" : ""}`);
    card.appendChild(coverBox(p, { title: true, gate: true, mark: "🎮 " }));

    const body = el("div", "body");
    body.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${esc(p.renderer)} · ${p.playable ? "💻 код готов" : "📄 только ТЗ"}`
      + (p.tokens ? ` · 🎟 ${esc(p.tokens_human)}` : "")));
    const line = el("div", "card-rating");
    line.appendChild(starWidget(p, "tiny"));
    line.appendChild(el("span", "dim", p.created_label ? esc(p.created_label) : ""));
    body.appendChild(line);
    card.appendChild(body);

    const actions = el("div", "card-actions");
    const play = el("button", `btn small grow-btn ${p.playable ? "ok" : ""}`, p.playable ? "▶ Играть" : "▶ Нет кода");
    play.disabled = !p.playable;
    play.onclick = (e) => { e.stopPropagation(); openPlay(p.slug); };
    const open = el("button", "btn small icon-only", "📄");
    open.title = "Открыть ТЗ проекта";
    open.onclick = (e) => { e.stopPropagation(); selectProject(p.slug); };
    const gate = el("button", "btn small icon-only", "🧪");
    gate.title = "Прогнать приёмку: собрать, открыть в браузере, проверить";
    gate.disabled = !p.playable;
    gate.onclick = (e) => { e.stopPropagation(); runGate(p.slug); };
    const rename = el("button", "btn small icon-only", "✏️");
    rename.title = "Переименовать игру";
    rename.onclick = (e) => { e.stopPropagation(); renameProject(p); };
    const archive = el("button", "btn small icon-only", p.archived ? "↩️" : "📦");
    archive.title = p.archived ? "Вернуть из архива" : "Убрать в архив (игра останется на диске)";
    archive.onclick = (e) => { e.stopPropagation(); toggleArchive(p); };
    const remove = el("button", "btn small danger icon-only", "🗑");
    remove.title = "Удалить игру безвозвратно";
    remove.onclick = (e) => { e.stopPropagation(); deleteProject(p); };
    actions.append(play, open, gate, rename, archive, remove);
    card.appendChild(actions);

    card.onclick = () => selectProject(p.slug);
    box.appendChild(card);
  });
}

/* ── Проекты ──────────────────────────────────────────────────────────── */

// loadProjects() и loadGallery() почти всегда запускаются вместе (например
// при старте), и оба ходят за одним и тем же списком. Без разделения это
// два параллельных запроса к /api/projects вместо одного.
let _projectsInFlight = null;
function fetchProjectsList() {
  if (!_projectsInFlight) {
    _projectsInFlight = api("/api/projects").finally(() => { _projectsInFlight = null; });
  }
  return _projectsInFlight;
}

async function loadProjects() {
  const res = await fetchProjectsList();
  const projects = Array.isArray(res.projects) ? res.projects : null;
  if (!projects) {
    // Запрос не удался (сервер ещё поднимается, оборвалось соединение) —
    // список остаётся как был, лучше показать старые карточки, чем стереть
    // всё и упасть на projects.length от undefined.
    toast("Проекты", res.message || "Не удалось обновить список проектов", "error");
    return;
  }
  state.projects = projects;
  const box = $("projects-list");
  box.innerHTML = "";
  const query = $("project-search") ? $("project-search").value : "";
  const shown = visibleProjects(state.showArchivedList, null, query);
  if (!shown.length) {
    box.appendChild(el("div", "muted", projects.length
      ? (query ? `Ничего не найдено по запросу «${esc(query)}».` : "Все проекты в архиве — включите «📦 Архив».")
      : "Нет проектов в workspace/"));
  }
  shown.forEach((p) => {
    const item = el("div", `list-item ${p.slug === state.project ? "active" : ""} ${p.archived ? "archived" : ""}`);
    item.appendChild(coverBox(p, { gate: true }));

    const info = el("div", "info");
    info.appendChild(el("div", "name",
      `${p.archived ? "📦 " : (p.favorite ? "⭐ " : "🎮 ")}${esc(p.title)}`));
    info.appendChild(el("div", "meta",
      `${esc(p.genre)} · ${p.playable ? "💻 код" : "📄 только ТЗ"}`
      + (p.tokens ? ` · 🎟 ${esc(p.tokens_human)}` : "")));
    const line = el("div", "card-rating");
    line.appendChild(starWidget(p, "tiny"));
    line.appendChild(el("span", "dim", p.created_label ? esc(p.created_label) : ""));
    info.appendChild(line);
    item.appendChild(info);
    item.onclick = () => selectProject(p.slug);
    box.appendChild(item);
  });
  fillPlayProjects();
  fillChatProjects();
  renderFavorites();
}

function renderProjectBanner() {
  const detail = state.detail;
  if (!detail) return;
  const card = (state.projects || []).find((p) => p.slug === detail.slug) || detail;
  const mark = card.archived ? "📦 " : (card.favorite ? "⭐ " : "🎮 ");
  $("project-title").textContent = `${mark}${detail.title}`;
  $("project-meta").textContent =
    `Slug: ${detail.slug}  |  Жанр: ${detail.genre}  |  Рендерер: ${detail.renderer}  |  Оценка ИИ: ⭐ ${detail.score}/10`
    + (detail.created_label ? `  |  Создана: ${detail.created_label}` : "")
    + (card.archived ? "  |  📦 в архиве" : "")
    + (card.favorite ? "  |  ⭐ в избранном" : "");
  const stars = $("project-stars");
  stars.innerHTML = "";
  stars.appendChild(starWidget(card));
  $("btn-archive-project").textContent = card.archived ? "↩️ Из архива" : "📦 В архив";
  $("btn-favorite-project").textContent = card.favorite ? "☆ Из избранного" : "⭐ В избранное";
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
  // Список ждём: без него свежесозданный проект прогона не попадёт в
  // выпадающие списки, и следующий переход на вкладку чатов его не найдёт.
  await loadProjects();
  loadChats();
  openDoc(state.doc);
}

function docTabButtons() {
  const box = $("doc-tabs");
  box.innerHTML = "";
  const tabs = [
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
    pane.appendChild(coverBox({
      slug: state.project,
      has_preview: true,
      preview_mtime: detail.preview_mtime,
      title: detail.title,
    }));
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

/* Игру выбирают по названию, а не по имени папки: игрок мог переименовать её,
   и в списках должно стоять именно его имя. Слуг остаётся техническим ключом
   (каталог, ссылки в чатах), поэтому прячем его в подсказку. */
function projectName(slug) {
  const p = (state.projects || []).find((x) => x.slug === slug);
  // Последняя запаска обязательна: без неё вкладка предпросмотра, открытая
  // раньше, чем подгрузился список проектов, называлась «undefined» — и это
  // же слово уезжало в адрес окна.
  return (p && p.title) || slug || "Игра";
}

function fillChatProjects() {
  /* Выбранный проект НИКОГДА не подменяется содержимым выпадающего списка.
     Раньше подменялся: проект прогона заводится в начале прогона, а
     state.projects перечитывается позже, и на этом промежутке выбранного слага
     в списке ещё нет. Список молча переключался на соседнюю игру, а запрос за
     чатом уходил в неё — отсюда и бралось «Чат не найден» при открытии чата
     только что начатого прогона. */
  const select = $("chat-project");
  const projects = activeProjects();
  select.innerHTML = "";
  projects.forEach((p) => select.appendChild(new Option(p.title || p.slug, p.slug)));
  if (!state.project) {
    if (projects.length) { state.project = select.value; localStorage.setItem("project", state.project); }
    return;
  }
  if (!projects.some((p) => p.slug === state.project)) {
    // Проект есть, а в списке его ещё нет — добавляем строкой, а не теряем выбор.
    select.appendChild(new Option(projectName(state.project), state.project));
  }
  select.value = state.project;
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
      const mark = s.kind === "run" ? "🏭 " : "";
      const open = el("button", "chat-open",
        `<strong>${mark}${esc(s.title)}</strong><br /><span class="dim">${s.resumable ? "🔗" : "•"} ${esc(when)} · ${esc(info)}${s.model ? " · " + esc(s.model) : ""}</span>`);
      open.onclick = () => openChat(s.id);
      const del = el("button", "chat-del", "🗑");
      del.onclick = async (e) => {
        e.stopPropagation();
        const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${s.id}`, { method: "DELETE" });
        if (res.status === "error") toast("Чат", res.message, "err");
        if (state.session === s.id) {
          state.session = null;
          $("chat-feed").innerHTML = "";
          renderRunBar(null);
        }
        loadChats();
      };
      row.append(open, del);
      box.appendChild(row);
    });
  });
  updateChatButtons();
}

async function refreshRunBar() {
  /* Прогон продолжается в фоне: полосу обновляем по событию шины, не
     перерисовывая ленту — иначе чат прыгает под руками. */
  if (!state.project || !state.session) return;
  const res = await api(`/api/chats/${encodeURIComponent(state.project)}/${state.session}`);
  if (res.status === "success") renderRunBar(res.run);
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
  renderRunBar(res.run);
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

/* ── Материалы заказа: те же вложения, но у прогона ещё нет проекта ───────
 *
 * Файл уезжает в предбанник песочницы сразу при выборе, а прогон копирует его
 * в каталог игры первым же делом — до первого вызова модели. Поэтому в заказ
 * можно положить готовый промпт игры, референсы или 3D-модели: агенты
 * спецификации получат текст врезкой, кодовый агент — пути внутри проекта.
 */

function renderStudioAttachments() {
  const bar = $("studio-attachments");
  bar.innerHTML = "";
  bar.classList.toggle("hidden", !state.studioAttachments.length);
  $("studio-attach-hint").textContent = state.studioAttachments.length
    ? `Поедут в проект вместе с заказом: ${state.studioAttachments.length}`
    : "Промпт игры, референсы, 3D-модели — агент получит их вместе с ТЗ";
  if (!state.studioAttachments.length) return;

  state.studioAttachments.forEach((file) => {
    const chip = el("div", "attach-chip");
    if (file.is_image) {
      const img = el("img");
      img.src = `/api/studio/uploads/file/${encodeURIComponent(file.name)}`;
      img.loading = "lazy";
      chip.appendChild(img);
    } else chip.appendChild(el("span", "attach-icon", "📄"));

    const info = el("div", "attach-info");
    info.appendChild(el("div", "attach-name", esc(file.original)));
    info.appendChild(el("div", "attach-meta", `${esc(file.size_label)} · в заказ`));
    chip.appendChild(info);

    const drop = el("button", "attach-del", "✕");
    drop.title = "Убрать материал из заказа и удалить файл";
    drop.onclick = async () => {
      state.studioAttachments = state.studioAttachments.filter((f) => f.name !== file.name);
      renderStudioAttachments();
      await api(`/api/studio/uploads/file/${encodeURIComponent(file.name)}`, { method: "DELETE" });
    };
    chip.appendChild(drop);
    bar.appendChild(chip);
  });
}

/** Предбанник переживает перезагрузку страницы: показываем, что в нём осталось. */
async function loadStudioAttachments() {
  const res = await api("/api/studio/uploads");
  state.studioAttachments = res.files || [];
  renderStudioAttachments();
}

async function attachStudioFiles(files) {
  const list = [...(files || [])];
  if (!list.length) return;
  for (const file of list) {
    try {
      const data = await readAsDataUrl(file);
      const res = await api("/api/studio/uploads", {
        body: { name: file.name || "screenshot.png", data },
      });
      if (res.status !== "success") { toast("Материалы заказа", res.message || "Не принято", "err"); continue; }
      state.studioAttachments.push(res.file);
    } catch (err) {
      toast("Материалы заказа", String(err && err.message || err), "err");
    }
  }
  renderStudioAttachments();
}

/** Прогон уже забрал копию — очищаем только полосу, файлы остаются в предбаннике
 *  до истечения срока или до кнопки «✕». */
function clearStudioAttachments() {
  state.studioAttachments = [];
  renderStudioAttachments();
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
    node.title = `${item.title}\n${projectName(item.slug)} (${item.slug})`;

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
        ? `${projectName(item.slug)} · ${item.stopping ? "останавливаю" : "идёт"} ${item.duration}`
        : `${projectName(item.slug)} · ${item.duration} · ${agoText(item.finished_ago)}`)));

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
  projects.forEach((p) => select.appendChild(
    new Option((p.title || p.slug) + (p.playable ? "" : "  (нет кода)"), p.slug)));
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
        + `<title>🎮 ${projectName(slug)}</title><style>`
        + `body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;`
        + `justify-content:center;gap:10px;background:#0a0e17;color:#f0f4fc;`
        + `font-family:"Segoe UI",system-ui,sans-serif}`
        + `.s{color:#00f0ff;font-size:18px;font-weight:700}.d{color:#8ea3c0;font-size:13px}`
        + `</style></head><body><div class="s">🚀 Запускаю ${projectName(slug)}…</div>`
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

/**
 * Игра всегда открывается через обёртку фабрики `/play`: сверху остаётся
 * полоска с пресетами размера вьюпорта, сама игра живёт в iframe под ней.
 */
function viewerUrl(url, slug) {
  if (!url) return url;
  // name — то, как игру назвал игрок: заголовок вкладки должен совпадать со
  // списком проектов, а slug остаётся для служебных нужд обёртки.
  return `/play?url=${encodeURIComponent(freshUrl(url))}&slug=${encodeURIComponent(slug || "")}`
    + `&name=${encodeURIComponent(projectName(slug))}`;
}

function navigateGameTab(tab, url, slug) {
  const target = viewerUrl(url, slug);
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
  navigateGameTab(pending.tab, url, slug);
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
  else toast("Запуск игры", `${projectName(slug)}: поднимаю dev-сервер, вкладка откроется сама.`, "");
  loadServers();
}

/* ── Демо-стенд базы знаний ───────────────────────────────────────────────
 *
 * Стенд поднимается тем же dev-сервером, что и игры, но проектом не является:
 * в витрине его карточку путали с выпущенной игрой, поэтому у него своя кнопка
 * в навигации и свой экран, а из списка проектов он исключён на бэкенде.
 */

const DEMO_SLUG = "knowledge-showcase";

function setDemoStatus(running, starting, url) {
  const node = $("demo-status");
  if (starting) { node.textContent = "● Запуск стенда..."; node.style.color = "var(--warn)"; }
  else if (running) { node.textContent = `● Стенд работает${url ? " · " + url : ""}`; node.style.color = "var(--ok)"; }
  else { node.textContent = "● Сервер остановлен"; node.style.color = "var(--muted)"; }
  $("nav-demo-badge").classList.toggle("hidden", !running && !starting);
}

function renderDemoPages(state_) {
  const box = $("demo-pages");
  box.innerHTML = "";
  if (!state_.running || !state_.url) return;
  box.appendChild(el("span", "dim", "Страницы стенда:"));
  (state_.pages || []).forEach((page) => {
    const btn = el("button", "btn small", page.label);
    btn.onclick = () => window.open(new URL(page.path, state_.url).href, "_blank", "noopener");
    box.appendChild(btn);
  });
}

async function loadDemoState() {
  const st = await api("/api/demo");
  state.demo = st;
  $("demo-log").textContent = st.logs || "";
  $("demo-log").scrollTop = $("demo-log").scrollHeight;
  $("demo-path").textContent = st.exists
    ? `📂 ${st.path}${st.installed ? "" : " · зависимости не установлены — первый запуск поставит npm install"}`
    : `⚠️ Стенда нет на диске: ${st.path}`;
  $("btn-demo-start").disabled = !st.exists;
  setDemoStatus(st.running, st.starting, st.url);
  renderDemoPages(st);
}

async function startDemo() {
  setDemoStatus(false, true, "");
  const res = await api("/api/demo/start", { method: "POST" });
  if (res.status === "error") {
    toast("Демо-стенд", res.message || "Не удалось запустить стенд", "err");
    loadDemoState();
    return;
  }
  if (res.url) window.open(res.url, "_blank", "noopener");
  else toast("Демо-стенд", "Поднимаю dev-сервер — адрес появится здесь и в логе.");
  loadDemoState();
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
  toast("Сборка", `${projectName(slug)}: npm run build, это может занять пару минут...`);
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
    const name = el("div", "s-slug", esc(projectName(s.slug)));
    name.title = s.slug;
    row.appendChild(name);
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
  if (percent === null || percent === undefined) return "var(--text-dim)";
  if (percent <= 10) return "var(--err)";
  if (percent <= 30) return "var(--warn)";
  return "var(--ok)";
}

function quotaCard(card) {
  const node = el("div", "quota-card");
  const head = el("div", "row spread");
  head.appendChild(el("h3", "", esc(card.title)));
  if (card.badge) {
    const badge = el("span", `quota-badge ${card.state || "local"}`, esc(card.badge));
    head.appendChild(badge);
  }
  node.appendChild(head);
  node.appendChild(el("div", "sub", esc(card.subtitle || "")));
  if (card.spent) node.appendChild(el("div", "quota-spent", `🎟 ${esc(card.spent)}`));
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
  // У OpenCode остаток доступен только в личном кабинете: вместо кнопки
  // «/usage», которой у него нет, даём прямую ссылку туда.
  if (card.console_url) {
    const link = el("a", "btn small", "🌐 Открыть личный кабинет и посмотреть лимиты");
    link.href = card.console_url;
    link.target = "_blank";
    link.rel = "noopener";
    link.style.marginTop = "10px";
    link.style.display = "inline-block";
    node.appendChild(link);
  }
  if (!card.live && card.supports_usage_command !== false
      && card.key && card.key !== "gemini" && card.key !== "claude_family"
      && !card.console_url) {
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

/* ── Прогон фабрики внутри чата разработки ───────────────────────────── */

/* Отдельного окна «Прогоны» нет: прогон — это обычный чат проекта, и
   продолжают его оттуда же, где видно, что фабрика спрашивала у модели. */
function renderRunBar(run) {
  const bar = $("chat-run-bar");
  const status = $("chat-run-status");
  const btn = $("btn-continue-run");
  if (!run || !run.run_id) { bar.classList.add("hidden"); return; }

  bar.classList.remove("hidden");
  const steps = `шагов пройдено: ${run.done}`;
  if (run.finished) {
    status.textContent = `🏭 Прогон завершён · ${steps} · пакет спецификаций собран`;
    status.style.color = "var(--ok)";
  } else if (run.failed && run.failed.length) {
    status.textContent = `⏸ Прогон приостановлен на шаге «${run.failed[0]}» · ${steps}`;
    status.style.color = "var(--warn)";
  } else {
    status.textContent = `🏭 Прогон фабрики · ${steps}`;
    status.style.color = "var(--text-muted)";
  }

  btn.classList.toggle("hidden", !run.can_continue);
  btn.disabled = !!run.running;
  btn.onclick = async () => {
    btn.disabled = true;
    const res = await api(`/api/runs/${encodeURIComponent(run.run_id)}/continue`, { body: {} });
    if (res.status === "started") {
      toast("Прогон", "Продолжаю со следующего шага — ход виден в этом чате", "ok");
    } else {
      toast("Прогон", res.message || "Не удалось продолжить", "err");
      btn.disabled = false;
    }
  };
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

  renderUsage(data.usage);
}

/* ── Хранилище: архивы игр и общий стор node-пакетов ──────────────────── */

function mb(bytes) {
  const value = (bytes || 0) / 1048576;
  return value >= 1024 ? `${(value / 1024).toFixed(2)} ГБ` : `${value.toFixed(1)} МБ`;
}

function appendStorageLog(line) {
  const box = $("storage-log");
  if (!box) return;
  box.textContent += line;
  box.scrollTop = box.scrollHeight;
}

async function loadStorage() {
  const data = await api("/api/storage");
  const a = data.archives || {};
  const p = data.packages || {};

  $("storage-archives").textContent =
    `Упаковано игр: ${a.archived || 0} · архивы занимают ${mb(a.archive_bytes)} · ` +
    `порог упаковки — ${a.max_age_days} дн. без обращения`;

  const stale = (data.stale || []).length;
  $("storage-stale").textContent = stale ? `залежалось: ${stale}` : "залежавшихся нет";

  $("storage-packages").textContent = p.ready
    ? `Стор: ${p.store_dir} — ${mb(p.store_bytes)} · кеш загрузок ${mb(p.cache_bytes)}`
    : "Стор ещё не готов: pnpm устанавливается при первой сборке или запуске игры.";

  const list = $("storage-list");
  list.innerHTML = "";
  const slugs = data.archived_slugs || [];
  if (!slugs.length) {
    list.appendChild(el("p", "dim", "Пока ни одна игра не упакована."));
  }
  slugs.forEach((slug) => {
    const row = el("div", "storage-row");
    row.appendChild(el("span", "storage-slug", esc(slug)));
    const btn = el("button", "btn small", "📂 Распаковать");
    btn.onclick = async () => {
      btn.disabled = true;
      const res = await api(`/api/projects/${encodeURIComponent(slug)}/unpack`, { body: {} });
      toast("Хранилище", res.message || "Готово", res.status === "error" ? "err" : "ok");
      loadStorage();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });

  renderSnapshotStorage(data.snapshots || {});

  $("storage-log").textContent = data.logs || "";
  $("storage-log").scrollTop = $("storage-log").scrollHeight;
}

function renderSnapshotStorage(s) {
  const limit = s.limit_bytes
    ? `потолок ${mb(s.limit_bytes)}` : "потолок снят (SNAPSHOT_LIMIT_MB=0)";
  const line = $("storage-snapshots");
  line.textContent =
    `История снимков: ${mb(s.total_bytes)} у ${s.count || 0} игр · ${limit}` +
    (s.over_limit ? " · потолок превышен, ближайшая уборка ужмёт и почистит" : "");
  line.classList.toggle("warn", !!s.over_limit);

  // Показываем только заметных едоков: список из тридцати строк по мегабайту
  // ничего не объясняет, а место, которое стоит вернуть, видно сразу.
  const box = $("storage-snapshot-list");
  box.innerHTML = "";
  (s.projects || []).filter((p) => p.bytes >= 5 * 1048576).slice(0, 10).forEach((p) => {
    const row = el("div", "storage-row");
    row.appendChild(el("span", "storage-slug", esc(p.slug)));
    row.appendChild(el("span", "dim small", mb(p.bytes)));
    box.appendChild(row);
  });
}

function bindStorage() {
  $("btn-refresh-storage").onclick = loadStorage;

  $("btn-storage-sweep").onclick = async (e) => {
    e.target.disabled = true;
    const res = await api("/api/storage/sweep", { body: {} });
    e.target.disabled = false;
    toast("Хранилище", res.message || "Готово", "ok");
    loadStorage();
  };

  $("btn-storage-snapshots").onclick = async (e) => {
    e.target.disabled = true;
    const res = await api("/api/storage/snapshots/clean", { body: {} });
    e.target.disabled = false;
    toast("История отката", res.message || "Готово", "ok");
    loadStorage();
  };

  $("btn-storage-prune").onclick = async (e) => {
    e.target.disabled = true;
    const res = await api("/api/storage/prune", { body: {} });
    e.target.disabled = false;
    toast("Стор пакетов", res.message || "Готово", res.status === "error" ? "err" : "ok");
    loadStorage();
  };
}

/* ── Расход токенов: фабрика целиком и каждый проект ──────────────────── */

function usageTile(label, value, note) {
  const tile = el("div", "usage-tile");
  tile.appendChild(el("div", "u-label", esc(label)));
  tile.appendChild(el("div", "u-value", esc(value)));
  if (note) tile.appendChild(el("div", "u-note", esc(note)));
  return tile;
}

function renderUsage(usage) {
  if (!usage) return;
  const { overall, projects } = usage;

  $("usage-since").textContent =
    `учёт с ${overall.since} · обновлено ${overall.updated_at}`;

  const tiles = $("usage-tiles");
  tiles.innerHTML = "";
  tiles.append(
    usageTile("Всего токенов", overall.tokens_human, `${overall.runs} запусков агентов`),
    usageTile("Сегодня", overall.tokens_today_human, "с полуночи"),
    usageTile("За 5 часов", overall.tokens_5h_human, "текущее окно лимита"),
    usageTile("За неделю", overall.tokens_weekly_human, "скользящие 7 суток"),
    usageTile("В среднем за запуск", overall.avg_per_run_human,
              `проектов в учёте: ${overall.projects_count}`),
  );

  const agentsBox = $("usage-agents");
  agentsBox.innerHTML = "";
  overall.agents.forEach((row) => {
    const line = el("div", "usage-agent");
    line.appendChild(el("div", "u-name", esc(row.label || row.agent)));
    const bar = el("div", "u-bar");
    const fill = el("div");
    fill.style.width = `${Math.max(2, Math.min(100, row.share))}%`;
    bar.appendChild(fill);
    line.appendChild(bar);
    line.appendChild(el("div", "u-num",
      `${esc(row.tokens_human)} · ${row.share}% · ${row.runs} зап.`));
    agentsBox.appendChild(line);
  });

  const box = $("usage-projects");
  box.innerHTML = "";
  if (!projects.length) {
    box.appendChild(el("p", "dim", "Запусков агентов ещё не было — считать нечего."));
    return;
  }
  projects.forEach((row) => {
    const line = el("div", "usage-project");
    const head = el("div", "row spread");
    const name = el("div", "u-name", esc(row.label));
    if (!row.exists && row.project) name.classList.add("gone");
    head.appendChild(name);
    head.appendChild(el("div", "u-num", `${esc(row.tokens_human)} токенов`));
    line.appendChild(head);

    const bar = el("div", "u-bar");
    const fill = el("div");
    fill.style.width = `${Math.max(2, Math.min(100, row.share))}%`;
    bar.appendChild(fill);
    line.appendChild(bar);

    const by = row.agents.map((a) => `${a.label || a.agent}: ${a.tokens_human}`).join(" · ");
    line.appendChild(el("div", "u-note", esc(
      `${row.share}% расхода · ${row.runs} запусков · неделя: ${row.tokens_weekly_human} · `
      + `${row.first_at} → ${row.last_at}${by ? " · " + by : ""}`
      + (row.project && !row.exists ? " · каталог проекта удалён" : ""))));
    box.appendChild(line);
  });
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
  $("set-template-mixing").checked = !!settings.allow_template_mixing;

  const fish = settings.fish_audio || {};
  $("set-fish-key").value = fish.api_key || "";
  const fishModel = $("set-fish-model");
  fishModel.innerHTML = "";
  (fish.models || []).forEach((m) => fishModel.appendChild(new Option(m.label, m.key)));
  fishModel.value = fish.model || fish.free_model || "";

  const knowledge = settings.knowledge || {};
  $("set-knowledge-repo").value = knowledge.repo || "";
  $("set-knowledge-ref").value = knowledge.ref || "main";
  $("set-knowledge-token").value = knowledge.token || "";

  fillGametest(settings.gametest || {});

  const bridge = settings.bridge || {};
  $("set-bridge-source").value = bridge.source || "";
  $("bridge-hint").textContent = bridge.tag
    ? `Сейчас: ${bridge.name} ${bridge.tag} из ${bridge.repo}`
    : "";

  const defaults = $("set-default-agent");
  defaults.innerHTML = "";
  state.boot.agents.forEach((a) => defaults.appendChild(new Option(a.label, a.key)));
  defaults.value = settings.default_agent;
}

/* ── Прогон на площадке ────────────────────────────────────────────────
 *
 * Полей полтора десятка, и держать их в общем коде настроек значит потерять
 * их среди агентов и озвучки. Что означает каждое — в подписях формы.
 */

const GAMETEST_CHECK_LABELS = {
  smoke: "запуск",
  ui: "вёрстка",
  saves: "сохранения",
  i18n: "локали",
  text: "тексты",
  rules: "правила площадки",
  ads: "реклама",
  payments: "покупки",
  debugcheck: "чекер Яндекса",
};

function fillGametest(gt) {
  $("gt-dir").textContent = gt.dir || "tools/gametest";
  $("gt-enabled").checked = !!gt.enabled;
  $("gt-update").checked = !!gt.update;
  $("gt-install-browsers").checked = !!gt.install_browsers;

  const mode = $("gt-mode");
  mode.innerHTML = "";
  (gt.modes || ["auto", "dev", "draft"]).forEach((m) => mode.appendChild(new Option(m, m)));
  mode.value = gt.mode || "auto";

  $("gt-viewports").value = gt.viewports || "smoke";
  $("gt-orientation").value = gt.orientation || "both";

  const block = $("gt-block-on");
  block.innerHTML = "";
  (gt.severities || ["blocker", "major", "minor"]).forEach((s) => block.appendChild(new Option(s, s)));
  block.value = gt.block_on || "major";

  $("gt-jobs").value = gt.jobs ?? 3;
  $("gt-play-ms").value = gt.play_ms ?? 45000;
  $("gt-timeout").value = gt.timeout ?? 2700;
  $("gt-repo").value = gt.repo || "";
  $("gt-ref").value = gt.ref || "main";
  $("gt-token").value = gt.token || "";

  const checks = $("gt-checks");
  checks.innerHTML = "";
  Object.entries(gt.checks || {}).forEach(([name, on]) => {
    const label = el("label", "check");
    const input = el("input");
    input.type = "checkbox";
    input.dataset.check = name;
    input.checked = !!on;
    label.append(input, document.createTextNode(` ${GAMETEST_CHECK_LABELS[name] || name}`));
    checks.appendChild(label);
  });

  const llm = gt.llm || {};
  $("gt-llm-enabled").checked = !!llm.enabled;
  const provider = $("gt-llm-provider");
  provider.innerHTML = "";
  (llm.providers || []).forEach((p) => provider.appendChild(new Option(p, p)));
  provider.value = llm.provider || "opencode";
  $("gt-llm-model").value = llm.model || "";
  $("gt-llm-key-env").value = llm.key_env || "LLM_API_KEY";
  $("gt-llm-key").value = llm.key || "";
  $("gt-llm-base-url").value = llm.base_url || "";

  renderYandexSession(gt.session || {}, gt.login || {});
}

function collectGametest() {
  const checks = {};
  document.querySelectorAll("#gt-checks [data-check]").forEach((node) => {
    checks[node.dataset.check] = node.checked;
  });
  return {
    enabled: $("gt-enabled").checked,
    update: $("gt-update").checked,
    install_browsers: $("gt-install-browsers").checked,
    mode: $("gt-mode").value,
    viewports: $("gt-viewports").value,
    orientation: $("gt-orientation").value,
    block_on: $("gt-block-on").value,
    jobs: Number($("gt-jobs").value) || 3,
    play_ms: Number($("gt-play-ms").value) || 0,
    timeout: Number($("gt-timeout").value) || 2700,
    repo: $("gt-repo").value.trim(),
    ref: $("gt-ref").value.trim(),
    token: $("gt-token").value.trim(),
    checks,
    llm: {
      enabled: $("gt-llm-enabled").checked,
      provider: $("gt-llm-provider").value,
      model: $("gt-llm-model").value.trim(),
      key_env: $("gt-llm-key-env").value.trim(),
      key: $("gt-llm-key").value.trim(),
      base_url: $("gt-llm-base-url").value.trim(),
    },
  };
}

function renderYandexSession(session, login) {
  const box = $("yandex-session");
  if (login && login.running) {
    box.textContent = "⏳ Окно браузера открыто на машине фабрики — войдите в аккаунт.";
    return;
  }
  if (!session.available) {
    box.textContent = session.reason ? `· ${session.reason}` : "";
    return;
  }
  if (session.signedIn) {
    box.textContent = `✅ Вход есть (профиль ${session.profile}${session.expiresAt ? `, до ${session.expiresAt}` : ""})`;
  } else if (session.expired) {
    box.textContent = "⚠️ Сессия просрочена — войдите заново.";
  } else {
    box.textContent = "· Входа нет — режим draft недоступен, прогон пойдёт в dev.";
  }
}

let yandexPoll = null;

async function pollYandex() {
  const data = await api("/api/yandex/status");
  renderYandexSession(data.session || {}, data.login || {});
  const running = data.login && data.login.running;
  if (!running) {
    clearInterval(yandexPoll);
    yandexPoll = null;
    const message = (data.login && data.login.message) || "";
    if (message) {
      $("yandex-msg").textContent = message;
      setTimeout(() => { $("yandex-msg").textContent = ""; }, 6000);
    }
  }
}

async function startYandexLogin() {
  $("yandex-msg").textContent = "";
  const res = await api("/api/yandex/login", { method: "POST" });
  renderYandexSession(res.session || {}, res.state || { running: true });
  if (!res.ok) {
    $("yandex-msg").textContent = res.message || "";
    return;
  }
  // Вход занимает минуты: пароль, иногда СМС, иногда капча. Держать запрос
  // открытым всё это время нельзя, поэтому состояние опрашивается.
  if (!yandexPoll) yandexPoll = setInterval(pollYandex, 3000);
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
      allow_template_mixing: $("set-template-mixing").checked,
      fish_audio: { api_key: $("set-fish-key").value.trim(), model: $("set-fish-model").value },
      knowledge: {
        repo: $("set-knowledge-repo").value.trim(),
        ref: $("set-knowledge-ref").value.trim(),
        token: $("set-knowledge-token").value.trim(),
      },
      gametest: collectGametest(),
      bridge: { source: $("set-bridge-source").value.trim() },
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
      appendStudioLog(data.line, data.job_id);
      break;
    case "studio.progress":
      setStudioProgress(data.percent, data.step);
      break;
    case "studio.job":
      upsertJob(data.job);
      break;
    case "studio.jobs_changed":
      loadJobs();
      break;
    case "studio.logs_cleared":
      if ((data.job_id || null) === (state.jobSel || null)) $("studio-log").textContent = "";
      break;
    case "studio.done":
      toast("Студия", `Проект готов: ${data.slug}`, "ok",
        [["Открыть ТЗ", () => selectProject(data.slug)]]);
      loadGallery();
      break;
    case "projects.changed":
      if (state.view === "studio") loadGallery();
      if (state.view === "projects") loadProjects();
      if (state.view === "settings" && state.settingsTab === "storage") loadStorage();
      if (state.view === "settings" && state.settingsTab === "storage") loadBuilds();
      break;
    case "storage.log":
      appendStorageLog(data.line);
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
      if (data.slug === DEMO_SLUG) {
        const box = $("demo-log");
        box.appendChild(document.createTextNode(data.line));
        box.scrollTop = box.scrollHeight;
      }
      break;
    case "play.url":
      resolveGameTab(data.slug, data.url);
      if (data.slug === state.playSlug) {
        $("play-url").value = data.url;
        setPlayStatus(true, false, data.url);
        toast("Игра запущена", data.url, "ok", [["Открыть", () => window.open(viewerUrl(data.url, data.slug), "_blank", "noopener")]]);
      }
      if (data.slug === DEMO_SLUG) {
        setDemoStatus(true, false, data.url);
        renderDemoPages({ ...(state.demo || {}), running: true, url: data.url });
        toast("Демо-стенд запущен", data.url, "ok",
          [["Открыть", () => window.open(data.url, "_blank", "noopener")]]);
      }
      loadServers();
      break;
    case "play.state":
      if (data.url) resolveGameTab(data.slug, data.url);
      if (!data.running && !data.starting) {
        dropGameTab(data.slug, "Dev-сервер не работает — смотрите лог во вкладке «Играть».");
      }
      if (data.slug === state.playSlug) setPlayStatus(data.running, data.starting, data.url);
      if (data.slug === DEMO_SLUG) setDemoStatus(data.running, data.starting, data.url);
      loadServers();
      break;
    case "quota.changed":
      if (state.view === "settings" && state.settingsTab === "quota") loadQuota();
      break;
    case "runs.changed":
      // Прогон живёт в чате проекта: обновляем список бесед и полосу прогона.
      loadChats();
      if (state.session) refreshRunBar();
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

  const launch = async (body) => {
    const res = await api("/api/studio/generate", { body });
    if (res.status !== "started") {
      toast("Студия", res.message || "Не удалось запустить", "warn");
      return;
    }
    // Новый прогон сразу становится выбранным: журнал показывает именно его.
    showLogPane(true);
    $("studio-log").textContent = "";
    state.jobSel = res.job_id;
    clearStudioAttachments();
    await loadJobs();
    ensureRunTicker();
  };
  $("btn-create-full").onclick = () =>
    launch(studioOpts({ kind: "full", model: $("chat-model").value }));
  $("btn-create-spec").onclick = () => launch(studioOpts({ kind: "spec" }));
  $("btn-log-global").onclick = () => selectJob(null);
  $("btn-close-finished").onclick = async () => {
    await api("/api/studio/jobs/close-finished", { method: "POST" });
    if (state.jobSel && !jobById(state.jobSel)) selectJob(null);
    await loadJobs();
  };
  $("btn-analyze").onclick = async () => {
    showLogPane(true);
    const res = await api("/api/studio/analyze", { body: studioOpts() });
    if (res.status === "error") toast("Анализ", res.message, "err");
  };
  $("btn-stop-studio").onclick = () => api("/api/studio/stop", { method: "POST" });
  $("btn-toggle-log").onclick = () => showLogPane($("studio-log-pane").classList.contains("hidden"));
  $("btn-clear-log").onclick = () =>
    api("/api/studio/logs/clear", { body: { job_id: state.jobSel } });
  $("btn-copy-log").onclick = async () => {
    await navigator.clipboard.writeText($("studio-log").textContent);
    toast("Журнал", "Скопирован в буфер обмена", "ok");
  };
  // Материалы заказа: кнопка, Ctrl+V со скриншотом, перетаскивание в поле идеи.
  const studioPrompt = $("studio-prompt");
  $("btn-studio-attach").onclick = () => $("studio-file-input").click();
  $("studio-file-input").onchange = async (e) => {
    await attachStudioFiles(e.target.files);
    e.target.value = "";
  };
  studioPrompt.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (!files.length) return;   // обычный текст вставляем как обычно
    e.preventDefault();
    attachStudioFiles(files);
  });
  ["dragenter", "dragover"].forEach((type) => studioPrompt.addEventListener(type, (e) => {
    e.preventDefault();
    studioPrompt.classList.add("drop-target");
  }));
  ["dragleave", "drop"].forEach((type) => studioPrompt.addEventListener(type, (e) => {
    e.preventDefault();
    studioPrompt.classList.remove("drop-target");
  }));
  studioPrompt.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) attachStudioFiles(e.dataTransfer.files);
  });

  $("btn-refresh-gallery").onclick = loadGallery;
  if ($("gallery-search")) $("gallery-search").oninput = loadGallery;

}

function bindProjects() {
  $("btn-refresh-projects").onclick = loadProjects;
  if ($("project-search")) $("project-search").oninput = loadProjects;
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
  $("btn-favorite-project").onclick = () => {
    const card = (state.projects || []).find((p) => p.slug === state.project);
    if (card) toggleFavorite(card);
  };
  $("btn-refresh-favorites").onclick = loadProjects;
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
    renderRunBar(null);
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
  const chatInput = $("chat-input");
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatTask(); }
  });
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(Math.max(chatInput.scrollHeight, 52), 220) + "px";
  });

  // Вложения: кнопка, Ctrl+V со скриншотом и перетаскивание файлов в композер.
  $("btn-chat-attach").onclick = () => $("chat-file-input").click();
  $("chat-file-input").onchange = async (e) => {
    await attachFiles(e.target.files);
    e.target.value = "";
  };
  chatInput.addEventListener("paste", (e) => {
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
    if (url) window.open(viewerUrl(url, $("play-project").value), "_blank", "noopener");
    else toast("Игра", "URL неизвестен — сначала запустите dev-сервер.", "warn");
  };
  $("btn-play-window").onclick = async () => {
    const slug = $("play-project").value;
    const url = $("play-url").value.trim();
    const res = await api(`/api/play/${encodeURIComponent(slug)}/window`,
      { body: { url: url ? location.origin + viewerUrl(url, slug) : "" } });
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

  $("btn-demo-start").onclick = startDemo;
  $("btn-demo-stop").onclick = async () => {
    await api("/api/demo/stop", { method: "POST" });
    loadDemoState();
  };
  $("btn-demo-open").onclick = () => {
    const url = (state.demo || {}).url;
    if (url) window.open(url, "_blank", "noopener");
    else toast("Демо-стенд", "Стенд не запущен — сначала нажмите «Запустить стенд».", "warn");
  };
  $("btn-demo-folder").onclick = () => api("/api/demo/open-folder", { method: "POST" });
  $("btn-demo-clear").onclick = () => { $("demo-log").textContent = ""; };

  $("btn-servers-refresh").onclick = loadServers;
  $("btn-servers-stop-all").onclick = async () => {
    const res = await api("/api/play/stop-all", { method: "POST" });
    toast("Менеджер игр", res.message, res.stopped ? "ok" : "");
    await loadServers();
    loadPlayState();
  };
}

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem("theme", theme);
  const isLight = theme === "light";
  if (isLight) {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const btn = $("btn-theme-toggle");
  if (btn) {
    btn.textContent = isLight ? "🌙" : "☀️";
    btn.title = isLight ? "Переключить на тёмную тему" : "Переключить на светлую тему";
  }
}

function toggleTheme() {
  applyTheme(state.theme === "light" ? "dark" : "light");
}

function bindCommon() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => showView(btn.dataset.view);
  });
  document.querySelectorAll("#settings-tabs .tab").forEach((btn) => {
    btn.onclick = () => showSettingsTab(btn.dataset.settingsTab);
  });
  if ($("btn-theme-toggle")) $("btn-theme-toggle").onclick = toggleTheme;
  if ($("btn-logout")) {
    // Кнопку показываем только когда вход вообще включён: при локальном
    // запуске на 127.0.0.1 (AUTH_ENABLED=0) выходить не из чего.
    $("btn-logout").classList.toggle("hidden", !state.boot?.auth_enabled);
    $("btn-logout").onclick = async () => {
      await api("/api/logout", { method: "POST" });
      location.replace("/login");
    };
  }
  $("btn-open-workspace-2").onclick = () => api("/api/open-workspace", { method: "POST" });
  $("btn-refresh-quota").onclick = loadQuota;
  bindStorage();
  $("btn-save-settings").onclick = saveSettings;
  $("btn-yandex-login").onclick = startYandexLogin;
  $("btn-yandex-logout").onclick = async () => {
    const res = await api("/api/yandex/logout", { method: "POST" });
    $("yandex-msg").textContent = res.message || "";
    renderYandexSession(res.session || {}, {});
    setTimeout(() => { $("yandex-msg").textContent = ""; }, 4000);
  };
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
  applyTheme(state.theme);
  state.boot = await api("/api/bootstrap");

  fillSelect("sel-provider", state.boot.providers, state.boot.settings.default_agent);
  fillSelect("sel-renderer", state.boot.renderers, "auto");
  fillSelect("sel-mode", state.boot.modes, "standard");
  fillSelect("sel-image", state.boot.image_providers, "qwen");
  fillSelect("chat-agent", state.boot.agents, state.boot.settings.default_agent);
  $("chat-model").appendChild(new Option(state.boot.model_default, ""));
  $("chat-sandbox").textContent = `🔒 Песочница: ${state.boot.settings.sandbox_root}`;

  bindCommon();
  bindSettingsExtras();
  bindStudio();
  bindProjects();
  bindChats();
  bindPlay();
  docTabButtons();
  renderSettings();

  connectEvents();
  loadActivity();          // панель активности не ждёт медленной витрины проектов
  startActivityTimer();

  // Сразу открываем сохранённую вкладку: showView запускает её собственный
  // загрузчик (loadProjects/loadGallery) немедленно. Раньше это делалось
  // самым последним шагом, в конце цепочки await'ов — из-за этого нужная
  // вкладка простаивала пустой, пока грузилось совсем не связанное с ней
  // состояние студии.
  showView(state.view);

  // Независимые загрузки — параллельно, а не одна за другой; loadProjects
  // и loadGallery делят один запрос к /api/projects через fetchProjectsList.
  await Promise.all([
    loadProjects(),
    loadStudioState(),
    loadStudioAttachments(),
  ]);
  loadQuota();
  refreshModels(true);

  if (state.project) {
    const exists = (state.projects || []).some((p) => p.slug === state.project);
    if (!exists) { state.project = null; localStorage.removeItem("project"); }
  }
  if (state.project && state.view === "projects") selectProject(state.project);
}

/* ── Доступ: пароль и база данных ─────────────────────────────────────── */

async function changePassword() {
  const current = $("pw-current").value;
  const next = $("pw-new").value;
  const repeat = $("pw-repeat").value;
  const msg = $("pw-msg");

  // Совпадение проверяем здесь: гонять пару на сервер, чтобы услышать
  // «не совпали», значит зря считать scrypt и зря светить пароль в журнале.
  if (next !== repeat) {
    msg.style.color = "var(--err)";
    msg.textContent = "Новый пароль и повтор не совпадают.";
    return;
  }
  const btn = $("btn-change-password");
  btn.disabled = true;
  msg.style.color = "var(--text-dim)";
  msg.textContent = "Считаю хеш...";
  const res = await api("/api/settings/password", { body: { current, new: next } });
  btn.disabled = false;
  msg.style.color = res.status === "error" ? "var(--err)" : "var(--ok)";
  msg.textContent = res.message || "";
  if (res.status !== "error") {
    $("pw-current").value = "";
    $("pw-new").value = "";
    $("pw-repeat").value = "";
    toast("Доступ", res.message || "Пароль изменён", "ok");
  }
}

function renderDatabase(data) {
  const status = data.status || {};
  const badge = $("db-status");
  if (!data.enabled) {
    badge.style.color = "var(--text-dim)";
    badge.textContent = "выключено — реестр в JSON";
  } else if (status.ok) {
    badge.style.color = "var(--ok)";
    badge.textContent = `✅ ${status.version || "подключено"} · ${status.latency_ms} мс`;
  } else {
    badge.style.color = "var(--err)";
    badge.textContent = "⚠️ нет связи";
  }

  $("db-enabled").checked = !!data.enabled;
  $("db-host").value = data.host || "";
  $("db-port").value = data.port || 3306;
  $("db-user").value = data.user || "";
  $("db-name").value = data.database || "";
  $("db-password").placeholder = data.has_password
    ? "пароль задан — оставьте пустым, чтобы не менять"
    : "пароль не задан";

  const msg = $("db-msg");
  msg.style.color = status.ok ? "var(--ok)" : "var(--text-dim)";
  msg.textContent = status.message || "";
}

async function loadAccess() {
  const data = await api("/api/settings/database");
  if (data && !data.message) renderDatabase(data);
}

async function saveDatabase() {
  const btn = $("btn-save-db");
  const msg = $("db-msg");
  btn.disabled = true;
  msg.style.color = "var(--text-dim)";
  msg.textContent = "Проверяю связь...";
  const body = {
    enabled: $("db-enabled").checked,
    host: $("db-host").value.trim(),
    port: $("db-port").value.trim() || "3306",
    user: $("db-user").value.trim(),
    database: $("db-name").value.trim(),
  };
  // Пустое поле означает «не трогать»: сервер пароль наружу не отдаёт, и
  // отправить обратно пустую строку значило бы его стереть.
  const password = $("db-password").value;
  if (password) body.password = password;

  const res = await api("/api/settings/database", { body });
  btn.disabled = false;
  $("db-password").value = "";
  if (res.database) renderDatabase(res.database);
  toast("MySQL", res.message || "Сохранено", res.status === "error" ? "err" : "ok");
}

/* ── Архивы игр ───────────────────────────────────────────────────────── */

async function loadBuilds() {
  const box = $("builds-list");
  if (!box) return;
  const data = await api("/api/builds?limit=60");
  const stats = data.stats || {};
  const mirror = stats.mirror || {};
  $("builds-stats").textContent = stats.enabled
    ? `после прогонов: ${stats.files} · ${mb(stats.size)} · ` +
      `в базе: ${stats.in_db} · ${mb(stats.db_size)}` +
      (mirror.enabled
        ? ` · зеркало: ${mirror.games} игр, ${mb(mirror.size)}` +
          `, сверка раз в ${Math.round((mirror.interval || 3600) / 60)} мин`
        : " · зеркало выключено")
    : "автоархивы выключены (BUILD_ZIP_ENABLED=0)";

  box.innerHTML = "";
  const rows = data.builds || [];
  if (!rows.length) {
    box.appendChild(el("p", "dim", "Архивов пока нет — они появятся после первого прогона агента."));
    return;
  }
  rows.forEach((item) => {
    const row = el("div", "storage-row");
    // Холодный архив — это сама игра, убранная с диска, а не слепок после
    // прогона. Путать их в одном списке нельзя: у первого удаление записи не
    // должно выглядеть как «удалить игру».
    const cold = item.kind === "cold";
    const mirrored = item.kind === "mirror";
    const where = cold
      ? (item.stored ? "❄ в архиве · копия в базе" : "❄ в архиве · только файл")
      : mirrored
        ? "☁ зеркало живого проекта"
        : (item.stored ? "💾 база + диск" : (item.on_disk ? "💽 диск" : "⚠️ файла нет"));
    const origin = item.reason && !cold ? ` · ${esc(item.reason)}` : "";
    row.appendChild(el("span", "storage-slug",
      `${esc(item.slug)}<span class="small dim"> — ${esc(item.created_at)}${origin} · ` +
      `${mb(item.size)}${item.files ? ` · ${item.files} файлов` : ""} · ${where}</span>`));

    const actions = el("div", "row");
    if (item.id) {
      const dl = el("a", "btn small", "⬇ Скачать");
      dl.href = `/api/builds/${item.id}/download`;
      actions.appendChild(dl);
      const del = el("button", "btn small danger", "🗑");
      del.title = cold
        ? "Убрать копию из базы (сама игра в архиве останется)"
        : "Удалить архив с диска и из базы";
      del.onclick = async () => {
        del.disabled = true;
        const res = await api(`/api/builds/${item.id}`, { method: "DELETE" });
        toast("Архивы", res.message || "Готово", res.status === "error" ? "err" : "ok");
        loadBuilds();
      };
      actions.appendChild(del);
    } else {
      actions.appendChild(el("span", "small dim", "нет в базе"));
    }
    row.appendChild(actions);
    box.appendChild(row);
  });
}

/* ── Состояние машины ─────────────────────────────────────────────────── */

let systemTimer = null;

function bar(percent, warn = 75, danger = 90) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const kind = value >= danger ? "danger" : (value >= warn ? "warn" : "ok");
  return `<div class="meter"><i class="${kind}" style="width:${value}%"></i></div>`;
}

function card(title, value, extra, meter) {
  return el("div", "system-card",
    `<div class="system-title">${esc(title)}</div>` +
    `<div class="system-value">${value}</div>` +
    (meter || "") +
    `<div class="small dim">${extra || ""}</div>`);
}

function human(seconds) {
  const value = Number(seconds) || 0;
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days) return `${days} д ${hours} ч`;
  if (hours) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

function renderSystem(data) {
  const cards = $("system-cards");
  if (!cards) return;
  if (data.ok === false) {
    cards.innerHTML = "";
    cards.appendChild(el("p", "dim", esc(data.message || "Состояние недоступно.")));
    return;
  }

  $("system-host").textContent =
    `${data.host || ""} · ${data.platform || ""} · ` +
    (data.container ? "в контейнере" : "на хосте") +
    (data.uptime ? ` · аптайм ${human(data.uptime)}` : "");

  const cpu = data.cpu || {};
  const mem = data.memory || {};
  const fac = data.factory || {};
  cards.innerHTML = "";

  const loadText = cpu.load ? `загрузка ${cpu.load.join(" / ")}` : "";
  cards.appendChild(card(
    "Процессор",
    cpu.percent === null || cpu.percent === undefined ? "—" : `${cpu.percent}%`,
    `${cpu.cores || "?"} ядер` + (cpu.quota ? ` · потолок контейнера ${cpu.quota}` : "") +
    (loadText ? ` · ${loadText}` : ""),
    bar(cpu.percent)));

  // Память показываем дважды и намеренно: у хоста семь гигабайт, у контейнера
  // три, и «занято 2.9 ГБ» означает в этих двух системах координат совершенно
  // разное — спокойный вечер против OOM через минуту.
  cards.appendChild(card(
    "Память машины",
    mem.total ? `${mb(mem.used)} из ${mb(mem.total)}` : "—",
    mem.swap_total ? `swap ${mb(mem.swap_used)} из ${mb(mem.swap_total)}` : "",
    bar(mem.percent)));

  if (mem.limit) {
    cards.appendChild(card(
      "Память фабрики",
      `${mb(mem.limit_used)} из ${mb(mem.limit)}`,
      "лимит контейнера — превышение означает OOM",
      bar(mem.limit_percent, 80, 92)));
  }

  (data.disks || []).forEach((disk) => {
    cards.appendChild(card(
      `Диск · ${disk.label}`,
      `${mb(disk.free)} свободно`,
      `${mb(disk.used)} из ${mb(disk.total)} · ${esc(disk.path)}`,
      bar(disk.percent, 80, 92)));
  });

  const temps = data.temperatures || [];
  if (temps.length) {
    const hottest = temps.reduce((a, b) => (b.value > a.value ? b : a));
    cards.appendChild(card(
      "Температура",
      `${hottest.value} °C`,
      esc(hottest.label),
      // Шкала до ста градусов: у процессора мини-ПК троттлинг начинается
      // около сотни, и рисовать проценты от чего-то другого бессмысленно.
      bar(hottest.value, 75, 88)));
  }

  cards.appendChild(card(
    "Работа фабрики",
    `${fac.studio_running || 0} + ${fac.chats_running || 0}`,
    `прогонов студии + задач в чатах · dev-серверов: ${fac.servers || 0} · ` +
    `терминалов: ${fac.terminals || 0}`,
    ""));

  const sensors = $("system-sensors");
  sensors.innerHTML = "";
  if (!temps.length) {
    sensors.appendChild(el("p", "dim", "Датчиков температуры не видно."));
  }
  temps.forEach((sensor) => {
    const row = el("div", "storage-row");
    row.appendChild(el("span", "storage-slug", esc(sensor.label)));
    row.appendChild(el("span", "small", `${sensor.value} °C`));
    sensors.appendChild(row);
  });
  (data.fans || []).forEach((fan) => {
    const row = el("div", "storage-row");
    row.appendChild(el("span", "storage-slug", `${esc(fan.label)} · вентилятор`));
    row.appendChild(el("span", "small", `${fan.rpm} об/мин`));
    sensors.appendChild(row);
  });

  const procs = $("system-processes");
  procs.innerHTML = "";
  const rows = data.processes || [];
  if (!rows.length) {
    procs.appendChild(el("p", "dim",
      data.psutil ? "Процессы не читаются." : "Нужен psutil: pip install -r requirements.txt"));
  }
  rows.forEach((proc) => {
    const row = el("div", "storage-row");
    row.appendChild(el("span", "storage-slug", `${esc(proc.name)} <span class="small dim">#${proc.pid}</span>`));
    row.appendChild(el("span", "small", `${proc.cpu}% · ${mb(proc.memory)}`));
    procs.appendChild(row);
  });
}

async function loadSystem() {
  const data = await api("/api/system");
  renderSystem(data || {});
}

function startSystemTimer() {
  stopSystemTimer();
  // Три секунды: процент загрузки считается как среднее между двумя опросами,
  // и на более редком интервале короткие всплески просто не видны.
  systemTimer = setInterval(() => {
    if (state.view === "settings" && state.settingsTab === "system") loadSystem();
    else stopSystemTimer();
  }, 3000);
}

function stopSystemTimer() {
  if (systemTimer) { clearInterval(systemTimer); systemTimer = null; }
}

/* ── Терминалы CLI-агентов ────────────────────────────────────────────── */

const term = { xterm: null, fit: null, socket: null, session: null, hints: {} };

function terminalWrite(text) {
  if (term.xterm) term.xterm.write(text);
}

function ensureXterm() {
  if (term.xterm) return true;
  if (typeof window.Terminal !== "function") return false;
  term.xterm = new window.Terminal({
    fontFamily: "'Cascadia Mono', 'JetBrains Mono', Consolas, monospace",
    fontSize: 13,
    cursorBlink: true,
    convertEol: false,
    scrollback: 5000,
    theme: { background: "#0d1117", foreground: "#c9d1d9", cursor: "#58a6ff" },
  });
  if (window.FitAddon && window.FitAddon.FitAddon) {
    term.fit = new window.FitAddon.FitAddon();
    term.xterm.loadAddon(term.fit);
  }
  term.xterm.open($("terminal-host"));
  term.xterm.onData((data) => {
    if (term.socket && term.socket.readyState === WebSocket.OPEN) {
      term.socket.send(JSON.stringify({ type: "input", data }));
    }
  });
  window.addEventListener("resize", () => fitTerminal());
  return true;
}

function fitTerminal() {
  if (!term.fit || !term.xterm) return;
  try { term.fit.fit(); } catch { return; }
  if (term.socket && term.socket.readyState === WebSocket.OPEN) {
    term.socket.send(JSON.stringify({
      type: "resize", rows: term.xterm.rows, cols: term.xterm.cols,
    }));
  }
}

function connectTerminal(session) {
  if (term.socket) { try { term.socket.close(); } catch { /* уже закрыт */ } }
  term.session = session;
  $("terminal-title").innerHTML =
    `${esc(session.label || session.key)} — <code>${esc(session.command)}</code>` +
    (term.hints[session.key] ? ` <span class="dim">· ${esc(term.hints[session.key])}</span>` : "");
  $("btn-terminal-kill").classList.remove("hidden");
  $("btn-terminal-clear").classList.remove("hidden");

  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${location.host}/api/terminals/${session.id}/ws`);
  term.socket = socket;

  socket.onopen = () => fitTerminal();
  socket.onmessage = (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    if (payload.type === "data") terminalWrite(payload.data);
    else if (payload.type === "exit") {
      $("btn-terminal-kill").classList.add("hidden");
      loadTerminalSessions();
    }
  };
  socket.onclose = (event) => {
    // 1008 — сервер отказал: либо сессия уже закрыта, либо кука не подошла.
    // Второе означает, что пароль сменили в другой вкладке.
    if (event.code === 1008) {
      terminalWrite("\r\n\x1b[31m— соединение отклонено: сессия закрыта или требуется вход —\x1b[0m\r\n");
    }
  };
}

async function startTerminal(key) {
  if (!ensureXterm()) {
    toast("Терминал", "Не загрузился xterm.js — обновите страницу", "err");
    return;
  }
  term.xterm.reset();
  const res = await api("/api/terminals", {
    body: { key, rows: term.xterm.rows || 30, cols: term.xterm.cols || 100 },
  });
  if (res.status === "error") {
    toast("Терминал", res.message || "Не удалось открыть", "err");
    terminalWrite(`\x1b[31m${res.message || "Не удалось открыть терминал"}\x1b[0m\r\n`);
    return;
  }
  connectTerminal(res.session);
  loadTerminalSessions();
  term.xterm.focus();
}

async function loadTerminalSessions() {
  const data = await api("/api/terminals");
  const box = $("terminal-sessions");
  if (!box) return;

  const launchers = $("terminal-launchers");
  if (launchers && !launchers.childElementCount) {
    (data.launchers || []).forEach((item) => {
      term.hints[item.key] = item.hint || "";
      const btn = el("button", "btn small", esc(item.label));
      btn.title = item.hint || item.command;
      btn.onclick = () => startTerminal(item.key);
      launchers.appendChild(btn);
    });
  }

  if (!data.available) {
    $("terminal-hint").innerHTML =
      "⚠️ Псевдотерминалов на этой системе нет — панель работает на Linux, " +
      "то есть на мини-ПК. Локально на Windows пользуйтесь обычной консолью.";
    (launchers ? Array.from(launchers.children) : []).forEach((b) => (b.disabled = true));
  }

  box.innerHTML = "";
  const sessions = data.sessions || [];
  if (!sessions.length) {
    box.appendChild(el("p", "dim", "Открытых сессий нет."));
    return;
  }
  sessions.forEach((item) => {
    const row = el("div", "storage-row");
    const state_ = item.alive ? "работает" : `завершён (код ${item.exit_code})`;
    row.appendChild(el("span", "storage-slug",
      `${esc(item.label)} <span class="small dim">— ${state_} · ${human(item.uptime)} · ` +
      `зрителей: ${item.viewers}</span>`));
    const actions = el("div", "row");
    const attach = el("button", "btn small", "👁 Открыть");
    attach.onclick = () => {
      if (ensureXterm()) { term.xterm.reset(); connectTerminal(item); term.xterm.focus(); }
    };
    actions.appendChild(attach);
    const kill = el("button", "btn small danger", "⏹");
    kill.onclick = async () => {
      kill.disabled = true;
      await api(`/api/terminals/${item.id}`, { method: "DELETE" });
      loadTerminalSessions();
    };
    actions.appendChild(kill);
    row.appendChild(actions);
    box.appendChild(row);
  });
}

function loadTerminals() {
  ensureXterm();
  loadTerminalSessions();
  // Размер считается по видимому контейнеру, а вкладка только что перестала
  // быть скрытой — без задержки fit намерил бы нулевую ширину.
  setTimeout(() => fitTerminal(), 60);
}

function bindSettingsExtras() {
  const change = $("btn-change-password");
  if (change) change.onclick = changePassword;
  const saveDb = $("btn-save-db");
  if (saveDb) saveDb.onclick = saveDatabase;
  const refreshBuilds = $("btn-refresh-builds");
  if (refreshBuilds) refreshBuilds.onclick = loadBuilds;
  const mirrorNow = $("btn-mirror-now");
  if (mirrorNow) {
    mirrorNow.onclick = async () => {
      mirrorNow.disabled = true;
      const before = mirrorNow.textContent;
      mirrorNow.textContent = "☁ сверяю...";
      const res = await api("/api/builds/mirror", { body: {} });
      mirrorNow.disabled = false;
      mirrorNow.textContent = before;
      toast("Зеркало", res.message || "Готово", res.status === "error" ? "err" : "ok");
      loadBuilds();
    };
  }

  const clear = $("btn-terminal-clear");
  if (clear) clear.onclick = () => term.xterm && term.xterm.clear();
  const kill = $("btn-terminal-kill");
  if (kill) {
    kill.onclick = async () => {
      if (!term.session) return;
      await api(`/api/terminals/${term.session.id}`, { method: "DELETE" });
      loadTerminalSessions();
    };
  }
}

boot();
