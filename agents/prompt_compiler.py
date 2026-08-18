from app import knowledge
from app.context import GenerationContext
from app.logging import log_agent

class PromptCompilerAgent:
    """
    Compiles structured game data, architecture specs, mechanics, and constraints
    into a self-contained, definitive master AI Developer Prompt (AI_DEVELOPER_PROMPT.md).
    """

    def compile(self, ctx: GenerationContext) -> str:
        concept = ctx.concept
        log_agent("PromptCompiler", f"Compiling definitive AI Developer Prompt for '{concept.title}'")

        dod_items = "\n".join([f"- [ ] {item}" for item in concept.definition_of_done]) if concept.definition_of_done else "- [ ] Complete playable game"
        layers_items = "\n".join([
            f"- **{layer.get('name', 'Layer') if isinstance(layer, dict) else str(layer)}**: {layer.get('responsibility', layer.get('desc', '')) if isinstance(layer, dict) else ''}"
            for layer in concept.tech_spec.layers
        ]) if concept.tech_spec.layers else "- **Core Systems Layer**: Complete game loop and state management"
        mechanics_items = "\n".join([
            f"### {m.name} ({m.priority.upper()})\n"
            f"- **Category**: {m.category}\n"
            f"- **Description**: {m.description}\n"
            f"- **Player Input**: {m.player_interaction}\n"
            f"- **Hit & Sensory Feedback**: {m.feedback}\n"
            f"- **Technical Complexity**: {m.technical_complexity}\n"
            for m in concept.mechanics
        ])
        rewarded_items = "\n".join([
            f"- **{r.name} (`{r.id}`)**: {r.benefit} (Trigger: {r.trigger_moment}, Limit: {r.cooldown_or_limit})"
            for r in concept.monetization.rewarded_placements
        ])
        # The knowledge base is the factory's memory of what actually ships on
        # these platforms. It is injected verbatim so the coding agent never has
        # to rediscover a rule that already cost a production bug.
        critical_rules = knowledge.critical_rules(heading_offset=1)
        if not critical_rules:
            log_agent("PromptCompiler", "WARNING: knowledge/CRITICAL_RULES.md missing — prompt will omit platform rules")
        knowledge_index = "\n".join(f"- `knowledge/{rel}`" for rel in knowledge.list_topics())

        roadmap_items = "\n".join([
            f"### Phase {phase.phase_number}: {phase.title} ({phase.duration_days} days)\n"
            f"- **Deliverable**: {phase.milestone_deliverable}\n"
            + "\n".join([f"  - {task}" for task in phase.tasks])
            for phase in concept.roadmap
        ])

        prompt_content = f"""# FINAL AI DEVELOPER PROMPT: {concept.title.upper()} 🎮⚡

> **INSTRUCTION FOR AI CODING AGENT**:
> You are the **Lead Game Developer & Systems Architect**. Your task is to build and deliver the complete, production-ready, fully playable HTML5/WebGL game described in this specification from start to finish.
> Follow the technical architecture, physics specifications, Playgama Bridge integration, and mobile ergonomics strictly.
> Do NOT omit systems, use fake placeholder stubs, or leave TODOs. The end result must satisfy every single item in the **Definition of Done**.

---

## 1. PROJECT IDENTITY & GOAL
- **Game Title**: {concept.title}
- **Project Slug**: `{concept.slug}`
- **Genre**: {concept.genre} ({concept.subgenre})
- **Target Platform**: {concept.platform}
- **Orientation**: {concept.orientation.capitalize()}
- **Target Audience**: {concept.target_audience}
- **Player Fantasy**: {concept.player_fantasy}
- **Core Hook**: {concept.hook}
- **Session Model**: {concept.session_model}

---

## 2. TECHNOLOGY STACK & RENDERING ENGINE
- **Language**: {concept.tech_spec.language}
- **Bundler & Dev Server**: {concept.tech_spec.bundler}
- **Renderer**: **{concept.tech_spec.renderer.upper()}** ({concept.tech_spec.renderer_version})
  - *Selection Rationale*: {concept.renderer_reason}
- **Physics Simulation**: **{concept.tech_spec.physics_engine}** (Fixed 60Hz timestep with accumulator)
- **Audio Engine**: {concept.tech_spec.audio_engine}
- **State Management**: {concept.tech_spec.state_manager}
- **Platform SDK**: `{concept.playgama.sdk_version}`

### Performance Budgets
- **Target FPS**: {concept.tech_spec.target_fps} FPS (Desktop & Mobile)
- **Max Draw Calls**: < {concept.tech_spec.max_draw_calls}
- **Max Triangles / Active Sprites**: < {concept.tech_spec.max_triangles_or_sprites}
- **Max Bundle Size**: < {concept.tech_spec.bundle_size_budget_mb} MB (Gzipped + assets)

---

## 3. CORE GAMEPLAY LOOP & MECHANICS
**Core Loop Sequence**:
```text
{concept.core_loop}
```

{mechanics_items}

---

## 4. SOFTWARE ARCHITECTURE & SYSTEMS
The game must be built with a clean, decoupled layer architecture:

{layers_items}

### Module Map (`src/`):
```text
src/
├── main.ts                    # Bootstrap, Playgama Bridge init, Game launch
├── core/
│   ├── Game.ts                # Main coordinator & state machine
│   ├── GameLoop.ts            # 60Hz fixed update loop with delta clamping
│   └── EventBus.ts            # Typed publish/subscribe event dispatcher
├── platform/
│   ├── PlaygamaService.ts     # Wrapper for @playgama/bridge (Ads, Save, Leaderboards)
│   └── StorageService.ts      # Cloud & LocalStorage sync with debouncing
├── physics/
│   ├── PhysicsWorld.ts        # Rapier3D / Physics world manager
│   └── RagdollController.ts    # Joint solver, balance spring torque, knockback
├── entities/
│   ├── Player.ts              # Player character entity & input impulses
│   ├── Enemy.ts               # Enemy AI behavior tree & ragdoll death
│   └── Weapon.ts              # Weapon mass, hitboxes, collision queries
├── systems/
│   ├── CombatSystem.ts        # Hitbox resolution, parry timing, damage formulas
│   ├── WaveManager.ts         # Spawning curves, elite bosses, wave clears
│   ├── UpgradeManager.ts      # 3-card roguelite selection & stat application
│   └── CrowdFavorSystem.ts    # Hype calculation and dynamic drop rewards
├── rendering/
│   ├── SceneManager.ts        # Three.js / PixiJS scene graph, lighting, camera lerp
│   ├── MeshPool.ts            # InstancedMesh pooling for debris & effects
│   └── Shaders.ts             # Optimized mobile shaders & materials
├── ui/
│   ├── UIManager.ts           # DOM HUD overlay, screen transitions
│   ├── VirtualJoystick.ts     # Mobile touch floating joystick
│   └── CardModal.ts           # 3-choice upgrade modal
└── audio/
    └── AudioManager.ts        # Sound effects pool & dynamic battle BGM
```

---

## 5. PLAYGAMA BRIDGE INTEGRATION SPECIFICATION
Platform integration is powered by `@playgama/bridge`.

### 1. Initialization & Ready Event
`game_ready` is **NOT** sent after `initialize()` — that dismisses the platform splash over an unloaded game. It is sent once, after assets are loaded and the menu is interactive.

```typescript
export async function bootstrapPlatform(): Promise<void> {{
    // A blocked sdk.js (ad blocker, CDN failure) must not mean a permanent black screen.
    await Promise.race([bridge.initialize(), new Promise((r) => setTimeout(r, 10_000))]);
    bridge.platform.sendMessage('in_game_loading_started');
}}

let gameReadySent = false;
export function sendGameReady(): void {{
    if (gameReadySent) return;                  // a second send can re-arm the platform splash
    gameReadySent = true;
    try {{ bridge.platform.sendMessage('game_ready'); }} catch {{}}
    try {{ bridge.platform.sendMessage('in_game_loading_stopped'); }} catch {{}}
}}
```

**Boot order (strict).** Nothing in this chain may wait on a player decision:
page guards → `initialize()` → language → silent VK/OK auth → load save → redeem pending purchases → build engine/UI → progress to 100% → `sendGameReady()` → arm banners → first-launch tutorial.
Keep a 15 s watchdog that sends `game_ready` regardless of boot failures.

### 2. Advertisement Flow
- **Interstitial Ads**:
  - Minimum **90 seconds** cooldown, and never below the platform's configured minimum.
  - Only at natural breaks traceable to a real click (run over, level complete, leaving to menu). Never at boot, never mid-combat, never right after a purchase.
  - Arm the slot when the run ends; fire it when the player taps to leave the result screen.
  - Never call `showInterstitial()` from a state method — the click handler decides.
- **Rewarded Ads** — the reward is granted **only** on `state === 'rewarded'`, never when the promise resolves. Always `off()` the listener and guard re-entry, or one ad pays out twice:
{rewarded_items}
- Every ad surface is capability-gated: if `isRewardedSupported` is false the button is **not rendered at all**.

### 3. Cloud Storage & Save State
- Persistent storage key: `"{concept.playgama.cloud_save_keys[0]}"` — one key, one JSON object.
- `bridge.storage.set(key, value)` / `get(key)` take **no `storageType` argument**; v2 picks cloud vs. local.
- Normalize on read: a corrupted or truncated save must boot on defaults, not crash.
- Mirror to `localStorage` for instant/offline boot, but never as the only copy — it is partitioned third-party storage inside the platform iframe. Settings (mute, volume, language) live in the save.
- Debounce writes by 1.5 s **and** flush on `pagehide` / `visibilitychange`.
- Daily/timed content uses `bridge.platform.getServerTime()`, never the device clock.

### 4. Lifecycle & Auto-Pause
- Subscribe to `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED)` and `AUDIO_STATE_CHANGED` — not `visibility_state_changed`, which misses interstitials.
- Fire the callback once with the current value at subscribe time; a game booted in a hidden tab otherwise starts in the wrong state.
- On resume, reset the delta accumulator and clamp `dt` to 0.1 s.

### 5. Authorization
- `authorize()` only from an explicit player action — **except** VK/OK, where it is silent, runs at boot before saves, and is time-boxed to 5 s.
- Guests have a non-null `id` and `name`: the only reliable check is `player.isGuest`.
- Never `await` a dialog-showing `authorize()` inside boot.

---

## 6. USER INTERFACE & MOBILE CONTROLS
- **Orientation**: {concept.orientation.capitalize()}
- **Safe Area Insets**: Handled via CSS `padding: env(safe-area-inset-top) env(safe-area-inset-right)...`
- **Mobile Touch Controls**:
  - **Left Side**: Floating dynamic virtual joystick with touch-drag tracking.
  - **Right Side**: Action cluster (Large Primary Strike, Medium Parry/Block, Medium Dash).
- **Desktop Controls**:
  - `WASD` / `Arrow Keys`: Movement
  - `Left Mouse Button` / `J`: Primary Strike
  - `Right Mouse Button` / `K`: Heavy Strike / Block
  - `Space` / `Shift`: Dash / Dodge
  - `F` / `E`: Parry / Special

---

## 7. ART DIRECTION & VISUAL GUIDELINES
- **Style**: {concept.art.style_name}
- **Camera Perspective**: {concept.art.camera_perspective} (FOV: {concept.art.camera_fov}°, Pitch: {concept.art.camera_pitch_angle}°)
- **Environment**: {concept.art.environment_theme}
- **Lighting**: {concept.art.lighting_setup}
- **Visual Feedback**: Screen-space hitstop (40ms on critical hit), directional particle sparks, additive ribbon weapon trails.

---

## 8. STEP-BY-STEP DEVELOPMENT ROADMAP
{roadmap_items}

---

## 9. NON-NEGOTIABLE PLATFORM RULES
Every rule below corresponds to a bug that reached production or a moderation rejection in a shipped game. They override any conflicting habit, tutorial or example — including snippets found in the Playgama/Yandex docs, many of which describe the deprecated Bridge v1 contract.

{critical_rules}

---

## 10. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

{dod_items}

---

## 11. FACTORY KNOWLEDGE BASE
Deep, worked-out detail behind the rules in section 9 — read the relevant file before implementing that area:

{knowledge_index}

---

## 12. DETAILED REFERENCE DOCUMENTS
For extended deep specifications, refer to the accompanying project documentation files:
- [Game Design Document](file:///output/{concept.slug}/GAME_DESIGN_DOCUMENT.md)
- [Gameplay Specification](file:///output/{concept.slug}/GAMEPLAY_SPECIFICATION.md)
- [Technical Specification](file:///output/{concept.slug}/TECHNICAL_SPECIFICATION.md)
- [Architecture Document](file:///output/{concept.slug}/ARCHITECTURE_DOCUMENT.md)
- [Playgama Integration](file:///output/{concept.slug}/PLAYGAMA_INTEGRATION.md)
- [Monetization Specification](file:///output/{concept.slug}/MONETIZATION.md)
- [Mobile Controls](file:///output/{concept.slug}/MOBILE_CONTROLS.md)
- [QA Plan](file:///output/{concept.slug}/QA_PLAN.md)
- [Game Skill Guidelines](file:///output/{concept.slug}/skills/GAME_SKILL.md)
- [Renderer Skill](file:///output/{concept.slug}/skills/RENDERER_SKILL.md)
"""
        return prompt_content.strip()
