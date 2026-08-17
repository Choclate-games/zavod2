# Gameplay Specification: Биослизь: Королевская Охота 3D

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Биослизь: Королевская Охота 3D`.

---

## 2. Gameplay Systems
### System: Система физики массы и пространственной сетки
- **Purpose**: Обеспечение быстрых коллизий поглощения и детекции целей для 300+ одновременных NPC на арене без просадки частоты кадров.
- **Input Channels**: Координаты, радиус и текущая масса игрока, миньонов, врагов и разрушаемых объектов.
- **Core Rules**:
  - Если Mass(Player) > Mass(Target) * 1.15, цель затягивается в центр слизи и уничтожается с передачей опыта.
  - Если Mass(Player) <= Mass(Target), цель наносит контактный урон и отталкивает игрока.
  - Скорость перемещения игрока вычисляется по формуле: BaseSpeed * (1 / (CurrentMass^0.18)).
- **Internal States**: `player_mass, player_radius, spatial_hash_buckets, active_absorb_animations`
- **System Interactions**: Взаимодействует с системой спавна волн, шейдером деформации и менеджером опыта.
- **Hit & Sensory Feedback**: Плавное интерполированное изменение радиуса коллайдера и масштаба меша, динамический зум камеры.
- **Edge Cases & Handling**:
  - Мгновенное поглощение пачки из 50 мелких NPC не должно приводить к скачку физического движка.
  - Камера не должна выходить за пределы скайбокса при максимальном росте.

### System: Система био-мутаций и синергий
- **Purpose**: Управление генерацией улучшений, инвентарем способностей слизи и расчетом комбинированных эффектов.
- **Input Channels**: Текущий уровень биомассы, активные мутации игрока, пул доступных улучшений.
- **Core Rules**:
  - При заполнении шкалы опыта выдается 3 неповторяющиеся мутации.
  - Мутация 'Ядовитые споры' + 'Панцирь' на максимальном уровне эволюционируют в 'Чумную цитадель' (ядовитая аура вокруг брони).
  - Мутация 'Клонирование' порождает до 6 миньонов, каждый наследует 20% текущих характеристик игрока.
- **Internal States**: `player_level, current_biomass, biomass_to_next_level, active_perks_map, evolutions_unlocked`
- **System Interactions**: Запускает UI модального окна выбора мутации, активирует таймеры авто-атак и шейдерные эффекты.
- **Hit & Sensory Feedback**: Звуковой фанфар повышения уровня, партикловые ауры на персонаже.
- **Edge Cases & Handling**:
  - Если игрок достиг максимума всех мутаций, предлагаются восстанавливающие 'Сгустки биомассы' (+25% HP и золото).

### System: AI-директор эскалации королевской гвардии
- **Purpose**: Генерация сбалансированных волн противников с учетом текущего времени выживания и силы игрока.
- **Input Channels**: Игровое время (0:00 - 10:00), текущий размер игрока, плотность врагов на арене.
- **Core Rules**:
  - Спавн происходит по внешнему кольцу видимости камеры через InstancedMesh.
  - Каждые 60 секунд тип спавнящихся отрядов обновляется на более тяжелый класс.
  - На 3:00, 6:00 и 9:00 спавнятся мини-боссы (Капитан Рыцарей, Королевский Архимаг, Инквизитор).
- **Internal States**: `game_timer, current_wave_index, spawn_budget_pool, active_boss_ref`
- **System Interactions**: Передает новые инстансы в рендерер и систему коллизий.
- **Hit & Sensory Feedback**: Звук боевого рога при старте новой волны, красное предупреждение на экране при выходе босса.
- **Edge Cases & Handling**:
  - При падении FPS ниже 45 AI-директор объединяет мелких крестьян в более сильных элитных пехотинцев для снижения числа объектов.

### System: Мета-лаборатория генетической модификации
- **Purpose**: Обеспечение долгосрочного удержания игрока через прокачку постоянных характеристик за собранные очки ДНК.
- **Input Channels**: Заработанные очки ДНК за забеги, уровни приобретенных генов.
- **Core Rules**:
  - Игрок покупает уровни генов: Плотность цитоплазмы (+HP), Хемотаксис (+Скорость), Пищеварительные ферменты (+Урон яда), Магнетизм биомассы (+Радиус сбора).
  - Стоимость каждого следующего уровня гена возрастает на 35%.
- **Internal States**: `total_dna_currency, gene_levels_dictionary, unlocked_slime_skins`
- **System Interactions**: Синхронизируется с облачными сохранениями Playgama Cloud Save.
- **Hit & Sensory Feedback**: Анимация колбы с бурлящей жидкостью при улучшении гена, звуковой сигнал успешной мутации.
- **Edge Cases & Handling**:
  - Корректная обработка оффлайн-режима с локальным сохранением в IndexedDB/LocalStorage.



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
