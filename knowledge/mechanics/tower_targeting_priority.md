# Mechanic: Tower Targeting Priority

Name: Tower Targeting Priority
Category: Tower Defense / Strategy
Description: Each tower exposes a target-selection rule — first (closest to base), last, strongest, weakest, closest — with hysteresis so it keeps its current target while that target lives and stays in range.

Player interaction:
Player sets the priority per tower (or per tower type) and re-tunes it as wave composition changes; sniper towers on "strongest", splash towers on "first".

Feedback:
- Range circle drawn on the ground for the selected tower only.
- A thin tracer line to the current target while a tower is engaging.
- Priority icon on the tower's info card and, at high zoom, above the tower.

Strengths:
- Converts passive tower placement into ongoing decisions.
- Fixes the "towers twitch between targets and kill nothing" defect by construction.

Weaknesses:
- Needs clear UI or players never discover it; default to "first" so it works untouched.

Good combinations:
- Wave composition changes, armour types, slow/support towers.

Bad combinations:
- Games with one enemy type — the choice has no meaning.

Technical complexity:
Low-moderate. Scored selection over a spatial grid, re-evaluated at 10Hz.
See `knowledge/threejs/tower_defense_core.md` §2.

Three.js suitability:
High (10/10).

Retention potential:
High — mastery lives in priority tuning, not placement.
