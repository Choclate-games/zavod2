from pathlib import Path
from typing import Dict, Callable
from app.context import GenerationContext
from app.logging import log_agent, log_success
from agents.prompt_compiler import PromptCompilerAgent
from generators.design_os_docs import DESIGN_OS_DOCS
from app.config import DESIGN_OS_ENABLED

class DocumentGenerator:
    """Generates the full suite of specialized Game Development Documents in Markdown."""

    def generate_all(self, ctx: GenerationContext):
        log_agent("DocumentGenerator", f"Rendering full specification suite in {ctx.game_dir}")
        generators: Dict[str, Callable[[GenerationContext], str]] = {
            "README.md": self._gen_readme,
            "PROJECT_DIRECTION.md": self._gen_direction,
            "GAME_DESIGN_DOCUMENT.md": self._gen_gdd,
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
        # config.DESIGN_OS_ENABLED — документы этого слоя не создаются.
        if DESIGN_OS_ENABLED:
            generators.update(DESIGN_OS_DOCS)

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
├── AI_DEVELOPER_PROMPT.md           # Definitive master prompt for coding agent
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

    def _gen_gdd(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        scores_table = f"""| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | {c.scores.fun}/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | {c.scores.originality}/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | {c.scores.replayability}/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | {c.scores.mobile_fit}/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | {c.scores.monetization}/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | {c.scores.platform_fit}/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |
"""
        return f"""# Game Design Document (GDD): {c.title}

## 1. Executive Summary & Vision
- **Title**: {c.title}
- **Vision Statement**: {c.vision}
- **Elevator Pitch**: {c.elevator_pitch}
- **Genre**: {c.genre} ({c.subgenre})
- **Target Audience**: {c.target_audience}

## 2. Viability & Fun Scores
{scores_table}
*Overall Weighted Score*: **{c.scores.overall_score:.1f} / 10**

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

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
"""

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
- **Дизайн-ядро**: {c.selected_nucleus or "—"}

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
- Ни одно усиление не отменяет решение из ядра «{c.selected_nucleus or c.hook}» — иначе петля схлопывается.
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
        screens_md = "\n".join([
            f"### Screen: {str(s.get('id', s.get('name', 'Screen')) if isinstance(s, dict) else s).replace('_', ' ').title()}\n- {s.get('desc', s.get('description', '')) if isinstance(s, dict) else ''}"
            for s in ui.screens
        ]) if isinstance(ui.screens, list) else ""

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
- [ ] С закрытым игровым полем меню всё ещё узнаётся как «{c.title}».
"""

    def _gen_mobile_controls(self, ctx: GenerationContext) -> str:
        c = ctx.concept
        m = c.mobile
        # Раскладка берётся из того же профиля, что и мастер-промпт, чтобы
        # документ и промпт не расходились между собой.
        profile = PromptCompilerAgent._control_profile(ctx)
        layout = PromptCompilerAgent._TOUCH_LAYOUTS[profile]
        desktop = PromptCompilerAgent._DESKTOP_LAYOUTS.get(
            profile, PromptCompilerAgent._DESKTOP_LAYOUTS["default"]
        )
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

