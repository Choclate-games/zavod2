# Skill: Stealth Vision Cones & Noise Shadows

## Purpose
Реализация системы скрытности: секторы обзора ИИ, расчет шума шагов и шкала тревоги.

## When to Use
При разработке логики патрулирования, конусов зрения, укрытий и реакции ИИ на звук.

## Core Rules & Constraints
- FOV-проверка угла (dot product) каждый кадр; физический Raycast — только при прохождении сектора (10 Гц).
- Радиус шума шагов генерируется динамически от скорости перемещения (0 для крадучись, 9 м для бега).
- Шкала тревоги растет плавно с буфером реакции 0.25 с (grace period).

## System Architecture
StealthManager регистрирует источники шума и проверяет видимость через Raycast к позиции игрока.

## Implementation Guidance
Публикуй события 'stealth:noise_emitted', 'guard:alerted' в EventBus.

## Common Mistakes to Avoid
- ❌ **Mistake**: Raycast каждый кадр для всех мобов — просадки FPS.
- ❌ **Mistake**: Мгновенное обнаружение сквозь угол без задержки реакции.

## Validation Checklist
- [ ] Укрытия полностью блокируют прямую видимость патрульных.
- [ ] Шаг крадучись не поднимает тревогу за спиной врага.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/mechanics/stealth_detection.md`

### Механика: Стелс, конусы зрения и радиусы шума (Stealth & Detection)

#### 1. Архитектура системы обнаружения
1. **Зрительный канал (Line of Sight / FOV)**:
   - Сектор зрения ИИ: угол полусектора $\theta = 45^\circ$ (общий угол $90^\circ$), дальность $R_{vis} = 14\text{ м}$.
   - Проверка: $\vec{d} = \vec{P}_{player} - \vec{P}_{guard}$, $\cos(\alpha) = \frac{\vec{d} \cdot \vec{F}_{guard}}{|\vec{d}|}$. Если $\cos(\alpha) \ge \cos(45^\circ)$ и $|\vec{d}| \le R_{vis}$ — пускается Raycast в физический мир.
   - Луч фильтруется по слоям: преграды (стены, укрытия, ящики) полностью блокируют прямую видимость.

2. **Слуховой канал (Noise Radius & Footsteps)**:
   - Действия игрока генерируют шум: крадучись ($0\text{ м}$), шаг ($3.5\text{ м}$), бег ($9.0\text{ м}$), выстрел/взрыв ($22.0\text{ м}$).
   - При превышении порога охранник переходит из `PATROL` в `INVESTIGATING` и поворачивается к источнику звука.

3. **Шкала тревоги (Suspicion Gauge)**:
   - Состояния: `UNAWARE` (0%) -> `SUSPICIOUS` (1–99%, жёлтый маркер над головой) -> `ALERTED` (100%, красный восклицательный знак, боевой режим).
   - Скорость накопления: $\Delta S = \frac{1.0 - |\vec{d}|/R_{vis}}{\text{light\_factor}} \times \Delta t$. В тени накапливается в 2.5 раза медленнее.

#### 2. Типичные ловушки и решения
- ❌ **Raycast каждый кадр для 50 врагов**: просадка 60 FPS на мобильных.
  - ✅ **Решение**: Проверка FOV и расстояния математически (dot product) каждый кадр, а дорогой физический Raycast — только при прохождении математического фильтра с таймером 10 Гц на каждого моба.
- ❌ **Мгновенное обнаружение сквозь угол**: игрок чувствует несправедливость.
  - ✅ **Решение**: Буфер реакции 0.25 с (`grace period`) перед началом заполнения шкалы тревоги.
