# Game Design Document (GDD): Рикошет Снайпер 3D: Замедленный Выстрел

## 1. Executive Summary & Vision
- **Title**: Рикошет Снайпер 3D: Замедленный Выстрел
- **Vision Statement**: Создать эталонную WebGL/Mobile физическую головоломку с непревзойденным сочным геймфилом, где каждый успешный выстрел ощущается как сцена из блокбастера благодаря замедлению времени, динамической камере и цепным реакциям.
- **Elevator Pitch**: «Superhot встречает Sniper Elite в формате 3D-головоломки»: целься лазерным лучом с учетом нормалей стен, жми на спуск и наблюдай в кинематографичном slow-mo, как твоя пуля огибает препятствия, проходит сквозь порталы, детонирует бочки и сокрушает красных врагов!
- **Genre**: Физическая головоломка / Тактический 3D-шутер (Рикошет-пазл от первого лица со Slow-Motion Bullet-Cam)
- **Target Audience**: Игроки 12-45 лет, ценящие тактические физические головоломки, кинематографичный экшен в стиле Superhot / Sniper Elite и залипательный гиперказуальный геймплей с реиграбельностью.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 8/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 9/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 8/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 9/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.5 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Гениальный снайпер-трикшотер, способный одним математически выверенным выстрелом запустить смертоносный рикошет через порталы и щиты, уничтожив всю вражескую базу.
- **Core Hook**: Гипнотический кинематографический Slow-Motion полет пули от первого лица с физически честными рикошетами, взрывами бочек и эпичным разлетом красных врагов одним точным выстрелом.
- **Unique Value Proposition**: Сочетание точного геометрического расчета траектории от первого лица с эффектом кинематографической камеры слежения за пулей в честном 3D-пространстве с интерактивной физикой Ragdoll и порталами.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые микро-сессии по 30-90 секунд на уровень с мгновенным перезапуском одной кнопкой и возможностью пройти 20 уровней за 15-25 минут с последующей охотой за 3 звездами.
- **Core Gameplay Loop**:
```text
Оценка геометрии уровня -> Прицеливание лазерным лучом с расчетом рикошетов -> Выстрел -> Замедленный полет пули (Bullet-Cam) с физическими рикошетами и цепными реакциями -> Уничтожение всех врагов -> Получение 1-3 звезд -> Переход на следующий уровень или мгновенный рестарт.
```
- **Win Conditions**: Все красные враги на уровне нейтрализованы (убиты прямым попаданием пули, осколками или взрывной волной бочек).
- **Lose Conditions**: Пуля израсходована и остановилась (превышен лимит отскоков или попадание в поглощающую преграду), при этом хотя бы один враг остался жив.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
