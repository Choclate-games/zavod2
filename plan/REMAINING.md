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
| 🥊 Файтинг: фрейм-дата | `threejs/fighting_game_core.md`, `threejs/skinned_character_models.md`, `threejs/procedural_character_rig.md`, `mechanics/frame_data_combat.md` | ✅ Сделано (переписано на Rapier3D: боец на `KinematicCharacterController`, рэгдолл из мешей персонажа; добавлена проверка `check:fighting-sim`; прыжки с кросс-апом, удары с воздуха, подсечка, рывок и подъём с настила. В кадре — модели X Bot / Y Bot из `assets/` (`mixamoRig.ts`) и мокап из `assets/fight_anim/`, запечённый ретаргетом; процедурный `boxerRig.ts` остался запасным путём. Анимации покрыты `check:fight-anim` (позы в живой игре + связность рэгдолла) и витриной `anim.html` / `npm run shots:anim`, выгружены в `assets/proc_anim/`. Управление — две кнопки мыши плюс `Ctrl` на ноги (`resolveInput` рядом с фрейм-датой); удары ногами — фронт-кик, хайкик и подсечка; раскладка проверяется головно и в браузере через `npm run check:fight-input`. Удары ногами идут по фазам «занос → выхлест → возврат», а бьющую ногу ведёт мокап (`joints` вместо слоёв); рэгдолл — 12 тел, шарниры с пределами в колене и локте, пружины-связки вместо тонуса суставов, бросок тела целиком; окна клипов выставлены по кадру попадания, перчатки собраны по кисти модели) |
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

* **Мокапу отданы не все конечности.** Бьющую ногу и корпус ведёт клип,
  опорную ногу и таз — поза-цель. Это правильная граница для ударов, но у
  подсечки нога до сих пор целиком процедурная (актёр в `sweep_kick`
  опирается на руки и уходит корпусом в горизонталь, а боец привязан к своей
  точке). Если появится клип подсечки без опоры на руки, её можно перевести
  на ту же схему.
* **Стойка и шаги в мокапе.** В `assets/fight_anim/` 40 боевых движений
  (запекаются через `npm run bake:fight-anim`), но нет ни стойки на месте, ни
  шагов — того, что боец делает большую часть матча. Их считает поза-цель, и
  она же выгружена в `assets/proc_anim/` (`npm run make:proc-anim`). Если
  появятся мокапные `idle` и `walk`, они пройдут тем же ретаргетом без правок.
* **Витрина анимаций** (`anim.html`, `npm run shots:anim`) сделана для
  файтинга. Для остальных вкладок со сложной анимацией её стоит повторить —
  поза ломается молча, и головные замеры без картинки половину не ловят.
* **Хук остался только связующим приёмом.** Прямой кнопки у него нет: в
  таблице раскладки восемь наземных слотов на восемь приёмов, и хук в них не
  попал. Достаётся он отменой из джеба и удара по корпусу, то есть «ЛКМ,
  ПКМ» — это осознанный размен, но если понадобится прямой доступ, свободных
  осей две: направление вперёд/назад при нажатии и удержание кнопки.
* **Скорость перемещения бойца — решение по балансу, не по анимации.**
  Сейчас `WALK_FWD` даёт 5.1 м/с: это спринт, а не боксёрский подшаг, и ринг
  пересекается меньше чем за секунду. Ноги с этим больше не спорят — фаза
  шага крутится пройденным расстоянием, — но выглядит боец бегущим. Если
  приводить к боксёрским ~1.5 м/с, менять надо только `WALK_FWD`; анимация
  подстроится сама, зато поедут дистанция, вопифф и цена промаха.

* `agents/skill_generator.py` — навыки есть для слэшера и survivor; для стелса,
  строительства, воды и звука генераторы навыков можно расширять по мере появления новых игровых концептов.
* 2D включается флагом `pipeline.enable_2d: false` в `config/factory.yaml`, ортографическая камера в Three.js полностью покрывает 2D-механики без необходимости использования PixiJS.
