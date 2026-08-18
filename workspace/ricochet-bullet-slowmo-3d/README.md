# Рикошет Снайпер 3D: Замедленный Выстрел 🎮

> **«Superhot встречает Sniper Elite в формате 3D-головоломки»: целься лазерным лучом с учетом нормалей стен, жми на спуск и наблюдай в кинематографичном slow-mo, как твоя пуля огибает препятствия, проходит сквозь порталы, детонирует бочки и сокрушает красных врагов!**

---

## 🌟 Project Overview
- **Genre**: Физическая головоломка / Тактический 3D-шутер (Рикошет-пазл от первого лица со Slow-Motion Bullet-Cam)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat 0.13.x)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web & Mobile)
- **Orientation**: Landscape
- **Target Audience**: Игроки 12-45 лет, ценящие тактические физические головоломки, кинематографичный экшен в стиле Superhot / Sniper Elite и залипательный гиперказуальный геймплей с реиграбельностью.
- **Core Hook**: Гипнотический кинематографический Slow-Motion полет пули от первого лица с физически честными рикошетами, взрывами бочек и эпичным разлетом красных врагов одним точным выстрелом.

---

## 📁 Package Directory Map
```text
workspace/ricochet-bullet-slowmo-3d/
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

## Запуск
```bash
npm install
npm run dev
```
Для production-проверки используйте `npm run build` и `npm run preview`.

## Управление
- Клавиатура: `WASD`/стрелки и движение мышью задают угол, `J` или ЛКМ стреляют, `Space` ускоряет bullet-cam, `R` перезапускает, `P`/`Esc` ставят паузу.
- Телефон: удерживайте и ведите палец в левой половине для плавающего стика, большая кнопка `FIRE` справа стреляет одновременно с движением, `DASH` зарезервирован под действие.
- Для проверки тач-раскладки мышью на ПК откройте `?touch=1`; стандартное определение можно отключить через `?touch=0`.

## Структура кода
`src/core` содержит игровой цикл и координатор, `src/rendering` отвечает за Three.js, `src/systems` за уровни и рикошеты, `src/physics` за Rapier и разрушения, `src/ui` за HUD/Pointer Events, `src/platform` за Playgama и сохранения, `src/audio` за Web Audio.
