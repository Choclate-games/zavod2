# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на физику Rapier3D, процедурный риг и меши стимпанк-шествия, стелс с конусами обзора, Web Audio ритм-синхронизацию и сочные конфетти-эффекты; стандартный архетип петли из patterns отсутствует, так как игра представляет собой линейный ритм-стелс-прорыв через эшелоны..

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
- `audio/web_audio_and_muting.md` — Корректная инициализация Web Audio по первому взаимодействию и соблюдение требований платформ по глушению звука.
- `monetization/rewarded_ads_patterns.md` — Rewarded-реклама для спасения при срыве маскировки и удвоения карнавальной награды после успешного побега.
- `monetization/interstitial_best_practices.md` — Показ межстраничной рекламы строго в естественных паузах между завершенными 90–120 секундными забегами.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, threejs/fighting_game_core.md, threejs/fps_controller_and_shooting.md, stack/bitecs.md, stack/recast_navigation.md, patterns/survivor_loop.md, patterns/arena_combat_loop.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
