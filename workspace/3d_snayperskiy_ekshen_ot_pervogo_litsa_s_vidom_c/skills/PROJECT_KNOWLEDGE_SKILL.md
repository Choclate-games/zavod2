# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физическую WASM-симуляцию разрушений (Rapier3D), процедурную генерацию горного каньона и титана, FPS-контроллер снайперской оптики с трассировкой BVH, кинематографичный пост-процессинг и синтез процедурного аудио..

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
- `patterns/physics_arcade_loop.md` — Определяет цикл снайперского контракта: оценка обстановки, прицельный выстрел по физической цели, сход разрушительной лавины и расчет награды за точность.
- `audio/web_audio_and_muting.md` — Реализует корректный жизненный цикл Web Audio, автозапуск по первому клику и глушение звука при сворачивании вкладки.
- `monetization/rewarded_ads_patterns.md` — Интегрирует вознаграждаемую рекламу для удвоения награды за чистоту контракта или получения дополнительного эхо-патрона.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/shooter_enemy_ai_and_combat.md, mechanics/cover_and_suppression.md, mechanics/stealth_detection.md, mechanics/upgrade_choices.md, mechanics/ragdoll.md, stack/bitecs.md, stack/recast_navigation.md, stack/yuka_ai.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/physics_arcade_loop.md` — Pattern: Physics Arcade Loop — Pattern Name: Physics Arcade Loop Primary Genre: Physics Destruction / Slingshot / Ragdoll Arcade
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
