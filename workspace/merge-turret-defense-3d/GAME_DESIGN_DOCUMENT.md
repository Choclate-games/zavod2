# Game Design Document (GDD): Слияние Турелей 3D: Оборона Базы

## 1. Executive Summary & Vision
- **Title**: Слияние Турелей 3D: Оборона Базы
- **Vision Statement**: Создать образцовый WebGL-хит для Yandex Games и Playgama с нулевым порогом входа, ультра-плавным 60 FPS на любых смартфонах, богатой системой прокачки 15+ видов орудий и мощными вирусными петлями удержания.
- **Elevator Pitch**: Соединяй пушки на сетке 4х4, создавай смертоносные плазменные рейлганы и защищай базу от бесконечных волн неоновых сфер в сочной 3D изометрии!
- **Genre**: Гибридная казуальная стратегия / Tower Defense (Merge-2 головоломка + Idle Авто-батлер)
- **Target Audience**: Игроки 12–45 лет, ценящие аддиктивный казуальный геймплей слияния (Merge Games) и удовлетворяющую визуальную прогрессию башенной защиты с непрерывным ростом цифр урона и авто-боем.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 10/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 9/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 10/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **9.0 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Гениальный инженер-артиллерист, создающий из примитивных деревянных пушек футуристическую несокрушимую батарею плазменных рейлганов и лазерных аннигиляторов.
- **Core Hook**: Гипнотический дуализм экрана: внизу — тактильно приятный дзен слияния орудий с сочным щелчком, вверху — взрывное 3D светопреставление с разлетающимися от выстрелов цветными сферами!
- **Unique Value Proposition**: Прямая бесшовная связь между 2D/псевдо-3D сеткой слияния и реальным полем боя в 3D: каждая объединенная турель мгновенно меняет свой внешний вид, тип снарядов, анимацию и сразу открывает сокрушительный огонь по толпе врагов.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые сессии от 1 до 5 минут для активного слияния и прокачки, поддерживаемые оффлайн-доходом до 8-12 часов для легкого возвращения в игру.
- **Core Gameplay Loop**:
```text
Покупка турелей 1-го уровня за монеты -> Drag-and-drop слияние одинаковых турелей на сетке 4x4 для получения более мощных орудий -> Автоматическая стрельба турелей с сетки по наступающим волнам цветных шаров на 3D арене -> Уничтожение шаров и сбор монет -> Мета-прокачка в магазине (урон, доход, скорость спавна) -> Прохождение волн и боссов.
```
- **Win Conditions**: Успешная зачистка всех волн локации, победа над гигантскими шарами-боссами каждые 10 волн и разблокировка ультимативного 15-го уровня турели (Квантовый Разрушитель).
- **Lose Conditions**: Прорыв цветных сфер к воротам базы и падение шкалы прочности базы до 0 HP (с возможностью мгновенного воскрешения за просмотр Rewarded Video или перезапуском волны с сохранением турелей).

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
