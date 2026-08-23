# Вышибала: Сброс за борт 🎮

> **«Вышибала: Сброс за борт» — это ураганный 3D-экшен от первого лица в парящем неоновом казино, где вы выбиваете киборгов за борт мощными спартанскими пинками, битами и кинетическими выстрелами, запуская зрелищные цепные рэгдолл-реакции.**

---

## 🌟 Project Overview
- **Genre**: 3D Физический Экшен от первого лица (Аренный браулер с физикой рэгдолла и ринг-аутом)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки 12–35 лет на Яндекс Играх и VK Play, любящие динамичные физические экшены, браулеры от первого лица и игры с рэгдолл-эффектами (Paint the Town Red, Anger Foot), ценящие сокрушительные пинки и быстрое прохождение арены за 2.5–4 минуты.
- **Core Hook**: Спартанский пинок с разбега в грудь 300-килограммового золотого киборга на краю дирижабля, от которого тот сносит троих охранников, проламывает стеклянную витрину бара и вся четверка кубарем в рэгдолле улетает в бездну ночного мегаполиса под звон стекла и взрыв фишек казино.

---

## 📁 Package Directory Map
```text
workspace/prompt_dlya_razrabotki_igry_kick_arena_sozday_br_002/
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
