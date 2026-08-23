# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физическую гидроавиацию в Rapier3D с гидродинамикой глиссирования, процедурный каньон с инстансированными эффектами огня и воды, оптимизированный рендеринг Three.js и аркадную петлю Score Attack..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/score_attack_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/score_attack_loop.md` — Архитектура спринтерской аркадной сессии на 45-60 секунд с подсчетом очков за ликвидацию пожаров и чистоту забора воды.
- `mechanics/fluid_buoyancy.md` — Физика гидродинамического контакта поплавков фюзеляжа с поверхностью реки при бреющем водозаборе.
- `audio/web_audio_and_muting.md` — Управление звуковым контекстом, автозапуском и корректным глушением звука по правилам платформ.
- `monetization/interstitial_best_practices.md` — Показ межстраничной рекламы строго в естественных паузах между спринтерскими вылетами без прерывания полета.
- `monetization/rewarded_ads_patterns.md` — Награждаемая реклама за удвоение очков за вылет или мгновенный запасной резервуар воды.
- `mechanics/checkpoint_lap_racing.md` — Документ назван директором проекта при выборе направления.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/rapier_vehicle_controller.md, mechanics/vehicle_physics.md, threejs/arcade_racing_and_drift.md, threejs/vehicle_wheel_rig.md, mechanics/checkpoint_lap_racing.md, threejs/racing_track_and_opponents.md, mechanics/drift_scoring.md, threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, patterns/survivor_loop.md, patterns/racing_event_loop.md, stack/recast_navigation.md, stack/yuka_ai.md, stack/bitecs.md, threejs/procedural_character_rig.md, threejs/fps_controller_and_shooting.md, threejs/melee_combat_and_ragdoll.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/score_attack_loop.md` — Pattern: Score Attack Loop — Pattern Name: Score Attack Loop Primary Genre: Arcade / Endless Runner / Combo Chaser
- `docs/ref/knowledge/mechanics/fluid_buoyancy.md` — Механика: Гидродинамика и плавучесть (Fluid Buoyancy) — 1. **Выталкивающая сила**:
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/mechanics/checkpoint_lap_racing.md` — Mechanic: Checkpoint & Lap Progression — Name: Checkpoint & Lap Progression Category: Racing & Vehicles Description: The track curve is sampled into ~40 ordered checkpoints. Passing them in sequence yields lap counting…
