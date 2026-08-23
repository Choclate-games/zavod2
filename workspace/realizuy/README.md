# Kick Arena: Кинетический Рикошет 🎮

> **«Kick Arena» — это взрывной 3D-бравлер от третьего лица с физикой Rapier3D, где спартанский пинок превращает врагов в живые кинетические тараны, сносящие толпы бандитов и ломающие арену в щепки.**

---

## 🌟 Project Overview
- **Genre**: 3D Физический Бравлер / Beat 'em up (Кинетический арена-экшен с рэгдоллом и цепными разрушениями)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat ^0.20.0)
- **Platform**: Playgama Bridge (Яндекс Игры, VK Play, Web, Mobile Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки 14–35 лет, любящие зрелищные физические браулеры, кинетические драки с рэгдоллом (в духе симуляторов разрушений и физического хаоса), ценящие тактильную отдачу, сочные удары, запуск врагов пинком через всю комнату и короткие адреналиновые сессии на 3–5 минут.
- **Core Hook**: Момент, когда мощным спартанским пинком ты запускаешь 120-килограммового громилу через всю арену, он пробивает штабель поддонов, сбивает с ног троих набегающих бандитов, рикошетит в бочку с горючим, вызывая взрывную ударную волну, а игра на 0.08 секунды замирает в хитстопе с яростной тряской камеры и неоновыми искрами.

---

## 📁 Package Directory Map
```text
workspace/realizuy/
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

## 🚀 Запуск и разработка
```bash
npm install      # Установка зависимостей
npm run dev      # Запуск локального сервера разработки (Vite)
npm run build    # Сборка проекта (TypeScript + Vite)
npm run check:spec # Статическая проверка приёмки
npm run smoke    # Дымовой тест в браузере Chromium
```

---

## 🎮 Управление

| Действие | ПК (Клавиатура + Мышь) | Мобильные устройства (Тач) |
|---|---|---|
| Движение | `WASD` / Стрелки | Плавающий сенсорный джойстик слева |
| Спартанский пинок | `Space` / `ЛКМ` (тап — быстрый, удержание — заряженный) | Кнопка «Kick» справа снизу (тап / зажатие) |
| Рывок уклонения | `Shift` (направление по WASD) | Кнопка «Dash» |
| Подбор / Бросок | `E` (подбор), `ПКМ` / `Q` (бросок) | Кнопка «Grab» |
| Пауза / Меню | `Esc` | Кнопка паузы на экране |

---

## 📁 Структура исходного кода (`src/`)
```text
src/
├── main.ts                    # Bootstrap, Playgama Bridge init, Game launch
├── config/
│   └── Balance.ts             # Числа игры из balance.yaml
├── core/
│   ├── Game.ts                # Координатор и конечный автомат состояний
│   ├── GameLoop.ts            # Фиксированный 60 Гц цикл с защитой от лагов
│   └── EventBus.ts            # Типизированная шина событий
├── platform/
│   ├── PlaygamaService.ts     # Интеграция Playgama Bridge (реклама, lifecycle, ready)
│   └── StorageService.ts      # Нормализация и сохранение player_cups
├── physics/
│   └── PhysicsWorld.ts        # Физика Rapier3D, октагон, коллизии
├── rendering/
│   ├── SceneManager.ts        # Three.js сцена, трехточечный свет, follow-камера, шейк
│   ├── ProceduralModels.ts    # Low-poly 3D модели бойцов, октагона и пропсов
│   └── ParticleSystem.ts      # Инстансированные частицы искр и щепок
├── entities/
│   ├── Player.ts              # Боец игрока, спартанский пинок, дэш
│   ├── Enemy.ts               # Враги (хулиган, тяжеловес, босс), рэгдолл-полет
│   ├── Prop.ts                # Разрушаемые ящики и взрывные бочки
│   └── EntityManager.ts       # Режиссер волн 1–4, расчет кегельбана и сплэтов
├── ui/
│   ├── theme.css              # Токены оформления, палитра, слои и медиа-запросы
│   ├── icons.ts               # Векторные SVG иконки без эмодзи
│   ├── UiRoot.ts              # Менеджер слоев интерфейса и вьюпорта
│   ├── ScreenRouter.ts        # Маршрутизатор экранов с плавными переходами
│   ├── Hud.ts                 # Оверлей здоровья, кэша, комбо и волн
│   ├── TouchControls.ts       # Сенсорный джойстик и кнопки на Pointer Events
│   └── screens/               # MainMenu, HudOverlay, Workbench, PauseModal, VictoryDefeat
└── audio/
    └── AudioManager.ts        # Web Audio процедурный синтезатор звуков
```

