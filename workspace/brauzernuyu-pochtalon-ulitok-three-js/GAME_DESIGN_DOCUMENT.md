# Game Design Document (GDD): Браузерную «почтальон улиток» three.js

## 1. Executive Summary & Vision
- **Title**: Браузерную «почтальон улиток» three.js
- **Vision Statement**: Создать качественную веб-игру на THREEJS с понятной первой сессией и высоким удержанием.
- **Elevator Pitch**: Ведите живую колонию через сезоны: планируйте, рискуйте и смотрите, как решения дают всходы!
- **Genre**: 3D Менеджмент колонии / Idle-стратегия (Жизнь и рост поселения)
- **Target Audience**: Игроки Яндекс Игр, CrazyGames и мобильных веб-порталов.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 9/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 9/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 10/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.8 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Растите колонию через сезоны: распределяйте роли, готовьтесь к непогоде и расширяйте владения.
- **Core Hook**: Вы задаёте правила, а колония живёт сама и приносит последствия ваших решений.
- **Unique Value Proposition**: Уникальное сочетание жизнь и рост поселения с сочным физическим геймфилом и рогалик-синергиями.

## 4. Session Model & Game Loop
- **Session Duration**: Короткие сессии по 5-8 минут с высоким удержанием и мета-прокачкой.
- **Core Gameplay Loop**:
```text
Планирование дня -> Работа колонии -> Событие сезона -> Распределение прироста -> Новый день.
```
- **Win Conditions**: Пережить полный годовой цикл и вывести колонию на устойчивый рост.
- **Lose Conditions**: Ресурсы исчерпаны, и колония не переживает сезон.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
