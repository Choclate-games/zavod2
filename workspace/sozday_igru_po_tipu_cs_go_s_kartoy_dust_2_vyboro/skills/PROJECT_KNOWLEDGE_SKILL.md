# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физический FPS-стек (Three.js + Rapier3D + three-mesh-bvh) с процедурной генерацией карты Dust 2, оружия и бойцов, синтезом звука на Web Audio и оптимизацией под мобильный веб; готовый паттерн раундового ретейк-шутера в patterns отсутствует, поэтому loop_pattern оставлен пустым..

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
- `mechanics/cover_and_suppression.md` — Тактическая оценка укрытий ботами при штурме плента и поведение под подавляющим огнем.
- `audio/web_audio_and_muting.md` — Корректная инициализация AudioContext по первому пользовательскому действию и автоглушение звука при сворачивании вкладки.
- `monetization/interstitial_best_practices.md` — Показ полноэкранной рекламы строго между раундами и матчами без вмешательства в активный игровой процесс.
- `monetization/rewarded_ads_patterns.md` — Награждаемая реклама за просмотр для разблокировки скинов оружия или получения бонусов после матча.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, patterns/survivor_loop.md, patterns/arena_combat_loop.md, patterns/fighting_match_loop.md, mechanics/wave_survival.md, mechanics/upgrade_choices.md, stack/bitecs.md, threejs/melee_combat_and_ragdoll.md, threejs/fighting_game_core.md, mechanics/drone_swarm.md, threejs/stealth_and_vision_cones.md, threejs/skinned_character_models.md, monetization/in_app_purchases.md.

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
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
