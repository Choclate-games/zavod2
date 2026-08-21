# Mechanic: Drift Scoring & Chain Multiplier

Name: Drift Scoring
Category: Racing & Vehicles
Description: A sustained slip angle between roughly 12° and 50° accumulates points proportional to speed and angle. Points bank when the car straightens cleanly; a spin, a wall hit or a full stop drops the pending chain.

Player interaction:
Player initiates with handbrake or a weight-transfer flick, then holds the slide on the throttle, linking one corner into the next without straightening in between.

Feedback:
- Score ticking up in real time with rising audio pitch.
- Tyre smoke density and skid-mark opacity tied to the same slip ratio that scores.
- Multiplier badge (x2, x3) with a shake when a link is registered.
- Distinct "banked" chime vs. a downward "lost" sweep — the two must never be confused.

Strengths:
- Turns pure driving into a scoring game with no extra systems.
- Risk/reward is legible: bank early and safe, or push for the multiplier.

Weaknesses:
- Meaningless unless the physics genuinely supports controllable slides.
- Scoring above ~50° rewards spinning in place; cap it.

Good combinations:
- Nitro charged by drifting, checkpoint racing, time attack.

Bad combinations:
- Simulation handling models where any slide loses time — the goals contradict.

Technical complexity:
Moderate. Slip ratio from the vehicle controller, not from throttle heuristics.
See `knowledge/threejs/arcade_racing_and_drift.md` §3.1.

Three.js suitability:
High (10/10) with Rapier's ray-cast vehicle controller.

Retention potential:
High. Score chasing plus leaderboards is the genre's whole retention loop.
