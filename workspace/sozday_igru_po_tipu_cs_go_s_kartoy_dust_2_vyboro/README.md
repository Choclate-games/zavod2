# Dust 2: Ретейк и Дуэли 🎮

> **Dust 2: Ретейк и Дуэли — это быстрый тактический 3D-шутер от первого лица в браузере, в котором спецназ и террористы сходятся в матчах 3v3 на точках A и B карты Dust 2 с честным контр-стрейфом, отдачей оружия, прострелами и таймером бомбы C4.**

---

## 🌟 Project Overview
- **Genre**: Тактический 3D FPS-Шутер (Соревновательный тактический ретейк-шутер от первого лица)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Поклонники тактических соревновательных шутеров (CS:GO, CS2, Standoff 2) в возрасте 14-35 лет, ценящие честный скилл стрельбы, контр-стрейф и моментальный вход в бой прямо в браузере.
- **Core Hook**: На последних 4 секундах до детонации C4 сквозь рассеивающийся смок ставишь ван-тап в голову врагу и успеваешь обезвредить бомбу с купленным набором сапёра!

---

## 📁 Package Directory Map
```text
workspace/sozday_igru_po_tipu_cs_go_s_kartoy_dust_2_vyboro/
├── AGENTS.md                        # Инструкция для ИИ-агента (пишет фабрика)
├── ACCEPTANCE.md                    # Приёмка: пронумерованные проверки готовности
├── AI_DEVELOPER_PROMPT.md           # Definitive master prompt for coding agent
├── balance.yaml                     # Числа игры: код читает их отсюда
├── scripts/check-spec.mjs           # Статическая часть приёмки, без зависимостей
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
