# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Точного архетипа петли в patterns/ нет, поэтому проект опирается на знания о маршрутном FPS, физической орде, процедурном городе, навигации, мобильной производительности, звуке и контрактной монетизации..

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
- `mechanics/formation_movement.md` — Временные строи орды должны сжиматься в улицах и заранее показывать, какой проход будет закрыт.
- `audio/web_audio_and_muting.md` — Автозапуск и глушение звука должны безопасно работать на клавиатуре и таче на всех площадках.
- `monetization/rewarded_ads_patterns.md` — Опциональная награда после неудачного контракта может поддержать доставку, не превращая победу в обязательный просмотр рекламы.
- `monetization/interstitial_best_practices.md` — Между контрактами или после естественного завершения забега нужна реклама, не прерывающая четыре активные волны.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, patterns/survivor_loop.md, patterns/arena_combat_loop.md, patterns/score_attack_loop.md, patterns/tower_defense_loop.md, threejs/fighting_game_core.md, threejs/melee_combat_and_ragdoll.md, mechanics/parry.md, mechanics/special_move_input.md, mechanics/cover_and_suppression.md, threejs/stealth_and_vision_cones.md, mechanics/card_synergy.md, mechanics/physics_destruction.md, stack/yuka_ai.md, stack/three_mesh_bvh.md, stack/postprocessing.md, monetization/in_app_purchases.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/formation_movement.md` — Mechanic: Formation Movement — Name: Formation Movement Category: Strategy / RTS Description: A move order for N units expands into N grid slots around the destination, oriented along the travel direction, assigned…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
