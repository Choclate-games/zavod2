# Mechanic: Checkpoint & Lap Progression

Name: Checkpoint & Lap Progression
Category: Racing & Vehicles
Description: The track curve is sampled into ~40 ordered checkpoints. Passing them in sequence yields lap counting, race position, respawn points, wrong-way detection and shortcut prevention from one data structure.

Player interaction:
Player drives the circuit; progression is invisible when correct and only surfaces when something goes wrong (wrong way, off track, respawn).

Feedback:
- Sector split time flashing green/red against the personal best at each quarter.
- Lap counter increment with a chime; final lap announced distinctly.
- "WRONG WAY" arrow appearing within 1 second of reversing direction.
- Respawn: fade, reposition on the racing line, 1.5s of reduced grip so it is not a free reset.

Strengths:
- One structure replaces five bespoke systems.
- Makes shortcuts impossible without extra anti-cheat logic.

Weaknesses:
- Checkpoints spaced too far apart make respawn feel punishing; ~10 m is a good default.

Good combinations:
- Racing opponents, time attack, drift scoring, ghost replay.

Bad combinations:
- Open-world free roam, where forced ordering fights the design.

Technical complexity:
Low-moderate. Ordered proximity test plus a scalar race-position score.
See `knowledge/threejs/racing_track_and_opponents.md` §2.

Three.js suitability:
High (10/10).

Retention potential:
Moderate on its own; high with lap-time leaderboards.
