# 📋 Регламент: обязательное интерактивное демо для каждого знания (`knowledge/`)

Каждый файл в `knowledge/` — авторитарный источник для кодовых агентов фабрики.
Чтобы в базу не попадал «бумажный» код, действует жёсткое правило.

---

## 🎯 Правило «Knowledge + Working Demo»

1. **Никакого кода без проверки.** Новый рецепт, механика, контроллер или модуль в
   `knowledge/` обязан сопровождаться работающей вкладкой в
   `workspace/knowledge-showcase/`. Теоретический код без демо не принимается.
2. **Критерии качества демо** (эталон — вкладка «🚚 ЗиЛ-130»):
   * запускается через `npm run dev` без ручных шагов;
   * управление отзывчиво, есть визуальный **и** звуковой отклик;
   * на экране показаны горячие клавиши и одна строка о том, что демонстрируется;
   * работает на телефоне (тач-управление) или явно помечено как desktop-only;
   * код демо и код в `knowledge/` **совпадают**: демо — это тот же рецепт, а не
     «похожая» реализация.
3. **Стек демо — стек фабрики.** Демо пишутся на Three.js и библиотеках из
   `knowledge/stack/README.md`. Самописные аналоги того, что закрывает стек, в демо
   запрещены так же, как и в играх.

---

## Головная проверка вместо «посмотреть глазами»

Демо доказывает, что рецепт **играется**. Что он ещё и **считается верно**, доказывает
головной прогон без рендерера (`CRITICAL_RULES` §66). Каждая игровая механика в демо
живёт в модуле, не импортирующем `three`, и покрыта скриптом:

| Скрипт | Что проверяет |
|---|---|
| `npm run check:fighting` | фрейм-дата: наказуемость, затухание комбо, hit-stop |
| `npm run check:racing` | геометрия трассы, 3 круга ботом, границы резинки |
| `npm run check:td` | 20 волн, приоритет целей, броня, экономика |
| `npm run check:rts` | флоу-филд через стену, слоты строя, таблица урона |
| `npm run check:survivor` | кривая опыта, пул карточек, баланс забега на 20 минут: держит ли игрок орду на 1/5/12 минуте |
| `npm run check:stealth` | конус зрения, шкала подозрения и grace period, радиусы шума, бюджет рейкастов |
| `npm run check:melee` | связка и окна отмены, буфер ввода, окна парирования, сектор поражения, физика рэгдолла на настоящем Rapier |
| `npm run check:smoke` | дымовой прогон демо без WebGL: исключения и NaN в трансформах |
| `npm run check:all` | всё сразу; входит в `npm run build` |

Эти прогоны уже поймали четыре бага, невидимых на глаз: сопротивление воздуха считалось
«за кадр» вместо «за секунду» (машина упиралась в 44 км/ч), очередь флоу-филда молча
переполнялась (юниты застревали посреди карты), и таблица урона RTS не была замкнутым
циклом (авиацию не бил никто). Четвёртый нашёл дымовой прогон: `MemorySystem.getRecord()`
в Yuka возвращает `undefined`, пока не вызван `createRecord()`, и охранник падал при
первом же обращении к памяти. Пятый нашла проверка слэшера: память связки тратилась
каждый кадр, поэтому длинный финишный удар съедал окно сам собой и третий удар связки
было невозможно собрать — на экране это выглядело как «иногда не выходит».

Шестой поймала проверка баланса survivor: здоровье врага росло множителем 1.55 за
минуту, и это давало спираль смерти — игрок переставал убивать, значит переставал
получать опыт и карточки, и его урон замирал навсегда, пока орда продолжала расти.
На экране это выглядит как «игра резко стала невозможной», причину не видно.

**Пустой прогон ничего не доказывает.** Дымовой прогон умеет держать кнопку и нажимать
клавиши (`Script` в `smoke-check.ts`) — без этого слэшер прогонялся зелёным просто
потому, что игрок ни разу не атаковал, и ветки «смерть врага → рэгдолл → новая волна»
не выполнялись ни разу. Добавляя демо в прогон, проверьте, что интересные ветки
действительно исполняются, а не только `init`.

## Соответствие вкладок и знаний

Статус: ✅ — вкладка есть в стенде, ⏳ — знание есть, демо в очереди.

| Вкладка | Знания |
|---|---|
| ✅ 🚚 ЗиЛ-130 (Rapier 3D) | `stack/rapier3d.md`, `threejs/rapier_vehicle_controller.md`, `threejs/vehicle_wheel_rig.md`, `mechanics/vehicle_physics.md` |
| ✅ 🏁 Гонка: трасса и соперники | `threejs/racing_track_and_opponents.md`, `threejs/arcade_racing_and_drift.md`, `mechanics/drift_scoring.md`, `mechanics/checkpoint_lap_racing.md`, `mechanics/rubberband_opposition.md` |
| ✅ 🥊 Файтинг: фрейм-дата | `threejs/fighting_game_core.md`, `mechanics/frame_data_combat.md`, `mechanics/special_move_input.md`, `mechanics/juggle_combo.md`, `mechanics/parry.md` |
| ✅ 🗼 Tower Defense (bitECS) | `threejs/tower_defense_core.md`, `stack/bitecs.md`, `mechanics/tower_targeting_priority.md`, `mechanics/wave_contract.md`, `patterns/tower_defense_loop.md` |
| ✅ ⚔️ Стратегия: строй и приказы | `threejs/rts_selection_and_command.md`, `mechanics/unit_selection_and_orders.md`, `mechanics/formation_movement.md` |
| ✅ 🎯 BVH: рейкаст и капсула | `stack/three_mesh_bvh.md` |
| ✅ 🧠 Yuka: steering и автомат | `stack/yuka_ai.md`, `mechanics/drone_swarm.md`, `mechanics/stealth_detection.md` |
| ✅ ✨ Постобработка по тирам | `stack/postprocessing.md`, `threejs/adaptive_quality.md`, `threejs/mobile_shaders.md` |
| ✅ 🧭 Навигация NPC (recast) | `stack/recast_navigation.md` |
| ✅ 🔫 FPS: стрельба и ИИ | `threejs/fps_controller_and_shooting.md`, `threejs/shooter_enemy_ai_and_combat.md`, `mechanics/cover_and_suppression.md`, `mechanics/chain_reaction.md` |
| ✅ ⚔️ Слэшер и рэгдолл | `threejs/melee_combat_and_ragdoll.md`, `mechanics/ragdoll.md`, `mechanics/parry.md` |
| ✅ 🐦 Рой и выживание | `threejs/horde_survivor_core.md`, `stack/bitecs.md`, `mechanics/wave_survival.md`, `mechanics/upgrade_choices.md`, `patterns/survivor_loop.md` |
| ⏳ 🏗️ Сетка и база | `mechanics/grid_building.md`, `mechanics/base_building.md`, `patterns/builder_defense_loop.md` |
| ✅ 👁️ Стелс и конусы зрения | `threejs/stealth_and_vision_cones.md`, `mechanics/stealth_detection.md` |
| ⏳ 🌊 Вода и разрушения | `mechanics/fluid_buoyancy.md`, `mechanics/physics_destruction.md`, `mechanics/mining_drill.md` |
| ⏳ 🎨 Процедурная 3D-графика | `threejs/procedural_mesh_builder.md` |
| ⏳ 👆 2D на ортокамере | `threejs/orthographic_2d_and_pointer_input.md`, `mechanics/evidence_board.md` (2D отключено, см. `knowledge_archive/`) |
| ⏳ ✨ VFX-пул | `threejs/juice_and_vfx_pool.md` |
| ⏳ 🔊 Синтез звука и ритм | `audio/procedural_sound_synthesizer.md`, `audio/web_audio_and_muting.md`, `mechanics/rhythm_sync.md` |

Удалённые вкладки (механики выведены из базы): «🧲 Трос, Время & Дэш».
