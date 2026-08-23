# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку Rapier3D и postprocessing для орбитальной баллистики и аутентичного FLIR-тепловизора, процедурную геометрию и физику разрушений укрытий при эскорте спецназа; готовый архетип петли в patterns отсутствует из-за специфики рельсового авиа-шутера..

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
- `mechanics/physics_destruction.md` — Честный физический расчет динамического обрушения укрытий, стен и блокпостов от попаданий тяжелых калибров 40мм и 105мм.
- `audio/web_audio_and_muting.md` — Корректная инициализация Web Audio по первому взаимодействию и автоглушение звука при потере вкладкой фокуса.
- `monetization/interstitial_best_practices.md` — Показ межстраничной рекламы в естественных сюжетных паузах между секторами эскорта и на экране финального дебрифинга.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/fps_controller_and_shooting.md, threejs/shooter_enemy_ai_and_combat.md, threejs/horde_survivor_core.md, patterns/survivor_loop.md, patterns/rts_skirmish_loop.md, threejs/rts_selection_and_command.md, mechanics/upgrade_choices.md, threejs/rapier_vehicle_controller.md, stack/recast_navigation.md, patterns/physics_arcade_loop.md.

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
