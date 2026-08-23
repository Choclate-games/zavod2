# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физическую аркадную петлю с симуляцией инерции и твердых тел в Rapier3D, процедурный риг персонажа и процедурную геометрию предметов, поддержанные адаптивным качеством, сочным откликом и процедурным Web Audio..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/physics_arcade_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/physics_arcade_loop.md` — Задаёт базовый цикл короткой физической сессии: принятие заказа, заезд с удержанием баланса, оценка уцелевшего груза и прогрессия уровней.
- `mechanics/fluid_buoyancy.md` — Нужен для математики гидродинамического резонанса и колебаний жидкости в аквариуме со сдвигом фазы.
- `mechanics/chain_reaction.md` — Определяет динамику распространения импульсов и соскальзывания между соседними элементами в шаткой башне.
- `audio/web_audio_and_muting.md` — Обеспечивает корректный запуск аудио по клику и глушение звуков при потере фокуса или показе рекламы.
- `monetization/interstitial_best_practices.md` — Регламентирует показ межстраничной рекламы в естественных паузах между станциями после открытия дверей.
- `monetization/rewarded_ads_patterns.md` — Реализует вознаграждаемую рекламу для удвоения чаевых курьера или спасения упавшего заказа.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/rapier_vehicle_controller.md, threejs/arcade_racing_and_drift.md, mechanics/vehicle_physics.md, threejs/orthographic_2d_and_pointer_input.md, stack/recast_navigation.md, stack/yuka_ai.md, stack/bitecs.md, mechanics/grid_building.md, mechanics/ragdoll.md, mechanics/upgrade_choices.md, threejs/horde_survivor_core.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/physics_arcade_loop.md` — Pattern: Physics Arcade Loop — Pattern Name: Physics Arcade Loop Primary Genre: Physics Destruction / Slingshot / Ragdoll Arcade
- `docs/ref/knowledge/mechanics/fluid_buoyancy.md` — Механика: Гидродинамика и плавучесть (Fluid Buoyancy) — 1. **Выталкивающая сила**:
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
