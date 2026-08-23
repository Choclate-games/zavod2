/**
 * CompoundStackRagdollSolverSystem: Evaluates stability of compound inverted pendulum.
 * Monitors tilt angles, sloshing dynamics, emergency grip cooldowns, and fall thresholds.
 */

import { BALANCE } from '../config/BalanceConfig';
import { EventBus } from '../core/EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class CompoundStackRagdollSolverSystem {
  private eventBus: EventBus = EventBus.get();
  private physicsWorld: PhysicsWorld = PhysicsWorld.get();
  private lastSloshEmit: number = 0;

  public update(_dt: number): void {
    const maxTilt = this.physicsWorld.getMaxTiltAngleDeg();
    const isCritical = maxTilt > 22;

    this.eventBus.emit('TILT_CHANGED', {
      angleDeg: Math.round(maxTilt * 10) / 10,
      isCritical
    });

    const courier = this.physicsWorld.getCourierState();
    this.eventBus.emit('GRIP_COOLDOWN_CHANGED', {
      normalized: courier.gripCooldown01,
      ready: courier.gripCooldownSec <= 0
    });

    const slosh = this.physicsWorld.getSloshDisplacement();
    if (Math.abs(slosh - this.lastSloshEmit) > 0.05) {
      this.lastSloshEmit = slosh;
      this.eventBus.emit('SLOSH_CHANGED', { displacement: slosh });
    }
  }

  public checkFailureCondition(): { failed: boolean; reason: string } {
    // 1. Critical Fragile Item dropped (TV or Aquarium hit floor)
    if (this.physicsWorld.isCriticalFragileItemDropped()) {
      return {
        failed: true,
        reason: 'Разбит критический хрупкий груз (аквариум / телевизор)!'
      };
    }

    // 2. Critical tilt > 38 degrees with >50% destroyed
    const maxTilt = this.physicsWorld.getMaxTiltAngleDeg();
    const preserved = this.physicsWorld.getPreservedCount();

    if (maxTilt >= BALANCE.session.loseCriticalTiltAngleDeg && preserved.percent < BALANCE.session.loseVolumeDestructionPercent) {
      return {
        failed: true,
        reason: 'Превышен предельный угол крена 38° с обрушением стопки!'
      };
    }

    if (preserved.percent < 35) {
      return {
        failed: true,
        reason: 'Утеряно больше половины объема груза!'
      };
    }

    return { failed: false, reason: '' };
  }
}
