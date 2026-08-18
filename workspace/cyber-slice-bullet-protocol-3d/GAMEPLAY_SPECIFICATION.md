# Gameplay Specification: CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)`.

---

## 2. Gameplay Systems
### System: Система процедурного рассечения мешей (Procedural Geometry Slicer)
- **Purpose**: Осуществление мгновенного математического разделения полигональной сетки врагов в реальном времени с генерацией внутренних граней и физических обломков.
- **Input Channels**: Координаты луча свайпа (Raycast Start/End) и вектор направления камеры.
- **Core Rules**:
  - Построение бесконечной секущей плоскости на основе двух точек свайпа и нормали взгляда камеры.
  - Итерация по треугольникам входного BufferGeometry: классификация вершин относительно плоскости (Dot Product).
  - Интерполяция вершин, UV и нормалей на линии пересечения ребер с плоскостью.
  - Триангуляция образовавшегося среза (Cap Triangulation) с присвоением материала внутреннего кибер-ядра (Emissive Neon Shader).
  - Спавн физических RigidBody в Rapier3D для отсеченных частей с радиальным импульсом взрыва.
- **Internal States**: `is_slicing_active (boolean), active_debris_count (integer), cut_plane_origin (Vector3), cut_plane_normal (Vector3)`
- **System Interactions**: Взаимодействует с Physics System для отталкивания половинок, с Particle VFX для генерации искр и с Combo System для начисления очков.
- **Hit & Sensory Feedback**: Неоновый лазерный след свайпа, яркий сноп искр, шлейф дыма, звуковой щелчок рассечения.
- **Edge Cases & Handling**:
  - Срез проходит мимо объекта -> свайп регистрируется как промах и сбрасывает часть комбо.
  - Объект уже слишком мал (<0.2м) -> вместо среза происходит мгновенная аннигиляция в частицы во избежание микро-полигонов.

### System: Система Хронодинамики и Замедления времени (Chrono-Dilation System)
- **Purpose**: Управление глобальной временной шкалой (Time Scale) для реализации механики Bullet Time при прикосновении к экрану.
- **Input Channels**: События PointerDown / PointerUp / TouchStart / TouchEnd.
- **Core Rules**:
  - При зажатии экрана time_scale плавно интерполируется от 1.0 до 0.1 за 60 мс.
  - Расход Chrono-Energy составляет 25 единиц/сек (максимум 100).
  - При исчерпании энергии time_scale принудительно возвращается к 1.0 с предупреждающим звуковым сигналом перегрузки.
  - При совершении успешного среза восстанавливается +15 единиц энергии.
- **Internal States**: `current_time_scale (float 0.1..1.0), chrono_energy (float 0..100), is_dilation_active (boolean)`
- **System Interactions**: Модифицирует dt во всех системах (перемещение врагов, полет снарядов, аниматоры), кроме рендерера следа клинка игрока.
- **Hit & Sensory Feedback**: Голографический круговой индикатор энергии вокруг пальца игрока, искажение звукового поля, виньетка замедления.
- **Edge Cases & Handling**:
  - Игрок держит палец и ничего не делает -> энергия заканчивается, враги наносят урон на нормальной скорости.

### System: Система Комбо, Ранга и Тепловой Перегрузки (Combo & Heat Engine)
- **Purpose**: Расчет мастерства игрока, динамическое начисление очков и активация режима ярости Overdrive.
- **Input Channels**: События успешного среза врага, отражения пули или получения урона.
- **Core Rules**:
  - Каждый срез дает базовые очки * текущий комбо-множитель (х1..х10).
  - Срез 3+ врагов одним свайпом дает бонус 'MULTI-SLICE' (+500 очков и заполнение Heat на 40%).
  - Получение урона сбрасывает ранг комбо до D и обнуляет Heat.
  - При 100% Heat активируется Overdrive на 6 секунд (х2 скорость регенерации энергии, взрывные срезы).
- **Internal States**: `combo_counter (integer), combo_rank (enum D, C, B, A, S, SS, SSS), heat_gauge (float 0..100), is_overdrive (boolean)`
- **System Interactions**: Влияет на размер наград в кибер-кредитах, пост-процессинг камеры (Bloom) и данные таблицы лидеров.
- **Hit & Sensory Feedback**: Голографические анимированные буквы ранга (D -> SSS), вспышка экрана при Overdrive, речевые оповещения ИИ-комментатора.
- **Edge Cases & Handling**:
  - Истечение комбо-таймера во время катсцены босса блокируется.

### System: Система Роглайт-Генерации и Талантов (Cyber-Augment Draft)
- **Purpose**: Предоставление игроку стратегического выбора аугментаций между боевыми волнами для создания уникальных билдов.
- **Input Channels**: Завершение боевой волны (Wave Cleared Event).
- **Core Rules**:
  - Генерация 3 случайных чипов из общего пула с весами редкости (Common 60%, Rare 30%, Legendary 10%).
  - Чипы разделены на 3 архетипа: 'Хроно-Мастер' (управление временем), 'Плазменный Клинок' (урон и AoE срезы), 'Кибер-Защита' (щиты и контрудары).
  - Игрок может потратить кибер-кредиты или посмотреть Rewarded Ad для реролла предложенных вариантов.
- **Internal States**: `active_augments (array of Augment), available_draft_cards (array of 3 AugmentCards), reroll_count (integer)`
- **System Interactions**: Модифицирует параметры меча, радиус среза, восстановление энергии и триггеры дополнительных снарядов.
- **Hit & Sensory Feedback**: Анимация вставки голографического картриджа, звуковой аккорд успеха, визуальное обновление клинка.
- **Edge Cases & Handling**:
  - Выбор взаимоисключающих перков предотвращается валидатором графа талантов.



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
