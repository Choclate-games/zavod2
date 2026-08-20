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
     * 🚚 **Гонки и физика авто** (`knowledge/threejs/arcade_racing_and_drift.md`)
     * 🔫 **FPS шуттер и пинок** (`knowledge/threejs/fps_controller_and_shooting.md`)
     * ⚔️ **Слэшер и парирование** (`knowledge/threejs/melee_combat_and_ragdoll.md`)
     * 🎨 **Процедурная 3D графика** (`knowledge/threejs/procedural_mesh_builder.md`)
     * 👆 **Свайпы и жесты** (`knowledge/pixijs/path_drawing_and_movement.md`)
     * ✨ **VFX и шейдеры** (`knowledge/threejs/juice_and_vfx_pool.md`)
     * 🔊 **Синтезатор звуков** (`knowledge/audio/procedural_sound_synthesizer.md`)
