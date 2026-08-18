# Gameplay Specification: Воксельный Измельчитель ASMR 3D

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Воксельный Измельчитель ASMR 3D`.

---

## 2. Gameplay Systems
### System: Система вокселизации и деконструкции модели
- **Purpose**: Представление 3D моделей в виде 3D матрицы вокселей и послойный расчет их уничтожения при пересечении с плоскостью валов.
- **Input Channels**: Координаты высоты модели Y, текущая скорость вращения валов, параметр остроты зубьев.
- **Core Rules**:
  - Каждый шаг времени валы опускают модель вниз со скоростью, пропорциональной силе затягивания.
  - Все воксели в диапазоне высоты контакта валов [Y_min, Y_max] отделяются от родительского меша.
  - Отделившиеся воксели становятся динамическими частицами со случайным импульсом разлета и ускорением свободного падения.
- **Internal States**: `current_model_id, total_voxels_count, destroyed_voxels_count, model_feed_y_offset`
- **System Interactions**: Взаимодействует с генератором частиц, звуковым менеджером и начислением валюты.
- **Hit & Sensory Feedback**: Плавное таяние 3D модели сверху вниз, вспышки на границе соприкосновения.
- **Edge Cases & Handling**:
  - Модель полностью уничтожена -> Запуск следующей модели из очереди.
  - Слишком высокая плотность вокселей -> Батчинг обновления сетки для предотвращения просадки кадров.

### System: Система физических частиц (GPU/Instanced Particle Pool)
- **Purpose**: Высокопроизводительная отрисовка и анимация сотен одновременно падающих кубиков-частиц.
- **Input Channels**: Точки спавна оторвавшихся вокселей, исходный цвет вокселя, вектор начальной скорости.
- **Core Rules**:
  - Использование предварительно аллоцированного Three.InstancedMesh на 1500 частиц.
  - Обновление позиций в кастомном вершинном шейдере или через плоский Float32Array.
  - Удаление частицы и начисление очков при достижении плоскости корзины Y <= Y_basket.
- **Internal States**: `active_particles_count, free_instance_indices`
- **System Interactions**: Связана с корзиной наград и аудио-триггерами.
- **Hit & Sensory Feedback**: Яркий фонтан сыплющихся кубиков с сохранением их оригинальных цветов от модели.
- **Edge Cases & Handling**:
  - Переполнение пула частиц -> Автоматическое ускорение старых частиц без потери начисления монет.

### System: Экономика и баланс улучшений (Idle Economy)
- **Purpose**: Расчет стоимости апгрейдов и генерации монет по законам инкрементальных игр.
- **Input Channels**: Уровни улучшений игрока, события уничтожения вокселей, клики игрока.
- **Core Rules**:
  - Стоимость апгрейда = BaseCost * (1.15 ^ CurrentLevel).
  - Доход за воксель = BaseVoxelValue * SharpnessMultiplier * ValueMultiplier.
  - Каждый клик дает множитель скорости x2 на 0.6 секунды с возможностью поддержания комбо.
- **Internal States**: `player_coins, roller_width_lvl, roller_sharpness_lvl, voxel_value_lvl, auto_speed_lvl`
- **System Interactions**: Связывает UI апгрейдов с боевой математикой дробилки.
- **Hit & Sensory Feedback**: Анимация летящих монет в счетчик баланса, звуки покупок, подсветка доступных к покупке кнопок.
- **Edge Cases & Handling**:
  - Большие числа баланса -> Форматирование в суффиксы (1.2K, 3.4M, 5.6B).



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
