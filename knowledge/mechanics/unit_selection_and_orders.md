# Mechanic: Unit Selection & Order Queue

Name: Unit Selection & Order Queue
Category: Strategy / RTS
Description: Box selection resolved by a single view frustum, with combat-unit priority, modifier keys, double-click type-select, numbered control groups, and Shift-queued orders stored per unit.

Player interaction:
Player drags a box, refines with Shift/Ctrl, binds groups to number keys, and queues move/attack/gather orders. On touch: tap a unit, tap a group icon, or "select all on screen".

Feedback:
- Ground decal rings under selected units, brightening on selection.
- Order confirmation: a ping marker at the destination plus a unit voice line.
- Queued waypoints drawn as a dotted path while the group stays selected.

Strengths:
- These conventions are invisible when present and instantly disqualifying when absent.
- A single frustum test scales to hundreds of units where per-unit raycasts do not.

Weaknesses:
- Box selection does not translate to touch at all; the mobile path must be designed separately, not adapted.

Good combinations:
- Formation movement, flow-field pathing, control-group hotkeys.

Bad combinations:
- Single-hero control schemes, where selection is meaningless overhead.

Technical complexity:
Moderate. Frustum from screen rect, selection sets, per-unit order queue.
See `knowledge/threejs/rts_selection_and_command.md` §2-3.

Three.js suitability:
High (9/10).

Retention potential:
Moderate directly; it is a prerequisite for everything else in the genre.
