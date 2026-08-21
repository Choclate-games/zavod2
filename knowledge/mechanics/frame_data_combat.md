# Mechanic: Frame-Data Combat (Startup / Active / Recovery)

Name: Frame-Data Combat
Category: Combat & Fighting
Description: Every attack is defined by four integers measured in 60Hz logic frames — startup, active, recovery and the stun it inflicts. Whether a move is "safe" or "punishable" is derived arithmetically (`frameAdvantage = blockstun - (activeLeft + recovery)`), not tuned by feel.

Player interaction:
Player learns that a light attack hits on frame 4 and a heavy on frame 14, and chooses moves by the space and time available. Mastery is knowing which of the opponent's moves can be punished after a block.

Feedback:
- Hit-stop freezing both fighters 4-10 frames on contact — the single largest source of impact weight.
- Distinct block spark (dull, grey) vs. hit spark (bright, coloured).
- Damage numbers or health-bar chunk with a delayed "ghost" bar showing what was just lost.
- Debug hitbox overlay behind a flag — a fighting game without it cannot be balanced.

Strengths:
- Makes the game learnable and discussable: players talk in frames.
- Balance becomes data, not opinion — one YAML table drives every number.
- Deterministic: replays and headless bot-vs-bot balance runs are possible.

Weaknesses:
- Requires a fixed logic tick decoupled from render FPS; retrofitting it later is a rewrite.
- Unreadable without visual telegraphs per move.

Good combinations:
- Timing-based parry, juggle combos, super meter, wake-up invulnerability.

Bad combinations:
- Physics-driven ragdoll strikes where contact time is emergent and unpredictable.

Technical complexity:
Moderate-high. Fixed 60Hz accumulator, per-move state machine, AABB hit/hurt/push boxes.
See `knowledge/threejs/fighting_game_core.md`.

Three.js suitability:
High (9/10) — 2.5D camera on a fixed plane, boxes rather than mesh collision.

Retention potential:
Very high for skill-oriented players; the depth is what brings them back.
