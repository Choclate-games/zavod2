# Gameplay Specification: Рикошет Снайпер 3D: Замедленный Выстрел

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Рикошет Снайпер 3D: Замедленный Выстрел`.

---

## 2. Gameplay Systems
### System: Система расчета лазерного предикшена (Laser Trajectory Predictor)
- **Purpose**: Отрисовка точной траектории полета пули с учетом отражений от нормалей поверхностей и прохождения через порталы.
- **Input Channels**: Координаты прицела игрока (Vector3) и стартовая точка ствола.
- **Core Rules**:
  - Raycast пускается из дула оружия в направлении взгляда
  - При пересечении с твердым телом вычисляется точка удара и нормаль: D_reflect = D - 2 * (D · N) * N
  - Новый луч пускается из точки удара с небольшим смещением по нормали (epsilon = 0.001) для исключения самопересечения
  - При попадании в портал луч переносится в выходной портал с трансформацией кватерниона направления
  - Лимит предикшена: до 4 последовательных отскоков
  - При попадании во врага или бочку луч завершается ярким маркером попадания
- **Internal States**: `origin, direction, bounce_points, hit_targets, is_valid_aim`
- **System Interactions**: Передает массив точек сегментов в Three.js LineSegments / TubeGeometry для рендера светящегося луча.
- **Hit & Sensory Feedback**: Анимированная пульсация лазера, смена цвета маркера при наведении на взрывные цели (желтый) или врагов (красный).
- **Edge Cases & Handling**:
  - Попадание точно в острый угол между двумя стенами (разрешается выбором доминирующей нормали)
  - Зацикливание луча между двумя параллельными зеркальными щитами (ограничение счетчиком итераций)

### System: Система кинематографической камеры Slow-Motion (Bullet Time Controller)
- **Purpose**: Управление временем и перемещением камеры во время выстрела для создания максимального эффекта вовлечения.
- **Input Channels**: Триггер выстрела, текущая позиция и скорость пули.
- **Core Rules**:
  - В режиме прицеливания камера зафиксирована в позиции глаз персонажа (FOV 65)
  - В момент выстрела timescale снижается до 0.25 (slow-motion)
  - Камера переходит в режим слежения: позиция = bullet.pos - bullet.velocity.normalized * 1.5 + Vector3(0, 0.4, 0)
  - При приближении пули к врагу на дистанцию < 2 метров timescale снижается до 0.1 (супер-замедление)
  - После поражения последнего врага запускается 2-секундный победный ракурс с облетом сцены (orbit camera)
  - При промахе камера возвращается в режим прицеливания с затемнением или мгновенным рестартом
- **Internal States**: `camera_mode (AIM / FOLLOW / IMPACT / VICTORY), current_timescale, target_transform, lerp_factor`
- **System Interactions**: Взаимодействует с Physics Engine (управление fixedDeltaTime) и Audio Engine (питч звуков снижается до 0.5x).
- **Hit & Sensory Feedback**: Эффект виньетки и легкого Chromatic Aberration по краям экрана в момент Slow-Motion.
- **Edge Cases & Handling**:
  - Пуля летит в узкий туннель (камера использует raycast против стен для предотвращения клиппинга геометрии)
  - Игрок нажимает кнопку пропуска полета (timescale мгновенно сбрасывается в 3.0x до завершения расчета)

### System: Физическая система разрушений и Ragdoll (Impact & Destruction Engine)
- **Purpose**: Реалистичный просчет ударов пули, детонации бочек и физического разлета тел врагов.
- **Input Channels**: Столкновения коллайдеров Rapier3D / Three.js Raycast Hits.
- **Core Rules**:
  - Прямое попадание пули передает импульс телу врага в точке контакта
  - Взрыв бочки генерирует радиальную силу: Force = MaxForce * (1 - Distance / Radius)
  - Кубический враг распадается на 6-8 независимых физических блоков с рандомизированным вращательным моментом
  - Разрушенные объекты деактивируют свои коллайдеры через 3 секунды для экономии ресурсов
- **Internal States**: `active_rigidbodies, destroyed_entities, explosion_queue`
- **System Interactions**: Посылает события в Level Manager для проверки условий победы.
- **Hit & Sensory Feedback**: Спавн облака дыма и искр (Particle System), тряска экрана (Camera Shake 0.3s), сочный звук взрыва.
- **Edge Cases & Handling**:
  - Обломок бочки сбивает врага (засчитывается как убийство окружением)
  - Враг падает за пределы карты (триггер KillZone снизу уровня засчитывает устранение)

### System: Система рейтинга уровней и мгновенного рестарта (Level Flow & Scoring)
- **Purpose**: Оценка мастерства игрока, сохранение звезд и обеспечение нулевой задержки при повторной попытке.
- **Input Channels**: Количество потраченных выстрелов, время прохождения, нажатие клавиши рестарта (R / кнопка в UI).
- **Core Rules**:
  - Каждый уровень имеет лимит выстрелов (1 выстрел = 3 звезды, 2 выстрела = 2 звезды, 3 выстрела = 1 звезда)
  - Убийство всех врагов одним выстрелом с первого рикошета дает идеальный рейтинг (3 звезды)
  - Нажатие клавиши 'R' или экранной кнопки перезапускает уровень менее чем за 100 мс без перезагрузки сцены (сброс позиций объектов через пул)
  - Результаты уровня сохраняются в Cloud Storage через Playgama Bridge
- **Internal States**: `shots_fired, current_level, stars_awarded, level_status (READY/IN_FLIGHT/WON/FAILED)`
- **System Interactions**: Связь с UI Manager и Playgama Bridge Save Storage.
- **Hit & Sensory Feedback**: Анимация появления 3 сияющих звезд со звуковыми аккордами, всплывающая плашка 'ИДЕАЛЬНЫЙ ТРИКШОТ!'.
- **Edge Cases & Handling**:
  - Игрок нажимает рестарт прямо во время полета пули (анимация и физика мгновенно прерываются, пуля возвращается в ствол)



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
