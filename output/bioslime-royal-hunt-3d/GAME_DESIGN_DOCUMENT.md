# Game Design Document (GDD): Биослизь: Королевская Охота 3D

## 1. Executive Summary & Vision
- **Title**: Биослизь: Королевская Охота 3D
- **Vision Statement**: Создать эталонный веб-хит в жанре 3D-выживания, где тактильное удовольствие от физики поглощения и желеобразного шейдера сочетается с реиграбельностью лучших представителей roguelite-экшенов.
- **Elevator Pitch**: Vampire Survivors встречает Agar.io в средневековом 3D-сеттинге: вы играете за разумную каплю слизи с сочной физикой деформации. Пожирайте крестьян, стражников и заборы, отращивайте шипы, ядовитые железы и армию миньонов, чтобы сокрушить королевскую гвардию и выжить до рассвета!
- **Genre**: 3D Roguelite Экшен / Выживание (Agar-поглощение массы + Survivors Bullet Heaven)
- **Target Audience**: Игроки 12–35 лет, любящие динамичные аркады роста массы (Agar.io, Hole.io), авто-экшены выживания (Vampire Survivors, Brotato) и физические разрушения.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 9/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 9/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 9/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.7 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Вы — неудержимая первобытная биомасса, вырвавшаяся из алхимической лаборатории, которая мутирует на ходу, адаптируется к атакам целой королевской армии и поглощает все живое на своем пути.
- **Core Hook**: Управляйте живой желеобразной массой с процедурным шейдером, которая начинает размером с яблоко, а к 10-й минуте вырастает в гигантского титана, проглатывающего королевскую конницу и башни замка целиком!
- **Unique Value Proposition**: Уникальный синтез физики роста массы из Agar.io и богатого билдостроения Vampire Survivors, усиленный процедурной 3D-деформацией слизи, сочным сквош-эффектом и полным разрушением интерактивного средневекового окружения.

## 4. Session Model & Game Loop
- **Session Duration**: 7–10 минутные сессии выживания по таймеру с динамически нарастающей сложностью, волнами элитных рыцарей и мгновенным выбором мутаций.
- **Core Gameplay Loop**:
```text
Поглощение мелких крестьян и разрушение микро-декораций -> Набор биомассы и увеличение размера слизи -> Выбор случайных мутаций при повышении уровня -> Отражение накатывающих волн королевской гвардии и боссов -> Накопление очков ДНК и перманентная прокачка генома в лаборатории.
```
- **Win Conditions**: Продержаться 10 минут против непрерывных волн королевской армии и одолеть прибывшего на 10-й минуте Королевского Инквизитора в бронированном големе.
- **Lose Conditions**: Потеря всего запаса биомассы (HP падает до нуля под шквальным уроном королевских лучников, магов и рыцарей).

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
