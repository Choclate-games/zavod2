# Knowledge Base

Production knowledge for the agents in this factory, distilled from shipped
HTML5 games (Yandex Games, VK, OK, CrazyGames, Playgama) and their moderation
and QA reports. Everything here is **verified against real builds** — where a
widely repeated snippet turned out to be wrong, the file says so explicitly.

Consumed via `app/knowledge.py`; `CRITICAL_RULES.md` is injected verbatim into
every generated `AI_DEVELOPER_PROMPT.md`.

**The factory ships Three.js only, and for now 3D only** — 2D output is disabled
via `config/factory.yaml` → `pipeline.enable_2d`. The PixiJS recipes were not
deleted: they live in `knowledge_archive/pixijs/`, which this loader never reads,
together with the steps to bring them back. The libraries every game is built on,
and the tasks each one owns instead of hand-written code, are in `stack/README.md`.

## Index

| File | What it covers |
|---|---|
| **`CRITICAL_RULES.md`** | The non-negotiable rules. Injected into every master prompt |
| `playgama/bridge_api_reference.md` | Bridge v2 API surface + the v1 snippets that are wrong for v2 |
| `playgama/game_ready_and_loading.md` | Boot order, `game_ready`, loading progress, watchdog |
| `playgama/auth_and_player.md` | Guest detection, silent VK/OK auth, placeholder names |
| `playgama/storage_and_cloud.md` | Single-key saves, normalization, pagehide flush, server time |
| `playgama/ads_integration.md` | Event-based rewarded, arm/flush interstitials, capability gating |
| `playgama/banners_and_layout.md` | Advanced vs. sticky banners, retry policy, layout reserve |
| `playgama/lifecycle_and_orientation.md` | Pause/audio events, resize settling, gameplay signals |
| `playgama/social_features.md` | Share/invite/community/rate: gating, gesture rule, cadence |
| `playgama/platform_matrix.md` | Per-platform differences in one table |
| `compliance/yandex_moderation.md` | Requirement → cause → fix map, the page lock, traps |
| `compliance/qa_checklist.md` | Testing in a real draft, what to measure, automation |
| `monetization/in_app_purchases.md` | Consume by id, redeem-before-consume, catalog prices |
| `monetization/rewarded_ads_patterns.md` | Placements, conversion, button UX |
| `monetization/interstitial_best_practices.md` | Frequency and placement |
| `ux/localization_system.md` | i18n engine, `_touch` variants, parity audit |
| `ux/ui_design_system.md` | Tokens, one geometry, capability-gated layout, no-scroll menus |
| `audio/web_audio_and_muting.md` | Web Audio only, autoplay unlock, master bus, platform mute |
| `platform_builds/android_capacitor.md` | Capacitor shell, package/icon setup, native banner reserve |
| **`stack/README.md`** | The Three.js stack, pinned versions, the "task → library" table, frame order |
| `stack/rapier3d.md` | Physics: world, bodies, groups, character controller, headless checks |
| `stack/three_mesh_bvh.md` | Fast raycast/overlap against static geometry, capsule controller |
| `stack/yuka_ai.md` | Steering, state machines, fuzzy logic, perception |
| `stack/recast_navigation.md` | Navmesh generation, `NavMeshQuery`, `Crowd`, dynamic obstacles |
| `stack/bitecs.md` | ECS 0.4 API, mass entities, instanced rendering, system order |
| `stack/postprocessing.md` | `EffectComposer`, effect budget per device tier, sRGB/AA traps |
| `threejs/orthographic_2d_and_pointer_input.md` | 2D as an orthographic Three.js scene: pointer→world, splines, drag |
| `threejs/fighting_game_core.md` | Frame data, hit/hurt/push boxes, reach & advance, stamina/guard break, the physics boundary, live-match check; раскладка «две кнопки + модификатор» рядом с балансом, окно мокап-клипа по кадру попадания |
| `threejs/skinned_character_models.md` | Готовые FBX из `assets/`: нормализация и перепривязка, свои оси поверх чужого скелета, рэгдолл из костей (разбитых по суставам), ретаргет мокапа по направлениям и его четыре ловушки — включая ту, из-за которой удар уходит вбок, — плюс размер дописанных аксессуаров |
| `threejs/procedural_character_rig.md` | Humanoid built from boxes: hierarchy, seeded faces, wear decals, pose-target animation, ragdoll from the real meshes (шарниры с пределами, тонус связками, бросок тела целиком), leg-rotation sign, фазы удара ногой и граница между мокапом и позой, and how to prove an animation is not broken (Playwright sheet + headless pose measurements) |
| `threejs/racing_track_and_opponents.md` | Track from one curve, checkpoints and laps, racing line, fair rubber-banding |
| `threejs/game_map_and_world_design.md` | Procedural game maps, terrain recessed corridors, anti-z-fighting, prop grounding |
| `threejs/tower_defense_core.md` | Fixed path vs. maze, target priority, projectiles, wave contract |
| `threejs/rts_selection_and_command.md` | Frustum selection, order queue, formations, flow fields, fog |
| `threejs/shooter_enemy_ai_and_combat.md` | Hitscan, TTK, enemy FSM, attack tokens, cover, hit feedback, horde |
| `threejs/adaptive_quality.md` | Converging quality auto-tuner, the vsync headroom trap |
| `threejs/rapier_vehicle_controller.md` | Ray-cast vehicle, suspension tuning, cargo that stays in the bed, head-less physics checks |
| `threejs/vehicle_wheel_rig.md` | Wheel rig for arcade **and** physics cars — the two are opposite, see §0 |
| `patterns/*.md` | Core-loop blueprints per genre |
| `mechanics/*.md` | Individual mechanic specs |
| `references/*.md` | Deconstructed market references |
| `threejs/*.md` | Renderer recipes: vehicles, FPS, melee, stealth, VFX, procedural meshes |

## Editing rules

1. **Only verified knowledge.** If it was not observed in a real build, a real
   rejection or vendor code, it does not belong here.
2. **Say why, not just what.** A rule without its failure mode gets "optimized
   away" by the next agent.
3. **Correct the record loudly.** When a common pattern is wrong, keep it in the
   file marked wrong next to the right one — otherwise it comes back.
4. **New non-negotiable rule → also add it to `CRITICAL_RULES.md`**, since that
   is the only file guaranteed to reach the coding agent.
5. Keep files topic-sized. Agents load them individually.
