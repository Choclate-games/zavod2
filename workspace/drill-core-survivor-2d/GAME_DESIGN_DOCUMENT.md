# Game Design Document (GDD): Бур Судного Дня: Шахтерский Рогалик

## 1. Executive Summary & Vision
- **Title**: Бур Судного Дня: Шахтерский Рогалик
- **Vision Statement**: Создать главный мобильный веб-хит в жанре вертикального шахтерского экшена с непревзойденным ощущением разрушения и глубоким билдостроением.
- **Elevator Pitch**: Управляйте гигантским буром, прогрызающим недра чужой планеты! Взрывайте динамитные пласты, замораживайте перегревающийся бур, устанавливайте турели против роя монстров и прокачивайте свой ядерный таран прямо на лету.
- **Genre**: Вертикальный 2D экшен-рогалик (Шахтерский выживач / Reverse Tower Defense)
- **Target Audience**: Игроки 16-35 лет, фанаты Dome Keeper, Vampire Survivors, Motherload и мобильных таймкиллеров с сочной физикой разрушений.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 10/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 9/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 10/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.9 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Пилот несокрушимой высокотехнологичной буровой мехи, превращающей километры монолитного камня, взрывоопасных жил и чудовищных инсектоидов в пыль и ценные ресурсы.
- **Core Hook**: Безостановочный адреналиновый спуск в недра планеты, где каждый пробуренный метр создает лавину искр и взрывов, а ресурсы нужно добывать прямо под натиском орд монстров.
- **Unique Value Proposition**: Смесь разрушаемого процедурного террейна Motherload и авто-шутерной динамики Vampire Survivors с акцентом на максимальный тактильный 'juice' (screen-shake, искры, сочный звук).

## 4. Session Model & Game Loop
- **Session Duration**: Короткие, сверхплотные 4-8 минутные сессии с нарастающей интенсивностью и мгновенным перезапуском.
- **Core Gameplay Loop**:
```text
Бурение вниз -> Разрушение блоков и сбор кристаллов -> Отбивание волн подземных тварей -> Заполнение шкалы крафта -> Выбор синергетических перков -> Смерть или достижение рекордной глубины -> Мета-прокачка буровой машины.
```
- **Win Conditions**: Преодоление максимальных рубежей глубины (1000м, 2500м, 5000м) и победа над глубинными титанами-боссами каждого биома.
- **Lose Conditions**: Полное истощение очков прочности (HP) бура от атак монстров или детонации взрывоопасных блоков.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
