Ты должен разработать **AI Game Prompt Factory** — локальное приложение на Python, которое по описанию будущей игры автоматически создает полный пакет проектной документации, визуальный concept preview и финальный промпт для AI coding agent.

Это **не фабрика готовых игр**.

Это **генератор спецификаций для создания игр**.

Главный результат работы программы:

```text
Идея игры
    ↓
анализ механик и референсов
    ↓
выбор технологии
    ↓
Game Design
    ↓
Gameplay Design
    ↓
Technical Architecture
    ↓
Art Direction
    ↓
UI/UX
    ↓
Progression
    ↓
Monetization
    ↓
Playgama Integration
    ↓
Development Plan
    ↓
Skills
    ↓
Concept Preview Image
    ↓
FINAL AI DEVELOPER PROMPT
```

---

# 1. Главная задача

Пользователь запускает приложение и вводит, например:

```text
Создай 3D игру про гладиаторов.
Бои должны ощущаться физически,
оружие должно влиять на анимации и баланс,
игра рассчитана на Яндекс Игры.
```

Программа должна самостоятельно:

1. понять игровую идею;
2. определить жанр;
3. определить core gameplay loop;
4. подобрать подходящие игровые референсы;
5. определить, какие механики можно использовать;
6. решить, использовать Three.js или PixiJS;
7. спроектировать игру;
8. создать архитектурный документ;
9. создать технический документ;
10. создать дизайн-документ;
11. описать UI/UX;
12. продумать мобильное управление;
13. продумать монетизацию;
14. спроектировать интеграцию Playgama;
15. создать roadmap разработки;
16. создать game-specific skills;
17. сгенерировать изображение концепта;
18. собрать всё в единый финальный prompt для coding agent.

---

# 2. Основной принцип

Не генерируй просто длинный текст.

Фабрика должна работать как **pipeline специализированных AI-ролей**.

Логическая структура:

```text
User Input
    ↓
Idea Analyzer
    ↓
Game Designer
    ↓
Reference Analyst
    ↓
Mechanics Architect
    ↓
Renderer Selector
    ↓
Technical Architect
    ↓
Playgama Specialist
    ↓
Monetization Designer
    ↓
Art Director
    ↓
UX Designer
    ↓
Preview Generator
    ↓
Skill Generator
    ↓
Prompt Compiler
    ↓
Output Package
```

Каждый этап должен иметь отдельный Python-модуль.

Не делай один гигантский Python-файл.

---

# 3. Технологический стек фабрики

Используй:

```text
Python 3.11+
Pydantic
PyYAML
Jinja2
Typer или argparse
Rich
pathlib
```

Архитектура должна позволять подключить AI provider через адаптер.

Создай интерфейс:

```text
AIProvider
```

и реализации через adapters.

Например:

```text
providers/
├── base.py
├── openai.py
├── anthropic.py
├── google.py
├── local.py
└── factory.py
```

Не привязывай всю систему к одному AI-провайдеру.

---

# 4. Структура проекта

Создай:

```text
ai_game_prompt_factory/
├── README.md
├── pyproject.toml
├── requirements.txt
├── .env.example
│
├── config/
│   ├── factory.yaml
│   ├── models.yaml
│   ├── genres.yaml
│   ├── mechanics.yaml
│   ├── references.yaml
│   └── playgama.yaml
│
├── app/
│   ├── __init__.py
│   ├── cli.py
│   ├── pipeline.py
│   ├── context.py
│   ├── models.py
│   ├── config.py
│   └── logging.py
│
├── providers/
│   ├── base.py
│   ├── openai.py
│   ├── anthropic.py
│   ├── google.py
│   ├── local.py
│   └── factory.py
│
├── agents/
│   ├── idea_analyzer.py
│   ├── game_designer.py
│   ├── reference_analyst.py
│   ├── mechanics_architect.py
│   ├── renderer_selector.py
│   ├── technical_architect.py
│   ├── playgama_specialist.py
│   ├── monetization_designer.py
│   ├── art_director.py
│   ├── ux_designer.py
│   ├── preview_designer.py
│   ├── skill_generator.py
│   └── prompt_compiler.py
│
├── knowledge/
│   ├── mechanics/
│   ├── patterns/
│   ├── references/
│   ├── monetization/
│   ├── threejs/
│   ├── pixijs/
│   └── playgama/
│
├── templates/
│   ├── documents/
│   ├── prompts/
│   ├── skills/
│   └── project/
│
├── generators/
│   ├── document_generator.py
│   ├── preview_generator.py
│   ├── skill_generator.py
│   └── output_generator.py
│
├── validators/
│   ├── document_validator.py
│   ├── consistency_validator.py
│   ├── completeness_validator.py
│   └── output_validator.py
│
├── cli/
│
└── output/
```

---

# 5. Пользовательский интерфейс

Основной интерфейс должен быть CLI.

Минимальные команды:

```bash
python -m app.cli create
```

Интерактивный режим:

```text
Название/идея:
Жанр:
Особые требования:
Платформа:
Renderer:
```

Но пользователь может указать только идею.

Например:

```bash
python -m app.cli create "физический гладиаторский roguelike"
```

Программа должна самостоятельно заполнить остальные параметры.

---

# 6. Команды

Создай:

```bash
python -m app.cli create "..."
```

Создает полный пакет.

```bash
python -m app.cli create --file idea.txt
```

Берет описание из файла.

```bash
python -m app.cli create --interactive
```

Интерактивный режим.

```bash
python -m app.cli analyze "..."
```

Только анализ идеи.

```bash
python -m app.cli preview GAME_ID
```

Повторно генерирует preview.

```bash
python -m app.cli rebuild-docs GAME_ID
```

Перегенерирует документацию.

```bash
python -m app.cli rebuild-prompt GAME_ID
```

Пересобирает финальный AI Developer Prompt.

```bash
python -m app.cli skills GAME_ID
```

Перегенерирует skills.

```bash
python -m app.cli validate GAME_ID
```

Проверяет пакет.

---

# 7. Формат результата

Для каждой идеи создавай:

```text
output/
└── <game_slug>/
    ├── README.md
    ├── GAME_DESIGN_DOCUMENT.md
    ├── GAMEPLAY_SPECIFICATION.md
    ├── CORE_LOOP.md
    ├── MECHANICS.md
    ├── PROGRESSION.md
    ├── LEVEL_DESIGN.md
    ├── DIFFICULTY_DESIGN.md
    ├── TECHNICAL_SPECIFICATION.md
    ├── ARCHITECTURE_DOCUMENT.md
    ├── THREEJS_ARCHITECTURE.md
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
        └── PLAYGAMA_SKILL.md
```

---

# 8. GAME_DATA.yaml

Помимо документов всегда сохраняй структурированные данные.

Пример:

```yaml
title:
slug:
genre:
subgenre:
renderer:
platform:
orientation:
target_audience:

core_loop:
hook:
player_fantasy:

references:
  - name:
    mechanics:
    lessons:

mechanics:
  - name:
    category:
    priority:

progression:
monetization:
playgama_features:

scores:
  fun:
  originality:
  replayability:
  development_cost:
  visual_appeal:
  mobile_fit:
  monetization:
  platform_fit:
```

Это позволит в будущем строить web UI, искать игры и массово перерабатывать проекты.

---

# 9. Knowledge Base

Создай внутреннюю базу знаний.

Она должна содержать reusable знания, а не готовые игры.

Структура:

```text
knowledge/
├── mechanics/
├── patterns/
├── references/
├── monetization/
├── threejs/
├── pixijs/
└── playgama/
```

---

# 10. Библиотека механик

Каждая механика — отдельный Markdown-файл.

Например:

```text
knowledge/mechanics/ragdoll.md
knowledge/mechanics/dash.md
knowledge/mechanics/parry.md
knowledge/mechanics/physics_destruction.md
knowledge/mechanics/wave_survival.md
knowledge/mechanics/base_building.md
knowledge/mechanics/upgrade_choices.md
```

Формат:

```text
# Mechanic

Name:
Category:
Description:

Player interaction:

Feedback:

Strengths:

Weaknesses:

Good combinations:

Bad combinations:

Technical complexity:

Three.js suitability:

PixiJS suitability:

Retention potential:
```

Количество механик не должно быть фиксировано.

---

# 11. Game Patterns

Создай шаблоны gameplay loop.

Например:

```text
knowledge/patterns/survivor_loop.md
knowledge/patterns/roguelike_loop.md
knowledge/patterns/builder_defense_loop.md
knowledge/patterns/physics_arcade_loop.md
knowledge/patterns/score_attack_loop.md
knowledge/patterns/arena_combat_loop.md
```

Каждый pattern описывает:

* starting state;
* player action;
* challenge;
* reward;
* progression;
* escalation;
* session ending;
* replay trigger.

---

# 12. Референсы

Создай каталог референсных игр.

Формат:

```text
knowledge/references/<game>.md
```

Содержит:

```text
Game:
Genre:
Core loop:
Core mechanic:
Progression:
Retention:
Monetization:
Visual identity:
Why it works:
What can be learned:
What should NOT be copied:
```

Разрешено использовать существующие успешные игры как референсы.

Но фабрика должна искать **механики и design patterns**, а не производить прямые клоны.

---

# 13. Renderer Selector

Создай отдельного агента:

```text
agents/renderer_selector.py
```

Он выбирает:

### Three.js

Если требуется:

* полноценный 3D;
* physics;
* vehicles;
* ragdolls;
* destruction;
* spatial gameplay;
* 3D environments;
* 3D simulation.

### PixiJS

Если требуется:

* 2D;
* cards;
* roguelike UI;
* strategy;
* tower defense;
* puzzle;
* arcade;
* 2D simulation.

Результат должен содержать:

```yaml
renderer: threejs
reason:
confidence:
```

Пользователь должен иметь возможность принудительно указать renderer:

```bash
--renderer threejs
```

или:

```bash
--renderer pixijs
```

---

# 14. Game Design Document

`GAME_DESIGN_DOCUMENT.md` должен содержать:

* Vision;
* elevator pitch;
* player fantasy;
* target audience;
* genre;
* session model;
* game loop;
* win/lose conditions;
* player actions;
* enemies;
* obstacles;
* rewards;
* progression;
* content structure;
* replayability;
* retention;
* difficulty;
* long-term goals.

Не ограничивайся общими фразами.

Документ должен позволить game designer'у начать производство.

---

# 15. Gameplay Specification

Подробно опиши каждый gameplay system.

Например:

```text
Player Movement
Combat
Enemies
Spawn System
Damage
Health
Rewards
Upgrades
Bosses
Events
```

Для каждого:

```text
Purpose
Input
Rules
State
Interactions
Feedback
Edge cases
```

---

# 16. Architecture Document

Это один из самых важных файлов.

Опиши:

```text
Application Layer
Game Layer
Core Systems
Entity Systems
Rendering
Input
Audio
UI
Save
Platform
Ads
Analytics
Content
```

Должны быть описаны зависимости.

Пример:

```text
GameLoop
    ↓
Gameplay Systems
    ↓
Entities
    ↓
Physics / Rendering
```

и:

```text
Game
 ├── InputService
 ├── AudioService
 ├── SaveService
 ├── UIService
 └── PlaygamaService
```

Не пиши абстрактную архитектуру ради красивой схемы.

Она должна соответствовать конкретной игре.

---

# 17. Technical Specification

Документ должен содержать:

* TypeScript;
* Vite;
* renderer;
* libraries;
* architecture;
* classes/modules;
* state;
* collision;
* physics;
* asset management;
* loading;
* save system;
* performance;
* mobile;
* error handling;
* build;
* deployment.

---

# 18. Playgama

**Playgama Bridge является основной платформенной интеграцией.**

Архитектура каждой игры должна предусматривать отдельный adapter/service layer.

Не размазывай платформенный код по gameplay systems.

Используй концепцию:

```text
Game Logic
    ↓
Platform Services
    ↓
Playgama Bridge
```

Покрой документацией необходимые возможности:

* initialization;
* game ready;
* ads;
* rewarded;
* interstitial;
* storage;
* player;
* leaderboards;
* achievements;
* platform;
* language;
* device;
* pause/resume;
* optional social features;
* optional payments;
* optional cross-promo/tasks/daily rewards, если они нужны конкретной игре.

Всегда проверяй актуальную документацию/API Playgama перед генерацией конкретной интеграции.

Не выдумывай названия методов SDK.

Если генератор не может подтвердить конкретный API, используй формулировку уровня архитектуры, а не придумывай код.

---

# 19. Monetization

Для каждой игры опиши:

* ads strategy;
* rewarded ads;
* interstitial placement;
* optional purchases;
* player value;
* frequency;
* fallback;
* impact on gameplay.

Не превращай монетизацию в отдельный слой, который ломает игру.

---

# 20. Mobile

Опиши:

* portrait/landscape;
* touch;
* gestures;
* virtual controls;
* safe areas;
* pause;
* orientation change;
* performance;
* loading.

Учитывай browser-based mobile environment.

---

# 21. Preview

Preview — **ТОЛЬКО КАРТИНКА**.

Не создавать:

* HTML prototype;
* playable prototype;
* npm preview project;
* Three.js demo;
* PixiJS demo.

Нужно сгенерировать **concept gameplay screenshot** будущей игры.

Изображение должно показывать:

* игровой момент;
* player;
* основные игровые объекты;
* environment;
* camera;
* UI/HUD;
* визуальный стиль;
* core mechanic.

Это должно выглядеть как screenshot существующей игры, а не как рекламный постер.

Например, вместо:

> "герой стоит на фоне города"

нужно генерировать:

> gameplay screenshot from an in-game camera, player fighting enemies in the city, visible health HUD, score, ability icons, active effects, environmental destruction.

---

# 22. Preview Prompt

Создай отдельный документ:

```text
PREVIEW_PROMPT.md
```

В нем хранить итоговый prompt для image generation.

Он должен быть сформирован из:

```text
Art Direction
+
Camera
+
Gameplay
+
Environment
+
Player
+
Enemies
+
UI
+
Effects
+
Core Hook
```

---

# 23. Image Provider

Создай абстракцию:

```text
ImageProvider
```

и адаптеры.

Программа должна уметь работать с доступным image-generation backend через отдельный provider.

Не привязывай всю архитектуру к одному API.

Если image generation недоступна, приложение не должно падать.

В этом случае:

```text
PREVIEW_PROMPT.md
```

создается обязательно, а `concept_preview.png` помечается как pending.

---

# 24. Art Direction

Должны быть описаны:

* style;
* camera;
* environment;
* character proportions;
* lighting;
* materials;
* VFX;
* particles;
* UI;
* typography;
* visual hierarchy;
* color logic.

Учитывай экономичность реализации в Three.js/PixiJS.

---

# 25. UI/UX

Создай:

```text
UI_UX_SPECIFICATION.md
```

Опиши:

* HUD;
* menus;
* pause;
* game over;
* progression;
* rewards;
* ads;
* settings;
* feedback;
* onboarding.

При необходимости добавь wireframe в Markdown.

---

# 26. Skill Generation

Генератор должен создавать **game-specific skills**.

Не просто общий README.

Каждый skill должен содержать:

```text
Purpose
When to use
Rules
Architecture
Implementation guidance
Common mistakes
Validation checklist
```

Минимум:

```text
GAME_SKILL.md
GAMEPLAY_SKILL.md
RENDERER_SKILL.md
PLAYGAMA_SKILL.md
```

Если игре нужны специальные механики, создавай дополнительные skills.

Например:

```text
ragdoll_skill.md
destruction_skill.md
wave_defense_skill.md
card_synergy_skill.md
vehicle_physics_skill.md
```

---

# 27. Skills должны быть reusable

Не копируй в skill весь Game Design Document.

Skill должен содержать только знания и инструкции, полезные coding agent'у.

Например:

```text
vehicle_physics_skill.md
```

должен объяснять:

* управление;
* acceleration;
* friction;
* collision;
* drift;
* damage;
* pooling;
* optimization.

---

# 28. Финальный AI Developer Prompt

Это **главный выход фабрики**.

`AI_DEVELOPER_PROMPT.md` должен быть самодостаточным.

AI developer не должен открывать 20 файлов, чтобы понять задачу.

Prompt должен содержать:

```text
ROLE
PROJECT
GOAL
TECH STACK
RENDERER
PLATFORM
GAMEPLAY
CORE LOOP
MECHANICS
ARCHITECTURE
UI
MOBILE
ART
AUDIO
PROGRESSION
MONETIZATION
PLAYGAMA
PERFORMANCE
SAVE
QA
BUILD
DEFINITION OF DONE
```

При этом внизу можно добавить ссылки/пути на подробные документы как расширенный reference.

---

# 29. Definition of Done

Финальный prompt обязан иметь четкий:

```text
DEFINITION OF DONE
```

Например:

* project runs;
* build succeeds;
* gameplay loop works;
* mobile controls work;
* save/load works;
* Playgama integration layer exists;
* ads integration points exist;
* UI works;
* no console errors;
* performance target met;
* restart works;
* pause/resume works.

---

# 30. Self-Critique Agent

Перед выдачей результата запусти отдельную проверку.

Создай:

```text
agents/critic.py
```

Он должен проверить:

```text
Is the core loop clear?
Is the game differentiated?
Is the scope reasonable?
Does architecture match gameplay?
Does renderer choice make sense?
Is Playgama relevant integration defined?
Is monetization reasonable?
Is mobile support realistic?
Is preview consistent with design?
Is AI prompt complete?
```

Если документ содержит противоречия — исправляй автоматически.

---

# 31. Consistency Validator

Все документы должны быть согласованы.

Например, если:

```yaml
renderer: pixijs
```

то нельзя чтобы:

```text
ARCHITECTURE_DOCUMENT
```

говорил о Three.js renderer.

Также проверяй:

* название;
* жанр;
* core loop;
* player abilities;
* controls;
* progression;
* monetization;
* Playgama features.

---

# 32. Автоматическое создание папки

Slug создается автоматически:

```text
"3D Gladiator Roguelike"
→
3d_gladiator_roguelike
```

Если папка существует:

```text
3d_gladiator_roguelike_002
```

---

# 33. Сохранение контекста

Создай:

```text
output/<game>/generation.json
```

Сохраняй:

* user prompt;
* timestamp;
* selected provider;
* model;
* renderer;
* intermediate structured data;
* scores;
* generation status.

Это позволит перегенерировать отдельный документ без пересоздания всего проекта.

---

# 34. Incremental regeneration

Очень важно.

Пользователь должен иметь возможность заменить только часть результата.

Например:

```bash
python -m app.cli rebuild GAME_ID --section monetization
```

или:

```bash
python -m app.cli rebuild GAME_ID --section architecture
```

или:

```bash
python -m app.cli rebuild GAME_ID --section preview
```

После этого остальные документы не трогать.

---

# 35. Prompt Compilation

Финальный AI Developer Prompt должен собираться программно.

Не делай его просто еще одним независимым AI-generated Markdown.

Пусть:

```text
structured game data
+
documents
+
skills
+
constraints
```

попадают в:

```text
Prompt Compiler
```

который формирует:

```text
AI_DEVELOPER_PROMPT.md
```

Так конечный prompt будет консистентным.

---

# 36. Режимы генерации

Сделай минимум 3 режима.

### FAST

```bash
python -m app.cli create "idea" --mode fast
```

Минимальная документация + preview + final prompt.

### STANDARD

Полный пакет.

### DEEP

Глубокий анализ референсов, механик, архитектуры, retention, Playgama и дополнительные skills.

---

# 37. Пример использования

Пользователь:

```bash
python -m app.cli create \
"Сделай браузерную игру в духе Vampire Survivors,
но игрок управляет маленьким боевым мехом,
а между волнами строит оборонительную базу."
```

Factory должна самостоятельно получить примерно:

```text
Genre:
Survival / Base Defense

Renderer:
Three.js

Core Loop:
Explore → Kill → Collect → Upgrade → Build → Defend → Repeat

References:
Vampire Survivors
Brotato
Tower Defense patterns

Unique Hook:
Mech survival + persistent battlefield base

Platform:
Playgama

Orientation:
Landscape
```

После чего построить всю документацию.

---

# 38. Что НЕ делать

Не превращай проект в:

* game engine;
* готовый Unity replacement;
* онлайн IDE;
* полноценный game generator;
* систему из 30 отдельных игр;
* коллекцию статичных шаблонов.

Фабрика должна **проектировать игры и подготавливать их к разработке**.

---

# 39. Что должно быть готово после выполнения этого задания

Ты должен создать рабочий Python-проект.

Я должен иметь возможность сделать:

```bash
python -m app.cli create "моя идея"
```

и получить:

```text
output/my_game/
```

с:

```text
полным GDD
+
Gameplay Spec
+
Architecture
+
Technical Spec
+
Art Direction
+
UI/UX
+
Progression
+
Monetization
+
Playgama
+
Mobile
+
Performance
+
QA
+
Roadmap
+
Reference Analysis
+
Skills
+
Preview Prompt
+
Concept Preview Image
+
Final AI Developer Prompt
```

---

# 40. Приоритеты

Расставь приоритет разработки именно так:

### Priority 1

Корректный pipeline.

### Priority 2

Качественный Game Design Document.

### Priority 3

Качественный Architecture / Technical Document.

### Priority 4

Сильный AI Developer Prompt.

### Priority 5

Skills.

### Priority 6

Playgama integration knowledge.

### Priority 7

Concept Preview.

### Priority 8

CLI удобство.

---

# 41. Ключевой критерий

После генерации я должен иметь ощущение:

> **"Я могу взять эту папку, передать `AI_DEVELOPER_PROMPT.md` coding agent'у и начать настоящую разработку без повторного проектирования игры с нуля."**

Именно это является основной целью всего проекта.

Не количество игр.

Не количество файлов.

Не объем текста.

**Главная цель — превратить сырую идею в качественное, согласованное и исполнимое ТЗ для AI-разработчика.**

Начни с реализации самой фабрики, ее моделей данных, pipeline, provider abstraction, knowledge base, document generator, skill generator, preview generator, validators и prompt compiler.

После этого создай одну тестовую игровую концепцию и полностью прогони через pipeline, чтобы проверить всю систему end-to-end.
