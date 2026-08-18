# Gameplay Specification: Куриный Побег 3D: Стелс на Ферме

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Куриный Побег 3D: Стелс на Ферме`.

---

## 2. Gameplay Systems
### System: Система стелс-детекции и конусов обзора (Stealth Detection System)
- **Purpose**: Обеспечение математически точной проверки видимости игрока патрульными собаками с учетом укрытий и состояния маскировки.
- **Input Channels**: Координаты курицы, состояние маскировки (isHiding), вектор скорости курицы, координаты и поворот собаки.
- **Core Rules**:
  - Если курица находится вне конуса зрения собаки: статус незаметен (Hidden).
  - Если курица вошла в конус зрения и isHiding == false: запуск накопления шкалы тревоги собаки (Alert Gauge 0 -> 100% за 0.3 сек).
  - Если курица вошла в конус зрения, isHiding == true и скорость == 0: собака считает коробку обычным объектом окружения и продолжает патруль.
  - Если курица двигается под коробкой (скорость > 0.1) внутри конуса: немедленный переход в режим Тревоги (собака видит ползущую коробку).
  - Препятствия (заборы, амбары, тюки сена) блокируют луч зрения (Raycast occlusion).
- **Internal States**: `PATROL_IDLE, PATROL_WALK, SUSPICIOUS_INVESTIGATING, ALARM_PURSUIT, SEARCHING_LOST_TARGET`
- **System Interactions**: Взаимодействует с PlayerController, DogAIController, LevelGeometryManager, UIManager (шкала тревоги).
- **Hit & Sensory Feedback**: Цветовая смена меша конуса (Зеленый -> Желтый -> Красный), шейдерный глитч на краях экрана при тревоге.
- **Edge Cases & Handling**:
  - Игрок надел коробку прямо в момент, когда собака уже бежит на него в упор (собака должна обнюхать коробку и успокоиться, если игрок замер вовремя)
  - Несколько собак заметили игрока одновременно (координация погони без наслоения мешей)

### System: Система маскировки и камуфляжа (Camouflage System)
- **Purpose**: Управление механиками скрытности курицы, спавном коробки и физическими ограничениями режима укрытия.
- **Input Channels**: Нажатие кнопки Hide/Коробка, вектор движения игрока.
- **Core Rules**:
  - При активации коробка опускается на курицу за 0.15 секунды с легким сквош-эффектом.
  - Скорость перемещения курицы под коробкой снижается на 60% от базовой (забавное медленное ползание).
  - При повторном нажатии или резком рывке коробка сбрасывается вверх с эффектом разлетающихся щепок/пыли.
- **Internal States**: `EXPOSED_NORMAL, BOX_DROPPING, BOX_STATIONARY_STEALTH, BOX_CRAWLING_EXPOSED`
- **System Interactions**: Взаимодействует с PhysicsController, StealthDetectionSystem, AudioSystem.
- **Hit & Sensory Feedback**: Звук падения коробки 'Тумп!', визуальные прорези для глаз на картонке, светящиеся в темноте.
- **Edge Cases & Handling**:
  - Активация коробки внутри узкого дверного проема (коробка автоматически масштабируется без клиппинга в стены)

### System: Система целей уровня и триггеров побега (Level Objectives & Gate System)
- **Purpose**: Контроль прогресса уровня, подсчет собранных зерен и управление логикой открытия ворот.
- **Input Channels**: Триггер сбора зерен (GrainTrigger), триггер финишной зоны (ExitZoneTrigger).
- **Core Rules**:
  - Каждый уровень содержит фиксированное количество золотых зерен (например, 10 шт).
  - Для разблокировки ворот требуется собрать 100% обязательных зерен.
  - При сборе последнего зерна ворота фермы проигрывают анимацию открытия, а маркер выхода подсвечивается неоновым лучом в небо.
  - Достижение зоны выхода при открытых воротах завершает уровень победой.
- **Internal States**: `GATHERING_SEEDS, GATE_UNLOCKING, GATE_OPEN_ESCAPE_ACTIVE, LEVEL_COMPLETED`
- **System Interactions**: Взаимодействует с HUD, AudioSystem, CameraController (кратковременный фокус на открывающиеся ворота).
- **Hit & Sensory Feedback**: Камера на 1 секунду показывает распахивающиеся ворота фермы со звоном колокольчика, в HUD зажигается зеленый статус 'ВОРОТА ОТКРЫТЫ! БЕГИ К ВЫХОДУ!'.
- **Edge Cases & Handling**:
  - Игрок добегает до ворот до сбора зерен (ворота заперты, выводится подсказка 'Соберите еще N зерен')



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
