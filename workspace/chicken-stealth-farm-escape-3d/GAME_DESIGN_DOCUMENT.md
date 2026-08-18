# Game Design Document (GDD): Куриный Побег 3D: Стелс на Ферме

## 1. Executive Summary & Vision
- **Title**: Куриный Побег 3D: Стелс на Ферме
- **Vision Statement**: Создать эталонную браузерную 3D стелс-игру с сочным геймфилом, плавной анимацией, процедурными спецэффектами и непрерывной кривой удовольствия от перехитрения умных патрульных псов.
- **Elevator Pitch**: Дерзкая курица планирует побег века! Прокрадитесь мимо патрулирующих фермерских псов, прячьтесь под картонную коробку при малейшей опасности, соберите все золотые зерна, чтобы взломать замок ворот, и вырвитесь на свободу!
- **Genre**: 3D Стелс-головоломка / Аркадный Экшен (Изометрический стелс / Тактический лабиринт)
- **Target Audience**: Широкая казуальная и мидкорная аудитория 10-35 лет на платформах Yandex Games и WebGL, любящая забавных животных, тактические стелс-задачи и динамичный аркадный геймплей.

## 2. Viability & Fun Scores
| Category | Score / 10 | Rationale |
| :--- | :--- | :--- |
| **Fun & Game Feel** | 9/10 | Immediate tactile feedback from physics impacts and responsive controls |
| **Originality** | 8/10 | Unique hybrid twist combining physics with roguelite scaling |
| **Replayability** | 8/10 | Upgrade synergy cascades and persistent meta progression |
| **Mobile Fit** | 10/10 | Ergonomic touch controls and safe area adaptation |
| **Monetization** | 9/10 | High-converting Rewarded Revives and multipliers |
| **Platform Fit** | 10/10 | Perfect fit for Yandex Games / CrazyGames fast-loading web ecosystem |

*Overall Weighted Score*: **8.9 / 10**

## 3. Player Fantasy & Core Hook
- **Player Fantasy**: Вы — ловкая курица-спецагент под прикрытием, способная перехитрить грозных сторожевых псов, мгновенно раствориться под картонной коробкой прямо перед носом врага и совершить легендарный побег на волю.
- **Core Hook**: Культовая механика маскировки картонной коробкой в стиле Metal Gear Solid, перенесенная в комедийный сеттинг фермы с дерзкой курицей и собаками с неоновыми конусами обзора!
- **Unique Value Proposition**: Уникальный сплав тактического стелса с мгновенно считываемыми правилами (четкие светящиеся конусы обзора) и вирусного комедийного геймплея, адаптированного под управление одним пальцем на смартфонах и клавиатуру на ПК.

## 4. Session Model & Game Loop
- **Session Duration**: Быстрые напряженные сессии по 1.5–3 минуты на уровень с нарастающей комплексностью патрулей и мета-прогрессией скинов.
- **Core Gameplay Loop**:
```text
Скрытное исследование территории фермы -> Уклонение от патрулей собак и маскировка коробкой -> Сбор золотых зерен -> Открытие запертых ворот -> Побег в зону эвакуации -> Получение наград и разблокировка скинов/уровней.
```
- **Win Conditions**: Собрать необходимое количество золотых зерен на уровне, активировать механизм открытия главных ворот и пересечь финишную линию эвакуации.
- **Lose Conditions**: Попадание в освещенный конус зрения собаки в незамаскированном виде или совершение движения в коробке на глазах у патрульного пса, приводящее к поимке.

## 5. Player Actions & Controls
- **Movement**: Smooth 360-degree locomotion with responsive controls.
- **Offense**: Dynamic attack abilities, stance modifiers, and combo chains.
- **Defense**: Evasion, shielding, and tactical positioning.
- **Progression Interaction**: 3-Choice card draft upon wave clear or level-up.

## 6. Progression & Retention Drivers
- **In-Run Escalation**: Upgrades synergize via keyword tags.
- **Meta-Progression**: Currency earned in run spent permanently to unlock new traits.
- **Leaderboards**: Highest wave reached and total score submitted to Playgama Leaderboards.
