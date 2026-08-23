# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку высокоскоростного FPS-контроллера с механикой подкатов и процедурной генерацией арены терминала на Three.js/Rapier3D, быстрый хитскан через three-mesh-bvh, шейдерный визор БПЛА через postprocessing, процедурный Web Audio синтез и оптимизацию под мобильные браузеры..

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
- `patterns/arena_combat_loop.md` — Задает цикл сессионного матча арена-шутера на 60–90 секунд с гонкой до 12 фрагов и мгновенным респауном.
- `audio/web_audio_and_muting.md` — Гарантирует корректную инициализацию Web Audio по первому тапу и глушение звуков при потере вкладкой фокуса.
- `monetization/interstitial_best_practices.md` — Определяет показ полноэкранной рекламы строго на экране итогов матча без прерывания 90-секундного игрового флоу.
- `monetization/rewarded_ads_patterns.md` — Реализует опциональный просмотр рекламы за удвоение наград после победы без нарушения соревновательного баланса.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, patterns/survivor_loop.md, mechanics/upgrade_choices.md, patterns/roguelike_loop.md, mechanics/drone_swarm.md, mechanics/cover_and_suppression.md, stack/bitecs.md, threejs/melee_combat_and_ragdoll.md.

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
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
