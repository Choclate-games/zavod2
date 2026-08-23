# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физический FPS с процедурными павильонами, цепным разрушением, точной стрельбой, мобильной оптимизацией, синтетическим звуком и аккуратной рекламной интеграцией..

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
- `mechanics/cover_and_suppression.md` — Он помогает связать разрушение декораций с укрытиями, обзором и решениями игрока.
- `mechanics/physics_destruction.md` — Он превращает попадания в фасады и опоры в изменения маршрута, укрытий и следующего кадра.
- `mechanics/chain_reaction.md` — Он формализует выбор первой опоры в связанных цепях декораций и последствия этого выбора.
- `audio/web_audio_and_muting.md` — Он обеспечивает корректный автозапуск и глушение звука на игровых площадках.
- `monetization/interstitial_best_practices.md` — Он не даст прервать короткий контракт рекламой во время стрельбы или физической реакции.
- `monetization/rewarded_ads_patterns.md` — Он помогает предложить добровольное вознаграждение после провала, не ломая честность контракта.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, mechanics/wave_survival.md, mechanics/upgrade_choices.md, patterns/survivor_loop.md, patterns/arena_combat_loop.md, patterns/score_attack_loop.md, threejs/fighting_game_core.md, threejs/melee_combat_and_ragdoll.md, mechanics/parry.md, stack/yuka_ai.md, stack/recast_navigation.md, stack/bitecs.md, threejs/skinned_character_models.md, threejs/game_map_and_world_design.md, stack/three_mesh_bvh.md, threejs/performance_guide.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/cover_and_suppression.md` — Mechanic: Cover & Suppression — Name: Cover & Suppression Category: Shooter / Tactics Description: Pre-authored cover points carry a position, a facing normal, a height class and an occupancy slot. AI scores them…
- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
