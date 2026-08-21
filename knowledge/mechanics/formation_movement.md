# Mechanic: Formation Movement

Name: Formation Movement
Category: Strategy / RTS
Description: A move order for N units expands into N grid slots around the destination, oriented along the travel direction, assigned greedily by proximity. In formation mode the group moves at its slowest member's speed.

Player interaction:
Player right-clicks a destination; the squad arrives as a block facing the direction of travel rather than as a shivering pile on one point.

Feedback:
- Ghost markers at each assigned slot for ~1 second after the order.
- Units rotating to a common facing on arrival.
- Formation shape preview while dragging the order (drag-to-face).

Strengths:
- Removes the single worst visual defect of amateur RTS games.
- Proximity assignment prevents units crossing each other's paths en route.

Weaknesses:
- Slowest-member pacing frustrates players unless they can toggle it off.
- Needs terrain validation: slots on cliffs or water must fall back to the nearest walkable point.

Good combinations:
- Flow-field movement, unit selection, cover/stance systems.

Bad combinations:
- Swarm-style hordes, where a formation reads as unnatural.

Technical complexity:
Moderate. Slot generation, greedy assignment, navmesh snapping per slot.
See `knowledge/threejs/rts_selection_and_command.md` §4.

Three.js suitability:
High (9/10).

Retention potential:
Moderate. Contributes to competence, which is what keeps strategy players.
