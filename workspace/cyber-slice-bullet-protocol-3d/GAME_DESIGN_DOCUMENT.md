# Game Design Document (GDD): CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)

## 1. Executive Summary & Vision
- **Title**: CYBER SLICE: BULLET PROTOCOL (Кибер Срез: Протокол Времени)
- **Vision Statement**: Создать эталонный мобильный и веб-хит в жанре свайп-экшена, соединяющий визуальный шик киберпанка, глубокую roguelite-реиграбельность билдов и непревзойденное ощущение гипер-контроля над временем и геометрией пространства.
- **Elevator Pitch**: «Ghostrunner встречает Fruit Ninja в неоновом киберпанке»: замедляй время одним касанием, рассекай киборгов и летящие ракеты на светящиеся полигональные части, выстраивай безумные комбо и сокрушай мега-боссов с уникальными roguelite-талантами прямо в браузере!
- **Genre**: Экшен-слэшер / Аркада (3D Roguelite свайп-слэшер с замедлением времени и процедурным разрушением)
- **Target Audience**: Игроки 14-35 лет, поклонники динамичных слэшеров (Ghostrunner, Metal Gear Rising, Fruit Ninja, Superhot), любители киберпанк-стилистики, неонового синтивейва и скиллозависимого аркадного геймплея.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 10/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 9/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 9/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 10/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 9/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 9/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **9.0 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Ты — элитный аугментированный кибер-ниндзя с тактическим квантовым клинком. Для тебя мир замирает в миллисекундах, пока ты элегантными взмахами пальца разрезаешь лазерные лучи, пули и элитных боевых мехов на десятки аккуратных кусков.
- **Core Hook**: Мгновенное тактильное рассечение 3D-врагов под любым углом в кинематографичном Bullet Time с физическим разлетом светящихся неоновых осколков и сочным киберпанк-звуком.
- **Unique Value Proposition**: Первый в браузерном WebGL 3D-слэшер с честным процедурным срезом трехмерных моделей (CSG/Plane-intersection) в замедлении времени, оптимизированный под 60 FPS на мобильных и десктопных устройствах без тяжелых загрузок.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые сессии по 4-8 минут (3-5 волн врагов + дуэль с боссом) с глубокой мета-прокачкой и бесконечным рейтинговым режимом «Кибер-Бездна».
- **Core Gameplay Loop**:
```text
Вход на неоновую кибер-арену -> Замедление времени (Bullet Time) при касании/свайпе -> Хирургическое рассечение нападающих киборгов и снарядов свайпом -> Накопление комбо и перегрузки (Overdrive) -> Сбор нано-чипов и выбор roguelite-модификаторов -> Сражение с многофазным боссом -> Прокачка постоянных кибер-имплантов в хабе.
```
- **Win Conditions**: Уничтожить все волны кибер-агентов на арене, отразить критические атаки и нейтрализовать главного босса сектора, сохранив запас прочности экзоскелета.
- **Lose Conditions**: Полное истощение шкалы HP кибер-ниндзя от пропущенных ударов, взрывов неразрезанных ракет или падения в лазерные барьеры.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
