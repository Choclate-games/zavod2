# Gameplay Specification: Изометрический стелс-экшен pixi.js: персонаж

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Изометрический стелс-экшен pixi.js: персонаж`.

---

## 2. Gameplay Systems
### System: Система Перемещения и Физического Контроля
- **Purpose**: Обеспечить четкое и отзывчивое управление с учетом инерции и столкновений.
- **Input Channels**: Плавающий виртуальный джойстик (мобильные) или WASD/Стрелки (ПК).
- **Core Rules**:
  - Скорость масштабируется параметрами маневренности и массы.
  - Коллизии с препятствиями рассчитываются через физический движок с упругим отскоком.
  - При потере управления включается автоматическая стабилизация.
- **Internal States**: `IDLE, MOVING, DRIFTING, IMPACT, RECOVERING`
- **System Interactions**: Взаимодействует с физическими телами врагов, препятствиями и дропами наград.
- **Hit & Sensory Feedback**: Следы на поверхности, частицы пыли, звуки мотора/шагов, динамический наклон камеры.
- **Edge Cases & Handling**:
  - При застревании в геометрии объект мягко телепортируется в ближайшую свободную точку.

### System: Боевая Система и Расчет Урона
- **Purpose**: Обработка ударов, тарана, хитбоксов, расчета брони и эффектов отдачи.
- **Input Channels**: Кнопки атаки, нитро, спец-способностей.
- **Core Rules**:
  - Итоговый Урон = (БазовыйУрон * ФакторСкорости + БонусСилы) * (1 - СнижениеБроней).
  - Критические удары наносят 2.0x урона при атаке в уязвимые зоны.
  - Тяжелые попадания вызывают 40мс хит-стоп замедление времени.
- **Internal States**: `READY, ATTACKING, HITSTOP, COOLDOWN`
- **System Interactions**: Триггеры коллизий проверяют пересечения с хитбоксами противников.
- **Hit & Sensory Feedback**: Заморозка кадра (40мс), фонтан искр/частиц, всплывающие цифры урона.
- **Edge Cases & Handling**:
  - Одновременные встречные удары вызывают взаимное физическое отталкивание.



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
