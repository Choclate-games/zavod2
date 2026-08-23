# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физическую симуляцию рэгдоллов и кинетических разрушений в Rapier3D, процедурный риг персонажей, аркадный цикл арена-боев с верстаком между раундами, эффекты сочного отклика с хитстопом и процедурный звук Web Audio..

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
- `patterns/arena_combat_loop.md` — Задает структуру сессионного матча в октагоне с 4 нарастающими натисками уличных бойцов и паузами на апгрейд бойца у верстака.
- `audio/web_audio_and_muting.md` — Обеспечивает корректный запуск AudioContext по первому тапу и соблюдение требований платформ по глушению звука.
- `monetization/rewarded_ads_patterns.md` — Внедряет rewarded-рекламу для получения дополнительных наличных на верстаке или бонусного возрождения без нарушения динамики матча.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: patterns/survivor_loop.md, threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, mechanics/parry.md, patterns/fighting_match_loop.md, threejs/fighting_game_core.md, mechanics/frame_data_combat.md, stack/bitecs.md, stack/recast_navigation.md, threejs/skinned_character_models.md, threejs/melee_combat_and_ragdoll.md, mechanics/wave_contract.md.

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
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
