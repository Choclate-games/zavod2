# Mechanic: Cover & Suppression

Name: Cover & Suppression
Category: Shooter / Tactics
Description: Pre-authored cover points carry a position, a facing normal, a height class and an occupancy slot. AI scores them against the current threat direction; sustained fire on a covered target suppresses it — accuracy and willingness to peek drop instead of health.

Player interaction:
Player flanks to invalidate the enemy's cover normal, or lays suppressing fire while a teammate/objective advances.

Feedback:
- Dust and chips bursting off the cover surface under fire.
- Suppressed enemies ducking, shouting, and firing blind over cover.
- Screen-edge vignette and increased weapon sway when the player is suppressed.

Strengths:
- Turns a firefight into a positional problem rather than a damage race.
- Occupancy slots stop two enemies sharing one rock — the classic engine-bug look.

Weaknesses:
- Runtime cover search by raycast is too expensive; the points must be authored or baked.
- Without visible suppression feedback players read it as random AI accuracy.

Good combinations:
- Squad AI with attack tokens, flanking behaviours, destructible cover.

Bad combinations:
- Horde shooters and bullet-hell, where standing still is fatal by design.

Technical complexity:
Moderate. Baked cover graph, scoring function, suppression accumulator per agent.
See `knowledge/threejs/shooter_enemy_ai_and_combat.md` §4.

Three.js suitability:
High (8/10).

Retention potential:
Moderate-high. Readable AI is what makes combat worth repeating.
