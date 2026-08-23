# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на гибрид тактического строительства и FPS-обслуживания турелей в связке с процедурной дизельпанк-графикой, физикой Rapier3D и термодинамическими цепными реакциями..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/builder_defense_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/builder_defense_loop.md` — Задаёт гибридный цикл тактической фазы монтажа турелей по слотам и активной фазы обороны периметра с обслуживанием орудий от первого лица.
- `mechanics/chain_reaction.md` — Реализует термодинамическую цепную реакцию: глубокую крио-заморозку мутантов с последующим раскалыванием взрывом дизельных бочек.
- `audio/web_audio_and_muting.md` — Гарантирует разблокировку Web Audio по первому клику монтажа и корректное глушение звука при потере фокуса вкладки.
- `monetization/rewarded_ads_patterns.md` — Внедряет добровольный просмотр рекламы за экстренную доставку Overcharge-ячейки или мгновенное крио-охлаждение всех орудий.
- `monetization/interstitial_best_practices.md` — Ограничивает межстраничную рекламу паузами между трёхволновыми сменами обороны, исключая прерывание активного боя.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, patterns/survivor_loop.md, mechanics/upgrade_choices.md, threejs/shooter_enemy_ai_and_combat.md, mechanics/parry.md, patterns/roguelike_loop.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/builder_defense_loop.md` — Pattern: Builder Defense Loop — Pattern Name: Builder Defense Loop Primary Genre: Base Defense / Tower Defense Hybrid
- `docs/ref/knowledge/mechanics/chain_reaction.md` — Механика: Физические цепные реакции (Kinetic Chain Reactions) — 1. **Радиусы поражения**:
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
