# Skill: FPS Weapons, Recoil & Spartan Kick

## Purpose
Реализация First-Person шуттера: PointerLock, отдача ствола, раскачивание при ходьбе, трассеры и пинок.

## When to Use
При разработке шуттера от первого лица, оружия, баллистики и ближнего удара ногой.

## Core Rules & Constraints
- PointerLock на ПК и плавающий тач-пад обзора на мобильных экранах.
- Weapon Bobbing синхронизируется с шагами персонажа.
- Отдача воздействует на положение и угол ствола с пружинным возвратом (Snappiness).
- Физический пинок передает кинетический импульс телам и врагам.

## System Architecture
FPSController управляет камерой, WeaponSystem обрабатывает стрельбу, SpartanKick наносит импульсный урон.

## Implementation Guidance
Используй Web Audio синтезатор для выстрелов и вспышек без загрузки MP3 файлов.

## Common Mistakes to Avoid
- ❌ **Mistake**: Жесткая привязка оружия к камере без инерции и раскачивания делает шутер безжизненным.

## Validation Checklist
- [ ] Оружие эффектно дергается назад при выстреле и плавно возвращается в исходную позицию.


## Справочник
Полные тексты лежат не здесь, а в базе знаний фабрики. Один раз
выполните `node scripts/fetch-knowledge.mjs` — файлы появятся по
адресам ниже, и дальше работа идёт офлайн. Эти документы старше
любого примера из интернета: где они расходятся с найденным
сниппетом, правы они.

- `docs/ref/knowledge/threejs/fps_controller_and_shooting.md` — Three.js: FPS-контроллер, оружие, вьюмодель и обратная связь выстрела — Что делает противник и как считается урон — `shooter_enemy_ai_and_combat.md`. Здесь — **всё, что находится под управлением игрока**: движение…
- `docs/ref/knowledge/audio/procedural_sound_synthesizer.md` — Web Audio: Procedural Sound Synthesizer (Без MP3 файлов) — Полный модуль синтеза звуков на чистом Web Audio API. Не требует загрузки внешних аудиофайлов, работает мгновенно в любом браузере, поддерживает безопасное…
- `docs/ref/knowledge/threejs/juice_and_vfx_pool.md` — Three.js: Juice, Instanced Particle VFX & Toon Shading — Рецепт оптимизированной системы частиц (`InstancedMesh` на 1000+ частиц за 1 Draw Call), шейка камеры и Toon (Cel) шейдинга.
