# Что осталось сделать (записка на будущее)

Обновлено: 2026-08-21. Контекст: проект переведён на Three.js-стек, 2D отключено
флагом `pipeline.enable_2d` в `config/factory.yaml`, всё про Pixi лежит в
`knowledge_archive/pixijs/`.

Полная таблица «вкладка ↔ знания» со статусами — в
[docs/KNOWLEDGE_DEMOS_POLICY.md](../docs/KNOWLEDGE_DEMOS_POLICY.md).
Здесь только то, что не сделано.

---

## Шесть вкладок стенда в очереди

| Вкладка | Знания | Что именно проверить демо |
|---|---|---|
| 🏗️ Сетка и база | `mechanics/grid_building.md`, `mechanics/base_building.md`, `patterns/builder_defense_loop.md` | привязка к сетке, валидность постройки, снос, влияние построек на пути NPC (TileCache из recast) |
| 🌊 Вода и разрушения | `mechanics/fluid_buoyancy.md`, `mechanics/physics_destruction.md`, `mechanics/mining_drill.md` | плавучесть на Rapier, разлёт обломков, бюджет тел |
| 🎨 Процедурная 3D-графика | `threejs/procedural_mesh_builder.md` | showroom `ProceduralMeshFactory`, стоимость генерации в мс |
| 👆 2D на ортокамере | `threejs/orthographic_2d_and_pointer_input.md`, `mechanics/evidence_board.md` | 2D той же связкой под ортокамерой; делать, когда решим включать `enable_2d` |
| ✨ VFX-пул | `threejs/juice_and_vfx_pool.md` | пул частиц без аллокаций, импульсные эффекты через `blendMode.opacity` |
| 🔊 Синтез звука и ритм | `audio/procedural_sound_synthesizer.md`, `audio/web_audio_and_muting.md`, `mechanics/rhythm_sync.md` | Web Audio без файлов, попадание в ритм, корректный mute |

## Как делается одна вкладка (сложившийся порядок)

1. Игровая логика — в модуль `src/game/*.ts`, **не импортирующий `three`**.
2. Головная проверка `scripts/<имя>-check.ts` на числа этой логики.
3. Демо `src/demos/<Имя>Demo.ts`, регистрация в `src/main.ts`.
4. Строка в `scripts/smoke-check.ts` — **со сценарием ввода**, иначе прогон
   зелёный просто потому, что ничего не произошло.
5. `check:<имя>` в `package.json` и в `check:all`.
6. Знание в `knowledge/` переписывается по факту сделанного: измеренные числа,
   найденные ловушки. Строка в таблице политики → ✅.

## Хвосты, не связанные с вкладками

* `agents/skill_generator.py` — навыки есть для слэшера и survivor; для стелса,
  строительства, воды и звука навыков пока нет.
* В `knowledge/` остались документы, написанные до стенда и не проверенные демо
  (см. ⏳ в таблице политики) — у них выше шанс расхождения с реальным API.
* 2D включается одним флагом, но `providers/local.py` сейчас принудительно
  переводит 2D-профили в 3D; при включении надо снять кламп и вернуть Pixi-знания
  из архива либо переписать их под ортокамеру.
