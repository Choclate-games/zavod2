from app.context import GenerationContext
from app.logging import log_agent

class TechnicalArchitectAgent:
    """Architects the TypeScript/Vite application structure, layers, and service modules."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("TechnicalArchitect", f"Designing technical architecture for {concept.tech_spec.renderer.upper()} + {concept.tech_spec.physics_engine}")
        
        # Ensure layers are populated
        if not concept.tech_spec.layers:
            concept.tech_spec.layers = [
                {"name": "Application Layer", "responsibility": "Vite bootstrapping, canvas resize, fullscreen management, asset preloader."},
                {"name": "Platform & Ads Layer", "responsibility": "Playgama Bridge adapter, Interstitial & Rewarded ad managers, Cloud save sync."},
                {"name": "Core Engine Layer", "responsibility": "Fixed 60Hz GameLoop, Time dilation manager, EventBus, Input routing."},
                {"name": "Physics Simulation Layer", "responsibility": f"{concept.tech_spec.physics_engine} World stepping, collision events, joint constraint solver."},
                {"name": "Gameplay Systems Layer", "responsibility": "Combat system, Spawn director, Upgrade card logic, Crowd favor calculator."},
                {"name": "Entity Management Layer", "responsibility": "Player entity, Enemy entity pool, Weapon rigidbodies, Debris instance pool."},
                {"name": "Rendering Layer", "responsibility": f"{concept.tech_spec.renderer} Scene graph, InstancedMesh batches, Shadow maps, Particle emitters."},
                {"name": "UI & HUD Layer", "responsibility": "HTML5/CSS3 responsive overlay, Virtual joystick, Health bars, Card modal, Shop."}
            ]

        # Ensure modules are populated
        if not concept.tech_spec.modules:
            concept.tech_spec.modules = [
                {"name": "src/main.ts", "desc": "Bootstrap, Playgama Bridge init, Game launch"},
                {"name": "src/core/Game.ts", "desc": "Main coordinator & state machine"},
                {"name": "src/core/GameLoop.ts", "desc": "60Hz fixed update loop with delta accumulator"},
                {"name": "src/core/EventBus.ts", "desc": "Typed publish/subscribe event dispatcher"},
                {"name": "src/platform/PlaygamaService.ts", "desc": "Wrapper for @playgama/bridge (Ads, Save, Leaderboards)"},
                {"name": "src/systems/CombatSystem.ts", "desc": "Weapon collision, hitstop, and damage calculations"},
                {"name": "src/systems/SpawnDirector.ts", "desc": "Wave escalation and dynamic enemy spawning"},
                {"name": "src/ui/UIManager.ts", "desc": "HUD overlay, virtual joystick, and modal screens"}
            ]
        
        log_agent("TechnicalArchitect", f"Architecture mapped into {len(concept.tech_spec.layers)} distinct decoupled layers.")
