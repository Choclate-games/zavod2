# Браузерную «почтальон улиток» three.js

> **Ведите живую колонию через сезоны: планируйте, рискуйте и смотрите, как решения дают всходы!**

---

## Проект
- **Genre**: 3D Менеджмент колонии / Idle-стратегия (Жизнь и рост поселения)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat 0.13.x)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки Яндекс Игр, CrazyGames и мобильных веб-порталов.
- **Core Hook**: Вы задаёте правила, а колония живёт сама и приносит последствия ваших решений.

---

## Запуск
```bash
npm install
npm run dev
```

Для production-проверки: `npm run build`, для локального просмотра сборки: `npm run preview`.

## Управление
- **ПК**: зажмите ЛКМ на саду и проведите маршрут от цветка к гнезду; `WASD` или стрелки панорамируют камеру; тап по улитке меняет роль; `H` увлажняет сад, `G` переводит сборщика в стражи; `P`/кнопка `Ⅱ` ставит игру на паузу.
- **Телефон**: проведите пальцем по саду для маршрута; плавающий стик слева панорамирует карту; кнопки справа расходуют росу и выставляют стража; тап по улитке меняет роль.
- **Проверка touch-раскладки на ПК**: добавьте `?touch=1` к URL. `?touch=0` принудительно отключает её.

## Структура каталогов
```text
workspace/brauzernuyu-pochtalon-ulitok-three-js/
├── AGENTS.md                        # Инструкция для ИИ-агента (пишет фабрика)
├── AI_DEVELOPER_PROMPT.md           # Definitive master prompt for coding agent
├── DEVLOG.md                        # Журнал разработки, ведёт кодовый агент
├── CHANGELOG.md                     # Changelog проекта, ведёт кодовый агент
├── package.json                      # npm-скрипты и зависимости
├── index.html                        # canvas и HUD
├── vite.config.ts                    # dev-сервер и production build
├── tsconfig.json                     # strict TypeScript
├── src/
│   ├── main.ts                       # boot, viewport guards, platform wiring
│   ├── core/                         # Game, fixed GameLoop, EventBus
│   ├── game/                         # типы событий и числовая конфигурация
│   ├── input/                        # keyboard + Pointer Events touch controls
│   ├── physics/                      # Rapier3D fixed-world wrapper
│   ├── platform/                     # Playgama Bridge и offline save fallback
│   ├── systems/                      # colony simulation и enemy spawner
│   └── audio/                        # Howler mute и Web Audio feedback
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

## Архитектура
Игра использует fixed-step 60 Гц с ограничением дельты 100 мс, Rapier3D для кинематических тел улиток, общую типизированную EventBus для систем, общий пул визуальных врагов и capability-safe Playgama adapter с локальным fallback. Three.js ограничивает pixel ratio значением 1.5 и использует общие материалы для повторяющихся объектов.
