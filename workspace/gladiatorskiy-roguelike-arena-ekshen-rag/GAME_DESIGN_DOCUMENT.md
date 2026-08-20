# Game Design Document (GDD): Гладиаторский roguelike арена-экшен ragdoll

## 1. Executive Summary & Vision
- **Title**: Гладиаторский roguelike арена-экшен ragdoll
- **Vision Statement**: Создать бескомпромиссный физический слэшер с сочным геймфилом и глубокой системой билдов.
- **Elevator Pitch**: Сражайтесь в Колизее с физикой рэгдолла: рубите врагов, сбрасывайте их в ямы и прокачивайте оружие!
- **Genre**: 3D Физический Арена-Экшен (Рэгдолл Рогалик)
- **Target Audience**: Любители экшен-слэшеров, рэгдолл-игр и средневековых сражений.

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
- **Player Fantasy**: Выйдите на арену Колизея, овладейте инерцией меча, парируйте удары титанов и завоюйте вечную славу.
- **Core Hook**: Тактические бои на мечах с активной рэгдолл-физикой, отсечением элементов брони и ликованием трибун Колизея.
- **Unique Value Proposition**: Уникальное сочетание рэгдолл рогалик с сочным физическим геймфилом и рогалик-синергиями.

## 4. Session Model & Game Loop
- **Session Duration**: Короткие сессии по 5-8 минут с высоким удержанием и мета-прокачкой.
- **Core Gameplay Loop**:
```text
Бой на арене -> Парирования и комбо -> 3-Card выбор карт гладиатора -> Битва с чемпионом -> Оружейная.
```
- **Win Conditions**: Пройти 10 волн и одолеть Титана Арены.
- **Lose Conditions**: Гибель гладиатора (HP = 0).

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
