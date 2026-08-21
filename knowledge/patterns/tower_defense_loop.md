# Pattern: Tower Defense Loop

Pattern Name: Tower Defense Loop
Primary Genre: Tower Defense / Base Protection

Starting State:
Player holds starting gold, an empty build grid, 20 lives, and a preview of wave 1 on a fixed path or an open maze field.

Player Action:
- Build and upgrade towers in the 8-15 second gap between waves.
- Set targeting priorities per tower as wave composition shifts.
- Call the next wave early for a gold bonus.

Challenge:
- Budget growing as `100 * n^1.35`; every fifth wave introduces a new threat type.
- Air, armoured, fast, healing and splitting enemies each invalidating one comfortable answer.
- Leaks cost lives, not the run — pressure without instant failure.

Reward:
- Gold per kill plus a no-leak wave bonus.
- Upgrade tiers that visibly change a tower's silhouette and firing sound.
- Boss kills dropping a one-off ability charge.

Progression:
- Within a run: tower tiers and a small set of active abilities on cooldown.
- Meta: unlock tower types, permanent modifiers, and harder map variants.

Escalation:
- Wave 5: air units, invalidating ground-only towers.
- Wave 10: armoured column requiring pierce or splash.
- Wave 15: boss with a slow-immunity aura that changes the rules rather than the numbers.

Session Ending:
- Win: all waves survived, star rating from remaining lives, leaderboard submit.
- Defeat: lives exhausted, run summary of leak sources, rewarded-ad continue with 5 lives (once).

Replay Trigger:
- "No-leak run" or "Beat it using only two tower types".
