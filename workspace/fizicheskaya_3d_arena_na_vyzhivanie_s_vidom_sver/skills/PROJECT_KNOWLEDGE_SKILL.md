# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Физический экшен на выбывание с процедурной графикой Three.js, расчётом импульсов и гидродинамики плавающего льда в Rapier3D, поведением ботов Yuka AI, адаптивной производительностью и синтезированным Web Audio звуком..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/arena_combat_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/arena_combat_loop.md` — Определяет структуру матча Last Man Standing на выбывание с сужающейся ледовой ареной и короткими раундами по 45–75 секунд.
- `mechanics/fluid_buoyancy.md` — Реализует гидродинамическую плавучесть для реалистичного покачивания льдин под весом игроков и эффектного погружения вытолкнутых соперников в океан.
- `audio/web_audio_and_muting.md` — Обеспечивает корректное управление аудиоконтекстом, разблокировку звука по первому тапу и глушение при сворачивании игры.
- `monetization/rewarded_ads_patterns.md` — Интегрирует просмотр рекламы за вознаграждение для разблокировки эксклюзивных скинов тюбингов и эффектов брызг.
- `monetization/interstitial_best_practices.md` — Регулирует показ межстраничной рекламы строго в паузах между матчами на выбывание для сохранения удержания игроков.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: patterns/racing_event_loop.md, threejs/arcade_racing_and_drift.md, threejs/rapier_vehicle_controller.md, threejs/vehicle_wheel_rig.md, mechanics/checkpoint_lap_racing.md, mechanics/drift_scoring.md, patterns/survivor_loop.md, threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, threejs/fighting_game_core.md, mechanics/parry.md, stack/bitecs.md, stack/recast_navigation.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/arena_combat_loop.md` — Pattern: Arena Combat Loop — Pattern Name: Arena Combat Loop Primary Genre: Action Combat / Gladiator / Brawler
- `docs/ref/knowledge/mechanics/fluid_buoyancy.md` — Механика: Гидродинамика и плавучесть (Fluid Buoyancy) — 1. **Выталкивающая сила**:
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
