# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на процедурную 3D-генерацию мира и монстров, физику Rapier3D с bitECS для управления ордой, процедурный Web Audio звук и систему термодинамического луча с цепными реакциями, не используя стандартные архетипы петель из-за уникального формата стационарной 180-секундной вахты..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: не выбран, петля собственная.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `audio/web_audio_and_muting.md` — Гарантирует корректную разблокировку звука по первому клику/тапу и глушение при потере фокуса вкладки согласно требованиям площадок.
- `monetization/interstitial_best_practices.md` — Регулирует показ межстраничной рекламы строго в естественных паузах между 180-секундными ночными вахтами без прерывания геймплея.
- `monetization/rewarded_ads_patterns.md` — Предоставляет добровольную рекламу за вознаграждение для аварийного перезапуска генератора при поражении или бонуса к финальному счету.
- `mechanics/chain_reaction.md` — Реализует механику цепного катализа биолюминесценции и радиусы поражения при взрывах уязвимых брюшек альфа-тварей и био-мин.
- `mechanics/drone_swarm.md` — Реализует алгоритмы поведения роя (Boids), направляющие плотные массы тварей с трех утесов к центральной башне маяка.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, patterns/survivor_loop.md, mechanics/upgrade_choices.md, threejs/tower_defense_core.md, patterns/tower_defense_loop.md, mechanics/tower_targeting_priority.md, mechanics/base_building.md, threejs/fps_controller_and_shooting.md, threejs/melee_combat_and_ragdoll.md, mechanics/parry.md, stack/recast_navigation.md, threejs/skinned_character_models.md, monetization/in_app_purchases.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/mechanics/drone_swarm.md` — Механика: Поведение роя дронов и миньонов (Boids Swarm AI) — 1. **Три базовых вектора**:
