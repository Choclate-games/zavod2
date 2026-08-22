# Game Design Document (GDD): Тактика Прорыва: CQB Штурм

## 1. Executive Summary & Vision
- **Title**: Тактика Прорыва: CQB Штурм
- **Vision Statement**: Создать эталонный веб-шутер ближнего боя, где каждый штурм — это короткая, но предельно насыщенная адреналином тактическая головоломка с физическим взрывом стен, тактическим щитом и бескомпромиссной стрельбой на дистанции вытянутой руки.
- **Elevator Pitch**: Тактический 3D-шутер от первого лица в духе Rainbow Six: пробивайте стены зарядами C4, прикрывайтесь баллистическим щитом и зачищайте захваченное посольство в замедленном времени за 90 секунд!
- **Genre**: Тактический 3D CQB-Шутер (Тактический симулятор штурма / Бричинг и зачистка)
- **Target Audience**: Игроки 16–35 лет, увлеченные тактическими шутерами (Rainbow Six, Ready or Not), ценящие атмосферу спецназа, планирование штурма, летальный CQB и зрелищное разрушение укрытий без утомительного виртуального бега.

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
- **Player Fantasy**: Вы — элитный оперативник штурмовой группы спецназа 'Радуга'. За вашими плечами титановый баллистический щит и бричинг-заряды. Вы диктуете геометрию боя, пробивая стены там, где враг уверен в своей безопасности, и ликвидируете террористов за доли секунды без права на промах.
- **Core Hook**: Мгновенное превращение глухой стены в тактический пролом: взрыв разносит гипсокартон в щепки, время замирает, и за 2 секунды кинематографичного slow-mo вы решаете исход операции одним точным хедшотом.
- **Unique Value Proposition**: Первый браузерный 3D-шутер с процедурным физическим разрушением преград и акцентом на фазе бричинга в slow-mo: управление оптимизировано под тач-скрин без виртуальных джойстиков, а летальность попаданий возвращает истинный хардкорный дух тактического спецназа.

## 4. Session Model & Game Loop
- **Session Duration**: Штурм захваченного объекта из 3 последовательных комнат (Периметр -> Офисный холл -> Серверное хранилище) длительностью 90–120 секунд с нарастающей сложностью укреплений и вооружения врагов.
- **Core Gameplay Loop**:
```text
Тактическая разведка эндоскопом -> Выбор слабой зоны и установка C4 -> Детонация с физическим проломом стены -> Вход в штурмовой Slow-Mo -> Ликвидация угроз точными выстрелами из-за щита -> Обезвреживание бомбы / переход к следующей комнате -> Получение тактических кредитов и улучшение снаряжения.
```
- **Win Conditions**: Успешная нейтрализация всех террористов во всех 3 помещениях объекта и обезвреживание взрывного устройства без критического разрушения баллистического щита.
- **Lose Conditions**: Гибель оперативника от ответного огня боевиков, подрыв на скрытой растяжке или детонация бомбы по истечении таймера штурма.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
