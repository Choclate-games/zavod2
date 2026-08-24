# Gameplay Specification: Лесной Рейс: Доставка на Лесопилку 3D

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Лесной Рейс: Доставка на Лесопилку 3D`.

---

## 2. Gameplay Systems
### System: VehiclePhysicsSystem
- **Purpose**: Симуляция динамики грузовика: крутящий момент, многорычажная подвеска, сцепление колес с грунтом и центр тяжести.
- **Input Channels**: Команды газа/тормоза от контроллеров ввода (клавиатура / тач).
- **Core Rules**:
  - Подача газа прикладывает крутящий момент к задней оси с учетом передаточного числа
  - Тормоз создает замедляющий момент и переносит массу на переднюю ось
  - Подвеска амортизирует вертикальные толчки от неровностей процедурного меша
- **Internal States**: `currentSpeed, engineRPM, suspensionCompression, isGrounded, tiltAngle`
- **System Interactions**: Взаимодействует с RoadMeshCollider и передает импульсы кузову, где находится груз.
- **Hit & Sensory Feedback**: Спидометр на HUD, наклон шасси, частицы пыли и звуки двигателя.
- **Edge Cases & Handling**:
  - Грузовик завис на гребне холма днищем
  - Переворот на 180 градусов

### System: CargoPhysicsSystem
- **Purpose**: Контроль физики предметов в кузове, коллизий и фиксация факта потери груза.
- **Input Channels**: Физические импульсы от перемещения кузова грузовика.
- **Core Rules**:
  - Каждый объект груза обладает массой, трением и упругостью
  - Если объект покидает ограничивающий триггер кузова и касается земли, он помечается как потерянный
  - Потерянный объект деактивируется через 5 секунд для экономии производительности
- **Internal States**: `totalCargoCount, activeCargoCount, cargoIntegrityPercent, cargoObjectsList`
- **System Interactions**: Передает данные в DeliveryScoringSystem и HUD.
- **Hit & Sensory Feedback**: Всплывающий красный значок '-1 Груз!', тревожный звуковой сигнал, обновление шкалы целостности.
- **Edge Cases & Handling**:
  - Бревно высоко подлетело на кочке, но приземлилось обратно в кузов (не считается потерянным)

### System: ProceduralRoadSystem
- **Purpose**: Генерация бесконечного или сегментного ухабистого маршрута от точки 'Деревня' до 'Лесопилка'.
- **Input Channels**: Сид уровня, длина трассы, коэффициент холмистости и плотности препятствий.
- **Core Rules**:
  - Трасса строится по 3D Catmull-Rom сплайну
  - Высота профиля модулируется несколькими октавами шума Перлина
  - Вдоль обочин процедурно расставляются сосны, березы, заборы и дорожные знаки
  - В начале трассы генерируется зона деревни с избами, в конце — лесопилка с конвейером
- **Internal States**: `levelSeed, roadSpline, roadMesh, finishDistance, playerProgress`
- **System Interactions**: Предоставляет коллизионную геометрию для физического движка Rapier3D.
- **Hit & Sensory Feedback**: Плавная подгрузка геометрии, маркеры дистанции вдоль обочин.
- **Edge Cases & Handling**:
  - Слишком крутой угол подъема (сглаживается авто-валидатором уклона)



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
