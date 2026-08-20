import re
from app import knowledge
from app.config import DESIGN_OS_ENABLED
from app.context import GenerationContext
from app.logging import log_agent

class PromptCompilerAgent:
    """
    Compiles structured game data, architecture specs, mechanics, and constraints
    into a self-contained, definitive master AI Developer Prompt (AI_DEVELOPER_PROMPT.md).
    """

    # Раскладка тач-управления зависит от жанра. Универсальный «джойстик слева +
    # кнопки справа» ломает вождение: газ и руль обязаны работать одновременно.
    _TOUCH_LAYOUTS = {
        "driving": (
            "- **Слева — РУЛЬ**: плавающий стик, работает только по горизонтали "
            "(поворот). Вертикаль стика не управляет газом.\n"
            "- **Справа — ПЕДАЛИ И ДЕЙСТВИЯ**: большая кнопка **ГАЗ** (≥ 104 px) под "
            "большим пальцем, рядом **НАЗАД/ТОРМОЗ**, выше — **НИТРО** и **РУЧНИК/ДРИФТ**.\n"
            "- Газ, руль и нитро должны нажиматься одновременно (мультитач на 3 пальца)."
        ),
        "platformer": (
            "- **Слева**: кнопки ВЛЕВО / ВПРАВО (или горизонтальный стик).\n"
            "- **Справа**: ПРЫЖОК (самая большая кнопка) и кнопка действия/атаки.\n"
            "- Прыжок и движение обязаны работать одновременно."
        ),
        "builder": (
            "- **Одним пальцем**: панорамирование карты, тап — выбор объекта.\n"
            "- **Двумя пальцами**: пинч-зум и поворот камеры.\n"
            "- **Справа снизу**: панель постройки/действий, кнопки ≥ 64 px."
        ),
        "default": (
            "- **Слева — ДВИЖЕНИЕ**: плавающий виртуальный джойстик на 2 оси, "
            "зона захвата — вся левая половина экрана.\n"
            "- **Справа — ДЕЙСТВИЯ**: крупная основная кнопка (атака/использование) "
            "и 2–3 второстепенные (дэш, блок, спец-умение).\n"
            "- Движение и атака должны работать одновременно."
        ),
    }

    _DESKTOP_LAYOUTS = {
        "driving": (
            "- `W` / `S` / `↑` / `↓` — газ и тормоз/задний ход\n"
            "- `A` / `D` / `←` / `→` — руль\n"
            "- `Space` / `E` — нитро\n"
            "- `Shift` / `F` — ручной тормоз (дрифт)\n"
            "- `P` / `Esc` — пауза"
        ),
        "default": (
            "- `WASD` / стрелки — движение\n"
            "- ЛКМ / `J` — основная атака\n"
            "- ПКМ / `K` — тяжёлая атака / блок\n"
            "- `Space` / `Shift` — рывок / уклонение\n"
            "- `P` / `Esc` — пауза"
        ),
    }

    _DRIVING_WORDS = ("гонк", "дрифт", "маш", "racing", "drift", "vehicle", "car", "derby", "трак")
    _PLATFORMER_WORDS = ("платформер", "platformer", "runner", "раннер")
    _BUILDER_WORDS = ("строит", "builder", "base building", "tower defense", "башен", "стратег")

    @classmethod
    def _control_profile(cls, ctx: GenerationContext) -> str:
        """Определяет профиль управления по жанру, механикам и исходной идее."""
        concept = ctx.concept
        haystack = " ".join([
            str(concept.genre or ""),
            str(concept.subgenre or ""),
            str(concept.title or ""),
            str(ctx.raw_prompt or ""),
            " ".join(m.name for m in concept.mechanics),
        ]).lower()

        for profile, words in (
            ("driving", cls._DRIVING_WORDS),
            ("platformer", cls._PLATFORMER_WORDS),
            ("builder", cls._BUILDER_WORDS),
        ):
            if any(word in haystack for word in words):
                return profile
        return "default"

    # ------------------------------------------------------------------
    # Блоки слоя Design OS для мастер-промпта.
    # ------------------------------------------------------------------

    @staticmethod
    def _promise_block(concept) -> str:
        p = concept.player_promise
        layers = [
            ("Витрина платформы", p.store_promise),
            ("Первые 60 секунд", p.first_session_promise),
            ("Долгая игра", p.long_term_promise),
        ]
        parts = []
        for title, layer in layers:
            if not layer.claim:
                continue
            evidence = "\n".join(f"  - {item}" for item in layer.expected_evidence)
            failures = "\n".join(f"  - {item}" for item in layer.failure_signals)
            parts.append(
                f"**{title}**: {layer.claim}\n"
                f"- Должно подтверждаться в билде:\n{evidence}\n"
                f"- Считается нарушением:\n{failures}"
            )
        promise = "\n\n".join(parts) or "_Контракт обещания не задан._"
        nucleus = concept.selected_nucleus or concept.hook
        return (
            f"**Дизайн-ядро проекта**: {nucleus}\n"
            "Любая система, не обслуживающая это ядро, требует отдельного решения в `DECISIONS.md`.\n\n"
            f"{promise}"
        )

    @staticmethod
    def _density_block(concept) -> str:
        ed = concept.experience_density
        beats = "\n".join(
            f"| {b.window} | {b.required_event} | {b.failure_signal} |" for b in ed.first_session_beats
        ) or "| — | — | — |"
        clp = "\n".join(f"- {item}" for item in ed.clp_reducers)
        feel = "\n".join(f"- {item}" for item in (ed.sf_boosters + ed.eb_boosters))
        return f"""Модель: `{ed.formula}` (статус: `{ed.theory_status}`).

**Жёсткие показатели первой сессии** — проверяются телеметрией, не на глаз:
- Первое осмысленное действие доступно не позже **{ed.time_to_first_action_sec} с** после загрузки.
- Первая награда или явный прогресс — не позже **{ed.time_to_first_reward_sec} с**.
- Значимых решений игрока — около **{ed.md_per_min_target} в минуту** (решений, а не нажатий).

| Окно | Что обязано произойти | Сигнал провала |
| --- | --- | --- |
{beats}

**Снижение когнитивной нагрузки (обязательно):**
{clp}

**Качество отклика (обязательно):**
{feel}"""

    @staticmethod
    def _telemetry_block(concept) -> str:
        events = concept.experience_density.telemetry
        rows = "\n".join(
            f"| `{e.name}` | {e.trigger} | {', '.join(f'`{p}`' for p in e.params) or '—'} |"
            for e in events
        ) or "| — | — | — |"
        return f"""Без этих событий план плотности впечатлений непроверяем, а спецификация
превращается в мнение. Реализуй модуль `src/telemetry/Telemetry.ts` по контракту из
[`TELEMETRY_SPEC.md`](./TELEMETRY_SPEC.md).

| Событие | Когда | Параметры |
| --- | --- | --- |
{rows}

Правила: `first_action` и `first_reward` — ровно один раз за сессию; отправка не
блокирует игровой цикл; отсутствие сети не приводит к исключению в геймплее;
персональные данные не отправляются."""

    @staticmethod
    def _scope_block(concept) -> str:
        gate = concept.validation.scope_gate
        mvp = "\n".join(f"- {item}" for item in gate.mvp_must) or "- (не задано)"
        cut = "\n".join(f"- {item}" for item in gate.cut) or "- (не задано)"
        later = "\n".join(f"- {item}" for item in gate.vertical_slice_should) or "- (не задано)"
        risky = [a for a in concept.assumptions if a.impact == "high" and a.status == "open"]
        risky_lines = "\n".join(
            f"- `{a.id}` [{a.ul_level}] {a.statement} — опровергается: {a.falsifier}" for a in risky
        ) or "- (нет открытых высокорисковых допущений)"
        return f"""**Обязательно в MVP** (делать в первую очередь):
{mvp}

**Только после MVP** (не начинать раньше):
{later}

**Вырезано — не реализовывать без нового решения в `DECISIONS.md`:**
{cut}

**Открытые высокорисковые допущения** — это гипотезы, а не факты. Если реализация
показывает обратное, пиши об этом в `DEVLOG.md`, а не подгоняй игру под документ:
{risky_lines}"""

    @staticmethod
    def _gates_block(concept) -> str:
        pending = [g for g in concept.gates if g.status == "pending"]
        if not pending:
            return "Все ворота пройдены человеком — блокирующих ограничений нет."
        lines = "\n".join(
            f"- **{g.id} — {g.name}**: блокирует {g.blocks.lower()}" for g in pending
        )
        return f"""Следующие ворота ещё не подтверждены человеком. Пока статус `pending`,
работу, которую они блокируют, начинать нельзя: опиши в `DEVLOG.md`, что упёрся в
ворота, и переходи к незаблокированной задаче. Менять статус ворот самостоятельно
запрещено — это делает человек в фабрике.

{lines}"""

    @staticmethod
    def _design_os_dod(concept) -> str:
        ed = concept.experience_density
        names = ", ".join(f"`{e.name}`" for e in ed.telemetry[:4])
        return "\n".join([
            f"- [ ] Первое осмысленное действие доступно за {ed.time_to_first_action_sec} с, первая награда — за {ed.time_to_first_reward_sec} с (замерено телеметрией)",
            f"- [ ] Реализованы события телеметрии из TELEMETRY_SPEC.md ({names} и остальные)",
            "- [ ] Каждое обещание из PLAYER_PROMISE.md подтверждается в билде, ни один сигнал провала не воспроизводится",
            "- [ ] Реализовано только то, что входит в MVP из VALIDATION_PLAN.md; вырезанное не добавлено",
            "- [ ] Ни одна задача не пересекла ворота со статусом `pending` из HUMAN_GATES.md",
        ])

    @staticmethod
    def _mechanic_depth_block(deep) -> str:
        """Глубина механики для кодового агента: числа, состояния, псевдокод.

        Без этого блока агент реализует жанровый шаблон, а не эту игру.
        """
        if deep is None:
            return ""
        params = "\n".join(f"  - `{p.name}` = `{p.value}` — {p.tuning_note}" for p in deep.parameters)
        states = ", ".join(f"`{s}`" for s in deep.states)
        feedback = "\n".join(f"  - {f}" for f in deep.feedback_layers)
        synergies = "\n".join(f"  - {s}" for s in deep.synergies)
        pseudocode = f"\n- **Псевдокод тика**:\n```text\n{deep.pseudocode.strip()}\n```" if deep.pseudocode.strip() else ""
        lines = [f"- **Решение игрока**: {deep.player_decision}" if deep.player_decision else ""]
        if states:
            lines.append(f"- **Состояния**: {states}")
        if params:
            lines.append(f"- **Числовые параметры (реализуй именно эти значения)**:\n{params}")
        if feedback:
            lines.append(f"- **Слои отклика**:\n{feedback}")
        if deep.failure_mode:
            lines.append(f"- **Режим отказа игрока**: {deep.failure_mode}")
        if deep.mastery_curve:
            lines.append(f"- **Кривая мастерства**: {deep.mastery_curve}")
        if deep.counterplay:
            lines.append(f"- **Сопротивление игры**: {deep.counterplay}")
        if synergies:
            lines.append(f"- **Синергии**:\n{synergies}")
        if deep.why_unique:
            lines.append(f"- **Почему это не жанровый шаблон**: {deep.why_unique}")
        return "\n".join([l for l in lines if l]) + pseudocode + "\n"

    @staticmethod
    def _core_design_block(concept) -> str:
        """Уникальное ядро игры: петли, напряжение и формулы — до списка механик."""
        core = concept.core_design
        if not (core.micro_loop or core.core_formulas or core.signature_moment):
            return ""

        def steps(items) -> str:
            return "\n".join(
                f"- **{s.step}** ({s.duration}): игрок — {s.player_action}; игра — {s.game_response}; "
                f"решение — {s.decision}"
                for s in items
            )

        parts = []
        if core.signature_moment:
            parts.append(f"**Фирменный момент**: {core.signature_moment}")
        if core.what_makes_it_different:
            parts.append(f"**Чем петля отличается от соседей по жанру**: {core.what_makes_it_different}")
        if core.genre_template_rejected:
            parts.append(f"**Шаблон жанра, который НЕ реализуем**: {core.genre_template_rejected}")
        if core.loop_diagram.strip():
            parts.append(f"**Схема петли**:\n```text\n{core.loop_diagram.strip()}\n```")
        if core.micro_loop:
            parts.append(f"**Микро-петля (посекундно)**:\n{steps(core.micro_loop)}")
        if core.meso_loop:
            parts.append(f"**Мезо-петля (этап)**:\n{steps(core.meso_loop)}")
        if core.macro_loop:
            parts.append(f"**Макро-петля (забег)**:\n{steps(core.macro_loop)}")
        if core.tension_curve:
            parts.append(f"**Кривая напряжения**: {core.tension_curve}")
        if core.core_formulas:
            formulas = "\n".join(f"- `{f}`" for f in core.core_formulas)
            parts.append(f"**Формулы ядра (реализуй буквально)**:\n{formulas}")
        if core.run_progression:
            parts.append("**Прогрессия внутри забега**:\n" + "\n".join(f"- {i}" for i in core.run_progression))
        if core.meta_progression:
            parts.append("**Мета-прогрессия**:\n" + "\n".join(f"- {i}" for i in core.meta_progression))
        return "\n\n".join(parts)

    @classmethod
    def _generate_module_map(cls, concept) -> str:
        """Динамическая карта модулей под архитектуру и системы именно этой игры."""
        is_3d = concept.renderer == "threejs"
        physics_desc = "Rapier3D / Physics world manager & colliders" if is_3d else "Matter.js / Physics world manager"

        # Системы из концепции или механик
        systems_lines = []
        if concept.gameplay_systems:
            for s in concept.gameplay_systems[:5]:
                name_clean = re.sub(r"[^a-zA-Z0-9]+", "", s.name.title())
                if not name_clean.endswith("System") and not name_clean.endswith("Manager"):
                    name_clean += "System"
                purpose = s.purpose[:45] if s.purpose else "Game logic execution"
                systems_lines.append(f"│   ├── {name_clean}.ts{' ' * max(1, 22 - len(name_clean))}# {purpose}")
        else:
            for m in concept.mechanics[:4]:
                name_clean = re.sub(r"[^a-zA-Z0-9]+", "", m.name.title())
                if not name_clean.endswith("System") and not name_clean.endswith("Manager"):
                    name_clean += "System"
                desc = m.description[:45] if m.description else "Core mechanic logic"
                systems_lines.append(f"│   ├── {name_clean}.ts{' ' * max(1, 22 - len(name_clean))}# {desc}")

        if not systems_lines:
            systems_lines = [
                "│   ├── GameplayManager.ts     # Core loop controller",
                "│   └── ProgressionManager.ts  # Level state & progression",
            ]
        systems_block = "\n".join(systems_lines)

        scene_desc = "Three.js scene graph, lights, camera lerp" if is_3d else "PixiJS stage, container layers, camera"

        return f"""src/
├── main.ts                    # Bootstrap, Playgama Bridge init, Game launch
├── core/
│   ├── Game.ts                # Main coordinator & state machine
│   ├── GameLoop.ts            # 60Hz fixed update loop with delta clamping
│   └── EventBus.ts            # Typed publish/subscribe event dispatcher
├── platform/
│   ├── PlaygamaService.ts     # Wrapper for @playgama/bridge (Ads, Save, Leaderboards)
│   └── StorageService.ts      # Cloud & LocalStorage sync with debouncing
├── physics/
│   └── PhysicsWorld.ts        # {physics_desc}
├── entities/
│   ├── Player.ts              # Player entity & input handling
│   └── EntityManager.ts       # Dynamic entity pool & lifecycle
├── systems/
{systems_block}
├── rendering/
│   ├── SceneManager.ts        # {scene_desc}
│   ├── ProceduralModels.ts    # Styled models / geometry for {concept.title}
│   └── ParticleSystem.ts      # Particle effects & visual feedback
├── ui/
│   ├── UIManager.ts           # HUD overlay, state transitions
│   └── TouchControls.ts       # Mobile touch input adapter
└── audio/
    └── AudioManager.ts        # Sound effects pool & dynamic audio feedback"""

    def compile(self, ctx: GenerationContext) -> str:
        concept = ctx.concept
        log_agent("PromptCompiler", f"Compiling definitive AI Developer Prompt for '{concept.title}'")

        dod_items = "\n".join([f"- [ ] {item}" for item in concept.definition_of_done]) if concept.definition_of_done else "- [ ] Complete playable game"
        layers_items = "\n".join([
            f"- **{layer.get('name', 'Layer') if isinstance(layer, dict) else str(layer)}**: {layer.get('responsibility', layer.get('desc', '')) if isinstance(layer, dict) else ''}"
            for layer in concept.tech_spec.layers
        ]) if concept.tech_spec.layers else "- **Core Systems Layer**: Complete game loop and state management"
        deep_by_name = {d.name.strip().lower(): d for d in concept.core_design.mechanics if d.name}
        mechanics_items = "\n".join([
            f"### {m.name} ({m.priority.upper()})\n"
            f"- **Category**: {m.category}\n"
            f"- **Description**: {m.description}\n"
            f"- **Player Input**: {m.player_interaction}\n"
            f"- **Hit & Sensory Feedback**: {m.feedback}\n"
            f"- **Technical Complexity**: {m.technical_complexity}\n"
            + self._mechanic_depth_block(deep_by_name.get(m.name.strip().lower()))
            for m in concept.mechanics
        ])
        core_block = self._core_design_block(concept)
        rewarded_items = "\n".join([
            f"- **{r.name} (`{r.id}`)**: {r.benefit} (Trigger: {r.trigger_moment}, Limit: {r.cooldown_or_limit})"
            for r in concept.monetization.rewarded_placements
        ])
        # The knowledge base is the factory's memory of what actually ships on
        # these platforms. It is injected verbatim so the coding agent never has
        # to rediscover a rule that already cost a production bug.
        profile = self._control_profile(ctx)
        touch_layout = self._TOUCH_LAYOUTS[profile]
        desktop_controls = self._DESKTOP_LAYOUTS.get(profile, self._DESKTOP_LAYOUTS["default"])
        log_agent("PromptCompiler", f"Control profile: {profile}")

        critical_rules = knowledge.critical_rules(heading_offset=1)
        if not critical_rules:
            log_agent("PromptCompiler", "WARNING: knowledge/CRITICAL_RULES.md missing — prompt will omit platform rules")
        knowledge_index = "\n".join(f"- `knowledge/{rel}`" for rel in knowledge.list_topics())

        roadmap_items = "\n".join([
            f"### Phase {phase.phase_number}: {phase.title} ({phase.duration_days} days)\n"
            f"- **Deliverable**: {phase.milestone_deliverable}\n"
            + "\n".join([f"  - {task}" for task in phase.tasks])
            for phase in concept.roadmap
        ])

        # Слой Design OS. Кодовый агент получает не только «что построить»,
        # но и «что здесь гипотеза», «чем это измеряется» и «где остановиться».
        # Слой Design OS отключён флагом config.DESIGN_OS_ENABLED: соответствующие
        # секции промпта собираются только когда слой включён.
        if DESIGN_OS_ENABLED:
            promise_section = (
                "\n---\n\n## 1a. ОБЕЩАНИЕ ИГРОКУ (ПРОВЕРЯЕМЫЙ КОНТРАКТ)\n"
                "Это не маркетинг, а приёмочный критерий. Любая реализация, нарушающая обещание\n"
                "первых 60 секунд, считается невыполненной задачей, даже если код работает.\n\n"
                + self._promise_block(concept) + "\n"
            )
            density_section = (
                "\n---\n\n## 3a. ПЛОТНОСТЬ ПЕРВОЙ СЕССИИ (EXPERIENCE DENSITY)\n"
                + self._density_block(concept) + "\n"
            )
            design_os_sections = (
                "\n---\n\n## 8a. ТЕЛЕМЕТРИЯ (ЧАСТЬ DEFINITION OF DONE)\n"
                + self._telemetry_block(concept) + "\n"
                "\n---\n\n## 8b. ГРАНИЦЫ ОБЪЁМА И ОТКРЫТЫЕ ДОПУЩЕНИЯ\n"
                + self._scope_block(concept) + "\n"
                "\n---\n\n## 8c. ЧЕЛОВЕЧЕСКИЕ ВОРОТА (ГДЕ ОСТАНОВИТЬСЯ И СПРОСИТЬ)\n"
                + self._gates_block(concept) + "\n"
            )
            dod_items = dod_items + "\n" + self._design_os_dod(concept)
        else:
            promise_section = ""
            density_section = ""
            design_os_sections = ""

        prompt_content = f"""# FINAL AI DEVELOPER PROMPT: {concept.title.upper()} 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: {concept.title}
- **Project Slug**: `{concept.slug}`
- **Genre**: {concept.genre} ({concept.subgenre})
- **Target Platform**: {concept.platform}
- **Orientation**: {concept.orientation.capitalize()}
- **Target Audience**: {concept.target_audience}
- **Player Fantasy**: {concept.player_fantasy}
- **Core Hook**: {concept.hook}
- **Session Model**: {concept.session_model}

{promise_section}
---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: {concept.tech_spec.language}
- **Bundler & Dev Server**: {concept.tech_spec.bundler}
- **Renderer**: **{concept.tech_spec.renderer.upper()}** ({concept.tech_spec.renderer_version})
  - *Selection Rationale*: {concept.renderer_reason}
- **Physics Simulation**: **{concept.tech_spec.physics_engine}** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: {concept.tech_spec.audio_engine}
- **State Management**: {concept.tech_spec.state_manager}
- **Platform SDK**: `{concept.playgama.sdk_version}`

### Performance Budgets
- **Target FPS**: {concept.tech_spec.target_fps} FPS (Desktop & Mobile)
- **Max Draw Calls**: < {concept.tech_spec.max_draw_calls}
- **Max Triangles / Active Sprites**: < {concept.tech_spec.max_triangles_or_sprites}
- **Max Bundle Size**: < {concept.tech_spec.bundle_size_budget_mb} MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
{concept.core_loop}
```

{core_block}

{mechanics_items}

---

## 3b. ⚠️ СТРОГИЙ ЗАПРЕТ ЖАНРОВЫХ ШАБЛОНОВ И КЛОНОВ (CRITICAL ANTI-CLICHÉ RULES)
Кодовый агент ОБЯЗАН реализовать уникальную игру, спроектированную в этом ТЗ, а не шаблонный автошутер:
1. **ЗАПРЕТ ШАБЛОННЫХ РОГАЛИКОВ И КАРТОЧЕК**: Если игра прямо не требует карточный драфт в GDD, **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** добавлять спам волн врагов и всплывающее окно «Выберите 1 из 3 карт апгрейда».
2. **ЗАПРЕТ СЕРЫХ ПРИМИТИВОВ НА ПУСТОЙ ПЛОСКОСТИ**: Создавай выразительную процедурную низкополигональную 3D/2D графику, точно соответствующую `ART_DIRECTION.md` (тематические персонажи, рельеф, модули, объекты окружения, частицы), а не бегающий куб на сером полу.
3. **ТОЧНОЕ СОБЛЮДЕНИЕ МЕХАНИК**: Реализуй все состояния, формулы, тайминги и слои отклика из `MECHANICS.md` (включая Web Audio звуки, импульсы камеры, визуал и тач-инпут).
4. **СПЕЦИФИЧЕСКОЕ УПРАВЛЕНИЕ**: Реализуй схему управления под конкретную механику этой игры (свайпы, жесты, траектории, физический дрифт, прицеливание), а не стандартный стик.

{density_section}
---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

{layers_items}

### Module Map (`src/`):
```text
{self._generate_module_map(concept)}
```

---

## 5. PLAYGAMA BRIDGE INTEGRATION SPECIFICATION
Platform integration is powered by `@playgama/bridge`.

### 1. Initialization & Ready Event
`game_ready` is **NOT** sent after `initialize()` — that dismisses the platform splash over an unloaded game. It is sent once, after assets are loaded and the menu is interactive.

```typescript
export async function bootstrapPlatform(): Promise<void> {{
    // A blocked sdk.js (ad blocker, CDN failure) must not mean a permanent black screen.
    await Promise.race([bridge.initialize(), new Promise((r) => setTimeout(r, 10_000))]);
    bridge.platform.sendMessage('in_game_loading_started');
}}

let gameReadySent = false;
export function sendGameReady(): void {{
    if (gameReadySent) return;                  // a second send can re-arm the platform splash
    gameReadySent = true;
    try {{ bridge.platform.sendMessage('game_ready'); }} catch {{}}
    try {{ bridge.platform.sendMessage('in_game_loading_stopped'); }} catch {{}}
}}
```

**Boot order (strict).** Nothing in this chain may wait on a player decision:
page guards → `initialize()` → language → silent VK/OK auth → load save → redeem pending purchases → build engine/UI → progress to 100% → `sendGameReady()` → arm banners → first-launch tutorial.
Keep a 15 s watchdog that sends `game_ready` regardless of boot failures.

### 2. Advertisement Flow
- **Interstitial Ads**:
  - Minimum **90 seconds** cooldown, and never below the platform's configured minimum.
  - Only at natural breaks traceable to a real click (run over, level complete, leaving to menu). Never at boot, never mid-combat, never right after a purchase.
  - Arm the slot when the run ends; fire it when the player taps to leave the result screen.
  - Never call `showInterstitial()` from a state method — the click handler decides.
- **Rewarded Ads** — the reward is granted **only** on `state === 'rewarded'`, never when the promise resolves. Always `off()` the listener and guard re-entry, or one ad pays out twice:
{rewarded_items}
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"{concept.playgama.cloud_save_keys[0]}"` — one key, one JSON object.
- `bridge.storage.set(key, value)` / `get(key)` take **no `storageType` argument**; v2 picks cloud vs. local.
- Normalize on read: a corrupted or truncated save must boot on defaults, not crash.
- Mirror to `localStorage` for instant/offline boot, but never as the only copy — it is partitioned third-party storage inside the platform iframe. Settings (mute, volume, language) live in the save.
- Debounce writes by 1.5 s **and** flush on `pagehide` / `visibilitychange`.
- Daily/timed content uses `bridge.platform.getServerTime()`, never the device clock.

### 4. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED` — not `visibility_state_changed`, which misses interstitials.
- Fire the callback once with the current value at subscribe time; a game booted in a hidden tab otherwise starts in the wrong state.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

### 5. Authorization
- `authorize()` only from an explicit player action — **except** VK/OK, where it is silent, runs at boot before saves, and is time-boxed to 5 s.
- Guests have a non-null `id` and `name`: the only reliable check is `player.isGuest`.
- Never `await` a dialog-showing `authorize()` inside boot.

---

## 6. USER INTERFACE & MOBILE CONTROLS
Мобильное управление — обязательная часть поставки, а не «доделаем потом».
Большинство игроков на Яндекс Играх / VK / Playgama заходят с телефона: игра без
рабочего тач-управления не проходит приёмку, даже если на клавиатуре всё идеально.

- **Orientation**: {concept.orientation.capitalize()}
- **Safe Area Insets**: `padding: calc(18px + env(safe-area-inset-bottom))` и аналогично
  для left/right — кнопки не должны попадать под вырез камеры и системные жесты.

### Обязательный контракт тач-управления
{touch_layout}

- **Реализация только на Pointer Events** (`pointerdown/move/up/cancel`) с
  `setPointerCapture` и учётом `pointerId` для каждой кнопки: `touchstart/end`
  теряет палец на границе элемента, а второй палец сбрасывает первый.
- **Плавающий стик**: зона захвата — вся левая половина экрана, база стика
  появляется под пальцем. Мёртвая зона 8%, иначе управление дрожит.
- **Отмена браузерных жестов**: `touch-action: none`, отмена `contextmenu`,
  `dragstart` и `touchmove` с `{{ passive: false }}`; `-webkit-tap-highlight-color: transparent`.
- **Видимость по состоянию**: слой управления показан только в игровом процессе,
  скрыт в меню / гараже / паузе / модалках и при скрытии сбрасывает все оси и
  кнопки (также по `blur` и `visibilitychange`).
- **Размеры**: основная кнопка действия ≥ 96 px, второстепенные ≥ 64 px, зазор ≥ 12 px.
- **Отладочный флаг** `?touch=1` принудительно включает мобильную раскладку на
  десктопе (и `?touch=0` выключает) — без него управление невозможно проверить.
- Клавиатура и тач работают параллельно и не глушат друг друга.

### Desktop Controls
{desktop_controls}

---

## 6a. ЖУРНАЛ РАЗРАБОТКИ И CHANGELOG (ЧАСТЬ DEFINITION OF DONE)
Проект живёт в песочнице `workspace/{concept.slug}/`, и вся работа за её пределы
не выходит. Правила работы продублированы в `AGENTS.md` в корне проекта —
прочитай его первым. В корне также ведутся два журнала; они обновляются в конце
**каждой** рабочей сессии, до отчёта о завершении:

- **`DEVLOG.md`** — запись вида `## ГГГГ-ММ-ДД ЧЧ:ММ — <суть>` с пунктами
  **Задача**, **Сделано**, **Затронутые файлы**, **Проверено**,
  **Известные проблемы / следующий шаг**.
- **`CHANGELOG.md`** — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/):
  раздел `## [Unreleased]`, подразделы Added / Changed / Fixed / Removed,
  формулировки на языке игрока, а не описание диффа.
- **`README.md`** — как запустить (`npm install`, `npm run dev`), управление на
  клавиатуре и на телефоне, структура каталогов.

Игра обязана запускаться командой `npm run dev` и открываться в браузере без
ошибок в консоли: именно так её проверяет фабрика (вкладка «Играть»).

---

## 7. ART DIRECTION & VISUAL GUIDELINES
- **Style**: {concept.art.style_name}
- **Camera Perspective**: {concept.art.camera_perspective} (FOV: {concept.art.camera_fov}°, Pitch: {concept.art.camera_pitch_angle}°)
- **Environment**: {concept.art.environment_theme}
- **Lighting**: {concept.art.lighting_setup}
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
{roadmap_items}

{design_os_sections}
---

## 9. NON-NEGOTIABLE PLATFORM RULES
Every rule below corresponds to a bug that reached production or a moderation rejection in a shipped game. They override any conflicting habit, tutorial or example — including snippets found in the Playgama/Yandex docs, many of which describe the deprecated Bridge v1 contract.

{critical_rules}

---

## 10. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

{dod_items}

---

## 11. FACTORY KNOWLEDGE BASE
Deep, worked-out detail behind the rules in section 9 — read the relevant file before implementing that area:

{knowledge_index}

---

## 12. DETAILED REFERENCE DOCUMENTS
For extended deep specifications, refer to the accompanying project documentation files:
- [Инструкция агенту (AGENTS.md)](./AGENTS.md)
- [Журнал разработки (DEVLOG.md)](./DEVLOG.md)
- [Changelog](./CHANGELOG.md)
- [Game Design Document](./GAME_DESIGN_DOCUMENT.md)
- [Gameplay Specification](./GAMEPLAY_SPECIFICATION.md)
- [Technical Specification](./TECHNICAL_SPECIFICATION.md)
- [Architecture Document](./ARCHITECTURE_DOCUMENT.md)
- [Playgama Integration](./PLAYGAMA_INTEGRATION.md)
- [Monetization Specification](./MONETIZATION.md)
- [Mobile Controls](./MOBILE_CONTROLS.md)
- [QA Plan](./QA_PLAN.md)
- [Обещание игроку (PLAYER_PROMISE.md)](./PLAYER_PROMISE.md)
- [Дизайн-ядро (DESIGN_NUCLEUS.md)](./DESIGN_NUCLEUS.md)
- [Плотность впечатлений (EXPERIENCE_DENSITY.md)](./EXPERIENCE_DENSITY.md)
- [Спецификация телеметрии (TELEMETRY_SPEC.md)](./TELEMETRY_SPEC.md)
- [Реестр допущений (ASSUMPTIONS.md)](./ASSUMPTIONS.md)
- [План валидации (VALIDATION_PLAN.md)](./VALIDATION_PLAN.md)
- [Журнал решений (DECISIONS.md)](./DECISIONS.md)
- [Человеческие ворота (HUMAN_GATES.md)](./HUMAN_GATES.md)
- [Game Skill Guidelines](./skills/GAME_SKILL.md)
- [Renderer Skill](./skills/RENDERER_SKILL.md)
"""
        return prompt_content.strip()
