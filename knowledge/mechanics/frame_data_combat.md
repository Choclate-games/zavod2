# Mechanic: Frame-Data Combat (Startup / Active / Recovery)

Name: Frame-Data Combat
Category: Combat & Fighting
Description: Every attack is defined by four integers measured in 60Hz logic frames — startup, active, recovery and the stun it inflicts. Whether a move is "safe" or "punishable" is derived arithmetically (`frameAdvantage = blockstun - (activeLeft + recovery)`), not tuned by feel.

Player interaction:
Player learns that a light attack hits on frame 4 and a heavy on frame 14, and chooses moves by the space and time available. Mastery is knowing which of the opponent's moves can be punished after a block.

Two numbers the table must also carry, or the fight stalls:
- `advance` — metres the fighter steps forward during startup. A punch thrown from a standstill only reaches someone already pressed against you, and neutral degenerates into two fighters staring at each other just out of range.
- `reach = hitbox.x + hitbox.w/2 + victimHalfWidth + advance` — the only honest spacing number, and the one the AI must use. Hard-coding the bot's neutral distance produced a demo where frame data was correct, no exception was thrown, and nothing happened for 90 seconds.

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

Height levels and the air (what turns a rail into a game):
- Each move is `low` / `mid` / `high`. Crouch beats high, jump beats low, and only moves flagged `hitsAir` (the anti-air) touch an airborne opponent.
- A jump is three states — jumpsquat (telegraph), air, landing (punish window) — never one. No blocking in the air, exactly one attack per jump, and being hit airborne means landing as a knockdown.
- Crossing over the opponent (cross-up) requires disabling collision **both** in the physics capsule and in the logical pushbox; `facing` recalculates only on the ground.
- After getting up there must be a window where the fighter cannot be knocked down again, or sweeps and jump kicks loop the floor forever.

Zones and defence (what turns two buttons into a game):
- Every move targets `head` or `body`. Crouch and slip make head moves whiff outright — recovery frames stay, so a dodge is a read, not a free button. Body shots cannot be slipped, only blocked.
- Stamina is a second resource: it scales damage (never below ~55 %) and visibly drops the guard, but never takes controls away. Blocking spends it (`guardDamage`); at zero the guard breaks into a long stun — the answer to "blocking everything is optimal".

Good combinations:
- Timing-based parry, juggle combos, super meter, wake-up invulnerability.
- Physics-driven ragdoll **on knockdown only**: the strike stays deterministic, the fall goes to the solver.

Bad combinations:
- Physics-driven ragdoll strikes where contact time is emergent and unpredictable — a fist that connects "whenever the solver says so" cannot have frame data at all.

Technical complexity:
Moderate-high. Fixed 60Hz accumulator, per-move state machine, AABB hit/hurt/push boxes.
See `knowledge/threejs/fighting_game_core.md` (implementation, physics boundary, live-match check) and `knowledge/threejs/procedural_character_rig.md` (deriving the punch animation from the same table).

Three.js suitability:
High (9/10) — 2.5D camera on a fixed plane, boxes rather than mesh collision.

Retention potential:
Very high for skill-oriented players; the depth is what brings them back.
