# AC-130: Ночной Тепловизор 🎮

> **Стань оператором ночного ганшипа AC-130: уничтожай вражескую бронетехнику и зачищай здания из 25-мм пулемета, 40-мм автопушки и 105-мм гаубицы через прицел тепловизора. Рассчитывай упреждение снарядов с высоты 1000м и спаси союзный спецназ за 90 секунд напряженного боя!**

---

## 🌟 Project Overview
- **Genre**: 3D Тактический Рельсовый Авиа-Шутер (FLIR-симулятор огневой поддержки / Аркадный ганшип)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Мужчины 16–45 лет, поклонники Call of Duty (культовая миссия «Death From Above»), фанаты военной авиации, тактических шутеров и игр с зрелищной физикой разрушений.
- **Core Hook**: Залп 105-мм гаубицы с высоты 1000 метров с баллистической задержкой в 2 секунды: ослепительно белая тепловая вспышка в монохромном тепловизоре разрывает вражескую колонну на горящие обломки ровно в 10 метрах от укрытия союзного спецназа под хладнокровный радиодоклад «Direct hit, target destroyed!».

---

## 📁 Package Directory Map
```text
workspace/sozday_igru_po_tipu_call_of_duty/
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
