# Ван-Тап: Дуэли на Крыше 🎮

> **CS:GO, сжатый до абсолютного концентрата: дуэли 1v1 на крыше строящегося небоскреба, где раунд длится 12 секунд. Сделай контр-стрейф, поймай точку нулевой инерции и поставь ван-тап в голову врага со звоном сорванного шлема!**

---

## 🌟 Project Overview
- **Genre**: Тактический 3D FPS-Шутер (Соревновательные дуэли 1v1 / Высотный контр-стрейф арена-шутер от первого лица)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK Play / CrazyGames / Web & Mobile)
- **Orientation**: Landscape
- **Target Audience**: Игроки 14–35 лет, поклонники CS:GO, Valorant и соревновательных тактических шутеров, ценящие чистый механический скилл, мгновенный отклик, тайминг контр-стрейфа и триумф хедшотов, играющие в короткие сессии по 1–3 минуты на ПК и смартфонах.
- **Core Hook**: Момент, когда на 7-й секунде раунда ты выходишь из-за строительной балки на свайпе, жмешь противоположный стрейф, ловишь идеальный ноль скорости и за 120 миллисекунд ставишь противнику ван-тап из Desert Eagle — его каска со снопом золотых искр улетает в бездну заката над мегаполисом под оглушительный металлический 'ДЗЫНЬ!'.

---

## 📁 Package Directory Map
```text
workspace/sozday_igru_po_tipu_cs_go/
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
