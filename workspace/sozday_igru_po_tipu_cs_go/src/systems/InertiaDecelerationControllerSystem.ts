import * as THREE from 'three';

export interface MovementInput {
  moveX: number; // -1 (left / A) to +1 (right / D)
  moveZ: number; // -1 (forward / W) to +1 (backward / S)
  isWalking: boolean; // Shift
}

export class InertiaDecelerationControllerSystem {
  public static readonly V_MAX = 6.2; // Maximum strafe speed (m/s)
  public static readonly V_ACCURACY_THRESHOLD = 0.35; // Accuracy zero speed threshold (m/s)
  public static readonly T_COUNTER_STOP = 0.08; // Active counter-strafe stop time (s)
  public static readonly T_PERFECT_WINDOW = 0.22; // Perfect shot window (s)
  public static readonly A_BASE = 18.0; // Base friction deceleration (m/s^2)
  public static readonly A_COUNTER = 54.0; // Counter-opposed braking deceleration (m/s^2)
  public static readonly WALK_SPEED = 2.8; // Silent walk speed (m/s)

  public currentVelocity: THREE.Vector3 = new THREE.Vector3();
  public isCounterStrafing = false;
  public perfectStopTimer = 0;
  public currentSpread = 0.05;

  public update(currentVel: THREE.Vector3, input: MovementInput, yaw: number, dt: number): {
    newVelocity: THREE.Vector3;
    speed: number;
    isAccurate: boolean;
    spread: number;
  } {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const targetSpeed = input.isWalking ? InertiaDecelerationControllerSystem.WALK_SPEED : InertiaDecelerationControllerSystem.V_MAX;
    const wishDir = new THREE.Vector3()
      .addScaledVector(right, input.moveX)
      .addScaledVector(forward, -input.moveZ);

    if (wishDir.lengthSq() > 0.001) {
      wishDir.normalize();
    }

    const currentSpeed = currentVel.length();
    let nextVel = currentVel.clone();

    if (wishDir.lengthSq() > 0.001) {
      // Player is giving directional input
      const accel = 36.0;
      const targetVel = wishDir.clone().multiplyScalar(targetSpeed);
      
      // Check if counter-strafing (input is opposed to current velocity)
      const dot = currentVel.dot(wishDir);
      if (dot < -0.1 && currentSpeed > 0.5) {
        this.isCounterStrafing = true;
        // Supercharged counter-braking: V(t) = max(0, V_current - (a_base + a_counter * input_opposed) * dt)
        const brakeSpeed = Math.max(0, currentSpeed - (InertiaDecelerationControllerSystem.A_BASE + InertiaDecelerationControllerSystem.A_COUNTER) * dt);
        if (brakeSpeed <= 0.01) {
          nextVel.set(0, 0, 0);
        } else {
          nextVel.normalize().multiplyScalar(brakeSpeed);
        }
      } else {
        this.isCounterStrafing = false;
        nextVel.lerp(targetVel, Math.min(1.0, accel * dt));
      }
    } else {
      // Passive deceleration or coasting
      this.isCounterStrafing = false;
      const decel = InertiaDecelerationControllerSystem.A_BASE * dt;
      const newSpeed = Math.max(0, currentSpeed - decel);
      if (newSpeed <= 0.01) {
        nextVel.set(0, 0, 0);
      } else {
        nextVel.normalize().multiplyScalar(newSpeed);
      }
    }

    const finalSpeed = nextVel.length();
    const isAccurate = finalSpeed <= InertiaDecelerationControllerSystem.V_ACCURACY_THRESHOLD;

    if (isAccurate && currentSpeed > InertiaDecelerationControllerSystem.V_ACCURACY_THRESHOLD) {
      this.perfectStopTimer = InertiaDecelerationControllerSystem.T_PERFECT_WINDOW;
    } else if (this.perfectStopTimer > 0) {
      this.perfectStopTimer -= dt;
    }

    // Spread formula: Base_Spread + (V_player / V_max)^1.8 * Max_Move_Spread
    const speedRatio = Math.min(1.0, finalSpeed / InertiaDecelerationControllerSystem.V_MAX);
    this.currentSpread = 0.05 + Math.pow(speedRatio, 1.8) * 14.5;

    this.currentVelocity.copy(nextVel);

    return {
      newVelocity: nextVel,
      speed: finalSpeed,
      isAccurate,
      spread: this.currentSpread
    };
  }
}