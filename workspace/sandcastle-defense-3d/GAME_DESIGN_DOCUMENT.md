# Game Design Document (GDD): Песочный Бастион 3D: Защита Пляжа

## 1. Executive Summary & Vision
- **Title**: Песочный Бастион 3D: Защита Пляжа
- **Vision Statement**: Красочная, сочная и расслабляющая, но в то же время тактически глубокая 3D-стратегия, которая загружается за секунду на любом смартфоне или ПК, даря игрокам эстетическое удовольствие от брызг воды, рассыпающегося песка и умного перестроения вражеских потоков.
- **Elevator Pitch**: Постройте несокрушимый песчаный лабиринт на солнечном берегу! Расставляйте ракушечные пушки, поливайте наглых крабов из водяных брызгалок и не дайте чайкам и морским звездам разрушить ваш песчаный замок в трехмерном Tower Defense с умным поиском пути!
- **Genre**: Tower Defense (Защита башен) (Лабиринтный 3D Tower Defense / Real-Time Strategy)
- **Target Audience**: Игроки от 10 до 45 лет, любители казуальных и мидкорных тактических стратегий, поклонники классических TD (Kingdom Rush, Bloons, Desktop Tower Defense) на ПК и мобильных браузерах.

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
- **Player Fantasy**: Вы — великий архитектор песчаных замков и защитник побережья, превращающий хрупкий пляжный песок и морские ракушки в непреодолимую высокотехнологичную крепость против забавных морских захватчиков.
- **Core Hook**: Возможность создавать собственный уникальный лабиринт из песчаных замков прямо на пляже, заставляя волны крабов и морских звезд плутать под перекрестным огнем ракушечных пушек и струй поливалок.
- **Unique Value Proposition**: Сочетание теплой летней пляжной атмосферы, приятной 3D-физики песчаных частиц и глубокой тактики лабиринтостроения (mazing) с расчетом Flow Field в реальном времени прямо в веб-браузере.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые сессии по 4–8 минут на уровень с возможностью мгновенного продолжения, сохранения прогресса в облаке и бесконечного режима выживания.
- **Core Gameplay Loop**:
```text
1. Оценка береговой линии и спавна врагов -> 2. Строительство песчаных стен и боевых башен за ракушки -> 3. Запуск волны и динамический поиск пути врагами по созданному лабиринту -> 4. Уничтожение крабов, чаек и морских звёзд -> 5. Получение золотого песка и мета-прокачка башен между раундами.
```
- **Win Conditions**: Успешно отразить все волны морских обитателей на локации, сохранив прочность главного Песчаного Замка выше 0%.
- **Lose Conditions**: Прочность главного Песчаного Замка падает до 0% из-за прорвавшихся к нему врагов.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
