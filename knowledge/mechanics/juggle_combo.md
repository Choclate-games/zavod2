# Mechanic: Juggle Combo & Damage Scaling

Name: Juggle Combo
Category: Combat & Fighting
Description: A launcher sends the opponent airborne; follow-up hits keep them there while gravity accumulates. Each additional hit deals a decreasing share of its base damage (`scale = max(0.25, 1 - hits * 0.09)`), so a long combo is impressive but never lethal on its own.

Player interaction:
Player converts a confirmed hit into a launcher, then executes a memorised or improvised air sequence before the opponent falls out of range.

Feedback:
- Rising combo counter with escalating pitch.
- Hit-stop shortening as the combo extends, so the sequence accelerates.
- Camera drifting upward with the juggled fighter, keeping both in frame.
- Hard knockdown and dust burst on the finisher.

Strengths:
- The main expression outlet: two players with the same character look different.
- Rewards practice directly and visibly.

Weaknesses:
- Without damage scaling, one opening equals a full life bar and the match dies.
- Infinite loops must be broken by a gravity/hit-count limit; test this explicitly.

Good combinations:
- Frame-data combat, super meter (spend meter to extend), wall bounce.

Bad combinations:
- Crowd fights: a juggle on one enemy leaves the player open to four others.

Technical complexity:
Moderate. Per-hit gravity multiplier, hit counter, scaling table, combo reset on landing.

Three.js suitability:
High (9/10).

Retention potential:
Very high — combo discovery is self-sustaining content.
