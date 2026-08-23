# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку Three.js и Rapier3D для кинетического FPS-экшена с физическим рэгдоллом, разрушениями и рикошетами на процедурной геометрии бункера с петлей арена-комбата..

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
- `patterns/arena_combat_loop.md` — Базовый игровой цикл штурма модульного бункера с зачисткой 4 отсеков и апгрейдом экзокостюма между фазами.
- `mechanics/chain_reaction.md` — Кинетические цепные реакции при падении выбитых дверей на пулеметчиков, сбивании стоек с баллонами и взрывах.
- `mechanics/physics_destruction.md` — Разрушаемое окружение бункера, срыв гермодверей с петель и метание интерактивных ящиков и бочек во врагов.
- `audio/web_audio_and_muting.md` — Управление политиками автозапуска Web Audio в браузере и глушение звука при потере фокуса вкладки.
- `monetization/rewarded_ads_patterns.md` — Rewarded-монетизация для добровольного получения энергоячеек, усиления экзокостюма или второго шанса при штурме.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: patterns/survivor_loop.md, threejs/horde_survivor_core.md, patterns/fighting_match_loop.md, threejs/fighting_game_core.md, stack/bitecs.md, threejs/skinned_character_models.md, threejs/stealth_and_vision_cones.md, mechanics/upgrade_choices.md.

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
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
