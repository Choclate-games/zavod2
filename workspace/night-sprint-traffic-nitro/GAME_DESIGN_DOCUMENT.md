# Game Design Document (GDD): Ночной Спринт: Трафик и Закись

## 1. Executive Summary & Vision
- **Title**: Ночной Спринт: Трафик и Закись
- **Vision Statement**: Создать самый визуально и кинестетически сочный 3D веб-спринт в эстетике золотой эры NFS, работающий мгновенно без загрузок на смартфонах и ПК, где каждая секунда заезда держит в предельном напряжении благодаря динамической физике и честной механике риска.
- **Elevator Pitch**: «Ночной Спринт» — это скоростной 3D-рейсинг в духе NFS Underground для браузеров и мобильных: управляй спорткаром на мокром ночном шоссе, лавируй между фурами на волосок от столкновения для мгновенной зарядки нитро и ставь рекорды времени в плотных 90-секундных спринтах.
- **Genre**: 3D Аркадный Автосимулятор / Уличные Гонки (Тайм-атака в плотном трафике / Хайвей-спринт с физикой заноса)
- **Target Audience**: Игроки 16–35 лет, фанаты серии Need for Speed (Underground 1/2, Most Wanted), любители уличных гонок, плотного трафика, дрифта, ночной неоновой эстетики и динамичных спринт-заездов на 1-2 минуты в вебе и на смартфонах.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 9/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 8/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 9/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.5 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Ты — безбашенный уличный гонщик ночного мегаполиса, пилотирующий заниженный кастомный спорткар на пределе сцепления, разрезающий плотный трафик миллиметровыми маневрами и взрывающий ночную тишину снопами синего пламени закиси азота.
- **Core Hook**: Культовый дух ночного стритрейсинга NFS Underground в браузере: ревущий хамелеон-спорткар, мокрый асфальт, ослепляющий неон и бешеный прилив нитро от миллиметровых разъездов с фурами на встречке на скорости 250 км/ч.
- **Unique Value Proposition**: Полноценный физический 3D-контроллер спорткара с кренами и пробуксовкой на Three.js + Rapier 3D, где закись азота добывается исключительно риском миллиметровых разъездов (Near Miss) в ночном неоновом трафике без скучных рельс и автопилотов.

## 4. Session Model & Game Loop
- **Session Duration**: Спринтерский заезд точка-в-точку длительностью 60–90 секунд с 3 чекпоинтами тайм-атаки и мгновенным перезапуском при аварии или победе.
- **Core Gameplay Loop**:
```text
Старт спринта -> Скоростное лавирование в плотном трафике -> Зарядка нитро через опасные сближения (Near Miss) и заносы -> Активация нитро-форсажа на свободных участках -> Прохождение чекпоинтов до истечения таймера -> Финиш заезда с фиксацией времени в лидерборде -> Получение репутации и кредитов -> Тюнинг спорткара в гараже (мощность, закись азота, управляемость, неоновая подсветка, обвесы) -> Открытие новых ночных маршрутов.
```
- **Win Conditions**: Пересечь финишную черту за отведенный лимит времени (уложиться в золото, серебро или бронзу), сохранив автомобиль от фатальных повреждений и набрав рекордные очки адреналина.
- **Lose Conditions**: Истечение времени таймера до достижения очередного чекпоинта ИЛИ лобовой фатальный таран тяжелого трафика (фура, автобус, бетонный разделитель) без использования спасительного билета восстановления (Revive).

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
