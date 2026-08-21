# Pattern: Racing Event Loop

Pattern Name: Racing Event Loop
Primary Genre: Arcade Racing / Drift

Starting State:
Player on the starting grid of a closed circuit, 3-6 opponents, 3 laps, empty nitro, car tuned from the garage.

Player Action:
- Hit the racing line, brake to the apex, hold controllable slides through the corners.
- Bank drift chains, draft opponents in the slipstream, spend nitro on the straights.
- Recover cleanly after contact rather than restarting.

Challenge:
- Opponents driving through the same vehicle controller, with fair rubber-banding.
- Surface changes (gravel, puddles) that punish carrying too much speed.
- Damage or grip loss accumulating from wall contact within a race.

Reward:
- Position, lap times and sector splits versus the personal best.
- Currency from finishing position plus a drift-score bonus.
- Nitro earned by driving well, not by waiting.

Progression:
- Between races: garage upgrades (engine, tyres, suspension) and cosmetic paint.
- Meta: new circuits, reversed layouts, night and wet variants of known tracks.

Escalation:
- Event 3: a circuit with a gravel sector.
- Event 5: opponents whose pace matches the player's own best lap.
- Final: multi-lap endurance with tyre wear and one mandatory recovery.

Session Ending:
- Win: podium, reward breakdown, lap time submitted to the leaderboard.
- Defeat: retry from the grid, or a rewarded-ad restart from the final lap.

Replay Trigger:
- "Beat your own ghost" or "Clean-lap challenge: finish without touching a wall".
