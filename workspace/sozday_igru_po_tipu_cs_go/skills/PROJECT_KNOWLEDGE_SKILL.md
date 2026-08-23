# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку соревновательного FPS-контроллера с мгновенным контр-стрейфом, высокоточного хитскана через three-mesh-bvh, физики тел и отлета каски на Rapier3D, процедурной стилизованной графики крыши и раундовой структуры матча Best of 5..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/fighting_match_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/fighting_match_loop.md` — Архитектура матча формата Best of 5: раунды по 15 секунд, смена спавнов, фиксация счета дуэли и переход к закупке.
- `mechanics/cover_and_suppression.md` — Тактическая разметка точек укрытия на крыше для пиков из-за углов и джог-бейта.
- `audio/web_audio_and_muting.md` — Корректная инициализация Web Audio по первому тапу и управление глушением звука по правилам веб-платформ.
- `monetization/interstitial_best_practices.md` — Интеграция полноэкранной рекламы в паузах между матчами Best of 5 без прерывания быстрых раундов.
- `monetization/rewarded_ads_patterns.md` — Опциональный просмотр рекламы за вознаграждение для открытия скинов оружия или удвоения призовых за победу.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, patterns/survivor_loop.md, threejs/fighting_game_core.md, threejs/melee_combat_and_ragdoll.md, mechanics/upgrade_choices.md, stack/bitecs.md, stack/recast_navigation.md, threejs/skinned_character_models.md, mechanics/wave_survival.md, threejs/stealth_and_vision_cones.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/fighting_match_loop.md` — Pattern: Fighting Match Loop — Pattern Name: Fighting Match Loop Primary Genre: Fighting / Versus Combat
- `docs/ref/knowledge/mechanics/cover_and_suppression.md` — Mechanic: Cover & Suppression — Name: Cover & Suppression Category: Shooter / Tactics Description: Pre-authored cover points carry a position, a facing normal, a height class and an occupancy slot. AI scores them…
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
