# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку высокоточного снайперского прицеливания (ThreeMeshBVH), стелс-детекции и физического саботажа окружения (Rapier3D) с процедурной милитари-геометрией, синтезом звука и эффектами оптики; стандартные архетипы петель из patterns не выбраны, так как игра строится вокруг уникальной структуры коротких тактических стелс-контрактов..

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
- `mechanics/chain_reaction.md` — Физический саботаж кабелей, осветительных вышек и электрощитов для цепных аварийных ликвидаций целей.
- `mechanics/physics_destruction.md` — Разрушение подвесных тросов, падение тяжелых прожекторов и физический урон целям от обломков.
- `audio/web_audio_and_muting.md` — Управление жизненным циклом Web Audio, разблокировка звука первым касанием и глушение при скрытии вкладки.
- `monetization/rewarded_ads_patterns.md` — Rewarded-реклама для пополнения запаса задержки дыхания, разведки маршрутов целей или открытия прототипов оптики.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: patterns/survivor_loop.md, patterns/arena_combat_loop.md, patterns/physics_arcade_loop.md, patterns/roguelike_loop.md, threejs/horde_survivor_core.md, threejs/melee_combat_and_ragdoll.md, mechanics/upgrade_choices.md, stack/bitecs.md, stack/recast_navigation.md.

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
- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
