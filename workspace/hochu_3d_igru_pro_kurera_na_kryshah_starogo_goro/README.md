# Черепичный Спринт: Чистый Флоу 🎮

> **«Черепичный Спринт: Чистый Флоу» — это адреналиновый 3D-раннер от третьего лица для одного пальца. Мчись по крышам старого города, прыгай через пропасти, скользи под вентиляцией и амортизируй приземления, чтобы донести хрупкую посылку в целости и сорвать рекордный куш чаевых.**

---

## 🌟 Project Overview
- **Genre**: 3D Паркур-Раннер / Спидран-Аркада (Флоу-Раннер / Тайминг-Платформер с Физикой Инерции Груза)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Mobile Web)
- **Orientation**: Portrait
- **Target Audience**: Игроки мобильных веб-платформ (16–35 лет), ценящие ритмичные раннеры, состояние потока (flow state), паркур и тайм-атаку, с короткими игровыми сессиями по 1–2 минуты и мгновенным управлением одним пальцем.
- **Core Hook**: Секунда затяжного прыжка над 10-метровым разрывом между особняками на закате: игрок зажимает палец в воздухе, курьер группируется, идеально амортизирует приземление на крутой черепичный скат, сохраняя 100% целостности алхимической колбы и удерживая комбо-множитель скорости х4.

---

## 📁 Package Directory Map
```text
workspace/hochu_3d_igru_pro_kurera_na_kryshah_starogo_goro/
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
