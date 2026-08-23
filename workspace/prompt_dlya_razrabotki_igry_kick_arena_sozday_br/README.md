# Судебный Пристав: Штурм Локдауна 🎮

> **«Судебный Пристав: Штурм Локдауна» — это взрывной тактический FPS от первого лица на Three.js и Rapier3D, где ты штурмуешь подземный бункер, выбиваешь бронедвери ногой прямо во врагов, стреляешь сквозь укрытия и разносишь толпы наемников сокрушительными физическими ударами и рикошетами.**

---

## 🌟 Project Overview
- **Genre**: Тактический 3D FPS / Кинетический Брейкер (Физический Штурмовой Экшен от первого лица с рукопашным боем)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Мужчины и подростки 16–35 лет, ценящие тактические шутеры от первого лица, смачный физический импакт ударов, разрушаемое окружение и динамичные сессии на 2 минуты.
- **Core Hook**: Момент, когда игрок выбивает тяжелую гермодверь пинком ноги, летящая дверь расплющивает пулеметчика в рэгдолл, сбивает стойку с взрывными баллонами, а игрок сквозь облако пыли отстреливает двоих автоматчиков рикошетами от стальных балок.

---

## 📁 Package Directory Map
```text
workspace/prompt_dlya_razrabotki_igry_kick_arena_sozday_br/
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
