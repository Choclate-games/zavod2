# Pattern: Fighting Match Loop

Pattern Name: Fighting Match Loop
Primary Genre: Fighting / Versus Combat

Starting State:
Two fighters at neutral, full health, empty super meter, round 1 of 3, on a fixed-width arena with walls.

Player Action:
- Control spacing in neutral: walk, dash, whiff-punish at the edge of the opponent's reach.
- Convert a confirmed hit into a combo; spend meter to extend or to escape.
- Block and punish unsafe moves using known frame advantage.

Challenge:
- Opponent AI with a difficulty-scaled reaction delay and scheduled mistakes.
- Health only recovers between rounds; a single dropped combo swings the round.
- Cornered fighters take longer combos — position is a resource.

Reward:
- Round win with a slow-motion final blow and a crowd reaction.
- Meter carrying over between rounds.
- Match victory unlocking the next opponent on the ladder.

Progression:
- Between matches: choose one of three modifiers (armour on heavy attacks, faster meter gain, extra dash).
- Meta: unlock fighters, alternate palettes, and a move list that fills in as moves are used.

Escalation:
- Match 3: opponent punishes unsafe moves reliably.
- Match 5: opponent with an armoured special that beats predictable pressure.
- Final: two-phase champion that changes its neutral behaviour at low health.

Session Ending:
- Win: ladder complete, champion screen, best-combo statistic submitted to the leaderboard.
- Defeat: rewarded-ad rematch offer (once per ladder), otherwise a summary showing the longest combo and the punish rate.

Replay Trigger:
- "Try another fighter" or "Beat this ladder without losing a round".
