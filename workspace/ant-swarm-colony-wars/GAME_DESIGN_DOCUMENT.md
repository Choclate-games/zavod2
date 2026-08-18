# Game Design Document (GDD): Муравьиный Рой: Война Колоний

## 1. Executive Summary & Vision
- **Title**: Муравьиный Рой: Война Колоний
- **Vision Statement**: Создать самую отзывчивую и зрелищную микро-RTS на веб-рынке, сочетающую медитативное рисование потоков и глубокую тактику противостояния колоний.
- **Elevator Pitch**: Управляйте живой армией из 500+ муравьев! Рисуйте феромонные трассы, сцепляйте рабочих в живые мосты над расщелинами, швыряйте бомбардиров в укрепления врага и захватывайте всю экосистему на процедурных микро-аренах!
- **Genre**: Стратегия в реальном времени (Тактический симулятор роя с векторным управлением)
- **Target Audience**: Любители стратегий в реальном времени, микро-менеджмента, физических симуляций и динамичных тактических головоломок в возрасте 12-35 лет.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 9/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 8/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 9/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 8/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 9/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.5 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Вы — сверхразум колонии, управляющий живой стихией из сотен разумных насекомых, способных как вода обтекать препятствия и как стальной кулак разрушать вражеские муравейники.
- **Core Hook**: Рисуй феромонные реки пальцем или мышью и наблюдай, как сотни муравьев мгновенно объединяются в гигантские живые физические структуры для сокрушения вражеских цитаделей.
- **Unique Value Proposition**: Прямое векторное управление потоками частиц с процедурной механикой живых конструкций (Verlet-сцепка муравьев) в ультра-быстрой браузерной RTS без лагов.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые тактические уровни по 2-4 минуты с мета-прогрессией колонии и эволюционным древом мутаций.
- **Core Gameplay Loop**:
```text
Рисование феромонных троп и направление роя -> Формирование живых мостов и таранных сфер для преодоления преград -> Штурм и захват вражеских гнезд -> Сбор биомассы и феромонов -> Улучшение и эволюция классов муравьев -> Переход к следующему уровню.
```
- **Win Conditions**: Уничтожение всех маток и захват всех вражеских муравейников на локации.
- **Lose Conditions**: Потеря главного муравейника игрока или гибель всей популяции колонии.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
