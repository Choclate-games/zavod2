# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физический стек Three.js и Rapier3D для реализации контактного FPS-браулера с кинетическими пинками, цепным рэгдоллом и сбросом врагов за борт в рамках 4-волнового контракта арены..

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
- `patterns/arena_combat_loop.md` — Задает структуру сессии из 4 нарастающих волн киборгов с выбором улучшений и финальным боссом на палубе дирижабля.
- `mechanics/chain_reaction.md` — Реализует передачу импульса соударений между телами врагов по принципу физического кегельбана.
- `mechanics/physics_destruction.md` — Отвечает за физическое разрушение стеклянных витрин и заграждений телами врагов, расширяя зону сброса за борт.
- `mechanics/wave_contract.md` — Описывает логику спавна 4 волн киборгов с эскалацией сложности и появлением босса-вышибалы.
- `audio/web_audio_and_muting.md` — Обеспечивает корректную инициализацию Web Audio по клику и глушение звука при сворачивании вкладки.
- `monetization/rewarded_ads_patterns.md` — Интегрирует вознаграждаемую рекламу для получения бонусов между волнами или второго шанса при падении.
- `monetization/interstitial_best_practices.md` — Регулирует показ межстраничной рекламы в паузах между контрактами без прерывания динамичного боя.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/fighting_game_core.md, threejs/horde_survivor_core.md, patterns/survivor_loop.md, patterns/fighting_match_loop.md, patterns/physics_arcade_loop.md, mechanics/frame_data_combat.md, mechanics/parry.md, stack/bitecs.md, stack/recast_navigation.md, stack/yuka_ai.md, threejs/shooter_enemy_ai_and_combat.md, threejs/skinned_character_models.md, mechanics/wave_survival.md.

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
- `docs/ref/knowledge/mechanics/wave_contract.md` — Mechanic: Wave Contract & Early Call — Name: Wave Contract & Early Call Category: Tower Defense / Survival Description: Every wave is declared as data — budget, composition weights, spawn interval, early-call bonus…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
