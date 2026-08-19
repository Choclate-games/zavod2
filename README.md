# AI Game Prompt Factory 🎮⚡

**AI Game Prompt Factory** — локальное приложение на Python, которое по текстовому описанию идеи игры автоматически создает полный пакет проектной документации, визуальный concept preview и финальный промпт для AI coding agent.

> **Главный принцип:** Это генератор исчерпывающих спецификаций и инструкций для создания игр, превращающий сырую идею в согласованное, качественное и исполнимое ТЗ (`AI_DEVELOPER_PROMPT.md`), готовое к передаче coding agent'у без необходимости повторного проектирования игры с нуля.

---

## 🚀 Возможности

- **Полный ролевой Pipeline агентов**:
  - `IdeaAnalyzer` — деконструкция идеи, определение жанра, fantasy, hook, ЦА.
  - `GameDesigner` — core loop, win/lose, сессионная модель, прогрессия.
  - `ReferenceAnalyst` — подбор и деконструкция паттернов из базы референсов.
  - `MechanicsArchitect` — проектирование механик с физикой, инпутом, фидбеком и edge-кейсами.
  - `RendererSelector` — обоснованный выбор **Three.js** или **PixiJS** + физического движка.
  - `TechnicalArchitect` — модульная TypeScript/Vite архитектура, системы, зависимости.
  - `PlaygamaSpecialist` — полноценная интеграция Playgama Bridge (Ads, Storage, Cloud, Leaderboards, Lifecycle).
  - `MonetizationDesigner` — баланс Rewarded видео, Interstitials, IAP и экономика.
  - `ArtDirector` — стиль, палитра, освещение, шейдеры, VFX, камера и HUD.
  - `UXDesigner` — мокапы интерфейса, mobile touch controls (виртуальные стики, свайпы).
  - `PreviewDesigner` & `PreviewGenerator` — генерация концепт-скриншота игрового процесса (`concept_preview.png`) и промпта (`PREVIEW_PROMPT.md`).
  - `SkillGenerator` — game-specific и специализированные скиллы в формате Markdown.
  - `SelfCritiqueAgent` & `ConsistencyValidator` — валидация согласованности и полноты всех документов.
  - `PromptCompiler` — компиляция самодостаточного мастер-промпта `AI_DEVELOPER_PROMPT.md` с четким Definition of Done.

- **Провайдеры ИИ**:
  - `agy` — **Google Antigravity CLI** (отправляет идею в `agy`, который структурирует задачу, после чего Python компилирует полный пакет ТЗ).
  - `opencode` — **OpenCode Go / Zen Подписка** (доступ к специализированным моделям для кодинга через API `https://opencode.ai/zen/v1`).
  - `local` — экспертный эвристический движок (работает офлайн без API ключей).
  - `openai` — интеграция с GPT-4o и DALL-E 3.
  - `anthropic` — интеграция с Claude 3.5 Sonnet.
  - `google` — интеграция с Google Gemini.

- **Веб-интерфейс** (главное приложение, `start.bat` или `python run_web.py`) —
  локальный сервер FastAPI + одностраничный клиент в браузере. Те же вкладки,
  что и в десктопной версии, но без рывков Tk: длинные операции идут в фоне,
  а браузер получает их ход по Server-Sent Events.

- **Десктопный GUI на CustomTkinter** (запасной вариант, `python gui.py`):
  - **🚀 Студия генерации** — создание игры под ключ из одной идеи.
  - **📁 Проекты и ТЗ** — инспектор проектов, Markdown-вьюер, журнал разработки
    (`DEVLOG.md`) и changelog игры.
  - **⚡ AGY CLI Терминал** — чат с кодовым агентом по выбранному проекту;
    режим «Продолжать диалог» помнит предыдущие задачи и позволяет вести
    разработку итерациями.
  - **🌐 Играть (браузер)** — запуск `npm run dev` и открытие игры во внутреннем
    окне браузера прямо из фабрики.
  - **📊 Квота AGY** — отдельный экран с 5-часовым и недельным лимитами,
    временем сброса и историей запросов, обновляется автоматически.
  - **⚙️ Настройки API** — ключи, провайдеры и каталог песочницы.

- **Песочница `workspace/`**: все проекты создаются в `workspace/<slug>/`, и
  кодовому агенту разрешена работа только внутри каталога его проекта. Агент
  обязан вести `DEVLOG.md` и `CHANGELOG.md` — это часть Definition of Done.

---

## 📦 Структура генерируемого пакета (`workspace/<game_slug>/`)

```text
workspace/<game_slug>/
├── README.md
├── DEVLOG.md                  # журнал разработки, ведёт кодовый агент
├── CHANGELOG.md               # changelog проекта, ведёт кодовый агент
├── GAME_DESIGN_DOCUMENT.md
├── GAMEPLAY_SPECIFICATION.md
├── CORE_LOOP.md
├── MECHANICS.md
├── PROGRESSION.md
├── LEVEL_DESIGN.md
├── DIFFICULTY_DESIGN.md
├── TECHNICAL_SPECIFICATION.md
├── ARCHITECTURE_DOCUMENT.md
├── THREEJS_OR_PIXI_ARCHITECTURE.md
├── ART_DIRECTION.md
├── UI_UX_SPECIFICATION.md
├── MOBILE_CONTROLS.md
├── AUDIO_DESIGN.md
├── MONETIZATION.md
├── PLAYGAMA_INTEGRATION.md
├── PERFORMANCE.md
├── QA_PLAN.md
├── DEVELOPMENT_ROADMAP.md
├── REFERENCE_ANALYSIS.md
├── RISKS.md
├── PREVIEW_PROMPT.md
├── GAME_DATA.yaml
├── AI_DEVELOPER_PROMPT.md
│
├── preview/
│   └── concept_preview.png
│
└── skills/
    ├── GAME_SKILL.md
    ├── GAMEPLAY_SKILL.md
    ├── RENDERER_SKILL.md
    ├── PLAYGAMA_SKILL.md
    └── <specialized>_skill.md
```

---

## 🛠 Установка и Запуск

```bash
# Клонирование / переход в папку
cd zavod2

# Установка зависимостей
pip install -r requirements.txt

# Настройка .env (опционально)
copy .env.example .env
```

---

## 🌐 Запуск веб-фабрики (основной способ)

```bash
# Windows: двойной клик по файлу или из терминала
start.bat

# Любая система
python run_web.py

# Полезные флаги
python run_web.py --port 7900 --no-browser
```

`start.bat` при первом запуске доустановит зависимости, поднимет сервер и сам
откроет интерфейс в браузере (`http://127.0.0.1:7860` — порт берётся из
`GUI_PORT` в `.env`, занятый порт заменяется следующим свободным).
Сервер слушает только локальный адрес; всё — файлы, CLI-агенты, dev-серверы игр —
работает на вашей машине.

Вкладки веб-интерфейса:

| Вкладка | Что делает |
| :--- | :--- |
| 🚀 Студия генерации | идея → 25+ документов → скиллы → кодогенерация агентом, брейнсторм идей, пакетная генерация, журнал в реальном времени, витрина готовых игр |
| 📁 Проекты и ТЗ | список проектов с превью, просмотр документов (Markdown/исходник), DEVLOG, CHANGELOG, генерация превью, ребилд разделов, экспорт ZIP, валидация |
| 💬 Чаты разработки | параллельные чаты с CLI-агентами по проекту, выбор агента и модели, YOLO, продолжение беседы, стоп, внешний терминал |
| 🌐 Играть | `npm run dev` для выбранной игры, вывод сервера, открытие во вкладке или в отдельном окне предпросмотра |
| 📊 Квоты агентов | живые квоты Antigravity, реальные лимиты Claude Code / Codex, локальные счётчики остальных |
| ⚙️ Настройки | пути к CLI, модели, reasoning effort, каталог песочницы, уведомления — с записью в `.env` |

Отдельное окно предпросмотра использует `pywebview`, если он установлен; иначе
игра открывается в окне Edge/Chrome (`--app`), а в крайнем случае — во вкладке
системного браузера.

### Десктопное окно (запасной вариант)

```bash
python gui.py          # CustomTkinter
python -m app.cli gui
```

---

## 💻 Использование через CLI

### 1. Создание полной спецификации игры

```bash
# Запуск с Antigravity CLI (AGY)
python -m app.cli create "3D гладиаторский roguelike с ragdoll физикой на Яндекс Игры" --provider agy

# Запуск с OpenCode Go (Zen API)
python -m app.cli create "Космический автобатлер и кликер" --provider opencode

# Офлайн режим (без API ключей)
python -m app.cli create "2D карточный рогалик" --provider local

# Интерактивный режим (мастер вопросов)
python -m app.cli create --interactive
```

### 2. Тестирование подключения провайдеров

```bash
# Проверка AGY CLI
python -m app.cli test-provider agy

# Проверка OpenCode Go
python -m app.cli test-provider opencode
```

### 3. Инкрементальная регенерация

```bash
# Перегенерировать документацию
python -m app.cli rebuild-docs 3d_gladiator_roguelike

# Перегенерировать финальный промпт
python -m app.cli rebuild-prompt 3d_gladiator_roguelike

# Перегенерировать концепт-превью
python -m app.cli preview 3d_gladiator_roguelike

# Перегенерировать отдельную секцию
python -m app.cli rebuild 3d_gladiator_roguelike --section monetization
```

### 4. Список проектов и валидация

```bash
# Список проектов
python -m app.cli list

# Валидация пакета
python -m app.cli validate 3d_gladiator_roguelike
```
