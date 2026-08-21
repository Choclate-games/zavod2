# Mechanic: Fair Rubber-Banding

Name: Fair Rubber-Banding
Category: Racing & Vehicles / AI
Description: Opponent difficulty adapts to the gap by shifting driving parameters — max speed within -8%/+12%, cornering aggression, overtake willingness — never by teleporting or exceeding the player's own best lap.

Player interaction:
Invisible when working. The player experiences a race that stays close without noticing why.

Feedback:
- Visible catch-up devices are preferred to invisible ones: slipstream cones, a boost pad only the trailing car can reach.
- The leaderboard sidebar showing the gap in seconds so tension is legible.

Strengths:
- Keeps a 3-minute race tense from start to finish.
- Prevents both "unreachable AI" and "walked it from lap 1" failure states.

Weaknesses:
- Beyond ±12% the player detects the assistance and the win stops meaning anything.
- Must never let a trailing bot beat the player's best lap of the session.

Good combinations:
- Checkpoint racing, slipstream, nitro economy.

Bad combinations:
- Time attack and ghost modes, where the reference must be absolutely fixed.

Technical complexity:
Low. Gap in checkpoints -> clamped multipliers on AI parameters.
See `knowledge/threejs/racing_track_and_opponents.md` §4.

Three.js suitability:
High (10/10) — pure AI parameters.

Retention potential:
High indirectly: close races are what players replay.
