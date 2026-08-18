# Gameplay Specification: Песочный Бастион 3D: Защита Пляжа

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Песочный Бастион 3D: Защита Пляжа`.

---

## 2. Gameplay Systems
### System: Система Сетки и Размещения (Grid & Build System)
- **Purpose**: Управление координатной сеткой пляжа (например, 24x16 клеток), валидация установки объектов и управление ресурсами строительства.
- **Input Channels**: Клик мыши / Тап по экрану на координаты мира Three.js с помощью Raycaster.
- **Core Rules**:
  - Строительство разрешено только в пределах свободных ячеек пляжа.
  - Запрещено строить на точках спавна врагов и на ячейках самого Замка.
  - Запрещено ставить башню/стену, если это полностью блокирует единственный оставшийся путь от любого спавна к замку.
- **Internal States**: `grid_matrix: Array2D<CellState>, selected_tool: 'cannon' | 'splasher' | 'wall' | 'sell' | 'upgrade', hover_cell: {x: number, y: number} | null`
- **System Interactions**: При успешной постройке списывает ракушки, обновляет матрицу препятствий и триггерит событие OnGridChanged для Flow Field системы.
- **Hit & Sensory Feedback**: Зеленый/красный голографический шейдер предпросмотра ячейки, спавн 3D модели с сочным эффектом пыли.
- **Edge Cases & Handling**:
  - Попытка поставить башню в момент, когда моб стоит на этой клетке (моб плавно выталкивается в соседнюю свободную клетку)
  - Клик за пределами активной зоны поля (игнорируется)

### System: Система Поиска Пути Flow Field
- **Purpose**: Обеспечение быстрого и плавного движения сотен мобов по лабиринту без индивидуальных тяжелых расчетов A* для каждого юнита.
- **Input Channels**: Событие OnGridChanged или удаление башни.
- **Core Rules**:
  - Целевая ячейка — Песчаный Замок (стоимость 0).
  - Волновой алгоритм Дейкстры рассчитывает матрицу расстояний от всех ячеек к замку.
  - Для каждой ячейки вычисляется 2D-вектор градиента наискорейшего спуска.
  - Наземные мобы считывают вектор своей текущей клетки и двигаются вдоль него.
- **Internal States**: `cost_field: Uint16Array, flow_vectors: Float32Array (x, z), is_path_valid: boolean`
- **System Interactions**: Враги запрашивают текущий вектор смещения из буфера Float32Array в методе update().
- **Hit & Sensory Feedback**: Синхронное красивое перестроение всей колонны крабов в реальном времени.
- **Edge Cases & Handling**:
  - Если путь перекрыт — откатить постройку башни и вернуть деньги игроку с показом всплывающего предупреждения 'Путь заблокирован!'.

### System: Система Снарядов и Боевых Взаимодействий
- **Purpose**: Поиск целей башнями, баллистический расчет траекторий и регистрация урона/эффектов замедления.
- **Input Channels**: Тик игрового цикла delta_time.
- **Core Rules**:
  - Башни сканируют врагов в радиусе range с интервалом fire_rate.
  - Ракушечные снаряды летят с физическим упреждением к позиции цели.
  - Поливалка испускает круговой конус брызг, накладывая SlowEffect на 3 секунды.
- **Internal States**: `active_projectiles: Array<ProjectileData>, active_status_effects: Map<EnemyId, StatusEffect>`
- **System Interactions**: При попадании снаряда уменьшает HP врага; при HP <= 0 враг уничтожается, спавнятся наградные ракушки в общий счетчик игрока.
- **Hit & Sensory Feedback**: Всплывающие цифры урона, партиклы брызг и осколков, мигание модели врага белым цветом (hit flash).
- **Edge Cases & Handling**:
  - Цель погибает до прилета снаряда (снаряд падает на песок и оставляет след).

### System: Система Волн и Экономики Побережья
- **Purpose**: Генерация сбалансированных волн противников и начисление внутриигровых ресурсов (Ракушки для раунда, Жемчуг для меты).
- **Input Channels**: Таймер межволнового периода или ручной клик игрока 'Начать волну'.
- **Core Rules**:
  - Каждая волна имеет состав: тип врага, интервал спавна, множитель здоровья.
  - За досрочный запуск волны игрок получает бонусные +25 ракушек.
  - За каждого убитого врага начисляются ракушки в зависимости от его типа.
- **Internal States**: `current_wave: number, total_waves: number, wave_in_progress: boolean, sand_shells: number, pearls: number`
- **System Interactions**: Передает данные в UI HUD для обновления счетчиков и полосы прогресса волны.
- **Hit & Sensory Feedback**: Звуковой горн старта волны, всплывающий баннер 'Волна 5: Нашествие Чаек!'
- **Edge Cases & Handling**:
  - Все мобы убиты до окончания таймера спавна (волна корректно завершается победой).



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
