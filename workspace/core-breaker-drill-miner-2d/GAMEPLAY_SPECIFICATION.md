# Gameplay Specification: Бурильщик Бездны: Рикошет Руды

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Бурильщик Бездны: Рикошет Руды`.

---

## 2. Gameplay Systems
### System: Система разрушаемой воксельно-пиксельной породы (Voxel-Destruction System)
- **Purpose**: Обеспечение плавного и производительного разрушения грунта чанками с сохранением коллайдеров для рикошета.
- **Input Channels**: Координаты бура меха, радиус бурения, показатель мощности копания.
- **Core Rules**:
  - Мир делится на вертикальные чанки 32x32 тайла/пикселя.
  - Каждый пиксель/тайл имеет прочность и тип материала (земля, гранит, базальт, рудная жила).
  - Бур наносит урон прочности вокселей в радиусе контакта.
  - При прочности <= 0 воксель стирается из RenderTarget текстуры чанка и порождает частицы/руду.
  - Контур оставшихся вокселей формирует полигональные коллайдеры для лазерных рикошетов.
- **Internal States**: `chunk_grid_matrix, active_loaded_chunks, ore_spawn_table_by_depth, dirty_chunk_flags`
- **System Interactions**: Взаимодействует с физикой меха, снарядами лазера и спавнером лута.
- **Hit & Sensory Feedback**: Пиксельный шейдер разрушения, брызги породы, осыпание гравия.
- **Edge Cases & Handling**:
  - Игрок пытается пробурить нерушимый барьер границы мира — бур отскакивает с искрами.
  - Быстрый спуск вниз — асинхронная фоновая подгрузка и генерация нижних чанков без фризов.

### System: Система рикошетной баллистики лучей (Laser Ricochet Physics)
- **Purpose**: Расчет траектории лазеров с множественными отражениями от поверхностей породы и нанесением урона врагам.
- **Input Channels**: Позиция орудия, угол выстрела, количество отскоков (Bounces), урон, пробиваемость.
- **Core Rules**:
  - Луч использует быстрый 2D Raymarching / Raycast по физической сетке чанков.
  - При попадании в породу луч отражается по формуле R = D - 2*(D·N)*N (где N - нормаль поверхности).
  - Каждый рикошет увеличивает урон луча на +15% (множитель синергии).
  - Луч пробивает врагов или наносит сплэш-урон в зависимости от активных перков.
- **Internal States**: `active_beams_list, bounce_counter, beam_damage_multiplier, active_laser_segments`
- **System Interactions**: Взаимодействует с сеткой породы и хитбоксами монстров/боссов.
- **Hit & Sensory Feedback**: Неоновый лазерный луч с эффектом остаточного свечения (bloom), искры в точках нормали.
- **Edge Cases & Handling**:
  - Луч застревает в бесконечном параллельном отражении между двумя близкими стенами — ограничение тайм-аута жизни луча (макс. 0.4 сек).

### System: Система рогаликового драфта улучшений (Milestone Perk System)
- **Purpose**: Генерация 3 случайных перков каждые 50 метров с учетом синергий и текущего билда игрока.
- **Input Channels**: Событие преодоления глубины (depth % 50 == 0).
- **Core Rules**:
  - Генерация 3 карт из пула (Обычные, Редкие, Эпические, Легендарные).
  - Пул содержит: +Отскоки луча, +Скорость бурения, Дроны-сборщики, Расщепляющий лазер, Замораживающее поле, Электро-цепь.
  - Возможность 1 бесплатного реролла за просмотр Rewarded видеорекламы.
- **Internal States**: `player_active_perks_inventory, perk_deck_pool, rerolls_available`
- **System Interactions**: Модифицирует статы меха, оружия и физики в реальном времени.
- **Hit & Sensory Feedback**: Модальное окно с сочными картами, звуки перелистывания, анимация вспышки при выборе.
- **Edge Cases & Handling**:
  - Смерть игрока ровно на отметке 50м — приоритет отдается экрану поражения.



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
