# FINAL AI DEVELOPER PROMPT: БИОСЛИЗЬ: КОРОЛЕВСКАЯ ОХОТА 3D 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: Биослизь: Королевская Охота 3D
- **Project Slug**: `bioslime-royal-hunt-3d`
- **Genre**: 3D Roguelite Экшен / Выживание (Agar-поглощение массы + Survivors Bullet Heaven)
- **Target Platform**: Playgama Bridge (Yandex Games / VK / Web & Mobile)
- **Orientation**: Landscape
- **Target Audience**: Игроки 12–35 лет, любящие динамичные аркады роста массы (Agar.io, Hole.io), авто-экшены выживания (Vampire Survivors, Brotato) и физические разрушения.
- **Player Fantasy**: Вы — неудержимая первобытная биомасса, вырвавшаяся из алхимической лаборатории, которая мутирует на ходу, адаптируется к атакам целой королевской армии и поглощает все живое на своем пути.
- **Core Hook**: Управляйте живой желеобразной массой с процедурным шейдером, которая начинает размером с яблоко, а к 10-й минуте вырастает в гигантского титана, проглатывающего королевскую конницу и башни замка целиком!
- **Session Model**: 7–10 минутные сессии выживания по таймеру с динамически нарастающей сложностью, волнами элитных рыцарей и мгновенным выбором мутаций.

---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: TypeScript (strict mode)
- **Bundler & Dev Server**: Vite
- **Renderer**: **THREEJS** (^0.170.0)
  - *Selection Rationale*: User explicitly specified 'threejs'.
- **Physics Simulation**: **Rapier3D (@dimforge/rapier3d-compat 0.13.x)** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: Howler.js / WebAudio API
- **State Management**: Reactive EventBus / State Store
- **Platform SDK**: `@playgama/bridge 1.x`

### Performance Budgets
- **Target FPS**: 60 FPS (Desktop & Mobile)
- **Max Draw Calls**: < 65
- **Max Triangles / Active Sprites**: < 48000
- **Max Bundle Size**: < 3.8 MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
Поглощение мелких крестьян и разрушение микро-декораций -> Набор биомассы и увеличение размера слизи -> Выбор случайных мутаций при повышении уровня -> Отражение накатывающих волн королевской гвардии и боссов -> Накопление очков ДНК и перманентная прокачка генома в лаборатории.
```

### Процедурный желеобразный шейдер и сквош-эффект (CORE)
- **Category**: visual_physics
- **Description**: Кастомный GLSL шейдер деформирует вершины сферы игрока на основе вектора скорости, инерции и столкновений с объектами, создавая сочный эффект желе.
- **Player Input**: При движении и поворотах слизь сплющивается, вытягивается в направлении рывка и колышется при остановке.
- **Hit & Sensory Feedback**: Импульсная деформация при ударах, частицы всплеска слизи, тактильная отдача (вибрация) на мобильных устройствах.
- **Technical Complexity**: Medium

### Физическое поглощение и динамический рост (CORE)
- **Category**: progression
- **Description**: Игрок поглощает любых NPC и объекты, чей объем меньше 85% текущего объема игрока. При поглощении масса слизи увеличивается, а камера плавно отдаляется.
- **Player Input**: Наезд на мелких NPC засасывает их внутрь полупрозрачного тела слизи с последующим перевариванием.
- **Hit & Sensory Feedback**: Звук сочного хлюпанья, кратковременный импульс расширения меша, вылетающие сферы биомассы и цифры опыта.
- **Technical Complexity**: Medium

### Система био-мутаций (Триплеты улучшений) (CORE)
- **Category**: combat
- **Description**: При заполнении шкалы биомассы игра ставится на микро-паузу и предлагает 3 случайные мутации: ядовитые споры, миньоны-слизняки, бронированный панцирь, шипы, кислотный след.
- **Player Input**: Выбор карточки тапом или кликом мыши, мгновенное визуальное изменение модели слизи.
- **Hit & Sensory Feedback**: Вспышка мутации, появление новых суб-мешей (панцирные пластины, споровые наросты, летающие споры вокруг).
- **Technical Complexity**: Medium

### Разрушение микро-декораций (SECONDARY)
- **Category**: environment
- **Description**: Заборы, палатки, бочки, телеги и небольшие деревянные сторожевые вышки разрушаются на физические осколки при столкновении с выросшей слизью.
- **Player Input**: Таран препятствий на достаточной массе для расчистки арены и получения дополнительной биомассы.
- **Hit & Sensory Feedback**: Разлет щепок с физикой частиц, звук треска дерева, экранный шейк (screen shake).
- **Technical Complexity**: Medium

### Авто-атаки мутаций и клонирование миньонов (CORE)
- **Category**: combat
- **Description**: Оружие и способности активируются автоматически по таймерам: выброс ядовитых облаков, выстрел шипами в ближайших рыцарей, отпочкование автономных мини-слизней.
- **Player Input**: Игрок фокусируется на позиционировании, маневрировании и сборе биомассы.
- **Hit & Sensory Feedback**: Трассеры снарядов, зеленые ядовитые лужи на земле, рой мелких слизней, атакующих врагов вокруг.
- **Technical Complexity**: High


---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

- **Rendering Layer**: 
- **Physics & Spatial Layer**: 
- **Game Logic & ECS Layer**: 
- **Platform & SDK Layer**: 
- **UI Layer**: 

### Module Map (`src/`):
```text
src/
├── main.ts                    # Bootstrap, Playgama Bridge init, Game launch
├── core/
│   ├── Game.ts                # Main coordinator & state machine
│   ├── GameLoop.ts            # 60Hz fixed update loop with delta clamping
│   └── EventBus.ts            # Typed publish/subscribe event dispatcher
├── platform/
│   ├── PlaygamaService.ts     # Wrapper for @playgama/bridge (Ads, Save, Leaderboards)
│   └── StorageService.ts      # Cloud & LocalStorage sync with debouncing
├── physics/
│   ├── PhysicsWorld.ts        # Rapier3D / Physics world manager
│   └── RagdollController.ts    # Joint solver, balance spring torque, knockback
├── entities/
│   ├── Player.ts              # Player character entity & input impulses
│   ├── Enemy.ts               # Enemy AI behavior tree & ragdoll death
│   └── Weapon.ts              # Weapon mass, hitboxes, collision queries
├── systems/
│   ├── CombatSystem.ts        # Hitbox resolution, parry timing, damage formulas
│   ├── WaveManager.ts         # Spawning curves, elite bosses, wave clears
│   ├── UpgradeManager.ts      # 3-card roguelite selection & stat application
│   └── CrowdFavorSystem.ts    # Hype calculation and dynamic drop rewards
├── rendering/
│   ├── SceneManager.ts        # Three.js / PixiJS scene graph, lighting, camera lerp
│   ├── MeshPool.ts            # InstancedMesh pooling for debris & effects
│   └── Shaders.ts             # Optimized mobile shaders & materials
├── ui/
│   ├── UIManager.ts           # DOM HUD overlay, screen transitions
│   ├── VirtualJoystick.ts     # Mobile touch floating joystick
│   └── CardModal.ts           # 3-choice upgrade modal
└── audio/
    └── AudioManager.ts        # Sound effects pool & dynamic battle BGM
```

---

## 5. PLAYGAMA BRIDGE INTEGRATION SPECIFICATION
Platform integration is powered by `@playgama/bridge`.

### 1. Initialization & Ready Event
```typescript
import bridge, { PlatformMessage } from '@playgama/bridge';

export async function bootstrapPlatform(): Promise<void> {
    await bridge.initialize();
    console.log('Playgama Bridge initialized on:', bridge.platform.id);
    
    // Notify platform when game is loaded and ready
    bridge.platform.sendMessage(PlatformMessage.GAME_READY);
}
```

### 2. Advertisement Flow
- **Interstitial Ads**:
  - Minimum **90 seconds** cooldown between impressions.
  - Trigger only between major wave milestones or run game over.
  - Never trigger during active combat.
  - Listen to `bridge.advertisement.on('interstitial_state_changed')` to pause audio and physics when opened, and resume when closed.
- **Rewarded Ads**:
- **Второе Дыхание Слизи (`revive_run`)**: Мгновенное воскрешение на месте гибели с ударной волной отталкивания и 3 секундами неуязвимости (Trigger: Экран гибели при наличии оставшегося времени на таймере, Limit: 1 раз за забег)
- **Двойной Генетический Урожай (`double_dna_reward`)**: Удвоение всех собранных очков ДНК за завершенный или проигранный забег (Trigger: Экран итоговой статистики матча, Limit: После каждого забега)
- **Генетический Реролл (`reroll_mutations`)**: Бесплатная замена всех 3 предложенных карт мутаций на новые (Trigger: Окно выбора мутаций при повышении уровня, Limit: 2 раза за забег)

### 3. Cloud Storage & Save State
- Persistent storage key: `"bioslime_dna_balance"`
- Save format: JSON containing gold, unlocked weapons, high score, highest wave, and sound settings.
- Debounce cloud writes by 1.5 seconds.

### 4. Lifecycle & Auto-Pause
- Listen to `visibility_state_changed` event.
- Automatically pause physics and mute master volume when tab is hidden or ad opens.

---

## 6. USER INTERFACE & MOBILE CONTROLS
- **Orientation**: Landscape
- **Safe Area Insets**: Handled via CSS `padding: env(safe-area-inset-top) env(safe-area-inset-right)...`
- **Mobile Touch Controls**:
  - **Left Side**: Floating dynamic virtual joystick with touch-drag tracking.
  - **Right Side**: Action cluster (Large Primary Strike, Medium Parry/Block, Medium Dash).
- **Desktop Controls**:
  - `WASD` / `Arrow Keys`: Movement
  - `Left Mouse Button` / `J`: Primary Strike
  - `Right Mouse Button` / `K`: Heavy Strike / Block
  - `Space` / `Shift`: Dash / Dodge
  - `F` / `E`: Parry / Special

---

## 7. ART DIRECTION & VISUAL GUIDELINES
- **Style**: Стилизованное 3D Low-Poly с сочными PBR-шейдерами и неоновым био-свечением
- **Camera Perspective**: Top-Down изометрия с динамическим масштабированием FOV (FOV: 52°, Pitch: 55°)
- **Environment**: Средневековое королевство: замковая площадь, мощеные улочки, рыночные палатки, крепостные стены и зеленые лужайки
- **Lighting**: Теплый солнечный направленный свет с мягкими тенями (PCFSoftShadowMap) + фоновый Ambient небесного оттенка + точечные источники света для ядовитых спор и магии
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
### Phase 1: Базовый прототип и шейдер слизи (2 days)
- **Deliverable**: Управляемая капля слизи с сочной физикой колыхания на 3D-плоскости
  - Настройка сборки Vite + Three.js + TypeScript
  - Создание GLSL шейдера деформации желеобразной сферы (Wobble & Squash)
  - Реализация базового контроллера перемещения (клавиатура + виртуальный джойстик)
### Phase 2: Физика поглощения, рост и разрушения (2 days)
- **Deliverable**: Игрок может расти от поглощения пейзан и крушить декорации
  - Интеграция Rapier3D и Spatial Hash Grid для быстрого поиска объектов
  - Создание механики заглатывания мелких NPC и динамического масштабирования меша
  - Добавление разрушаемых заборов и микро-декораций с разлетом щепок
### Phase 3: Враги, волны и боевая система мутаций (3 days)
- **Deliverable**: Полноценный боевой цикл выживания с авто-атаками и прокачкой
  - Создание системы AI-спавна стражников, лучников и рыцарей
  - Реализация древа мутаций (ядовитые споры, миньоны, панцирь, шипы)
  - Окно повышения уровня с генерацией случайных триплетов карточек
### Phase 4: Интеграция Playgama Bridge, мета-прогресс и полишинг (2 days)
- **Deliverable**: Готовая к публикации игра с полным циклом мета-игры и монетизации
  - Подключение @playgama/bridge (Rewarded, Interstitial, Cloud Save, Leaderboards)
  - Создание экрана мета-лаборатории для прокачки генов за собранную ДНК
  - Финальная полировка сочности: скрин-шейк, партиклы, звуковые эффекты
### Phase 5: QA, оптимизация и релиз (1 days)
- **Deliverable**: Релизный билд, успешно прошедший премодерацию платформ
  - Тестирование на мобильных устройствах, профилирование draw calls и памяти
  - Настройка адаптивного DPI и локализации (RU/EN)
  - Финальная сборка и публикация на платформы Yandex Games и VK

---

## 9. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

- [ ] Процедурный шейдер слизи стабильно работает с плавной деформацией при движении и ударах.
- [ ] Механика поглощения четко масштабирует слизь от мелкого размера до гиганта с зумом камеры.
- [ ] Реализованы как минимум 5 уникальных мутаций с видимыми визуальными эффектами и авто-атаками.
- [ ] Таймер выживания на 10 минут генерирует волны стражников и боссов с нарастающей сложностью.
- [ ] Полная интеграция с Playgama Bridge: показ рекламы, сохранение прогресса в облако и таблица рекордов.
- [ ] Стабильные 60 FPS на десктопе и смартфонах среднего сегмента.
- [ ] Адаптивное сенсорное управление на смартфонах и полная поддержка клавиатуры на ПК.

---

## 10. DETAILED REFERENCE DOCUMENTS
For extended deep specifications, refer to the accompanying project documentation files:
- [Game Design Document](file:///output/bioslime-royal-hunt-3d/GAME_DESIGN_DOCUMENT.md)
- [Gameplay Specification](file:///output/bioslime-royal-hunt-3d/GAMEPLAY_SPECIFICATION.md)
- [Technical Specification](file:///output/bioslime-royal-hunt-3d/TECHNICAL_SPECIFICATION.md)
- [Architecture Document](file:///output/bioslime-royal-hunt-3d/ARCHITECTURE_DOCUMENT.md)
- [Playgama Integration](file:///output/bioslime-royal-hunt-3d/PLAYGAMA_INTEGRATION.md)
- [Monetization Specification](file:///output/bioslime-royal-hunt-3d/MONETIZATION.md)
- [Mobile Controls](file:///output/bioslime-royal-hunt-3d/MOBILE_CONTROLS.md)
- [QA Plan](file:///output/bioslime-royal-hunt-3d/QA_PLAN.md)
- [Game Skill Guidelines](file:///output/bioslime-royal-hunt-3d/skills/GAME_SKILL.md)
- [Renderer Skill](file:///output/bioslime-royal-hunt-3d/skills/RENDERER_SKILL.md)