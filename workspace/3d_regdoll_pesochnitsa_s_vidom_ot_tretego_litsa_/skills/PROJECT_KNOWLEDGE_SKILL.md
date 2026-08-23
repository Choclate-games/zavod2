# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку Three.js и Rapier3D для симуляции рэгдолла и каскадных разрушений, процедурную генерацию зала и персонажей, VFX сочности со Slow-Mo, синтезированный Web Audio звук и аркадный цикл физического саботажа с рекламой..

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
- `mechanics/chain_reaction.md` — Расчет кинетической цепной реакции при падении люстры в свадебный торт и разлете пирамид шампанского.
- `audio/web_audio_and_muting.md` — Управление Web Audio контекстом, разблокировка звука по первому клику и глушение при сворачивании игры.
- `monetization/rewarded_ads_patterns.md` — Интеграция вознаграждаемой рекламы для умножения очков погрома и разблокировки новых банкетных залов и катапульт.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/melee_combat_and_ragdoll.md, threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, stack/bitecs.md, threejs/skinned_character_models.md, patterns/score_attack_loop.md, patterns/survivor_loop.md, stack/yuka_ai.md.

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
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
