# Gameplay Specification: Бур Судного Дня: Шахтерский Рогалик

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Бур Судного Дня: Шахтерский Рогалик`.

---

## 2. Gameplay Systems
### System: Система процедурной генерации пластов породы
- **Purpose**: Создание бесконечной сбалансированной вертикальной шахты с блоками 5 уровней прочности, минералами, ловушками и пустотами.
- **Input Channels**: Текущая глубина бурения, сид уровня, коэффициент сложности биома.
- **Core Rules**:
  - Генерация чанками по 16x16 блоков по мере спуска
  - Шанс появления ценных руд растет с глубиной
  - Взрывчатка спавнится кластерами от 2 до 6 блоков
  - Каждые 500 метров генерируется открытая арена с боссом биома
- **Internal States**: `active_chunks, destroyed_blocks_mask, current_biome_id, ore_density_modifier`
- **System Interactions**: Коллизия с буром отнимает прочность блока; при 0 HP блок спавнит ресурсы и частицы.
- **Hit & Sensory Feedback**: Треснувшие текстуры блоков перед полным разрушением, звуковой тон повышается при твердой породе.
- **Edge Cases & Handling**:
  - Непроходимый монолит: всегда гарантирован хотя бы 1 проходимый коридор шириной в бур
  - Удаление верхних чанков из памяти для предотвращения утечек RAM

### System: Система перков и модификаций бура
- **Purpose**: Предоставление игроку синергетических улучшений в стиле Roguelite во время раунда.
- **Input Channels**: Накопленный опыт/ресурсы, пул разблокированных перков.
- **Core Rules**:
  - 3 случайных перка на драфт с шансом выпадения Редких и Легендарных
  - Ветви развития: Охлаждение/Лед (замедление врагов, защита от перегрева), Ядерная мощь (урон по площади, разрушение камня), Технологии дронов (авто-турели, сборщики)
  - Эволюция перков при достижении 5 уровня слиянием двух базовых умений
- **Internal States**: `equipped_perks_map, current_craft_xp, xp_to_next_perk, active_synergies`
- **System Interactions**: Влияет на скорость бурения, количество стволов турелей, радиус крио-ауры и урон тарана.
- **Hit & Sensory Feedback**: Визуальное изменение внешнего вида буровой мехи (добавление пушек, ледяной покров, неоновое свечение).
- **Edge Cases & Handling**:
  - Исчерпание пула перков: выдавать универсальный бонус к ремонту корпуса или золоту

### System: Система тактильного отклика и сочности (Game Feel & Juice)
- **Purpose**: Обеспечение максимального аудиовизуального удовлетворения от каждого действия игрока.
- **Input Channels**: События коллизии бура, разрушения блоков, убийства врагов, взрывов.
- **Core Rules**:
  - Screen Shake пропорционален твердости разрушенного блока и силе взрыва
  - Hitstop (микро-фриз на 1-2 кадра) при ударе по элитным врагам и крепким породам
  - Динамический зум камеры при активации ускорения/тарана
  - Пул частиц переиспользует спрайты без создания garbage collection (GC)
- **Internal States**: `shake_intensity, camera_zoom_offset, active_particle_count, hitstop_timer`
- **System Interactions**: Модулирует положение камеры PixiJS Container и воспроизводит аудио-сэмплы через Web Audio.
- **Hit & Sensory Feedback**: Плавный и одновременно взрывной отклик экрана на кончиках пальцев.
- **Edge Cases & Handling**:
  - Снижение интенсивности тряски на слабых устройствах через настройки



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
