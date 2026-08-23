# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку Rapier3D и Three.js для физического каскадного сноса процедурных небоскребов с BVH-рейкастингом срезов, частицами разрушений, процедурным звуком и адаптивной мобильной производительностью (ось тел в кадре закрыта процедурными зданиями и клиньями)..

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
- `mechanics/chain_reaction.md` — Реализует передачу кинетического импульса и цепную реакцию обрушения соседних небоскребов по принципу домино.
- `audio/web_audio_and_muting.md` — Обеспечивает корректную обработку политик автовоспроизведения браузера и глушение звука при сворачивании вкладки.
- `monetization/interstitial_best_practices.md` — Регламентирует показ межстраничной рекламы исключительно в естественных паузах между завершенными уровнями сноса.
- `monetization/rewarded_ads_patterns.md` — Интегрирует просмотр рекламы за вознаграждение для получения дополнительного сейсмического клина или права на переигровку уровня.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: mechanics/ragdoll.md, mechanics/mining_drill.md, mechanics/grid_building.md, mechanics/upgrade_choices.md, stack/bitecs.md, threejs/orthographic_2d_and_pointer_input.md, patterns/score_attack_loop.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
