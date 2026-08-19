# Knowledge Base

Production knowledge for the agents in this factory, distilled from shipped
HTML5 games (Yandex Games, VK, OK, CrazyGames, Playgama) and their moderation
and QA reports. Everything here is **verified against real builds** — where a
widely repeated snippet turned out to be wrong, the file says so explicitly.

Consumed via `app/knowledge.py`; `CRITICAL_RULES.md` is injected verbatim into
every generated `AI_DEVELOPER_PROMPT.md`.

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
| `threejs/adaptive_quality.md` | Converging quality auto-tuner, the vsync headroom trap |
| `threejs/rapier_vehicle_controller.md` | Ray-cast vehicle, suspension tuning, cargo that stays in the bed, head-less physics checks |
| `threejs/vehicle_wheel_rig.md` | Wheel rig for arcade **and** physics cars — the two are opposite, see §0 |
| `patterns/*.md` | Core-loop blueprints per genre |
| `mechanics/*.md` | Individual mechanic specs |
| `references/*.md` | Deconstructed market references |
| `threejs/*.md`, `pixijs/*.md` | Renderer-specific performance guidance |

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
