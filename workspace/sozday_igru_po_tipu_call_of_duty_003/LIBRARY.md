# Готовый код фабрики

Это не примеры из статьи, а модули, которые работали в живых сценах.
В шапке каждого файла написано, почему константы именно такие.

Забрать любой файл:

```bash
node scripts/fetch-knowledge.mjs <путь из таблицы>
```

Файл появится в `docs/ref/<путь>` — оттуда копируй в `src/`.

| Готовность | Что значит |
|---|---|
| копируется как есть | ни одного импорта, чистая логика и числа |
| нужен three, больше ничего | тянет только `three`, чужого проекта в нём нет |
| образец, переписать под себя | тянет модули стенда: читать, не копировать |

| Файл | Что даёт | Строк | Готовность |
|---|---|---|---|
| `workspace/knowledge-showcase/src/audio/AudioManager.ts` | Web Audio: Procedural Sound Synthesizer & Analyser (Zero MP3 files) | 530 | копируется как есть |
| `workspace/knowledge-showcase/src/game/fightingMoves.ts` | Фрейм-дата: единственный источник баланса файтинга | 412 | копируется как есть |
| `workspace/knowledge-showcase/src/game/gridBuilding.ts` | Grid & Base Building logic module (pure TS, independent of Three.js) | 383 | копируется как есть |
| `workspace/knowledge-showcase/src/game/meleeCombat.ts` | Ближний бой: комбо-цепочка, окна отмены, парирование, hit-stop | 330 | копируется как есть |
| `workspace/knowledge-showcase/src/game/flowField.ts` | Флоу-филд и строй для RTS | 283 | копируется как есть |
| `workspace/knowledge-showcase/src/game/survivorRun.ts` | Забег в survivor-игре: кривая опыта, карточки апгрейдов, эскалация орды | 279 | копируется как есть |
| `workspace/knowledge-showcase/src/game/vfxJuice.ts` | Instanced Particle VFX Pool & Camera Trauma Juice logic | 254 | копируется как есть |
| `workspace/knowledge-showcase/src/game/fluidPhysics.ts` | Fluid Buoyancy, Mining Drill & Physics Destruction logic module | 244 | копируется как есть |
| `workspace/knowledge-showcase/src/game/towerDefense.ts` | Tower defense: контракт волн, приоритет целей, экономика | 225 | копируется как есть |
| `workspace/knowledge-showcase/src/game/arcadeCar.ts` | Аркадная модель машины — общая для игрока и соперников | 201 | копируется как есть |
| `workspace/knowledge-showcase/src/game/ortho2dEvidence.ts` | Orthographic 2D, Swipe Slicer & Evidence Board Deduction Graph logic | 184 | копируется как есть |
| `workspace/knowledge-showcase/src/game/stealthSensing.ts` | Стелс: конус зрения, шкала подозрения, шум | 145 | копируется как есть |
| `workspace/knowledge-showcase/src/input/TouchControls.ts` | TouchControls (input) — экспортирует TouchControls | 138 | копируется как есть |
| `workspace/knowledge-showcase/src/game/fightAnimStates.ts` | Список анимаций бойца в одном месте: чем вызывается и сколько длится | 131 | копируется как есть |
| `workspace/knowledge-showcase/src/game/proceduralMesh.ts` | Procedural 3D Mesh generator specifications, animator math & benchmark calculations | 118 | копируется как есть |
| `workspace/knowledge-showcase/src/game/rhythmAudio.ts` | Web Audio Timing, Rhythm Beat Sync & Muting Logic | 80 | копируется как есть |
| `workspace/knowledge-showcase/src/world/shooterAnimTypes.ts` | Формат процедурной анимации стрелка | 70 | копируется как есть |
| `workspace/knowledge-showcase/src/world/assetBytes.ts` | Чтение файла из `public/` одинаково в браузере и в головной проверке | 20 | копируется как есть |
| `workspace/knowledge-showcase/src/world/boxerRig.ts` | Процедурный боксёр: сегментированный позвоночник, лицо, перчатки, износ | 543 | нужен three, больше ничего |
| `workspace/knowledge-showcase/src/rendering/SceneManager.ts` | SceneManager (rendering) — экспортирует SceneManager | 297 | нужен three, больше ничего |
| `workspace/knowledge-showcase/src/rendering/RacingVFX.ts` | RacingVFX (rendering) — экспортирует RacingVFX | 291 | нужен three, больше ничего |
| `workspace/knowledge-showcase/src/game/raceTrack.ts` | Трасса: одна кривая — один источник истины | 208 | нужен three, больше ничего |
| `workspace/knowledge-showcase/src/world/fighterRig.ts` | fighterRig (world) — экспортирует FighterRig, buildFighter | 95 | нужен three, больше ничего |
| `workspace/knowledge-showcase/src/world/carRig.ts` | Процедурный low-poly болид. Никаких .gltf: вся геометрия — код | 72 | нужен three, больше ничего |
| `workspace/knowledge-showcase/src/demos/FightingDemo.ts` | Демо Fighting: как boxerRagdoll, boxerRig, fightClips, fightingMoves, mixamoRig собирается в живую сцену | 2129 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/levels.ts` | levels (world) — экспортирует ForkConfig, LEVELS, LevelConfig, MudZoneConfig | 2030 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/FpsDemo.ts` | Демо Fps: как bvhLevel, mixamoRig, shooterPose, shooterRagdoll, shooterRig, vfxJuice собирается в живую сцену | 1995 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/vehicle/TruckController.ts` | TruckController (vehicle) — экспортирует TruckController | 1506 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/RacingTrack3D.ts` | RacingTrack3D (world) — экспортирует CHECKPOINTS, RacingTrack3D, TrackSample3D, defaultProTrackPoints | 865 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/rendering/ParticleSystem.ts` | ParticleSystem (rendering) — экспортирует ParticleKind, ParticleSystem | 724 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/TowerDefenseDemo.ts` | Демо TowerDefense: как towerDefense собирается в живую сцену | 664 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/RoadGenerator.ts` | RoadGenerator (world) — экспортирует RoadGenerator | 610 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/vehicle/truckSpec.ts` | Single source of truth for the trucks' dimensions, handling and cargo packages | 584 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/BuildingDemo.ts` | Демо Building: как gridBuilding собирается в живую сцену | 548 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/MeleeDemo.ts` | Демо Melee: как fighterRig, meleeCombat, ragdoll собирается в живую сцену | 546 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/SurvivorDemo.ts` | Демо Survivor: как survivorRun, towerDefense собирается в живую сцену | 546 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/RacingDemo.ts` | Демо Racing: как RacingCarController, RacingTrack3D собирается в живую сцену | 545 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/RtsDemo.ts` | Демо Rts: как flowField собирается в живую сцену | 540 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/StealthDemo.ts` | Демо Stealth: как stealthSensing собирается в живую сцену | 504 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/mixamoRig.ts` | mixamoRig (world) — экспортирует BONES, BOXER_MODELS, MixamoBoxerOptions, buildMixamoBoxer | 493 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/rendering/TireTracksManager.ts` | TireTracksManager (rendering) — экспортирует TireTracksManager | 478 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/Ortho2dDemo.ts` | Демо Ortho2d: как ortho2dEvidence собирается в живую сцену | 472 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/YukaDemo.ts` | Демо Yuka: собранная сцена целиком — образец подключения | 465 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/vehicle/RacingCarController.ts` | RacingCarController (vehicle) — экспортирует DEFAULT_SPORTS_SPEC, RacingCarController, RacingCarInput, RacingCarSpec | 460 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/BuoyancyDemo.ts` | Демо Buoyancy: как fluidPhysics собирается в живую сцену | 457 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/Procedural3dDemo.ts` | Демо Procedural3d: как proceduralMesh собирается в живую сцену | 438 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/boxerRagdoll.ts` | Рэгдолл ИЗ САМОГО ПЕРСОНАЖА, а не из капсул-заменителей | 408 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/terrain.ts` | Terrain shape and geometry, free of renderer dependency, so the exact same buffers | 396 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/shooterRagdoll.ts` | Рэгдолл трупа БЕЗ физического движка: точки, связки, верле | 395 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/physics/PhysicsWorld.ts` | PhysicsWorld (physics) — экспортирует CARGO_GROUPS, GROUND_GROUPS, GROUP_CARGO, GROUP_GROUND | 338 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/vehicle/CargoManager.ts` | CargoManager (vehicle) — экспортирует CargoManager | 314 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/shooterRig.ts` | Скиненный стрелок (Mixamo X Bot / Y Bot) с драйверами суставов | 306 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/BvhDemo.ts` | Демо Bvh: как bvhLevel собирается в живую сцену | 305 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/shooterPose.ts` | Проигрыватель процедурной анимации стрелка | 303 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/RecastDemo.ts` | Демо Recast: собранная сцена целиком — образец подключения | 291 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/AudioRhythmDemo.ts` | Демо AudioRhythm: как rhythmAudio собирается в живую сцену | 283 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/shooterAnimData.ts` | shooterAnimData (world) — экспортирует SHOOTER_ANIM | 278 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/input/InputHub.ts` | InputHub (input) — экспортирует InputHub, PointerSample | 258 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/PostFxDemo.ts` | Демо PostFx: собранная сцена целиком — образец подключения | 236 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/fightClips.ts` | Мокап поверх позы-цели: клипы из `assets/fight_anim/`, запечённые в | 222 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/ragdoll.ts` | Рэгдолл на Rapier: семь тел, шесть сферических суставов | 214 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/VfxPoolDemo.ts` | Демо VfxPool: как vfxJuice собирается в живую сцену | 214 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/demos/TruckDemo.ts` | Эталонная вкладка стенда: ЗиЛ-130 на честной физике Rapier3D | 101 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/world/bvhLevel.ts` | Процедурный «каньон» — намеренно тяжёлая статичная геометрия для BVH-демо | 90 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/input/InputManager.ts` | InputManager (input) — экспортирует InputManager | 53 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/game/botDriver.ts` | Водитель-бот: выдаёт ТОЛЬКО `CarInput` — тот же интерфейс, что у игрока | 49 | образец, переписать под себя |
| `workspace/knowledge-showcase/src/stack/bvhSetup.ts` | Установка расширений three-mesh-bvh — ОДИН раз на приложение | 28 | образец, переписать под себя |
