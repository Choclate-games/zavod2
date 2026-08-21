# Mechanic: Wave Contract & Early Call

Name: Wave Contract & Early Call
Category: Tower Defense / Survival
Description: Every wave is declared as data — budget, composition weights, spawn interval, early-call bonus — with a non-linear budget curve (`100 * n^1.35`) and a mandatory threat-type change every fifth wave.

Player interaction:
During the 8-15 second gap the player builds, upgrades and repositions. Pressing "call early" starts the wave immediately for a gold bonus proportional to the time saved.

Feedback:
- Wave preview showing enemy silhouettes and counts before it starts.
- Countdown ring around the call button; the bonus number shrinking as time passes.
- Distinct fanfare for a new threat type (air, armoured, healer) with a one-line explanation the first time.

Strengths:
- The between-wave gap is the actual gameplay; the early call converts patience into risk.
- Data-declared waves are reproducible and headlessly testable.

Weaknesses:
- Purely scaling waves ("same but tougher") flatten the middle third of the run.
- Random composition makes balance unreproducible; keep it seeded.

Good combinations:
- Tower targeting priority, kill-based economy, boss rule-changers.

Bad combinations:
- Continuous-spawn survivor games, where there is no gap to build in.

Technical complexity:
Low. YAML/JSON wave table plus a spawner reading it.
See `knowledge/threejs/tower_defense_core.md` §4.

Three.js suitability:
High (10/10).

Retention potential:
High. "One more wave" is the genre's core hook.
