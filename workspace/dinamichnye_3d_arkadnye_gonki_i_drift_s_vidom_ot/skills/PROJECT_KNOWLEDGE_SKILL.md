# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физическую модель тяжелого грузовика в Rapier3D со сдвигом центра масс от плещущейся жидкости, процедурный горный ледяной серпантин, систему дрифт-очков и чекпоинтов, синтезированный Web Audio звук дизеля и льда, а также адаптивное качество рендера под мобильные устройства..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/racing_event_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/racing_event_loop.md` — Определяет событийную структуру спринтерского заезда от старта до финиша с оценкой времени и сохранности груза.
- `mechanics/checkpoint_lap_racing.md` — Обеспечивает фиксацию прохождения 3 контрольных сплитов горного спуска и финишной весовой рамки.
- `audio/web_audio_and_muting.md` — Гарантирует корректный старт Web Audio по пользовательскому вводу и соблюдение правил глушения звука платформ.
- `monetization/rewarded_ads_patterns.md` — Интегрирует просмотр рекламы с вознаграждением за спасение упавшего в пропасть молоковоза или удвоение награды за доставку.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: mechanics/fluid_buoyancy.md, threejs/racing_track_and_opponents.md, mechanics/rubberband_opposition.md, patterns/score_attack_loop.md, stack/bitecs.md, stack/recast_navigation.md, stack/yuka_ai.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/racing_event_loop.md` — Pattern: Racing Event Loop — Pattern Name: Racing Event Loop Primary Genre: Arcade Racing / Drift
- `docs/ref/knowledge/mechanics/checkpoint_lap_racing.md` — Mechanic: Checkpoint & Lap Progression — Name: Checkpoint & Lap Progression Category: Racing & Vehicles Description: The track curve is sampled into ~40 ordered checkpoints. Passing them in sequence yields lap counting…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
