from pathlib import Path
from typing import Dict, Callable
from app import fidelity
from app.context import GenerationContext
from app.logging import log_agent, log_success
from agents.prompt_compiler import PromptCompilerAgent
from agents.ux_designer import normalize_screens as _normalize_screens

class DocumentGenerator:
    """Generates the full suite of specialized Game Development Documents in Markdown."""

    def generate_all(self, ctx: GenerationContext):
        log_agent("DocumentGenerator", f"Rendering full specification suite in {ctx.game_dir}")
        generators: Dict[str, Callable[[GenerationContext], str]] = {
            "README.md": self._gen_readme,
            "PROJECT_DIRECTION.md": self._gen_direction,
            "GAME_DESIGN_DOCUMENT.md": self._gen_gdd,
            "ACCEPTANCE.md": self._gen_acceptance,
            "GAMEPLAY_SPECIFICATION.md": self._gen_gameplay,
            "CORE_LOOP.md": self._gen_core_loop,
            "MECHANICS.md": self._gen_mechanics,
            "PROGRESSION.md": self._gen_progression,
            "LEVEL_DESIGN.md": self._gen_level_design,
            "DIFFICULTY_DESIGN.md": self._gen_difficulty,
            "TECHNICAL_SPECIFICATION.md": self._gen_tech_spec,
            "ARCHITECTURE_DOCUMENT.md": self._gen_architecture,
            "THREEJS_ARCHITECTURE.md": self._gen_renderer_arch,
            "ART_DIRECTION.md": self._gen_art_direction,
            "UI_UX_SPECIFICATION.md": self._gen_ui_ux,
            "MOBILE_CONTROLS.md": self._gen_mobile_controls,
            "AUDIO_DESIGN.md": self._gen_audio,
            "MONETIZATION.md": self._gen_monetization,
            "PLAYGAMA_INTEGRATION.md": self._gen_playgama,
            "PERFORMANCE.md": self._gen_performance,
            "QA_PLAN.md": self._gen_qa_plan,
            "DEVELOPMENT_ROADMAP.md": self._gen_roadmap,
            "REFERENCE_ANALYSIS.md": self._gen_references,
            "RISKS.md": self._gen_risks,
        }
        # Слой Design OS (обещание игроку, допущения, плотность впечатлений,
        # телеметрия, план валидации, решения и ворота) отключён флагом

        for filename, gen_fn in generators.items():
            content = gen_fn(ctx)
            file_path = ctx.game_dir / filename
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content.strip() + "\n")
            ctx.generated_files.append(file_path)

        log_success(f"Successfully rendered {len(generators)} specification documents.")

    def _gen_direction(self, ctx: GenerationContext) -> str:
        """Решение о том, чем стал проект, и какие знания он получил.

        Документ существует, чтобы решение было видно человеку: раньше выбор
        направления не принимался вовсе, а состав базы знаний был зашит в код,
        и проверить, почему игра вышла похожей на предыдущую, было негде."""
        c = ctx.concept
        d = c.direction
        plan = c.knowledge_plan

        options = "\n\n".join(
            f"### {o.id or '—'}. {o.name}"
            f"\n- **Питч**: {o.pitch}"
            f"\n- **Глагол игрока**: {o.core_verb}"
            f"\n- **Форма сессии**: {o.session_shape}"
            f"\n- **Камера**: {o.camera}"
            f"\n- **Управление**: {o.control_scheme}"
            f"\n- **Мир**: {o.world}"
            f"\n- **Чем не сводится к шаблону**: {o.why_not_generic}"
            f"\n- **Главный риск**: {o.biggest_risk}"
            f"\n- **Объём работ**: {o.production_cost}"
            + (f"\n- **Выбрано**: да" if o.id == d.selected_id else "")
            for o in d.options
        ) or "_Варианты не сформированы: ИИ-провайдер был недоступен на этом прогоне._"

        bans = "\n".join(f"- {item}" for item in d.what_it_is_not) or "- (запреты не заданы)"
        musts = "\n".join(f"- {item}" for item in d.non_negotiables) or "- (не задано)"
        rejected = "\n".join(f"- {item}" for item in d.rejected_reasons) or "- (не задано)"

        knowledge_rows = "\n".join(
            f"| `{sel.path}` | {sel.role} | {sel.reason} |" for sel in plan.selections
        ) or "| — | — | план знаний не сформирован |"
        not_included = ", ".join(f"`{r}`" for r in plan.rejected) or "—"

        return f"""# Направление проекта: {c.title}

> Этот документ фиксирует, ЧЕМ проект решено сделать и чем он сознательно НЕ является.
> Все остальные документы спецификации написаны внутри этой рамки.

---

## 1. Выбранное направление

- **Направление**: {d.selected_name or '—'}
- **Почему именно оно**: {d.selection_reason or '—'}
- **Узнаваемая сцена**: {d.signature_scene or '—'}

### Без чего проект перестаёт быть собой
{musts}

### Чем этот проект НЕ является
{bans}

Запреты действуют на всю разработку: если поле спецификации где-то умалчивает,
недостающее достраивается в духе направления, а не в духе жанрового шаблона.

---

## 2. Рассмотренные направления

{options}

### Почему отвергнуты остальные
{rejected}

---

## 3. Знания, отобранные под проект

{plan.summary or '_Сводка не задана._'}

| Документ | Роль | Зачем этой игре |
| --- | --- | --- |
{knowledge_rows}

- **Архетип петли**: {f'`{plan.loop_pattern}`' if plan.loop_pattern else 'собственная петля, архетип не подошёл'}
- **Осознанно не включены**: {not_included}
- **Почему**: {plan.rejection_reason or '—'}

Платформенные документы (Playgama Bridge, модерация, локализация, тач-управление)
подключаются всегда и в выбор не входят.
"""

    def _gen_readme(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        return f"""# {c.title} 🎮

> **{c.elevator_pitch}**

---

## 🌟 Project Overview
- **Genre**: {c.genre} ({c.subgenre})
- **Renderer**: **{c.tech_spec.renderer.upper()}** + {c.tech_spec.physics_engine}
- **Platform**: {c.platform}
- **Orientation**: {c.orientation.capitalize()}
- **Target Audience**: {c.target_audience}
- **Core Hook**: {c.hook}

---

## 📁 Package Directory Map
```text
workspace/{c.slug}/
├── AGENTS.md                        # Инструкция для ИИ-агента (пишет фабрика)
├── ACCEPTANCE.md                    # Приёмка: пронумерованные проверки готовности
├── AI_DEVELOPER_PROMPT.md           # Definitive master prompt for coding agent
├── balance.yaml                     # Числа игры: код читает их отсюда
├── scripts/check-spec.mjs           # Статическая часть приёмки, без зависимостей
├── scripts/smoke.mjs                # Сборка, запуск в браузере и проверка ввода
├── DEVLOG.md                        # Журнал разработки, ведёт кодовый агент
├── CHANGELOG.md                     # Changelog проекта, ведёт кодовый агент
├── GAME_DATA.yaml                   # Machine-readable game metadata
├── GAME_DESIGN_DOCUMENT.md          # Vision, player fantasy, game design
├── GAMEPLAY_SPECIFICATION.md        # Combat, movement, spawning formulas
├── TECHNICAL_SPECIFICATION.md       # TypeScript, Vite, physics, rendering
├── ARCHITECTURE_DOCUMENT.md         # Module hierarchy, system layer flow
├── PLAYGAMA_INTEGRATION.md          # Ads, Cloud Save, Leaderboards, SDK
├── MONETIZATION.md                  # Rewarded & Interstitial ad architecture
├── preview/
│   └── concept_preview.png          # Gameplay visual concept mockup
└── skills/
    ├── GAME_SKILL.md                # Game domain instructions
    ├── GAMEPLAY_SKILL.md            # Physics & combat coding rules
    ├── RENDERER_SKILL.md            # WebGL / Three.js performance guide
    ├── PLAYGAMA_SKILL.md            # Bridge SDK implementation guide
    └── CONTROLS_SKILL.md            # Тач- и десктоп-управление
```

---

## 🚀 How to Develop this Game
1. Open `AI_DEVELOPER_PROMPT.md`.
2. Feed the prompt into your AI coding assistant (Cursor / Antigravity / Claude).
3. Follow the 5-phase roadmap in `DEVELOPMENT_ROADMAP.md`.
4. Run `npm install && npm run dev` and check the game in the factory's built-in browser.
5. Keep `DEVLOG.md` and `CHANGELOG.md` updated after every work session.
6. Verify every deliverable against the **Definition of Done**.
"""

    @staticmethod
    def _knowledge_checklists(concept) -> str:
        """Чек-листы отобранных документов — как пункты приёмки, а не как совет.

        Пункты уже едут в мастер-промпт рядом с адресом документа, и там же
        стоит просьба закрыть их или объяснить отказ. Ровно этот механизм —
        «агенту сказали» — один раз уже провалился: документ на 726 строк
        доехал в пакет, был назван в промпте и не был открыт. Просьба, которую
        никто не проверяет, ничем не отличается от отсутствия просьбы.

        Поэтому пункты дублируются сюда: приёмка живёт в файле, переживает
        контекст агента и проверяется `check-spec`, который требует у каждого
        пункта отметку — сделано либо отказ с причиной."""
        from app import knowledge

        paths = []
        for selection in concept.knowledge_plan.selections:
            if selection.role == "core":
                paths.append(selection.path)
        for rel in knowledge.MANDATORY_TOPICS:
            if rel not in paths:
                paths.append(rel)

        blocks = []
        for path in paths:
            items = knowledge.checklist(path)
            if not items:
                continue
            rows = "\n".join(f"- [ ] {item}" for item in items)
            blocks.append(f"### `{path}`\n\n{rows}")

        if not blocks:
            return (
                "_У отобранных документов чек-листов нет: соберите их командой_ "
                "`python -m app.cli checklists` _на фабрике._"
            )

        head = (
            "Каждый пункт ниже — уже починенная кем-то ошибка, взятая из документа базы\n"
            "дословно. Пункты проверяются взглядом на запущенную игру.\n\n"
            "**Отметить обязан каждый.** `- [x]` — сделано. Пункт, который в этой игре не\n"
            "нужен, помечается `- [~]` и строкой причины сразу после него: «не делаем,\n"
            "потому что …». Оставленный пустым `- [ ]` считается невыполненным, и\n"
            "`check-spec` не даст закрыть проект."
        )
        return head + "\n\n" + "\n\n".join(blocks)

    def _gen_acceptance(self, ctx: GenerationContext) -> str:
        """Приёмка проекта — проверками, а не обещаниями.

        Definition of Done в мастер-промпте занимал меньше процента объёма и
        состоял из фраз вида «Playgama Bridge полностью интегрирован». Проверить
        такое нельзя, а значит кодовый агент не может узнать, закончил он или
        нет, и отчитывается о готовности по ощущению. Здесь каждый пункт — либо
        команда с ожидаемым результатом, либо наблюдаемый факт, и у каждого есть
        номер, на который ссылаются фазы роадмапа."""
        c = ctx.concept
        ui = c.ui_ux

        # Пункты геймплея живут в разделе D и нумеруются буквой своего раздела.
        # Раньше они шли под «G» — буквой, которой в документе не было, а строка
        # отчёта при этом просила «D1–D5». С появлением раздела G это стало ещё
        # и столкновением: два разных пункта с номером G1 в одном файле.
        gameplay = []
        for index, mechanic in enumerate(c.mechanics[:8], start=1):
            check = mechanic.player_interaction or mechanic.description or mechanic.name
            gameplay.append(f"- [ ] **D{index}** · {mechanic.name}: {check}")
        if c.win_conditions:
            gameplay.append(f"- [ ] **D{len(gameplay) + 1}** · Условие успеха срабатывает: {c.win_conditions}")
        if c.lose_conditions:
            gameplay.append(f"- [ ] **D{len(gameplay) + 1}** · Условие проигрыша срабатывает: {c.lose_conditions}")
        gameplay_md = "\\n".join(gameplay) or "- [ ] **D1** · Петля игры проходится целиком (см. CORE_LOOP.md)."

        screens = ", ".join(
            (s.get("id") or "").strip() for s in _normalize_screens(ui.screens) if s.get("id")
        ) or "main_menu, gameplay, session_end"

        knowledge_checklists = self._knowledge_checklists(c)
        # Заказ идёт нулевым разделом — раньше всего остального. Пункт «игра
        # осталась шутером от первого лица» не проверяется скриптом, но именно
        # он отделяет выполненную работу от красиво сделанной чужой игры.
        order_items = fidelity.acceptance_items(c.raw_prompt)
        order_block = ""
        if order_items:
            order_block = (
                "## 0. Заказ\n\n"
                "Пользователь назвал жанр и главное действие сам. Это не пожелание, "
                "а рамка задачи: игра, не прошедшая этот раздел, не принимается, "
                "насколько бы хороша она ни была сама по себе.\n\n"
                + "\n".join(f"- [ ] **O{n}** · {item}" for n, item in enumerate(order_items, start=1))
                + "\n\n---\n\n"
            )

        boards = c.playgama.leaderboards[0] if c.playgama.leaderboards else "таблица лидеров не используется"
        save_key = c.playgama.cloud_save_keys[0] if c.playgama.cloud_save_keys else f"{c.slug}_save_v1"
        rewarded = c.monetization.rewarded_placements[0].name if c.monetization.rewarded_placements else "rewarded-награда"

        return f"""# Приёмка: {c.title}

Готовность игры определяется этим файлом, а не ощущением. Каждый пункт — либо
команда с ожидаемым результатом, либо факт, который видно на экране. Пока хотя
бы один пункт разделов **0–C** красный, игра не готова. Раздел **0** — то, что
пользователь заказал: игра, не прошедшая его, не принимается вообще, какой бы
удачной она ни вышла сама по себе. Разделы **A–C** — работоспособность, а не
качество.

Автоматическая часть запускается одной командой:

```bash
node scripts/check-spec.mjs        # или npm run check:spec
node scripts/smoke.mjs             # или npm run smoke — единственная проверка, которая открывает игру
```

Скрипт лежит в проекте и проверяет то, что проверяется статически. Остальное —
руками, по этому же списку. Результат прогона записывается в `DEVLOG.md`.

---

{order_block}## A. Сборка и типы

- [ ] **A1** · `npm run build` завершается с кодом 0 и без единой ошибки TypeScript. Проверяется `smoke`.
- [ ] **A2** · Игра открывается без единой ошибки в консоли браузера. Проверяется `smoke`.
- [ ] **A3** · В `src/` нет `TODO`, `FIXME` и заглушек вида `throw new Error('not implemented')`. Проверяется `check-spec`.
- [ ] **A4** · `dist/` собран из текущего `src/`: сборка выполнена после последней правки.
- [ ] **A5** · Каждый импорт не-кода (`.css`, `.glsl`, `.png`) объявлен: в `src/` лежит `vite-env.d.ts` со
  ссылкой `/// <reference types="vite/client" />` или собственное `declare module`. TypeScript 5.x
  пропускает такой импорт молча, TypeScript 6 роняет на нём сборку (`TS2882`) — файл пишется один раз
  и снимает вопрос, почему релиз вдруг перестал собираться. Проверяется `check-spec`.

## A'. Дымовой запуск

Единственная часть приёмки, которая открывает игру, а не читает исходники.
Запускается `node scripts/smoke.mjs` (или `npm run smoke`) и обязана быть
зелёной перед сдачей: пакет, прошедший всю статику и не запускающийся, уже
случался.

- [ ] **S1** · Сборка проходит.
- [ ] **S2** · Игра открывается: ни одной ошибки в консоли, ни одного необработанного исключения.
- [ ] **S3** · Игровой цикл идёт: кадры считаются и не останавливаются после ввода.
- [ ] **S4** · В кадр что-то попадает: контекст WebGL создан, вызовы отрисовки идут. Чёрный экран — это провал.
- [ ] **S5** · Игра пережила ввод: клавиши, мышь и палец не роняют её.
- [ ] **S6** · На телефоне 390×844 ничего не разъехалось: горизонтальной полосы нет, сцена рисуется.
- [ ] **S7** · Интерфейс появился: поверх сцены есть кнопки и текст. Пустые слои интерфейсом не считаются —
  экраны, созданные в памяти и не вставленные в документ, выглядят как игра без меню.

## B. Интерфейс

- [ ] **B1** · Ни одного литерала цвета вне темы: `grep -rE '#[0-9a-fA-F]{{3,8}}' src/ui --exclude=theme.css` — пусто.
- [ ] **B2** · Ни одного эмодзи в интерфейсе: иконки — инлайновый SVG с `currentColor`.
- [ ] **B3** · Ни `alert`, ни `confirm`, ни `prompt` в `src/`.
- [ ] **B4** · Ни одного `z-index` мимо токенов `--z-*`.
- [ ] **B5** · За меню видна живая игровая сцена: у корня экрана меню нет непрозрачного фона, канвас не перекрыт.
- [ ] **B6** · Перетаскивание по центру канваса управляет игрой: ни один слой не съел указатель (контейнеры `pointer-events: none`).
- [ ] **B7** · Страница не скроллится: после свайпа `document.scrollingElement.scrollTop === 0`.
- [ ] **B8** · Каждая видимая кнопка ≥ 64 px по короткой стороне, основная ≥ 96 px.
- [ ] **B9** · Экраны проекта существуют и переключаются по одному: {screens}.
- [ ] **B10** · Скрытый экран — `display: none`: после перехода ни один его элемент не ловит нажатие.
- [ ] **B11** · Числа HUD не дёргают строку: `tabular-nums` в слоте фиксированной ширины.
- [ ] **B12** · На 360×640 и 1280×720 нет обрезанного текста и нет полосы прокрутки.

## C. Платформа Playgama

Без этого раздела игра не запускается на площадке — не «работает хуже», а не
стартует и снимается с модерации.

- [ ] **C1** · `game_ready` отправляется РОВНО ОДИН РАЗ и только после загрузки, когда меню уже интерактивно.
- [ ] **C2** · `bridge.initialize()` обёрнут таймаутом (~10 с), сторожевой таймер (~15 с) отправляет `game_ready` в любом случае.
- [ ] **C3** · Прогресс загрузки идёт от реальных вех, заставка доходит до 100% до `game_ready`.
- [ ] **C4** · Ни один шаг загрузки не ждёт решения игрока: `authorize()` в загрузке отсутствует.
- [ ] **C5** · Сохранение — один ключ (`{save_key}`), один JSON, нормализация при чтении; битый сейв поднимается на умолчаниях.
- [ ] **C6** · Награда за rewarded выдаётся только по `state === 'rewarded'` ({rewarded}), слушатель снимается через `off()`, повторный клик не платит дважды.
- [ ] **C7** · Interstitial не показывается при старте, в середине геймплея и сразу после покупки; пауза между показами соблюдена.
- [ ] **C8** · Пауза и звук приходят из событий моста (`PAUSE_STATE_CHANGED` / `AUDIO_STATE_CHANGED`), дельта времени сбрасывается при возврате.
- [ ] **C9** · Возможность, которой на площадке нет, не нарисована вовсе — не серой кнопкой и не ошибкой по нажатию. Проверяется подменой флага ({boards}).
- [ ] **C10** · Покупки: `getPurchases()` при каждом запуске, сначала выдача, потом `consumePurchase(productId)`.
- [ ] **C11** · Игра проверена в фрейме площадки и гостем, и авторизованным.
- [ ] **C12** · `public/playgama-bridge-config.json` лежит в сборке: без него `bridge.initialize()`
  получает 404 и площадка не отвечает. Проверяется `check-spec`.

## D. Геймплей

Это игра, а не движок: пункты ниже проверяются игрой руками.

{gameplay_md}

## E. Производительность

- [ ] **E1** · 60 FPS на десктопе и не ниже 50 FPS на телефоне среднего класса.
- [ ] **E2** · Вызовов отрисовки не больше {c.tech_spec.max_draw_calls}, треугольников не больше {c.tech_spec.max_triangles_or_sprites}.
- [ ] **E3** · Размер сборки не больше {c.tech_spec.bundle_size_budget_mb} МБ.
- [ ] **E4** · В кадре нет аллокаций: пулы вместо создания объектов, никакого `new` в цикле обновления.
- [ ] **E5** · Адаптивное качество сходится: на слабом устройстве качество падает и потом поднимается, а не скачет.

---

## F. Дизайн и готовый код

- [ ] **F1** · `DESIGN.md` написан до кода и раскрывает палитру, камеру, экраны и сцену за меню. Проверяется `check-spec`.
- [ ] **F2** · В `DEVLOG.md` записано, что взято из готового кода фабрики (`LIBRARY.md`) и что писалось с нуля — с причиной. Проверяется `check-spec`.
- [ ] **F3** · Механика, для которой в каталоге есть готовый модуль, не написана заново без записанной причины.
- [ ] **F4** · `node scripts/fetch-knowledge.mjs` отработал, `docs/ref/` не пуст, обязательные файлы на месте.

---

## G. Объявлено — значит подключено

Разобранный готовый шутер прошёл всю приёмку целиком и при этом не запускался
на телефоне: слой тач-управления был собран и ни разу не вставлен в документ.
Рядом лежали два пустых модуля из контракта архитектуры, событие, которое никто
не слушает, и посчитанный масштаб интерфейса, который не читает ни одно правило
CSS. Ни один из этих дефектов не виден в отчёте о готовности — их ловит только
проверка. Раздел не знает жанра: он про разрыв между «написал» и «включил».

- [ ] **G1** · Ни одного пустого модуля: файл из контракта архитектуры либо написан, либо удалён. Проверяется `check-spec`.
- [ ] **G2** · У каждого события шины есть и отправитель, и слушатель. Проверяется `check-spec`.
- [ ] **G3** · Каждое состояние, уходящее в шину, где-то разбирается — включая паузу и мьют от площадки. Проверяется `check-spec`.
- [ ] **G4** · Слой тач-управления вставлен в DOM и виден на телефоне. Проверяется `check-spec`.
- [ ] **G5** · Числа из `balance.yaml` доехали до кода, а не придуманы заново. Проверяется `check-spec`.
- [ ] **G6** · Переменная, посчитанная в JS, читается хотя бы одним правилом CSS. Проверяется `check-spec`.
- [ ] **G7** · В вёрстке есть брейкпоинты; интерфейс проверен на 360 px и в обеих ориентациях. Проверяется `check-spec`.
- [ ] **G8** · Каждый глагол игрока из таблицы управления в `DESIGN.md` имеет клавишу, кнопку и видимый отклик.
- [ ] **G9** · Вертикаль (прыжок, присед, тихий шаг) либо реализована, либо её отсутствие объяснено в `DESIGN.md`, и уровень её не обещает.
- [ ] **G10** · Публичный метод сервиса, который никто не вызывает, — либо подключён, либо удалён.
- [ ] **G11** · Схем управления две — клавиатура с мышью и экранная, — и активную выбирает `bridge.device.type`, а не догадки браузера. Проверяется `check-spec`.
- [ ] **G12** · Pointer lock запрашивается только в десктопной схеме. Проверяется `check-spec`.
- [ ] **G13** · `?input=touch` и `?input=desktop` показывают обе раскладки на одной машине; неактивной схемы нет в DOM, её подсказки не видны.

---

## H. Чек-листы отобранных документов базы знаний

{knowledge_checklists}

---

## Как отчитываться

Прогон приёмки записывается в `DEVLOG.md` строкой вида:

```text
2026-01-01 приёмка: O1 ✅, A1–A5 ✅, S1–S7 ✅, B1–B12 ✅, C1–C12 ✅, D1–D5 ✅, E1–E5 частично (E1 на телефоне 48 FPS), F1–F4 ✅, G1–G13 ✅, H1 ✅ (2 осознанных отказа)
```

Пункт, который не проходит, честнее оставить красным с объяснением, чем
отметить зелёным: следующий, кто откроет проект, будет считать его проверенным.
"""

    def _gen_gdd(self, ctx: GenerationContext) -> str:
        """Game Design Document.

        Разделы «оценки», «действия игрока» и «прогрессия» раньше были зашиты
        английским шаблоном: «3-Choice card draft upon wave clear», «Highest wave
        reached», «Upgrade synergy cascades». Текст печатался в любую игру — и в
        тактический штурм, где направление проекта прямым текстом запрещало и
        волны, и карты апгрейда. Кодовый агент читает GDD наравне с мастер-
        промптом, то есть получал одновременно запрет и требование. Теперь все
        три раздела собираются из самой концепции, а пустое поле честно
        отсылает к своему документу, а не подменяется жанровым шаблоном."""
        c = ctx.concept
        scores_table = f"""| Категория | Оценка / 10 |
| :--- | :--- |
| Ощущение от игры (fun & game feel) | {c.scores.fun}/10 |
| Оригинальность | {c.scores.originality}/10 |
| Реиграбельность | {c.scores.replayability}/10 |
| Пригодность для телефона | {c.scores.mobile_fit}/10 |
| Монетизация | {c.scores.monetization}/10 |
| Соответствие площадкам | {c.scores.platform_fit}/10 |
"""
        return f"""# Game Design Document (GDD): {c.title}

## 1. Executive Summary & Vision
- **Title**: {c.title}
- **Vision Statement**: {c.vision}
- **Elevator Pitch**: {c.elevator_pitch}
- **Genre**: {c.genre} ({c.subgenre})
- **Target Audience**: {c.target_audience}

## 2. Оценка концепции
{scores_table}
*Взвешенная оценка*: **{c.scores.overall_score:.1f} / 10**

{c.scores.justification or "_Обоснование оценок не задано._"}

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: {c.player_fantasy}
- **Core Hook**: {c.hook}
- **Unique Value Proposition**: {c.unique_value_proposition}

## 4. Session Model & Game Loop
- **Session Duration**: {c.session_model}
- **Core Gameplay Loop**:
```text
{c.core_loop}
```
- **Win Conditions**: {c.win_conditions}
- **Lose Conditions**: {c.lose_conditions}

## 5. Что игрок делает руками
{self._gdd_actions(c)}

## 6. Прогрессия и причины вернуться
{self._gdd_progression(c)}
"""

    @staticmethod
    def _gdd_actions(c) -> str:
        """Действия игрока — из механик этой игры, а не из шаблона жанра."""
        lines = []
        for mechanic in c.mechanics[:6]:
            interaction = (mechanic.player_interaction or mechanic.description or "").strip()
            if mechanic.name and interaction:
                lines.append(f"- **{mechanic.name}**: {interaction}")
        if c.ui_ux.mobile_controls_layout:
            lines.append(f"- **Телефон**: {c.ui_ux.mobile_controls_layout}")
        if c.ui_ux.desktop_controls_layout:
            lines.append(f"- **ПК**: {c.ui_ux.desktop_controls_layout}")
        keys = c.ui_ux.keyboard_controls or {}
        if keys:
            bound = ", ".join(f"`{key}` — {action}" for key, action in list(keys.items())[:8])
            lines.append(f"- **Клавиатура и мышь**: {bound}")
        return "\n".join(lines) or (
            "_Раскладка задаётся в MOBILE_CONTROLS.md, ввод каждой механики — в MECHANICS.md._"
        )

    @staticmethod
    def _gdd_progression(c) -> str:
        """Рост игрока — в терминах этой игры; пустое поле честно отсылает дальше."""
        lines = []
        for item in c.core_design.run_progression[:5]:
            lines.append(f"- **Внутри сессии**: {item}")
        for item in c.core_design.meta_progression[:5]:
            lines.append(f"- **Между сессиями**: {item}")
        if not lines and c.progression_summary:
            lines.append(f"- {c.progression_summary}")
        if c.difficulty_curve:
            lines.append(f"- **Кривая давления**: {c.difficulty_curve}")
        for board in c.playgama.leaderboards[:3]:
            lines.append(f"- **Таблица лидеров**: {board}")
        return "\n".join(lines) or "_Прогрессия задаётся в PROGRESSION.md._"

    def _gen_gameplay(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        systems_md = ""
        for s in c.gameplay_systems:
            rules_str = "\n".join([f"  - {r}" for r in s.rules]) if s.rules else "  - Standard system rules apply."
            state_str = ", ".join(s.state) if s.state else "IDLE, ACTIVE, COOLDOWN"
            edge_str = "\n".join([f"  - {e}" for e in s.edge_cases]) if s.edge_cases else "  - Graceful fallback on input loss."
            systems_md += f"""### System: {s.name}
- **Purpose**: {s.purpose}
- **Input Channels**: {s.input}
- **Core Rules**:
{rules_str}
- **Internal States**: `{state_str}`
- **System Interactions**: {s.interactions}
- **Hit & Sensory Feedback**: {s.feedback}
- **Edge Cases & Handling**:
{edge_str}

"""
        # Формулы приходят из ядра, спроектированного под эту игру. Универсальная
        # формула урона остаётся только как заглушка для проектов без ядра.
        core = c.core_design
        formulas_md = "\n".join(f"- `{f}`" for f in core.core_formulas) or (
            "- `Эффект = БазоваяСила × КачествоИсполнения × (1 + НакопленныйБонус)`\n"
            "- `СложностьЭтапа(n) = База × (1 + 0.18 × n)`"
        )
        params_rows = [
            f"| {d.name} | {p.name} | `{p.value}` | {p.tuning_note} |"
            for d in core.mechanics
            for p in d.parameters
        ]
        params_md = (
            "| Механика | Параметр | Значение | Что сломается при изменении |\n"
            "| :--- | :--- | :--- | :--- |\n" + "\n".join(params_rows)
        ) if params_rows else "Числовые параметры механик не заданы — см. MECHANICS.md."

        return f"""# Gameplay Specification: {c.title}

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `{c.title}`.

---

## 2. Gameplay Systems
{systems_md if systems_md else "Standard gameplay loop systems."}

## 3. Формулы и числа этой игры
{formulas_md}

## 4. Параметры механик (значения по умолчанию)
{params_md}
"""

    # ------------------------------------------------------------------
    # Ядро игры. Эти три документа раньше были одинаковым шаблоном во всех
    # проектах; теперь они рендерятся из CoreDesignSpec, который агент механик
    # проектирует под конкретную игру. Шаблонный текст остаётся только как
    # аварийная заглушка, если ядро не заполнено.
    # ------------------------------------------------------------------

    @staticmethod
    def _loop_table(steps) -> str:
        if not steps:
            return ""
        rows = "\n".join(
            f"| {s.step} | {s.player_action} | {s.game_response} | {s.decision} | {s.duration} |"
            for s in steps
        )
        return (
            "| Шаг | Действие игрока | Ответ игры | Решение игрока | Длительность |\n"
            "| :--- | :--- | :--- | :--- | :--- |\n" + rows
        )

    def _gen_core_loop(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        core = c.core_design
        micro = self._loop_table(core.micro_loop)
        meso = self._loop_table(core.meso_loop)
        macro = self._loop_table(core.macro_loop)
        diagram = core.loop_diagram.strip() or f"{c.core_loop}"
        formulas = "\n".join(f"- `{f}`" for f in core.core_formulas) or "- Формулы ядра не заданы."

        return f"""# Core Loop Design: {c.title}

## 1. Чем эта петля отличается
- **Фирменный момент**: {core.signature_moment or c.hook}
- **Отличие от жанрового шаблона**: {core.what_makes_it_different or c.unique_value_proposition}
- **Сознательно НЕ берём**: {core.genre_template_rejected or "—"}

---

## 2. Схема петли
```text
{diagram}
```

---

## 3. Микро-петля (посекундно)
{micro or "- " + (c.core_loop or "Микро-петля не детализирована.")}

---

## 4. Мезо-петля (этап за этапом)
{meso or "- Мезо-петля не детализирована."}

---

## 5. Макро-петля (забег за забегом)
{macro or "- Макро-петля не детализирована."}

---

## 6. Кривая напряжения
{core.tension_curve or c.difficulty_curve or "Кривая напряжения не задана."}

---

## 7. Формулы ядра
{formulas}
"""

    def _gen_mechanics(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        deep_by_name = {d.name.strip().lower(): d for d in c.core_design.mechanics if d.name}
        mechanics_md = ""
        for m in c.mechanics:
            strengths_str = ", ".join(m.strengths) if m.strengths else "Высокая вовлечённость"
            weaknesses_str = ", ".join(m.weaknesses) if m.weaknesses else "Требует точного тайминга"
            mechanics_md += f"""## Механика: {m.name} ({m.priority.upper()})
- **Категория**: {m.category}
- **Описание**: {m.description}
- **Взаимодействие игрока**: {m.player_interaction}
- **Отклик**: {m.feedback}
- **Техническая сложность**: {m.technical_complexity}
- **Сильные стороны**: {strengths_str}
- **На что смотреть**: {weaknesses_str}
{self._mechanic_depth(deep_by_name.get(m.name.strip().lower()))}
---

"""
        # Механики, которые архитектор добавил сверх исходного списка концепции.
        extra = [
            d for d in c.core_design.mechanics
            if d.name and d.name.strip().lower() not in {m.name.strip().lower() for m in c.mechanics}
        ]
        for d in extra:
            mechanics_md += f"""## Механика: {d.name} (ДОБАВЛЕНА АРХИТЕКТОРОМ)
- **Роль в петле**: {d.role_in_loop}
{self._mechanic_depth(d)}
---

"""
        return f"""# Mechanics Catalog: {c.title}

> Каждая механика описана до уровня, на котором её можно реализовать без
> додумывания: решение игрока, числа, состояния, режим отказа и сопротивление игры.

{mechanics_md if mechanics_md else "Механики ядра не заданы."}
"""

    @staticmethod
    def _mechanic_depth(d) -> str:
        """Блок глубины механики; пустая строка, если ядро не заполнено."""
        if d is None:
            return ""
        params = "\n".join(
            f"  - **{p.name}**: `{p.value}` — {p.tuning_note}" for p in d.parameters
        ) or "  - Числовые параметры не заданы."
        states = ", ".join(f"`{s}`" for s in d.states) or "`READY`, `ACTIVE`, `RECOVERY`"
        feedback = "\n".join(f"  - {f}" for f in d.feedback_layers) or "  - Слои отклика не заданы."
        synergies = "\n".join(f"  - {s}" for s in d.synergies) or "  - Связи не заданы."
        pseudocode = f"""
- **Псевдокод тика**:
```text
{d.pseudocode.strip()}
```""" if d.pseudocode.strip() else ""
        return f"""
### Глубина механики
- **Роль в петле**: {d.role_in_loop}
- **Решение игрока**: {d.player_decision}
- **Управление**: {d.input_mapping}
- **Состояния**: {states}
- **Параметры и настройка**:
{params}
- **Слои отклика**:
{feedback}
- **Режим отказа**: {d.failure_mode}
- **Кривая мастерства**: {d.mastery_curve}
- **Сопротивление игры**: {d.counterplay}
- **Синергии**:
{synergies}
- **Почему это не жанровый шаблон**: {d.why_unique}{pseudocode}
"""

    def _gen_progression(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        core = c.core_design
        run_items = "\n".join(f"- {item}" for item in core.run_progression)
        meta_items = "\n".join(f"- {item}" for item in core.meta_progression)
        if not run_items:
            run_items = (
                "- Рост силы внутри забега идёт через основную механику игры.\n"
                "- Не более трёх активных усилений одновременно, чтобы экран оставался читаемым."
            )
        if not meta_items:
            meta_items = (
                f"- {c.progression_summary or 'Между забегами открываются новые способы играть.'}\n"
                "- Прогресс сохраняется через Playgama Cloud Save и виден при возвращении."
            )
        return f"""# Progression & Economy: {c.title}

## 1. Прогрессия внутри забега
{run_items}

## 2. Мета-прогрессия между забегами
{meta_items}

## 3. Правила экономики
- Любая награда объясняется игроку в момент выдачи, без отдельного экрана обучения.
- Ни одно усиление не отменяет главный крючок «{c.hook}» — иначе петля схлопывается.
- Валюта и открытия хранятся в облаке платформы; локальное хранилище — только кэш.
"""

    def _gen_level_design(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        return f"""# Level & Arena Design: {c.title}

## 1. Arena Layout & Geometry
- **Floor Material**: High-contrast textured ground with dynamic decals.
- **Perimeter**: Perimeter bounds and boundary collision walls.
- **Hazard Zones**:
  - Central tactical cover.
  - Perimeter traps and dynamic obstacles.

## 2. Environmental Pacing
- **Early Waves**: Clear arena floor, basic enemy groups.
- **Mid Waves**: Hazards activate, armored elite units appear.
- **Climax Waves**: Boss encounter with dynamic arena events.
"""

    def _gen_difficulty(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        return f"""# Difficulty Design & Balancing: {c.title}

## 1. Difficulty Scaling Curve
- **Wave 1**: Introductory tier (Low aggression, teaches basic mechanics).
- **Wave 2-4**: Combined enemy types (fast rushers + ranged harassers).
- **Wave 5**: Mini-Boss milestone.
- **Wave 6-9**: High density swarms with environmental hazards.
- **Wave 10**: Apex Boss encounter with multi-phase attacks.

## 2. Dynamic Catch-Up Mechanisms
- Critical HP triggers increased special charge rate for comeback potential.
- Guaranteed recovery pickups on crate destructions during critical health.
"""

    def _gen_tech_spec(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        return f"""# Technical Specification: {c.title}

## 1. Technology Matrix
- **Language**: {c.tech_spec.language}
- **Build Tool**: {c.tech_spec.bundler} (Vite with ESBuild)
- **Renderer**: **{c.tech_spec.renderer.upper()}** ({c.tech_spec.renderer_version})
- **Physics Engine**: **{c.tech_spec.physics_engine}**
- **Audio Engine**: {c.tech_spec.audio_engine}
- **Platform SDK**: `{c.playgama.sdk_version}`

## 2. Hardware & Performance Targets
- **Target Framerate**: 60 FPS on desktop, >= 50 FPS on mid-tier mobile.
- **Maximum Active Draw Calls**: < {c.tech_spec.max_draw_calls}
- **Maximum Triangles in View**: < {c.tech_spec.max_triangles_or_sprites}
- **Initial Download Size**: < {c.tech_spec.bundle_size_budget_mb} MB.
- **Max Memory Footprint**: < 180 MB WebGL heap.
"""

    def _gen_architecture(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        layers_md = "\n".join([
            f"### {layer.get('name', 'Layer') if isinstance(layer, dict) else str(layer)}\n- **Responsibility**: {layer.get('responsibility', layer.get('desc', '')) if isinstance(layer, dict) else ''}"
            for layer in c.tech_spec.layers
        ])
        modules_md = "\n".join([
            f"- **`{m.get('name', 'Module') if isinstance(m, dict) else str(m)}`**: {m.get('desc', m.get('description', m.get('responsibility', ''))) if isinstance(m, dict) else ''}"
            for m in c.tech_spec.modules
        ])
        return f"""# Architecture Document: {c.title}

## 1. System Layers Overview
{layers_md if layers_md else "Standard modular layers."}

## 2. Module Dependency Graph
```text
                    [ src/main.ts ]
                          │
                          ▼
                  [ src/core/Game.ts ]
             ┌────────────┼────────────┐
             ▼            ▼            ▼
     [ GameLoop ]   [ EventBus ]  [ PlaygamaService ]
             │            │            │
             ▼            ▼            ▼
     [ PhysicsWorld ] [ Systems ] [ UIManager ]
             │            │            │
             └────────────┼────────────┘
                          ▼
                 [ SceneManager ]
```

## 3. Detailed Source Modules
{modules_md if modules_md else "Standard module map."}
"""

    def _gen_renderer_arch(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        spatial = "orthograph" not in (c.renderer_reason or "").lower()
        camera = (
            "PerspectiveCamera (fov 55, damped follow)" if spatial
            else "OrthographicCamera (fixed world height, aspect-driven width)"
        )
        graph_2d = """Scene (OrthographicCamera)
├── BackgroundQuad (single plane, gradient/atlas)
├── PropsGroup (static geometry, renderOrder 10)
├── EntityInstancedMesh (one InstancedMesh per atlas, renderOrder 20)
├── VfxPool (additive InstancedMesh, renderOrder 30)
└── DOM overlay (all text and UI — never rendered into the canvas)"""
        graph_3d = """Scene (PerspectiveCamera)
├── DirectionalSunLight (castShadow, tight shadow frustum)
├── HemisphereLight (fill)
├── LevelMesh (merged static geometry + MeshBVH for raycasts)
├── InstancedEnemyMesh / InstancedDebrisMesh
├── VfxPool (pooled additive particles, zero allocation)
└── PlayerGroup (chassis/root + nested child groups per DOF)"""
        return f"""# Three.js Rendering Architecture: {c.title}

The factory ships **Three.js only**. A 2D game is the same scene under an
orthographic camera, not a second renderer.

## 1. Scene Graph
```text
{graph_3d if spatial else graph_2d}
```

**Camera**: {camera}

## 2. Stack
| Layer | Library | Knowledge |
|---|---|---|
| Physics | {c.tech_spec.physics_engine} | `stack/rapier3d.md` |
| Raycast / static collision | three-mesh-bvh | `stack/three_mesh_bvh.md` |
| AI (steering, FSM) | Yuka | `stack/yuka_ai.md` |
| NPC navigation | recast-navigation | `stack/recast_navigation.md` |
| Mass entities | bitECS | `stack/bitecs.md` |
| Post FX | postprocessing | `stack/postprocessing.md` |

Anything in `knowledge/stack/README.md` §1 is taken from the library. Hand-rolled
A*, boids, character controllers or bloom chains are review defects, not optimisations.

## 3. Render Budget
- Draw calls: < 80 mobile, < 150 desktop. Repeated objects go through `InstancedMesh`.
- `pixelRatio` clamped by the adaptive quality tuner (`threejs/adaptive_quality.md`).
- One `EffectPass` for all post effects; the `low` tier renders without a composer.
- Resolution and shadow-map changes are applied **before** `render()` on a rendered frame.
"""

    def _gen_art_direction(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        art = c.art
        palette_md = "\n".join([f"- **{str(k).replace('_', ' ').title()}**: `{v}`" for k, v in art.color_palette.items()]) if isinstance(art.color_palette, dict) else str(art.color_palette)
        vfx_md = "\n".join([f"- {v}" for v in art.vfx_list]) if isinstance(art.vfx_list, list) else str(art.vfx_list)
        return f"""# Art Direction Specification: {c.title}

## 1. Visual Identity & Aesthetic
- **Style Name**: {art.style_name}
- **Camera Perspective**: {art.camera_perspective} (FOV: {art.camera_fov}°, Pitch: {art.camera_pitch_angle}°)
- **Environment Mood**: {art.environment_theme}
- **Character Proportions**: {art.character_proportions}

## 2. Color Palette & Lighting
{palette_md if palette_md else "Палитра под сеттинг игры: высокий контраст игрока к фону, спокойный фон, один акцентный цвет на важные события"}

**Lighting Setup**: {art.lighting_setup}

## 3. Visual Effects (VFX)
{vfx_md if vfx_md else "- Dynamic particle emitters\n- Screen shake feedback"}

## 4. Сцена за меню
Первое, что видит игрок, — это меню. За ним стоит живая сцена на том же
рендерере, а не заливка цветом и не картинка: игрок должен понять, во что он
играет, ещё до нажатия «Играть».

{art.menu_staging or "Постановка не задана — см. UI_UX_SPECIFICATION.md, раздел «Композиция экрана»."}

- **Интерфейс сделан из**: {art.ui_theme or "материала мира игры (см. раздел 1)"}
"""

    def _gen_ui_ux(self, ctx: GenerationContext) -> str:
        """Спецификация интерфейса.

        Прежняя версия документа состояла из трёх абзацев: список HUD, ASCII и
        имена экранов. По ней невозможно собрать интерфейс — только угадать его,
        и угадывался он всегда одинаково. Теперь документ несёт то же, что и
        мастер-промпт: материал, акценты, типографику, компоненты, якоря,
        переходы и состояния экранов."""
        c = ctx.concept
        ui = c.ui_ux
        art = c.art

        hud_md = "\n".join(f"- {h}" for h in ui.hud_elements) if isinstance(ui.hud_elements, list) else str(ui.hud_elements)
        screens_md = self._screens_md(ui.screens)

        accents_md = "\n".join(
            f"| `{name}` | {meaning} |" for name, meaning in ui.accent_roles.items()
        ) if ui.accent_roles else "| `primary` | Главное действие петли |\n| `danger` | Потеря и риск |\n| `neutral` | Служебный интерфейс в покое |"
        anchors_md = "\n".join(
            f"| `{anchor}` | {content} |" for anchor, content in ui.hud_anchors.items()
        ) if ui.hud_anchors else "| `top-right` | Пауза и настройки |"
        components_md = "\n".join(f"- {comp}" for comp in ui.components) or "- Набор компонентов не задан — см. `knowledge/ux/ui_design_system.md`, раздел 6"
        feedback_md = "\n".join(f"- {f}" for f in ui.feedback_moments) or "- Любое нажатие отвечает в том же кадре"
        diegetic_md = "\n".join(f"- {d}" for d in ui.diegetic_elements) or "- Не задано: состояние показывается только через HUD"
        states_md = "\n".join(f"- {st}" for st in ui.state_coverage) or "- Состояния экранов не расписаны — обязательны загрузка, пустота и ошибка"
        # Тема от арт-директора и визуальный язык совпадают, когда UX-агент принял
        # решение арт-дирекции как есть. Печатать одно и то же дважды незачем.
        material_md = f"- **Тема от арт-директора**: {art.ui_theme}" if art.ui_theme else ""
        if ui.visual_language and ui.visual_language != art.ui_theme:
            material_md += ("\n" if material_md else "") + f"- **Визуальный язык**: {ui.visual_language}"
        material_md = material_md or "- Материал интерфейса не задан — см. ART_DIRECTION.md"

        return f"""# UI/UX Specification: {c.title}

## 1. Материал интерфейса
Интерфейс живёт в том же мире, что и сцена. Проверка: если закрыть игровое поле,
меню обязано выдавать именно эту игру, а не любую другую.

{material_md}
- **Типографика**: {ui.typography or "две гарнитуры: акцидентная на цифры и заголовки, текстовая на подписи"}

## 2. Акценты: один цвет — один смысл
Разный цвет у каждой кнопки «чтобы отличались» — главная ошибка игрового
интерфейса. На одном экране одновременно видно не больше двух акцентов.

| Токен | Единственный смысл |
|---|---|
{accents_md}

Все значения — токенами в `src/ui/theme.css`: цвета, гарнитуры, шкала отступов,
радиусы, длительности, порядок слоёв `--z-*`. Литерал цвета внутри экрана — баг.

## 3. Композиция экрана
Меню и экраны между сессиями лежат ПОВЕРХ живой игровой сцены — той же, что в
игре, только с медленной камерой. Непрозрачная заливка на весь экран запрещена:
подложка только под текстом и кнопками.

- **Сцена за меню**: {art.menu_staging or "живая сцена игры на том же рендерере, медленная камера, свет и эффекты работают"}

Экран — не колонка кнопок по центру. Три зоны, и каждый элемент лежит ровно в одной:

1. **Идентичность** — что это за экран: заголовок, режим, состояние игрока.
2. **Главное действие** — ровно одно на экран, самое крупное и единственное с
   основным акцентом.
3. **Второстепенный ряд** — всё остальное, одним рядом или сеткой, одним весом.

Зоны нажатия: основная ≥ 96 px, остальные ≥ 64 px, зазор ≥ 12 px, отступы через
`env(safe-area-inset-*)` плюс измеренная высота липкого баннера. Ни один экран не
скроллит страницу: длинный список скроллится во внутреннем контейнере.

## 4. Набор компонентов (закрытый)
Всё на экране — один из этих компонентов. Одноразовый `<div>` с инлайновыми
стилями — это то, из-за чего второй экран перестаёт совпадать с первым.

{components_md}

Каждый интерактивный компонент несёт пять состояний: покой, наведение, нажатие,
недоступность, `:focus-visible`; асинхронное действие — ещё и `loading`.

## 5. HUD
Не больше пяти постоянных элементов на телефоне. Пять якорей, посередине экрана
не висит ничего, кроме временной обратной связи.

| Якорь | Что там |
|---|---|
{anchors_md}

Элементы:
{hud_md if hud_md else "- Индикатор состояния главной механики"}

Меняющиеся числа — `tabular-nums` в слоте фиксированной ширины, полосы —
`transform: scaleX()`, а не `width`. Текст поверх геймплея всегда с подложкой или
обводкой: белое число исчезает на светлой сцене.

## 6. Состояние, показанное миром, а не оверлеем
{diegetic_md}

## 7. Каталог экранов
{screens_md if screens_md else "Main Menu, Gameplay HUD, Session End, Settings"}

**Переходы**: {ui.screen_flow or "виден ровно один экран; скрытый убирается через display: none"}

## 8. Состояния экрана
{states_md}

## 9. Отклик и движение
{feedback_md}

Переход один на всю игру и укладывается в 300 мс; анимируются только `transform`
и `opacity`; `prefers-reduced-motion: reduce` убирает трансформации.

## 10. Вайрфрейм игрового экрана
```text
{ui.wireframes_ascii}
```

## 11. Чек-лист приёмки интерфейса
- [ ] Ни одного литерала цвета, шрифта, радиуса или длительности вне `theme.css`.
- [ ] Слои над канвасом не перехватывают игровой ввод: контейнеры `pointer-events: none`.
- [ ] Каждый экран помещается в измеренный вьюпорт, страница не скроллится.
- [ ] Одно главное действие на экран, не больше двух акцентов одновременно.
- [ ] Меняющиеся числа не дёргают строку HUD.
- [ ] У каждого экрана описаны загрузка, пустота и ошибка.
- [ ] Возможность, которой нет на площадке, не нарисована вовсе.
- [ ] Ни `alert`/`confirm`, ни эмодзи вместо иконок, ни `z-index` мимо токенов.
- [ ] Самая длинная переведённая строка помещается в кнопку.
- [ ] За меню видна живая сцена игры, а не заливка цветом.
- [ ] Ни одного эмодзи в подписи кнопки: иконка — инлайновый SVG с `currentColor`.
- [ ] У каждого экрана расписаны три зоны, а не «карточка по центру».
- [ ] С закрытым игровым полем меню всё ещё узнаётся как «{c.title}».
"""

    @staticmethod
    def _screens_md(screens) -> str:
        """Каталог экранов с композицией.

        Раньше читался единственный ключ `desc`, а модель называла его как
        придётся (`purpose`, `description`, `content`) — и раздел выходил
        списком заголовков без единой строки содержимого. Экраны нормализуются
        в UXDesignerAgent, здесь остаётся печать; ключ, которого нет, просто
        не печатается."""
        from agents.ux_designer import normalize_screens

        blocks = []
        for screen in normalize_screens(screens):
            name = (screen.get("id") or "Screen").replace("_", " ").strip()
            lines = [f"### Экран: {name}"]
            if screen.get("desc"):
                lines.append(f"- **Что на экране**: {screen['desc']}")
            if screen.get("primary_action"):
                lines.append(f"- **Главное действие**: {screen['primary_action']}")
            if screen.get("composition"):
                lines.append(f"- **Композиция**: {screen['composition']}")
            blocks.append("\n".join(lines))
        return "\n\n".join(blocks)

    def _gen_mobile_controls(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        m = c.mobile
        # Раскладка берётся из того же профиля, что и мастер-промпт, чтобы
        # документ и промпт не расходились между собой.
        profile = PromptCompilerAgent._control_profile(ctx)
        # Ровно та же раскладка, что уедет в мастер-промпт: спроектированная
        # UX-дизайнером, если она есть, и только иначе — шаблон профиля.
        # Печать шаблона напрямую расходилась с промптом ровно там, где
        # раскладку продумали руками.
        layout = PromptCompilerAgent._touch_layout(c, profile)
        desktop = PromptCompilerAgent._DESKTOP_LAYOUTS.get(
            profile, PromptCompilerAgent._DESKTOP_LAYOUTS["default"]
        )
        verbs_rule = PromptCompilerAgent._CONTROL_VERBS_RULE
        return f"""# Mobile Controls & Ergonomics: {c.title}

Профиль управления: **{profile}** (определён по жанру «{c.genre}»).

## 1. Orientation & Layout
- **Target Orientation**: **{m.orientation.upper()}**
- **Safe Area Insets**: `{m.safe_area_handling}`
- Отступы слоя управления: `calc(18px + env(safe-area-inset-bottom))` и аналогично
  для left/right.

## 2. Раскладка
{layout}

## 3. Реализация (обязательный контракт)
- Только **Pointer Events** (`pointerdown/move/up/cancel`) + `setPointerCapture`;
  на каждой кнопке — набор удерживающих её `pointerId`, иначе второй палец
  сбрасывает первый.
- Плавающий стик: зона захвата — половина экрана, база появляется под пальцем,
  мёртвая зона 8%.
- Отмена браузерных жестов: `touch-action: none`, отмена `contextmenu`,
  `dragstart` и `touchmove` с `{{ passive: false }}`,
  `-webkit-tap-highlight-color: transparent`.
- Размеры: основная кнопка ≥ 96 px, второстепенные ≥ 64 px, зазор ≥ 12 px;
  при высоте экрана < 460 px кнопки уменьшаются, но не ниже 56 px.
- Видимость строго по состоянию игры: только игровой процесс. При скрытии,
  `blur` и `visibilitychange` — сброс всех осей и кнопок.
- Флаг `?touch=1` включает мобильную раскладку на десктопе (`?touch=0` — выключает).

## 4. Desktop Controls
{desktop}

{verbs_rule}

## 5. Mobile Performance Throttling
- Cap pixel density to 1.5x.
- Disable dynamic real-time shadows on low-end devices.

## 6. Чек-лист приёмки
- [ ] Направление и основное действие работают одновременно (мультитач).
- [ ] Палец, уехавший за границу зоны, не роняет управление.
- [ ] Свайп по игре не скроллит страницу и не вызывает pull-to-refresh.
- [ ] Долгое нажатие не открывает контекстное меню.
- [ ] Управление скрыто в меню/паузе и сброшено после сворачивания вкладки.
- [ ] Кнопки не перекрыты вырезом камеры и системными жестами.
"""

    def _gen_audio(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        return f"""# Audio Design: {c.title}

## 1. Sound Engine
- Powered by **Howler.js** with WebAudio API backend and auto-unlock on first user interaction.

## 2. Sound Effects (SFX) Pool
- `action_swing_whoosh`: High-pass filtered whoosh with randomized pitch variation (0.9x - 1.1x).
- `metal_impact_clang`: Sharp metallic resonance with stereo reverb tail.
- `heavy_impact_slam`: Deep bass punch (80Hz sub-bass transient).
- `pickup_collect_chime`: Bright melodic chime for XP/gold pick-up.

## 3. Music Tracks
- **Main Menu**: Atmospheric ambient theme.
- **Combat Waves**: High-tempo battle music with dynamic volume fading.
"""

    def _gen_monetization(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        mon = c.monetization
        rewarded_md = "\n".join([f"### {r.name} (`{r.id}`)\n- **Benefit**: {r.benefit}\n- **Trigger**: {r.trigger_moment}\n- **Limit**: {r.cooldown_or_limit}\n" for r in mon.rewarded_placements]) if mon.rewarded_placements else "Rewarded revives & multipliers."
        iap_md = "\n".join([f"- **{item.name}** (`{item.sku}`): {item.description} ({item.price_tier})" for item in mon.in_app_purchases]) if mon.in_app_purchases else "Free-to-Play ad-supported model."
        return f"""# Monetization Specification: {c.title}

## 1. Strategy Summary
{mon.strategy_summary if mon.strategy_summary else "Balanced Rewarded Ads with fair non-intrusive Interstitials."}

## 2. Rewarded Video Ad Placements
{rewarded_md}

## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
{iap_md}
"""

    def _gen_playgama(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        p = c.playgama
        init_md = "\n".join([f"- {step}" for step in p.initialization_flow]) if isinstance(p.initialization_flow, list) else str(p.initialization_flow)
        keys_md = "\n".join([f"- `{k}`" for k in p.cloud_save_keys]) if isinstance(p.cloud_save_keys, list) else str(p.cloud_save_keys)
        boards_md = "\n".join([f"- `{b}`" for b in p.leaderboards]) if isinstance(p.leaderboards, list) else str(p.leaderboards)
        return f"""# Playgama Bridge Integration: {c.title}

## 1. SDK Overview
- **SDK**: `{p.sdk_version}`
- **Supported Portals**: {', '.join(p.supported_platforms)}

## 2. Initialization Flow
{init_md if init_md else "Standard bridge.initialize() bootstrap flow."}

## 3. Cloud Storage Keys
One key holding one JSON object — progression, purchase ownership and settings together. `storage.get(key)` / `set(key, value)` take **no `storageType` argument** on Bridge v2.

{keys_md if keys_md else "- `player_save_v1`"}

Write policy: debounce 1.5 s, and flush immediately on `pagehide` / `visibilitychange`. `localStorage` is a mirror only — inside the platform iframe it is partitioned third-party storage, so settings (mute, volume, language) live in the save object.

## 4. Leaderboards
IDs use letters and digits only (Yandex rejects underscores) and must be registered in the platform console before publishing — the bridge fails silently otherwise.

{boards_md if boards_md else "- `globalhighscore`"}

## 5. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED`. Do **not** rely on `visibilitychange` alone — it never reports an interstitial opening.
- Fire the callback once with the current value at subscribe time: the game may have booted in a hidden tab.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

## 6. Reference
Full contract and traps: `knowledge/playgama/` — see `bridge_api_reference.md`, `game_ready_and_loading.md`, `auth_and_player.md`, `storage_and_cloud.md`, `ads_integration.md`.
"""

    def _gen_performance(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        return f"""# Performance & Optimization Guide: {c.title}

## 1. Strict Budgets
- **Frame Rate**: 60 FPS (16.6ms frame budget).
- **Draw Calls**: < {c.tech_spec.max_draw_calls}.
- **Polygon Budget**: < {c.tech_spec.max_triangles_or_sprites} visible triangles.
- **Bundle Budget**: < {c.tech_spec.bundle_size_budget_mb} MB.

## 2. Memory & Garbage Collection
- Zero runtime allocations in render and physics update loops.
- Pre-allocated object pools for entities and particles.
- Explicit `.dispose()` calls on scene transitions.
"""

    def _gen_qa_plan(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        qa = c.qa
        func_md = "\n".join([f"- [ ] {t}" for t in qa.functional_tests]) if isinstance(qa.functional_tests, list) else str(qa.functional_tests)
        bench_md = "\n".join([f"- [ ] {b}" for b in qa.performance_benchmarks]) if isinstance(qa.performance_benchmarks, list) else str(qa.performance_benchmarks)
        browsers_md = "\n".join([f"- {br}" for br in qa.cross_browser_matrix]) if isinstance(qa.cross_browser_matrix, list) else str(qa.cross_browser_matrix)
        return f"""# QA & Testing Plan: {c.title}

## 1. Functional Test Matrix
{func_md if func_md else "- [ ] Core controls\n- [ ] Wave completion"}

## 2. Performance Benchmarks
{bench_md if bench_md else "- [ ] Sustained 60 FPS"}

## 3. Target Browser Matrix
{browsers_md if browsers_md else "- Chrome, Safari, Firefox, Edge, Mobile Web"}
"""

    def _gen_roadmap(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        phases_md = ""
        for p in c.roadmap:
            tasks_md = "\n".join([f"  - {t}" for t in p.tasks]) if p.tasks else "  - Phase milestones implementation."
            phases_md += f"""### Phase {p.phase_number}: {p.title} ({p.duration_days} Days)
- **Key Deliverable**: {p.milestone_deliverable}
- **Tasks**:
{tasks_md}

"""
        return f"""# Development Roadmap: {c.title}

{phases_md if phases_md else "5-phase agile delivery roadmap."}
"""

    def _gen_references(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        refs_md = ""
        for r in c.references:
            mechanics_str = ", ".join(r.mechanics) if r.mechanics else "Core loop reference"
            refs_md += f"""### Reference: {r.name} ({r.genre})
- **Mechanics Analyzed**: {mechanics_str}
- **Key Lessons**: {r.lessons}
- **What NOT to Copy**: {r.what_to_avoid}

"""
        return f"""# Reference Analysis & Market Research: {c.title}

{refs_md if refs_md else "Market benchmark references analyzed."}
"""

    def _gen_risks(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        risks_md = ""
        for r in c.risks:
            risks_md += f"""### Risk: {r.risk}
- **Category**: {r.category.upper()} | **Severity**: {r.severity}
- **Mitigation Strategy**: {r.mitigation}

"""
        return f"""# Project Risks & Mitigation: {c.title}

{risks_md if risks_md else "Technical and performance risk mitigation."}
"""

