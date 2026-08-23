# Био-Колизей: Ударный Синтез

> **«Био-Колизей: Ударный Синтез» — это динамичный 3D мердж-экшен на круглой гладиаторской арене над лавой. Швыряй и сталкивай зубастых комьев-мутантов пальцем или мышью: каждый акт слияния порождает разрушительную ударную волну, сдувающую нападающую орду в бездну. Вырасти легендарного титана и очисти колизей до того, как арена сгорит под ногами!**

---

## Project Overview
- **Genre**: 3D Физический Мердж-Экшен (Гладиаторский Арена-Браулер с Кинетическим Слиянием)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки 12–35 лет, любящие динамичные арена-потасовки, физические разрушения и удовлетворяющие механики слияния (Suika, Gang Beasts, Smash Bros).
- **Core Hook**: Момент, когда два кома 3-го уровня сливаются прямо в кольце окруживших тебя монстров, порождая сокрушительную ударную волну, которая в слоу-мо взрывом сносит десять врагов за край кипящей магматической бездны!

---

## 📁 Package Directory Map
```text
workspace/dinamichnyy_3d_merdzh_ekshen_s_vidom_sverhu_na_k/
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

## Run
1. `npm install`
2. `npm run dev`
3. Open the Vite URL in a browser. Production builds use `npm run build` and `npm run preview`.

## Controls
- Desktop: hold the left mouse button on a bio-blob, drag away from the target and release to fling or merge. A quick click, `Space`, or right click triggers the nearest jaw impulse. `Escape` or `P` pauses; `R` restarts.
- Phone/tablet: drag directly on a blob with one finger and release to fling or merge. The large `Jaws` button triggers the jaw impulse; the pause button remains in the HUD.
- `?input=touch` and `?input=desktop` force either layout for testing. The page is locked to the game viewport and supports landscape plus portrait fallback.

## Structure
- `src/core`, `src/entities`, `src/physics`, `src/systems`: fixed-step game and gameplay rules.
- `src/rendering`: procedural Three.js arena, creatures and pooled effects.
- `src/ui`: theme, localized screens, HUD and touch controls.
- `src/platform`, `src/audio`: Playgama lifecycle/save/ads adapter and Web Audio.
- `public`: platform bridge configuration; `scripts`: static and browser smoke checks.
