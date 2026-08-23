# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на архитектуру скоростного раннера с комбо-множителем флоу, процедурную генерацию викторианских крыш и персонажа без внешних ассетов, физику скольжения и перегрузок на Rapier3D с BVH-запросами, процедурный Web Audio звук и строгую мобильную оптимизацию..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/score_attack_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `patterns/score_attack_loop.md` — Определяет архитектуру курьерского спринт-раннера с нарастающим темпом, комбо-множителем флоу и финальным расчетом наград за сохранность груза.
- `audio/web_audio_and_muting.md` — Обеспечивает надежное управление Web Audio API, корректную инициализацию по первому свайпу и глушение звука при сворачивании игры.
- `monetization/rewarded_ads_patterns.md` — Интегрирует добровольную rewarded-рекламу для удвоения чаевых за чистую доставку и второго шанса при срыве с карниза.
- `monetization/interstitial_best_practices.md` — Регулирует показ межстраничной рекламы исключительно в естественных паузах между завершенными курьерскими контрактами.
- `monetization/in_app_purchases.md` — Обеспечивает покупку косметических сумок, обуви для паркура и премиальных контрактов без пейволлов в геймплее.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: mechanics/upgrade_choices.md, mechanics/fluid_buoyancy.md, mechanics/checkpoint_lap_racing.md, mechanics/drift_scoring.md, mechanics/rhythm_sync.md, threejs/skinned_character_models.md, stack/recast_navigation.md, stack/bitecs.md, stack/yuka_ai.md, patterns/survivor_loop.md, mechanics/parry.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/patterns/score_attack_loop.md` — Pattern: Score Attack Loop — Pattern Name: Score Attack Loop Primary Genre: Arcade / Endless Runner / Combo Chaser
- `docs/ref/knowledge/audio/web_audio_and_muting.md` — Game Audio: Web Audio, Autoplay and Muting — Audio is where two platform requirements and one browser policy meet. Getting it wrong is a moderation rejection, not a polish issue.
- `docs/ref/knowledge/monetization/rewarded_ads_patterns.md` — Rewarded Ads Patterns for Web & Mobile Games — Rewarded ads must always be **opt-in**, **high-value**, and **respect player agency**. Never make a game mathematically unwinnable without watching rewarded ads.
- `docs/ref/knowledge/monetization/interstitial_best_practices.md` — Interstitial Ads Best Practices — 1. **Never interrupt active gameplay**: Showing an interstitial during combat causes instant session abandonment. 2. **Natural break points only**:
- `docs/ref/knowledge/monetization/in_app_purchases.md` — In-App Purchases & Web Microtransactions — On Yandex Games, VK, OK and CrazyGames:
