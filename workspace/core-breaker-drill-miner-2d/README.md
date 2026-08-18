# Бурильщик Бездны: Рикошет Руды 🎮

> **Вертикальный 2D рогалик-майнер, где вы управляете боевым буром, уничтожаете процедурную пиксельную породу и запускаете рикошетящие лазеры, испепеляющие орды подземных тварей. Каждые 50 метров — выбор перка, каждые 200 метров — колоссальный босс!**

---

## 🌟 Project Overview
- **Genre**: 2D Экшен-рогалик / Майнер (Вертикальный шахтёр / Bullet Heaven)
- **Renderer**: **PIXIJS v8** + **Matter.js** (^0.19.0)
- **Platform**: Playgama Bridge (Yandex Games / VK Games / Mobile Web)
- **Orientation**: Portrait
- **Target Audience**: Любители Dome Keeper, Noita, Vampire Survivors и Mr. Mine; казуальные и мидкорные игроки мобильного веба 16-35 лет, ценящие сочную физику разрушений и быстрые сессии.
- **Core Hook**: Гипер-удовлетворяющее пиксельное разрушение породы в комбинации с лазерным авто-рикошетом, превращающим каждый узкий туннель в смертоносную световую ловушку для подземных чудовищ.

---

## 🚀 How to Run

```bash
npm install
npm run dev
```

Игра откроется по адресу `http://localhost:5173/`.

Сборка production-билда:

```bash
npm run build
npm run preview
```

---

## 🎮 Controls

### Desktop (Keyboard + Mouse)
- `WASD` / стрелки — движение бура
- `ЛКМ` / `J` — активировать бур (разрушать породу в направлении движения)
- `ПКМ` / `K` — тяжёлая атака (зарезервировано)
- `Space` / `Shift` — рывок (dash)
- `P` / `Esc` — пауза

### Mobile (Touch)
- **Левая половина экрана** — плавающий виртуальный джойстик (движение по двум осям)
- **Правая большая кнопка DRILL** — активировать бур
- **Правая маленькая кнопка DASH** — рывок

Чтобы проверить мобильную раскладку на десктопе, добавьте `?touch=1` в адресную строку. Чтобы выключить — `?touch=0`.

---

## 📁 Project Structure

```text
workspace/core-breaker-drill-miner-2d/
├── AGENTS.md                        # Инструкция для ИИ-агента (пишет фабрика)
├── AI_DEVELOPER_PROMPT.md           # Definitive master prompt for coding agent
├── DEVLOG.md                        # Журнал разработки, ведёт кодовый агент
├── CHANGELOG.md                     # Changelog проекта, ведёт кодовый агент
├── README.md                        # Этот файл
├── package.json                     # Зависимости и скрипты npm
├── tsconfig.json                    # TypeScript strict конфигурация
├── vite.config.ts                   # Конфигурация Vite
├── index.html                       # Корневой HTML
├── src/
│   ├── main.ts                      # Bootstrap, viewport guards, boot sequence
│   ├── core/
│   │   ├── EventBus.ts              # Типизированная шина событий
│   │   ├── GameLoop.ts              # Фиксированный игровой цикл 60 Гц
│   │   └── Game.ts                  # Главный координатор и state machine
│   ├── platform/
│   │   ├── PlaygamaService.ts       # Обертка @playgama/bridge
│   │   └── StorageService.ts        # Облачные/локальные сохранения
│   ├── physics/
│   │   └── PhysicsWorld.ts          # Мир Matter.js
│   ├── input/
│   │   ├── InputSnapshot.ts         # Снимок ввода
│   │   ├── InputManager.ts          # Слияние клавиатуры и тач
│   │   ├── KeyboardInput.ts         # Клавиатура + мышь
│   │   └── TouchControls.ts         # Pointer Events джойстик и кнопки
│   ├── rendering/
│   │   ├── Renderer.ts              # PixiJS рендерер и камера
│   │   └── layers/
│   │       ├── BackgroundLayer.ts   # Параллакс-фон
│   │       ├── TerrainLayer.ts      # Визуализация породы
│   │       ├── EntityLayer.ts       # Сущности
│   │       └── VfxLayer.ts          # Лазеры и частицы
│   ├── entities/
│   │   ├── Player.ts                # Боевой бур игрока
│   │   ├── Enemy.ts                 # Враги (grub, scarab, crystal)
│   │   ├── Ore.ts                   # Руда
│   │   └── Boss.ts                  # Босс на 200 м
│   ├── systems/
│   │   ├── TerrainManager.ts        # Процедурная порода и бурение
│   │   ├── LaserSystem.ts           # Автострельба и рикошет
│   │   ├── CombatSystem.ts          # Бой, смерть, частицы, руда
│   │   ├── WaveManager.ts           # Волны врагов и босс
│   │   └── UpgradeManager.ts        # Перки каждые 50 м
│   ├── ui/
│   │   └── UIManager.ts             # HUD, меню, модальные окна
│   └── audio/
│       └── AudioManager.ts          # Web Audio API звук и музыка
├── dist/                            # Production билд (генерируется)
└── skills/                          # Правила по областям
```

---

## 📚 Key Design Documents
- `AI_DEVELOPER_PROMPT.md` — мастер-спецификация игры
- `GAME_DESIGN_DOCUMENT.md` — визия и дизайн
- `GAMEPLAY_SPECIFICATION.md` — боёвка, движение, формулы
- `TECHNICAL_SPECIFICATION.md` — TypeScript, Vite, физика, рендеринг
- `ARCHITECTURE_DOCUMENT.md` — иерархия модулей
- `PLAYGAMA_INTEGRATION.md` — SDK, реклама, сохранения
- `MOBILE_CONTROLS.md` — обязательный контракт тач-управления
- `skills/*.md` — навыки по игровому домену, рендеру, Playgama, управлению

---

## 🛠 Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Запуск dev-сервера Vite |
| `npm run build` | TypeScript проверка + production сборка в `dist/` |
| `npm run preview` | Локальный превью production билда |
