# Mechanic: Special Move Input (Motion + Button Parity)

Name: Special Move Input
Category: Combat & Fighting / Controls
Description: Signature attacks are triggered either by a motion sequence (down, down-forward, forward + attack) on keyboard/gamepad, or by a dedicated button on touch. Both paths produce the identical move — the input method never changes what is available.

Player interaction:
Desktop players buffer a motion within a 12-frame window; mobile players tap one of 2-3 special buttons. A 6-frame input buffer lets the command be entered slightly before the current move recovers.

Feedback:
- Charge flash on the fighter the moment the motion is recognised, before the move starts.
- Distinct voice line and screen-wide flash on the super version.
- The special button dims while the move is unavailable (meter cost not met), never disappearing.

Strengths:
- Preserves the genre's texture on desktop without excluding phone players.
- The input buffer is what makes combos physically possible on a touchscreen.

Weaknesses:
- Motion inputs are undiscoverable without an in-game move list.
- Too many special buttons crowd a phone screen; 3 is the practical ceiling.

Good combinations:
- Frame-data combat, super meter, juggle combos.

Bad combinations:
- Games that also need a virtual joystick for free 3D movement — the thumb cannot do both.

Technical complexity:
Low-moderate. Ring buffer of directional inputs with per-entry frame stamps.

Three.js suitability:
High (9/10) — input layer, renderer-independent.

Retention potential:
High. Executing a special reliably is the first mastery milestone players feel.
