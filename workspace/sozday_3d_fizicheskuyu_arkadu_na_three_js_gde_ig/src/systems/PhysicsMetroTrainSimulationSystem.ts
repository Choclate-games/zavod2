/**
 * PhysicsMetroTrainSimulationSystem: Coordinates kinematic train motion with physics solver.
 * Emits telemetry to EventBus and triggers visual sparks / audio cues on track curves.
 */

import { EventBus } from '../core/EventBus';
import { MetroKinematics, MetroKinematicsState } from '../physics/MetroKinematics';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class PhysicsMetroTrainSimulationSystem {
  private kinematics: MetroKinematics = new MetroKinematics();
  private eventBus: EventBus = EventBus.get();
  private physicsWorld: PhysicsWorld = PhysicsWorld.get();
  private wasCurving: boolean = false;

  public reset(durationSec?: number): void {
    this.kinematics.reset(durationSec);
    this.wasCurving = false;
  }

  public update(dt: number): MetroKinematicsState {
    const state = this.kinematics.update(dt);

    // Step physics world with train inertial forces
    this.physicsWorld.step(dt, state);

    // Emit speed changes
    this.eventBus.emit('SPEED_CHANGED', state.speedKmH);

    // Emit progress
    this.eventBus.emit('PROGRESS_CHANGED', {
      progress01: state.progress01,
      distanceM: state.stationDistanceMeters,
      timeLeftSec: Math.max(0, Math.round(state.totalDurationSec - state.timeSec))
    });

    // Detect entering curve for sparks VFX & sound
    if (state.isCurving && !this.wasCurving) {
      this.eventBus.emit('PLAY_SOUND', 'screech');
      const sideX = state.curveDirection > 0 ? -1.0 : 1.0;
      this.eventBus.emit('TRIGGER_VFX', { type: 'sparks', x: sideX, y: 0.2, z: -1.5 });
    }
    this.wasCurving = state.isCurving;

    return state;
  }

  public getKinematics(): MetroKinematics {
    return this.kinematics;
  }
}
