# Three.js спелеологическая бродилка от 🎮

> **Короткие забеги, понятное управление и заметный рост возможностей от попытки к попытке!**

---

## 🌟 Project Overview
- **Genre**: 3D Аркадный экшен-рогалик (Короткие забеги с прокачкой)
- **Renderer**: **THREEJS** + Rapier3D (@dimforge/rapier3d-compat 0.13.x)
- **Platform**: Playgama Bridge (Yandex Games / VK / Web)
- **Orientation**: Landscape
- **Target Audience**: Игроки Яндекс Игр, CrazyGames и мобильных веб-порталов.
- **Core Hook**: Динамичный игровой процесс с сочным откликом и рогалик-прокачкой между забегами.

---

## 🎮 Controls / Управление

### 💻 ПК (Клавиатура и мышь):
- **WASD / Стрелки** — Перемещение персонажа
- **ЛКМ / J** — Акустический импульс LiDAR сонара
- **ПКМ / K** — Бросок звукового маяка-приманки (Decoy)
- **Пробел** — Прыжок через расщелины и обрывы
- **Shift** — Рывок / Спринт (расходует энергию)
- **C** — Присед / Бесшумная походка (снижает уровень шума на 85%)
- **P / Esc** — Пауза

### 📱 Мобильные устройства (Touch Controls):
- **Левая половина экрана** — Плавающий виртуальный джойстик (2 оси)
- **Кнопка СОНАР (96px)** — Акустический импульс сканера
- **Кнопка МАЯК (68px)** — Бросок звуковой приманки
- **Кнопка ПРЫЖОК (68px)** — Прыжок
- **Кнопка БЕГ (68px)** — Включение/выключение спринта
- **Флаг `?touch=1`** — Принудительное включение тач-раскладки на десктопе

---

## 📁 Package Directory Map
```text
three-js-speleologicheskaya-brodilka-ot/
├── index.html                       # HTML5 Canvas & Cyber-HUD container
├── package.json                     # Dependencies: Three.js, @playgama/bridge, Howler
├── tsconfig.json                    # Strict TypeScript configuration
├── vite.config.ts                   # Vite 5.x bundler config
├── src/
│   ├── main.ts                      # Bootstrap entry, viewport guards, Playgama init
│   ├── core/
│   │   ├── Game.ts                  # Main game coordinator & state machine
│   │   ├── GameLoop.ts              # Fixed 60Hz loop, delta clamping, hitstop
│   │   ├── EventBus.ts              # Typed pub/sub event dispatcher
│   │   └── GameState.ts             # Game states, save schema, base stats
│   ├── platform/
│   │   ├── PlaygamaService.ts       # @playgama/bridge SDK adapter (Ads, Cloud Save)
│   │   └── StorageService.ts        # Cloud & LocalStorage sync with debouncing
│   ├── physics/
│   │   ├── PhysicsWorld.ts          # 3D swept-sphere physics, obstacles, chasms
│   │   └── CollisionBody.ts         # Collision body definitions & layers
│   ├── entities/
│   │   ├── Player.ts                # Speleologist controller & noise tracker
│   │   ├── StalkerEnemy.ts          # Blind predatory chthonic monsters AI
│   │   ├── EnemyPool.ts             # Enemy spawner & stun coordinator
│   │   ├── CrystalCluster.ts        # Resonating amethyst mineral formations
│   │   └── DecoyBeacon.ts           # Acoustic decoy beacon entity
│   ├── systems/
│   │   ├── CaveGenerator.ts         # Procedural multi-tier 3D cave generator
│   │   ├── SonarSystem.ts           # Spherical LiDAR acoustic wave sampling
│   │   ├── SoundNoiseSystem.ts      # Real-time dB acoustic noise tracker
│   │   ├── UpgradeManager.ts        # Roguelite 3-card upgrade selection
│   │   ├── ProgressionManager.ts    # Base camp permanent meta-upgrades shop
│   │   └── CombatSystem.ts          # Contact resolution, hitstop, shockwaves
│   ├── rendering/
│   │   ├── PointCloudRenderer.ts    # High-performance Three.js PointCloud shader
│   │   ├── ParticleEffects.ts       # Sonic rings, crystal sparks, shockwaves
│   │   └── SceneManager.ts          # Isometric 3D camera, lighting, renderer
│   ├── ui/
│   │   ├── UIManager.ts             # UI coordinator, screens, notifications
│   │   ├── TouchControls.ts         # Pointer Events floating joystick & buttons
│   │   ├── HUD.ts                   # Top bar, Energy Battery gauge, Noise radar
│   │   ├── CardModal.ts             # 3-Card upgrade selection modal
│   │   ├── MetaShopModal.ts         # Speleologist base camp shop modal
│   │   └── ResultModal.ts           # Victory / Defeat screen with 2x Rewarded ad
│   ├── audio/
│   │   ├── SoundSynthesizer.ts      # WebAudio real-time sound synthesizer
│   │   └── AudioManager.ts          # Sound effects pool & event listeners
│   └── utils/
│       ├── Constants.ts             # Game parameters, formulas, upgrade cards
│       └── MathUtils.ts             # Vector helpers, dampening, RNG
```

---

## 🚀 How to Run & Build
```bash
npm install      # Установка зависимостей
npm run dev      # Запуск локального сервера разработки (Vite)
npm run build    # Компиляция TypeScript и сборка продакшн-бандла
npm run preview  # Локальный предпросмотр готовой сборки
```
