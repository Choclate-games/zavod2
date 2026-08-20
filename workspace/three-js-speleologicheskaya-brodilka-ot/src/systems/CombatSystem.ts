import * as THREE from "three";
import { Player } from "../entities/Player";
import { EnemyPool } from "../entities/EnemyPool";
import { CrystalCluster } from "../entities/CrystalCluster";
import { GameLoop } from "../core/GameLoop";
import { ParticleEffects } from "../rendering/ParticleEffects";
import { EventBus } from "../core/EventBus";
import { GAME_CONSTANTS } from "../utils/Constants";

export class CombatSystem {
  private eventBus: EventBus;
  private gameLoop: GameLoop;
  private fx: ParticleEffects;

  constructor(eventBus: EventBus, gameLoop: GameLoop, fx: ParticleEffects) {
    this.eventBus = eventBus;
    this.gameLoop = gameLoop;
    this.fx = fx;
  }

  public checkPlayerInteractions(
    player: Player,
    crystals: CrystalCluster[],
    stationPos: THREE.Vector3,
    exitPos: THREE.Vector3,
    floorIndex: number
  ): void {
    const playerPos = player.body.position;

    // 1. Crystal Collection on contact
    for (let i = 0; i < crystals.length; i++) {
      const c = crystals[i];
      if (c.isHarvested) continue;
      const d = playerPos.distanceTo(c.body.position);
      if (d <= player.body.radius + c.body.radius) {
        const yieldAmt = c.shatter(player.stats.resonanceFrequencyMatch);
        if (yieldAmt > 0) {
          this.fx.emitCrystalSparks(c.body.position, 0xbf55ec, 30);
          this.eventBus.emit("crystal:collected", {
            amount: yieldAmt,
            totalInRun: yieldAmt
          });
        }
      }
    }

    // 2. Seismic Station Activation
    const dStation = playerPos.distanceTo(stationPos);
    if (dStation <= 2.2) {
      this.eventBus.emit("station:activated", { floorIndex });
    }

    // 3. Exit Elevator Activation
    const dExit = playerPos.distanceTo(exitPos);
    if (dExit <= 2.2) {
      this.eventBus.emit("floor:completed", { floorIndex });
    }
  }

  public applyHitstop(): void {
    this.gameLoop.applyHitstop(GAME_CONSTANTS.HITSTOP_DURATION);
  }
}
