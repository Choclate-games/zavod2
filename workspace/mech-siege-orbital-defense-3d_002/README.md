# Мех-Осада: Защита Орбитальной Базы 3D 🎮

> **Управляйте боевым мехом, стройте автоматические турели и защищайте базу от тысяч монстров!**

---

## 🌟 Project Overview
- **Genre**: 3D Survivor Base Defense (Тактический Мех-Экшен)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat 0.13.x)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Поклонники Vampire Survivors, Dome Keeper и Tower Defense.
- **Core Hook**: Уничтожение орд пришельцев боевым мехом с одновременным строительством защитных турелей и энергощитов.

---

## 📁 Package Directory Map
```text
workspace/mech-siege-orbital-defense-3d_002/
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
