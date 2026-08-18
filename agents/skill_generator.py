from app import knowledge
from app.context import GenerationContext
from app.models import SkillDoc
from app.logging import log_agent

class SkillGeneratorAgent:
    """Ensures game-specific and specialized skills are prepared and attached to concept.

    Platform and renderer skills point at `knowledge/` rather than restating it:
    the knowledge base is the single source of truth, and a summary written here
    drifts from it the moment either changes."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("SkillGenerator", f"Generating game-specific skill instructions for '{concept.title}'")

        # Ensure concept.skills is a list
        if not isinstance(concept.skills, list):
            concept.skills = []

        skill_ids = [s.skill_id for s in concept.skills]
        
        # Inject core required skills if missing
        if "game_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: game_skill")
            concept.skills.append(SkillDoc(
                skill_id="game_skill",
                name=f"{concept.title} Domain Architecture",
                filename="GAME_SKILL.md",
                purpose=f"Defines domain rules, state machine, and core gameplay loop for {concept.title}.",
                when_to_use="Use when writing or modifying core game state, loop coordination, and progression.",
                rules=[
                    "Strict TypeScript strict mode without any 'any' types.",
                    "Fixed 60Hz delta accumulator with delta clamping.",
                    "Decoupled state management via typed EventBus.",
                    "Zero runtime object allocations inside the 60Hz game loop."
                ],
                architecture="Decoupled 3-layer architecture: Application/Platform -> Engine/Systems -> Rendering/UI.",
                implementation_guidance="Instantiate Game instance from main.ts, bootstrap PlaygamaService, and start GameLoop.",
                common_mistakes=[
                    "Do not instantiate Three.js meshes or heavy objects inside tick loops.",
                    "Do not bypass the EventBus for cross-system communications."
                ],
                checklist=[
                    "Game initializes cleanly and loads within 3 seconds.",
                    "EventBus routes inputs and system events without memory leaks.",
                    "Audio auto-pauses and unpauses cleanly with browser focus changes."
                ]
            ))

        if "gameplay_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: gameplay_skill")
            concept.skills.append(SkillDoc(
                skill_id="gameplay_skill",
                name="Combat, Physics & Movement Systems",
                filename="GAMEPLAY_SKILL.md",
                purpose="Defines standards for physics simulation, combat mechanics, and tactile player feedback.",
                when_to_use="Use when writing character controllers, weapon systems, collision listeners, and juice/VFX.",
                rules=[
                    "Clamp delta time to maximum 100ms to prevent physics tunneling.",
                    "Use continuous collision detection (CCD) for fast projectiles.",
                    "Apply hitstop (40ms time dilation) on impactful strikes.",
                    "Always synchronize physics rigid body transforms to mesh representations."
                ],
                architecture="Physics engine (Rapier3D/Matter.js) stepped on fixed 60Hz timestep, meshes interpolated.",
                implementation_guidance="Use EventBus to emit 'entity:hit', 'combat:parry', 'wave:cleared' events for sound and VFX triggers.",
                common_mistakes=[
                    "Never modify transform matrices directly on physics-controlled entities.",
                    "Do not hardcode magic numbers for damage or velocities without centralized configuration."
                ],
                checklist=[
                    "Player movement is responsive with no input lag.",
                    "Hits produce satisfying sensory feedback (VFX spark, screen shake, audio impact).",
                    "Ragdoll or death animations trigger smoothly without physics jitter."
                ]
            ))

        if "renderer_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: renderer_skill")
            concept.skills.append(SkillDoc(
                skill_id="renderer_skill",
                name=f"{concept.renderer.upper()} WebGL Performance Guide",
                filename="RENDERER_SKILL.md",
                purpose=f"Optimization and visual standards for {concept.renderer.upper()} WebGL pipeline.",
                when_to_use="Use when configuring scenes, cameras, lighting, materials, instanced meshes, and particle systems.",
                rules=[
                    "Keep active draw calls strictly under 80.",
                    "Use InstancedMesh for debris, bullets, and crowd mobs.",
                    "Clamp pixel ratio to Math.min(window.devicePixelRatio, 1.5) on mobile.",
                    "Share material instances across identical geometry."
                ],
                architecture="Scene graph with pre-allocated sprite and mesh pools, dynamic shadow frustum optimization.",
                implementation_guidance="Initialize renderer with antialias enabled on desktop, powerPreference 'high-performance'.",
                common_mistakes=[
                    "Do not construct new Geometries, Textures, or Materials in the render loop.",
                    "Do not leave unused GPU assets without calling .dispose().",
                    "Do not tune quality from raw frame time — under vsync every frame reads as budget-length.",
                    "Do not launch in reduced quality and climb up; start optimistic and step down."
                ],
                checklist=[
                    "Maintains solid 60 FPS on desktop and >= 50 FPS on mobile.",
                    "No WebGL context loss errors on tab switches.",
                    "Shadow map renders crisp without artifact acne.",
                    "The quality auto-tuner converges and locks instead of oscillating."
                ],
                knowledge_refs=knowledge.topics_for_renderer(concept.renderer)
            ))

        if "playgama_skill" not in skill_ids:
            log_agent("SkillGenerator", "Injecting core skill: playgama_skill")
            concept.skills.append(SkillDoc(
                skill_id="playgama_skill",
                name="Playgama Bridge SDK Integration",
                filename="PLAYGAMA_SKILL.md",
                purpose="Defines implementation patterns for @playgama/bridge v2 (Ads, Cloud Storage, Auth, Leaderboards, Lifecycle).",
                when_to_use="Use when implementing advertising triggers, cloud save/load, authorization, and portal lifecycle hooks.",
                rules=[
                    "Always await bridge.initialize() (with a timeout) before any other SDK call.",
                    "Send game_ready exactly once, only after assets are loaded and the menu is interactive.",
                    "Grant a rewarded reward only on state === 'rewarded'; never when the promise resolves.",
                    "One save key holding one JSON object; storage.get/set take no storageType argument.",
                    "Call authorize() only from a player action — except the silent VK/OK path at boot.",
                    "Build UI on capability flags: an unsupported feature's control is not rendered at all.",
                    "Take pause and audio state from the platform's own events, not visibilitychange alone.",
                    "Auto-save on progress milestones and flush on pagehide."
                ],
                architecture="Singleton PlaygamaService wrapper exposing strongly-typed promises for Ads, Storage, Auth, Payments and Leaderboards, degrading to a local mock when window.bridge is absent.",
                implementation_guidance=(
                    "Subscribe to EVENT_NAME.REWARDED_STATE_CHANGED, call "
                    "bridge.advertisement.showRewarded(placement), remove the listener in cleanup, and "
                    "resolve true only for the 'rewarded' state. Full implementations for every module "
                    "are embedded below."
                ),
                common_mistakes=[
                    "Sending game_ready right after initialize() — the splash lifts over an unloaded game.",
                    "Awaiting a dialog-showing authorize() inside boot — the game hangs for every guest.",
                    "Detecting a guest via player.id/name; they are populated for guests, use player.isGuest.",
                    "Showing an interstitial in the first seconds of a session or during gameplay.",
                    "Consuming a purchase before granting it — paid goods are destroyed.",
                    "Keeping settings in localStorage — it is partitioned inside the platform iframe.",
                    "Never assume internet connection is permanent — support local offline fallback."
                ],
                checklist=[
                    "Rewarded grants exactly one reward per view, even on a double click.",
                    "Progress survives a reload as guest and as an authorized player.",
                    "A corrupted save boots on defaults instead of crashing.",
                    "Leaderboard score submits and displays correctly.",
                    "Game auto-pauses on the platform's pause event, including during ads."
                ],
                knowledge_refs=knowledge.CORE_TOPICS
            ))

        log_agent("SkillGenerator", f"Compiled {len(concept.skills)} reusable skill documents.")
