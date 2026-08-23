# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физическую арену Rapier3D с процедурными упругими телами мутантов, механику кинетического синтеза и цепных ударных волн, процедурный Web Audio звук, адаптивное качество для мобильных браузеров и паттерн гладиаторского турнира с волнами..

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
- `mechanics/physics_destruction.md` — Определяет механику разрушения внешних сегментов платформы по таймеру для сужения боевой зоны и открытия новых бездн.
- `audio/web_audio_and_muting.md` — Обеспечивает корректную инициализацию Web Audio по первому тапу и соблюдение требований платформ по глушению звука.
- `monetization/interstitial_best_practices.md` — Регламентирует показ полноэкранной рекламы в паузах между гладиаторскими забегами без прерывания активного боя.
- `monetization/rewarded_ads_patterns.md` — Реализует вознаграждаемую рекламу для однократного спасения титана при падении или получения бонусной биомассы перед волной.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, patterns/survivor_loop.md, threejs/fighting_game_core.md, mechanics/frame_data_combat.md, stack/bitecs.md, stack/recast_navigation.md, stack/yuka_ai.md, threejs/melee_combat_and_ragdoll.md, threejs/procedural_character_rig.md, threejs/skinned_character_models.md, mechanics/fluid_buoyancy.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/mechanics/physics_destruction.md` — Mechanic: Destructible Environment & Dynamic Hazards — Name: Destructible Environment & Dynamic Hazards Category: Environment & Physics Description: Arena structures (stone pillars, wooden crates, barricades, weapon…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
