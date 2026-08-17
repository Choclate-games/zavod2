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
```typescript
import bridge, {{ PlatformMessage }} from '@playgama/bridge';

export async function bootstrapPlatform(): Promise<void> {{
    await bridge.initialize();
    console.log('Playgama Bridge initialized on:', bridge.platform.id);
    
    // Notify platform when game is loaded and ready
    bridge.platform.sendMessage(PlatformMessage.GAME_READY);
}}
```

### 2. Advertisement Flow
- **Interstitial Ads**:
  - Minimum **90 seconds** cooldown between impressions.
  - Trigger only between major wave milestones or run game over.
  - Never trigger during active combat.
  - Listen to `bridge.advertisement.on('interstitial_state_changed')` to pause audio and physics when opened, and resume when closed.
- **Rewarded Ads**:
{rewarded_items}

### 3. Cloud Storage & Save State
- Persistent storage key: `"{concept.playgama.cloud_save_keys[0]}"`
- Save format: JSON containing gold, unlocked weapons, high score, highest wave, and sound settings.
- Debounce cloud writes by 1.5 seconds.

### 4. Lifecycle & Auto-Pause
- Listen to `visibility_state_changed` event.
- Automatically pause physics and mute master volume when tab is hidden or ad opens.

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

## 9. DEFINITION OF DONE (MANDATORY VERIFICATION CHECKLIST)
To mark this game as complete, every single requirement below must be verified and working:

{dod_items}

---

## 10. DETAILED REFERENCE DOCUMENTS
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
