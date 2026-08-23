/**
 * SessionLifecycleAndScoringSystem: Controls session timing, win/loss evaluation, scoring, and tips.
 */

import { BALANCE } from '../config/BalanceConfig';
import { EventBus } from '../core/EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { StorageService } from '../platform/StorageService';

export class SessionLifecycleAndScoringSystem {
  private eventBus: EventBus = EventBus.get();
  private physicsWorld: PhysicsWorld = PhysicsWorld.get();
  private storage: StorageService = StorageService.get();

  public evaluateRunEnd(isRunComplete: boolean, currentLevel: number): { isOver: boolean; isWin: boolean } {
    const preserved = this.physicsWorld.getPreservedCount();

    if (isRunComplete) {
      const isWin = preserved.percent >= BALANCE.session.winMinPreservedPercent;
      if (isWin) {
        const baseTips = 100 * currentLevel;
        const preservationBonus = Math.round((preserved.percent / 100) * 50 * currentLevel);
        const totalTips = baseTips + preservationBonus;

        this.storage.recordVictory(totalTips, currentLevel);
        this.eventBus.emit('RUN_COMPLETED', {
          preservedPercent: preserved.percent,
          tipsEarned: totalTips,
          itemsSaved: preserved.saved,
          totalItems: preserved.total
        });
        this.eventBus.emit('PLAY_SOUND', 'victory');
      }
      return { isOver: true, isWin };
    }

    return { isOver: false, isWin: false };
  }

  public triggerCrash(reason: string): void {
    const preserved = this.physicsWorld.getPreservedCount();
    this.eventBus.emit('PLAY_SOUND', 'crash');
    this.eventBus.emit('CRASH_OCCURRED', {
      reason,
      preservedPercent: preserved.percent
    });
  }
}
