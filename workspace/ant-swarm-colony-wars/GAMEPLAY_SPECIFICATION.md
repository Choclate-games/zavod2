# Gameplay Specification: Муравьиный Рой: Война Колоний

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Муравьиный Рой: Война Колоний`.

---

## 2. Gameplay Systems
### System: Система Векторного Поля и Поведения Роя (Boids Flow System)
- **Purpose**: Обеспечение естественного движения 500+ частиц по алгоритмам Boids (сплочение, разделение, выравнивание) с наложением пользовательских феромонов.
- **Input Channels**: Координаты рисования игрока, позиции источников феромонов и препятствий.
- **Core Rules**:
  - Каждая частица вычисляет вектор скорости на основе сетки векторного поля 32x32
  - Феромонные линии испаряются со скоростью 10% в секунду
  - Муравьи избегают препятствий с помощью Raycast-сенсоров
- **Internal States**: `pheromoneGrid: Float32Array, swarmPositions: Float32Array, swarmVelocities: Float32Array, activeForces: Array`
- **System Interactions**: Взаимодействует с коллизиями ландшафта и триггерами сцепки.
- **Hit & Sensory Feedback**: Шлейф из микро-частиц пыльцы, динамическое искривление траекторий.
- **Edge Cases & Handling**:
  - Застревание роя в тупиках (решается импульсом рассеивания)
  - Разрыв непрерывной линии феромона при быстром свайпе (решается интерполяцией кривых Безье)

### System: Система Процедурной Генерации Микро-Уровней
- **Purpose**: Создание уникальных тактических аренд с реками, пропастями, нейтральными и вражескими гнездами.
- **Input Channels**: Номер уровня, модификаторы сложности, биом окружения.
- **Core Rules**:
  - На каждом уровне гарантирован минимум один путь решения через мост или прямую атаку
  - Количество вражеских муравейников масштабируется от 1 до 4
  - Ресурсы биомассы распределяются равномерно по ключевым точкам
- **Internal States**: `levelSeed: number, nestsList: Array, obstaclesPolygonList: Array, resourceNodes: Array`
- **System Interactions**: Инициализирует коллизии и начальные популяции перед стартом раунда.
- **Hit & Sensory Feedback**: Плавное появление уровня через эффект прорастания травы и раскрытия земли.
- **Edge Cases & Handling**:
  - Непроходимая генерация ландшафта (верифицируется A* валидатором перед запуском)



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
