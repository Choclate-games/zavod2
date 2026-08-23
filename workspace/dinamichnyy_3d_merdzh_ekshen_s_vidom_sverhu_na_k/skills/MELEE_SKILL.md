# Skill: Melee Combat, Hit-Stop & Parry System

## Purpose
Реализация комбо-атак холодным оружием, точного окна парирования и микро-заморозки времени (Hit-Stop).

## When to Use
При разработке слэшеров, битв на мечах, рукопашных драк и дуэлей.

## Core Rules & Constraints
- Каждый удар проходит фазы: startup -> active (хитбокс) -> recovery.
- Вся боёвка считается в КАДРАХ фиксированного шага 1/60, а не в секундах.
- Hit-Stop — счётчик кадров в fixedUpdate, НЕ setTimeout: таймер реального времени не знает про паузу и даёт разную длительность на разном FPS.
- Замах врага не короче 22 кадров, иначе парирование нечестное.
- Идеальное парирование сопровождается звуком скрежета металла и вспышкой искр.
- Рэгдолл включается только на смерть; живым врагом управляет автомат состояний.

## System Architecture
MeleeFighter — автомат состояний на кадрах (окна отмены, буфер ввода, память связки); рэгдолл — 7 тел Rapier на сферических суставах.

## Implementation Guidance
Попадание считать сектором (дальность + арка), а не AABB: коробка промахивается мимо цели сбоку и задевает того, кто за спиной. Публикуй 'combat:hit', 'combat:parry' в EventBus для тряски камеры.

## Common Mistakes to Avoid
- ❌ **Mistake**: Мгновенный урон без фазы подготовки (startup) лишает игрока возможности реагировать.
- ❌ **Mistake**: Память связки тратится каждый кадр — тогда длинный финишный удар съедает окно сам собой, и третий удар связки невозможно собрать.
- ❌ **Mistake**: Части рэгдолла сталкиваются друг с другом — труп дрожит и уползает.
- ❌ **Mistake**: Импульс смерти не клампится — сферические суставы разрывает.

## Validation Checklist
- [ ] Удары в серии плавно переходят из одного в другой при своевременном клике.
- [ ] Нажатие за несколько кадров до окна отмены не теряется (буфер ввода).
- [ ] Есть головная проверка фрейм-даты и физики трупа без рендерера.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/threejs/melee_combat_and_ragdoll.md` — Three.js: ближний бой, связки, парирование, hit-stop и рэгдолл — Слэшер отличается от файтинга (`fighting_game_core.md`) не жанром, а тем, что бой идёт в 3D против нескольких противников сразу. Отсюда три отличия…
- `docs/ref/knowledge/mechanics/ragdoll.md` — Mechanic: Active Ragdoll Physics Combat — Name: Active Ragdoll Physics Combat Category: Combat & Physics Description: A hybrid physics-driven character controller where characters have underlying kinematic bone targets…
- `docs/ref/knowledge/mechanics/parry.md` — Mechanic: Timing-based Parry & Counter — Name: Timing-based Parry & Counter Category: Combat & Defense Description: A precision defensive input with a tight activation window (e.g. 150-250ms). If struck during this…
- `docs/ref/knowledge/threejs/juice_and_vfx_pool.md` — Three.js: Juice, Instanced Particle VFX & Toon Shading — Рецепт оптимизированной системы частиц (`InstancedMesh` на 1000+ частиц за 1 Draw Call), шейка камеры и Toon (Cel) шейдинга.
- `docs/ref/knowledge/audio/procedural_sound_synthesizer.md` — Web Audio: Procedural Sound Synthesizer (Без MP3 файлов) — Полный модуль синтеза звуков на чистом Web Audio API. Не требует загрузки внешних аудиофайлов, работает мгновенно в любом браузере, поддерживает безопасное…
