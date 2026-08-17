from app.context import GenerationContext
from app.logging import log_agent

class UXDesignerAgent:
    """Designs the UI layout, mobile ergonomics, HUD elements, and screen wireframes."""

    def run(self, ctx: GenerationContext):
        concept = ctx.concept
        log_agent("UXDesigner", f"Designing mobile-first UI/UX and controls for '{concept.title}'")
        
        if not concept.ui_ux.hud_elements:
            concept.ui_ux.hud_elements = [
                "Top-Left: Health & Shield Stamina Bar",
                "Top-Center: Current Wave & Enemies Remaining",
                "Top-Right: Gold Currency & Pause Button",
                "Bottom-Left: Virtual Movement Joystick",
                "Bottom-Right: Action Cluster (Strike, Parry, Dash)"
            ]

        if not concept.ui_ux.screens:
            concept.ui_ux.screens = [
                {"id": "main_menu", "desc": "Play button, Armory, Settings, High Score banner"},
                {"id": "gameplay_hud", "desc": "Dynamic health bar, wave timer, joystick, action buttons"},
                {"id": "upgrade_draft_modal", "desc": "3-card roguelite selection with rarity borders and reroll button"},
                {"id": "game_over_modal", "desc": "Results, Revive via Rewarded Video button, Gold banked, Restart"}
            ]

        if not concept.ui_ux.wireframes_ascii:
            concept.ui_ux.wireframes_ascii = (
                "┌─────────────────────────────────────────────────────────────┐\n"
                "│ [HP: ████████░░]   [WAVE 04: 12/25]        [💰 1,450] [⚙️]  │\n"
                "│                                                             │\n"
                "│                                                             │\n"
                "│                          [ ARENA ]                          │\n"
                "│                                                             │\n"
                "│                                             (⚡ DASH)       │\n"
                "│    ( 🕹️ JOYSTICK )                     (🛡️ PARRY) (⚔️ ATTACK)│\n"
                "└─────────────────────────────────────────────────────────────┘"
            )
            
        log_agent("UXDesigner", f"UI/UX configured with {len(concept.ui_ux.screens)} distinct screens and responsive mobile controls.")
