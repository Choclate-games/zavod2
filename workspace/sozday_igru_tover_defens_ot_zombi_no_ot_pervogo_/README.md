# Бастион 13: Сапёр Периметра 🎮

> **Бастион 13: Сапёр Периметра — это 3D Tower Defense от первого лица в атмосфере сурового дизельпанка. Вы не просто стреляете, а командуете огневой мощью бастиона: возводите пулеметные, огнеметные и крио-турели по слотам периметра, разносите энергоблоки, охлаждаете раскаленные докрасна стволы крио-спреем прямо под носом у накатывающей орды зомби и удерживаете рубеж до рассвета.**

---

## 🌟 Project Overview
- **Genre**: 3D Экшен-Стратегия / Tower Defense от первого лица (Дизельпанк Тактический FPS-Инженер / Оборона Периметра / Thermal Management TD)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Мужчины и женщины 16–45 лет, фанаты Tower Defense, дизельпанка и динамичных зомби-экшенов, ценящие тактическую глубину, управление ресурсами в реальном времени и напряженную атмосферу выживания.
- **Core Hook**: В разгар боя пулеметная турель раскаляется докрасна и вот-вот взорвется прямо перед мордами десятков зомби; инженер на спринте влетает в амбразуру, заливает ствол шипящим крио-спреем под оглушительный выброс пара и в последний миг спасает сектор от прорыва.

---

## 📁 Package Directory Map
```text
workspace/sozday_igru_tover_defens_ot_zombi_no_ot_pervogo_/
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
