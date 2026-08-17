# Mechanic: Directional Dash & Evasion

Name: Directional Dash & Evasion
Category: Movement & Defense
Description: High-velocity instantaneous displacement along the input movement vector accompanied by invulnerability frames (i-frames) and trail particle rendering.

Player interaction:
Activated via tap on dedicated dash button or double-tap on virtual joystick / keyboard Space key. Consumes stamina or triggers a short cooldown (e.g. 1.2 seconds).

Feedback:
- Ghost trail mesh after-images with additive blending.
- Speed lines and dynamic camera FOV surge (+4 degrees during dash).
- Whoosh audio with high-pass filter cutoff sweep.

Strengths:
- Essential tactical positioning tool.
- Gives player agency to evade overwhelming attacks.

Weaknesses:
- Spamming can trivialize enemy threats if cooldown/stamina is not properly constrained.

Good combinations:
- Parry & Counter.
- Hazard dodging (spikes, rotating blades).
- Upgrade cards (e.g. "Dash leaves a trail of fire/spikes").

Bad combinations:
- Slow turn-based tactics.

Technical complexity:
Low to Moderate. Linear velocity impulse with collision layer filtering and timer cooldown.

Three.js suitability:
High (10/10).

PixiJS suitability:
High (10/10).

Retention potential:
High. Core fluidity driver in action games.
