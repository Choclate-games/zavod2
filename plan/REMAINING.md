# Что осталось сделать (записка на будущее)

Обновлено: 2026-08-22. Контекст: все 19 запланированных интерактивных вкладок и демонстраций базы знаний полностью реализованы в `workspace/knowledge-showcase/`, покрыты головными проверками логики (`scripts/*-check.ts`) и дымовыми прогонами (`scripts/smoke-check.ts`).

Полная таблица «вкладка ↔ знания» со статусами — в
[docs/KNOWLEDGE_DEMOS_POLICY.md](../docs/KNOWLEDGE_DEMOS_POLICY.md).

---

## Статус 19 вкладок стенда: ✅ ВСЕ ЗАВЕРШЕНЫ

| Вкладка | Знания | Статус |
|---|---|---|
| 🚚 ЗиЛ-130 | `stack/rapier3d.md`, `threejs/rapier_vehicle_controller.md` | ✅ Сделано |
| 🏁 Гонка: трасса и соперники | `threejs/racing_track_and_opponents.md`, `threejs/arcade_racing_and_drift.md` | ✅ Сделано |
| 🥊 Файтинг: фрейм-дата | `threejs/fighting_game_core.md`, `threejs/procedural_character_rig.md`, `mechanics/frame_data_combat.md` | ✅ Сделано (переписано на Rapier3D: боец на `KinematicCharacterController`, рэгдолл из мешей персонажа, процедурный боксёр `boxerRig.ts`; добавлена проверка `check:fighting-sim`; прыжки с кросс-апом, удары с воздуха, подсечка, рывок и подъём с настила) |
| 🗼 Tower Defense (bitECS) | `threejs/tower_defense_core.md`, `stack/bitecs.md` | ✅ Сделано |
| ⚔️ Стратегия: строй и приказы | `threejs/rts_selection_and_command.md` | ✅ Сделано |
| 🎯 BVH: рейкаст и капсула | `stack/three_mesh_bvh.md` | ✅ Сделано |
| 🧠 Yuka: steering и автомат | `stack/yuka_ai.md`, `mechanics/drone_swarm.md` | ✅ Сделано |
| ✨ Постобработка по тирам | `stack/postprocessing.md`, `threejs/adaptive_quality.md` | ✅ Сделано |
| 🧭 Навигация NPC (recast) | `stack/recast_navigation.md` | ✅ Сделано |
| 🔫 FPS: стрельба и ИИ | `threejs/fps_controller_and_shooting.md` | ✅ Сделано |
| ⚔️ Слэшер и рэгдолл | `threejs/melee_combat_and_ragdoll.md` | ✅ Сделано |
| 🐦 Рой и выживание | `threejs/horde_survivor_core.md`, `stack/bitecs.md` | ✅ Сделано |
| 👁️ Стелс и конусы зрения | `threejs/stealth_and_vision_cones.md` | ✅ Сделано |
| 🏗️ Сетка и база | `mechanics/grid_building.md`, `mechanics/base_building.md`, `patterns/builder_defense_loop.md` | ✅ Сделано (`BuildingDemo.ts`) |
| 🌊 Вода и разрушения | `mechanics/fluid_buoyancy.md`, `mechanics/physics_destruction.md`, `mechanics/mining_drill.md` | ✅ Сделано (`BuoyancyDemo.ts`) |
| 🎨 Процедурная 3D-графика | `threejs/procedural_mesh_builder.md` | ✅ Сделано (`Procedural3dDemo.ts`) |
| 👆 2D на ортокамере | `threejs/orthographic_2d_and_pointer_input.md`, `mechanics/evidence_board.md` | ✅ Сделано (`Ortho2dDemo.ts`) |
| ✨ VFX-пул | `threejs/juice_and_vfx_pool.md` | ✅ Сделано (`VfxPoolDemo.ts`) |
| 🔊 Синтез звука и ритм | `audio/procedural_sound_synthesizer.md`, `audio/web_audio_and_muting.md`, `mechanics/rhythm_sync.md` | ✅ Сделано (`AudioRhythmDemo.ts`) |

---

## Хвосты, не связанные с вкладками

* `agents/skill_generator.py` — навыки есть для слэшера и survivor; для стелса,
  строительства, воды и звука генераторы навыков можно расширять по мере появления новых игровых концептов.
* 2D включается флагом `pipeline.enable_2d: false` в `config/factory.yaml`, ортографическая камера в Three.js полностью покрывает 2D-механики без необходимости использования PixiJS.
