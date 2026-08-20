# 📋 Регламент: Обязательное создание интерактивных демо для базы знаний (`knowledge/`)

Каждый файл в каталоге `knowledge/` содержит авторитарные знания и эталонные куски TypeScript/WebGL кода, на которые опираются все кодовые агенты фабрики.

Чтобы предотвратить появление «бумажного» или неработающего кода, вводится строгое правило:

---

## 🎯 Правило «Knowledge + Working Demo»

1. **Никакого кода без проверки**:
   * При добавлении нового рецепта или механики в `knowledge/` (например, физика машин, конусы видимости, жесты, шейдеры, синтез звука) разработчик или ИИ-агент **обязан создать или обновить интерактивную вкладку в демо-стенде** `workspace/knowledge-showcase/index.html`.
2. **Критерии качества интерактивного демо**:
   * **Работоспособность без лишних шагов**: демо должно запускаться мгновенно в браузере (через CDN Three.js/PixiJS или `npm run dev`).
   * **Тактильный отклик**: управление должно быть плавным, отзывчивым, с визуальным и звуковым откликом.
   * **Понятность**: на экране должны быть выведены горячие клавиши (<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, <kbd>Space</kbd>, <kbd>F</kbd> и т.д.) и подсказка по режиму.
3. **Обновление стенда `workspace/knowledge-showcase/`**:
   * Все ключевые категории знаний представлены в виде вкладок в `workspace/knowledge-showcase/index.html`:
     * 🚚 **Гонки и физика авто** (`knowledge/threejs/arcade_racing_and_drift.md`, `knowledge/threejs/rapier_vehicle_controller.md`, `knowledge/threejs/vehicle_wheel_rig.md`, `knowledge/mechanics/vehicle_physics.md`)
     * 🔫 **FPS шуттер и пинок** (`knowledge/threejs/fps_controller_and_shooting.md`, `knowledge/mechanics/chain_reaction.md`)
     * ⚔️ **Слэшер и парирование** (`knowledge/threejs/melee_combat_and_ragdoll.md`, `knowledge/mechanics/parry.md`, `knowledge/mechanics/combo_juggling.md`, `knowledge/mechanics/ragdoll.md`)
     * 🧲 **Трос, Время & Дэш** (`knowledge/mechanics/grappling_hook.md`, `knowledge/mechanics/time_rewind.md`, `knowledge/mechanics/dash.md`)
     * 🌊 **Вода & Разрушения** (`knowledge/mechanics/fluid_buoyancy.md`, `knowledge/mechanics/physics_destruction.md`, `knowledge/mechanics/mining_drill.md`)
     * 🐦 **Рой & Выживание** (`knowledge/mechanics/drone_swarm.md`, `knowledge/mechanics/wave_survival.md`, `knowledge/mechanics/upgrade_choices.md`, `knowledge/patterns/survivor_loop.md`)
     * 🏗️ **Сетка & База** (`knowledge/mechanics/grid_building.md`, `knowledge/mechanics/base_building.md`, `knowledge/patterns/builder_defense_loop.md`)
     * 👁️ **Стелс & Конусы** (`knowledge/threejs/stealth_and_vision_cones.md`, `knowledge/mechanics/stealth_detection.md`)
     * 🎨 **Процедурная 3D графика** (`knowledge/threejs/procedural_mesh_builder.md`)
     * 👆 **2D Сплайны & Доска улик** (`knowledge/pixijs/path_drawing_and_movement.md`, `knowledge/pixijs/card_drag_and_evidence_board.md`, `knowledge/mechanics/evidence_board.md`)
     * ✨ **VFX и шейдеры** (`knowledge/threejs/juice_and_vfx_pool.md`, `knowledge/threejs/mobile_shaders.md`, `knowledge/threejs/adaptive_quality.md`)
     * 🔊 **Синтезатор звуков & Ритм** (`knowledge/audio/procedural_sound_synthesizer.md`, `knowledge/audio/web_audio_and_muting.md`, `knowledge/mechanics/rhythm_sync.md`)

