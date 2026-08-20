# Game Design Document (GDD): Атмосферную three.js о смотрителе 3D

## 1. Executive Summary & Vision
- **Title**: Атмосферную three.js о смотрителе 3D
- **Vision Statement**: Создать качественную веб-игру на THREEJS с понятной первой сессией и высоким удержанием.
- **Elevator Pitch**: Исследуйте глубину, где темнота дороже любого врага, и решайте, стоит ли следующий метр риска!
- **Genre**: 3D Исследование / Выживание (Погружение с ограниченными ресурсами)
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
- **Player Fantasy**: Спускайтесь глубже, чем безопасно, добывайте образцы и возвращайтесь до того, как кончится воздух.
- **Core Hook**: Свет, воздух и прочность корпуса — три счётчика, которые нельзя тратить одновременно.
- **Unique Value Proposition**: Уникальное сочетание погружение с ограниченными ресурсами с сочным физическим геймфилом и рогалик-синергиями.

## 4. Session Model & Game Loop
- **Session Duration**: Короткие сессии по 5-8 минут с высоким удержанием и мета-прокачкой.
- **Core Gameplay Loop**:
```text
Погружение -> Разведка и добыча -> Решение «глубже или назад» -> Всплытие и апгрейд -> Новый спуск.
```
- **Win Conditions**: Достичь дна разлома и вернуться с полным набором образцов.
- **Lose Conditions**: Кончился воздух или разрушен корпус.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
