import { Nest } from './Nest';
import { Team } from './AntTypes';

export class EnemySwarmAI {
  private decisionTimer = 0;
  private readonly DECISION_INTERVAL = 2.0; // Evaluate strategy every 2 seconds

  public currentTargetX = 0;
  public currentTargetY = 0;
  public hasTarget = false;

  public update(
    dt: number,
    nests: Nest[],
    playerSwarmCenter: { x: number; y: number; count: number }
  ): void {
    this.decisionTimer += dt;
    if (this.decisionTimer < this.DECISION_INTERVAL) return;
    this.decisionTimer = 0;

    // Find enemy nests
    const enemyNests = nests.filter((n) => n.team === Team.ENEMY);
    if (enemyNests.length === 0) {
      this.hasTarget = false;
      return;
    }

    // Pick primary strategic target:
    // 1. Look for uncaptured neutral nests closest to any enemy nest
    const neutralNests = nests.filter((n) => n.team === Team.NEUTRAL);
    const playerNests = nests.filter((n) => n.team === Team.PLAYER);

    let chosenTarget: { x: number; y: number } | null = null;

    if (neutralNests.length > 0 && Math.random() < 0.6) {
      // Find closest neutral nest to enemy HQ
      let minDist = Infinity;
      for (const nNest of neutralNests) {
        for (const eNest of enemyNests) {
          const d = Math.hypot(nNest.x - eNest.x, nNest.y - eNest.y);
          if (d < minDist) {
            minDist = d;
            chosenTarget = { x: nNest.x, y: nNest.y };
          }
        }
      }
    } else if (playerNests.length > 0) {
      // Attack player nest (prioritize lowest garrison/non-HQ first, or HQ if nearby)
      playerNests.sort((a, b) => a.garrison - b.garrison);
      chosenTarget = { x: playerNests[0].x, y: playerNests[0].y };
    } else if (playerSwarmCenter.count > 0) {
      // Counter-swarm player group
      chosenTarget = { x: playerSwarmCenter.x, y: playerSwarmCenter.y };
    }

    if (chosenTarget) {
      this.currentTargetX = chosenTarget.x;
      this.currentTargetY = chosenTarget.y;
      this.hasTarget = true;
    } else {
      this.hasTarget = false;
    }
  }
}
