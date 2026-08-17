# Mechanic: Timing-based Parry & Counter

Name: Timing-based Parry & Counter
Category: Combat & Defense
Description: A precision defensive input with a tight activation window (e.g. 150-250ms). If struck during this window, incoming damage is negated, the attacker is staggered with physical recoil, and a counter-attack bonus window opens.

Player interaction:
Player presses block/parry button just as the enemy attack flash / tell occurs. On mobile, a dedicated shield/parry button with generous input buffering (80ms).

Feedback:
- Radial flash / lens flare shockwave at collision point.
- Metallic clang SFX with reverberation decay.
- 60ms game hitstop (dilation to 0.1x speed).
- Enemy posture bar breaks or enemy enters ragdoll stagger.

Strengths:
- Deep satisfaction and mastery feeling.
- Dramatic reversals of combat flow.

Weaknesses:
- Can be frustrating on laggy screens or if timing window is too punishing.

Good combinations:
- Ragdoll combat (parrying sends opponent flying).
- Crowd Favor meter (crowd cheers wildly on successful parry).

Bad combinations:
- Bullet hell swarms where hundreds of projectiles hit continuously.

Technical complexity:
Moderate. State machine with active/recovery frames and hitbox intersection checking.

Three.js suitability:
High (9/10).

PixiJS suitability:
High (8/10).

Retention potential:
Very High. Core retention driver for skill-oriented players.
