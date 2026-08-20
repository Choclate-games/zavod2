# Атмосферную three.js о смотрителе 3D 🎮

> **Исследуйте глубину, где темнота дороже любого врага, и решайте, стоит ли следующий метр риска!**

---

## 🌟 Project Overview
- **Genre**: 3D Исследование / Выживание (Погружение с ограниченными ресурсами)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat 0.13.x)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки Яндекс Игр, CrazyGames и мобильных веб-порталов.
- **Core Hook**: Свет, воздух и прочность корпуса — три счётчика, которые нельзя тратить одновременно.

---

## 📁 Package Directory Map
```text
workspace/atmosfernuyu-three-js-o-smotritele-3d/
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

## 🚀 Как запустить
```bash
npm install
npm run dev      # Vite dev-сервер, открыть выданный http://localhost:5173
npm run build    # tsc --noEmit + vite build (сборка в dist/)
npm run preview  # предпросмотр собранной сборки
```
Игра должна открываться в браузере **без ошибок в консоли**. Для проверки
мобильного управления на десктопе добавьте `?touch=1` к URL (`?touch=0` выключает).

---

## 🎮 Управление

**Десктоп**
- `WASD` / стрелки — движение
- `Space` — всплытие, `Shift` / `Ctrl` — погружение
- `J` / ЛКМ — сонар-импульс (атака)
- `K` / ПКМ — тяжёлый импульс
- `P` / `Esc` — пауза

**Телефон** (landscape)
- Слева — плавающий виртуальный стик (движение, зона захвата — вся левая половина)
- Справа — `PULSE` (большая кнопка), `▲` всплытие, `▼` погружение, `H` тяжёлый импульс
- Движение и атака работают одновременно (мультитач на Pointer Events)

---

## 🧩 Структура исходников (`src/`)
```text
src/
├── main.ts                  # Bootstrap: viewport-гарды, Playgama, i18n, Game
├── config/GameConfig.ts     # Все игровые константы и баланс
├── core/
│   ├── EventBus.ts          # Типизированная шина событий
│   ├── GameLoop.ts          # Фиксированный цикл 60 Гц
│   ├── InputManager.ts      # Клавиатура + тач, единый InputState
│   └── Game.ts              # Координатор и стейт-машина
├── platform/
│   ├── PlaygamaService.ts   # Обёртка @playgama/bridge (реклама, save, лидерборд)
│   └── StorageService.ts    # Облачное + локальное сохранение (один JSON-ключ)
├── physics/
│   ├── PhysicsWorld.ts      # Rapier3D: мир, аккумулятор, shaft-арена
│   └── RagdollController.ts # Трупы врагов с отскоком
├── entities/
│   ├── Player.ts            # Игрок: тело, ресурсы, автояркость света
│   ├── Enemy.ts             # Враг + пул переиспользуемых тел
│   └── Weapon.ts             # Сонар: кулдаун + гейтинг по энергии
├── systems/
│   ├── CombatSystem.ts      # Хитбоксы, отбрасывание, хит-стоп, контактный урон
│   ├── WaveManager.ts       # Волны по мере погружения
│   ├── UpgradeManager.ts    # 3 карты улучшений (гарантия Rare/Epic)
│   ├── CrowdFavorSystem.ts  # Favor → бонус-бёрст
│   └── SampleField.ts       # Сбор образцов
├── rendering/
│   ├── SceneManager.ts      # Сцена, камера, прожектор, авто-тюнер качества
│   ├── MeshPool.ts          # InstancedMesh-пул частиц
│   └── Shaders.ts           # Материалы
├── ui/
│   ├── UIManager.ts         # HUD, меню, пауза, результаты
│   ├── VirtualJoystick.ts   # Плавающий стик + кнопки (Pointer Events)
│   └── CardModal.ts         # Модалка выбора 3 карт
├── audio/AudioManager.ts    # Web Audio API (master GainNode, синтез)
├── telemetry/Telemetry.ts   # События (first_action / first_reward и др.)
└── i18n/I18n.ts             # en/ru, _touch-варианты
```

---

## 🚀 How to Develop this Game
1. Open `AI_DEVELOPER_PROMPT.md`.
2. Feed the prompt into your AI coding assistant (Cursor / Antigravity / Claude).
3. Follow the 5-phase roadmap in `DEVELOPMENT_ROADMAP.md`.
4. Run `npm install && npm run dev` and check the game in the factory's built-in browser.
5. Keep `DEVLOG.md` and `CHANGELOG.md` updated after every work session.
6. Verify every deliverable against the **Definition of Done**.
