# Game Design Document (GDD): Лесной Рейс: Доставка на Лесопилку 3D

## 1. Executive Summary & Vision
- **Title**: Лесной Рейс: Доставка на Лесопилку 3D
- **Vision Statement**: Создать главный веб-хит в жанре перевозки грузов, сочетающий медитативную атмосферу русской природы, азартную физическую модель и высокую реиграбельность за счет процедурной генерации трасс.
- **Elevator Pitch**: Заведи старый добрый грузовик и доставь брёвна из тихой деревни на лесопилку! Дорога полна кочек, ям и крутых подъемов — удерживай баланс газа и тормоза, следи за спидометром и довези груз в целости, чтобы заработать максимум на прокачку машины.
- **Genre**: Физический 3D-симулятор вождения (Аркадная доставка груза по бездорожью)
- **Target Audience**: Игроки от 10 до 45 лет, любители физических автосимуляторов, Hill Climb Racing, Spintires/MudRunner, ценящие медитативный, но азартный геймплей с реалистичной физикой груза.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 9/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 8/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 10/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.7 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Мастерский шофёр винтажного грузовика, способный проехать по любым оврагам и доставить ценный груз в целости сквозь живописные лесные просеки.
- **Core Hook**: Тактильная физика раскачивающихся и норовящих вылететь из кузова брёвен на непредсказуемых ухабах в ламповой, теплой сельской атмосфере.
- **Unique Value Proposition**: Полноценный 3D-физический автосимулятор в браузере с процедурным ландшафтом, честной физикой сыпучего/штучного груза и уютным визуальным стилем без долгих загрузок.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые динамичные сессии по 2–4 минуты на один заезд с постоянным накоплением прогресса и апгрейдами.
- **Core Gameplay Loop**:
```text
Старт в деревне с полным кузовом -> Преодоление ухабистой процедурной трассы с контролем тяги и торможения -> Балансировка на склонах для предотвращения выпадения брёвен и ящиков -> Финиш на лесопилке -> Подсчет доставленного груза и получение монет -> Прокачка грузовика и открытие новых маршрутов.
```
- **Win Conditions**: Достижение финишных ворот лесопилки с сохранением хотя бы 1 единицы груза (для получения максимальных 3 звёзд требуется доставить от 80% до 100% груза).
- **Lose Conditions**: Полная потеря всех предметов из кузова (0% груза) или опрокидывание грузовика на крышу более чем на 3 секунды.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
