# Gameplay Specification: Слияние Турелей 3D: Оборона Базы

## 1. Overview
This document specifies the exact mechanical logic, mathematical formulas, state transitions, and feedback loops powering `Слияние Турелей 3D: Оборона Базы`.

---

## 2. Gameplay Systems
### System: Система Сетки Слияния (MergeGridSystem)
- **Purpose**: Управление состоянием 16 слотов сетки, валидация перемещений, объединение уровней и сохранение раскладки в LocalStorage/Cloud.
- **Input Channels**: Touch / Mouse Pointer события (PointerDown, PointerMove, PointerUp).
- **Core Rules**:
  - Сетка фиксированного размера 4x4.
  - Перетаскивание турели уровня N на другую турели уровня N создает турель уровня N+1 на целевом слоте, освобождая исходный.
  - Перетаскивание на пустой слот просто перемещает турель.
  - Перетаскивание на турель другого уровня меняет их местами.
  - Перетаскивание в иконку Корзины удаляет турель и возвращает 25% стоимости.
- **Internal States**: `gridArray: Array<TurretData | null> (length 16), activeDragIndex: number | null, highestUnlockedTier: number`
- **System Interactions**: При объединении триггерит событие EventBus.emit('TURRET_MERGED', { tier, index }) для звуков, аналитики и обновления боевого урона.
- **Hit & Sensory Feedback**: Подсветка совместимых ячеек зеленым контуром во время перетаскивания; красным — несовместимых.
- **Edge Cases & Handling**:
  - Дроп за пределами сетки возвращает турель на исходную позицию с плавной tween-анимацией.
  - Попытка объединить максимальный 15-й тир блокируется с предупреждающей плашкой «MAX LEVEL».

### System: Боевая Система и Наведение (CombatSystem)
- **Purpose**: Расчет баллистики, наведение стволов турелей, авто-стрельба по таймерам скорострельности и нанесение урона сферам.
- **Input Channels**: Позиции активных врагов на 3D трассе.
- **Core Rules**:
  - Каждая турель на сетке суммирует свою огневую мощь на верхнем поле боя.
  - Турель выбирает целью шар, находящийся ближе всего к финишу (First Target priority) или шар, выбранный игроком тапом.
  - Урон рассчитывается по формуле: BaseDamage(Tier) * MetaDamageMultiplier * CriticalHit(if proc).
  - Снаряды летят с физической интерполяцией или хитсканом в зависимости от типа (пули, плазма, лазерный луч).
- **Internal States**: `activeProjectiles: Pool<Projectile>, turretCooldowns: Float32Array, currentDps: number`
- **System Interactions**: Взаимодействует с WaveManager при попадании, отнимая HP у шаров и вызывая VFX столкновения.
- **Hit & Sensory Feedback**: Всплывающие цифры урона (Floating Combat Text), цветные трассеры снарядов, звуки выстрелов со стерео-панорамированием.
- **Edge Cases & Handling**:
  - Если цель уничтожена другим снарядом во время полета текущего, снаряд ищет ближайшую сферу в радиусе 1.5м (splash) или самоуничтожается.

### System: Генератор Волн и Сфер (WaveSystem)
- **Purpose**: Спавн очередей цветных сфер по кривой Безье в 3D пространстве с контролем сложности и босс-файтов.
- **Input Channels**: Номер текущей волны (currentWave).
- **Core Rules**:
  - Каждая волна состоит из 15-30 сфер с нарастающим запасом HP: HP = BaseHP * (1.18 ^ currentWave).
  - Каждые 5 волн — мини-босс (сфера-щитовик), каждые 10 волн — Мега-Босс с уникальной аурой (ускорение соседей, регенерация).
  - Уничтоженная сфера размера L распадается на 2 сферы размера M, размер M — на 2 размера S.
  - При пересечении финишной черты шар отнимает 1 HP базы за единицу своего размера.
- **Internal States**: `waveNumber: number, aliveEnemiesCount: number, baseHealth: number (max 100), waveState: 'SPAWNING' | 'IN_PROGRESS' | 'CLEARED' | 'DEFEAT'`
- **System Interactions**: Оповещает UI о прогрессе волны (прогресс-бар сверху экрана) и выдает награду за завершение.
- **Hit & Sensory Feedback**: Звуковая сирена перед волной босса, вспышка красного света на базе при получении урона.
- **Edge Cases & Handling**:
  - Если игрок не успел убить всех врагов и база уничтожена, волна перезапускается без потери прокачки турелей.

### System: Экономика и Оффлайн-Прогресс (EconomySystem)
- **Purpose**: Баланс игровой валюты (золотые монеты, кристаллы), расчет оффлайн-накоплений и цен апгрейдов.
- **Input Channels**: Время последнего выхода из игры (timestamp), убийства врагов, клики по ящикам.
- **Core Rules**:
  - Стоимость покупки новой базовой турели растет по экспоненте: Cost = BaseCost * (1.15 ^ PurchasesCount).
  - Оффлайн доход начисляется за время отсутствия (макс. 8 часов): OfflineCoins = DpsPerSecond * 0.25 * ElapsedSeconds.
  - Автоматический бесплатный дроп ящика с турелью на случайный свободный слот сетки каждые 15 секунд (ускоряется прокачкой).
- **Internal States**: `coins: number, gems: number, purchasedTurretsCount: number, lastSaveTimestamp: number`
- **System Interactions**: Связан с Playgama SDK Cloud Save для непрерывной синхронизации баланса.
- **Hit & Sensory Feedback**: Летающие монетки от убитых шаров прямо в счетчик баланса в правом верхнем углу.
- **Edge Cases & Handling**:
  - Защита от перемотки системного времени устройства через серверную валидацию времени Playgama.



## 3. Damage & Physics Combat Formulas
- **Base Damage Formula**:
  $$\text{FinalDamage} = (\text{BaseDamage} \times \text{ImpactVelocityFactor} + \text{AttackPower}) \times (1 - \text{ArmorMitigation})$$
- **Critical Strike Multiplier**: $2.0\times$ on weak points or staggered enemies.
- **Hit-Stop Dilation**: 40ms camera and physics time dilation ($0.05\times$ timescale) upon heavy hit connection.
- **Knockback Momentum**: Applied directly to target physics rigid body as a directional impulse vector.
