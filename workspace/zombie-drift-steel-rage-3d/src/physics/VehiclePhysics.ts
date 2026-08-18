import * as THREE from 'three';
import { VehicleControls, VehiclePhysicsState } from '../types/vehicle';
import { gameStore } from '../core/Store';
import { ARENA_HALF } from '../core/Constants';
import { eventBus } from '../core/EventBus';

export class VehiclePhysics {
  public position = new THREE.Vector3(0, 0.4, 0);
  public velocity = new THREE.Vector3(0, 0, 0);
  public headingAngle = 0; // Yaw angle in radians (0 = pointing towards -Z or +X)
  public steeringAngle = 0; // Front wheels visual steer angle
  public speed = 0; // Forward speed (positive or negative)

  // Visual chassis tilt
  public roll = 0;
  public pitch = 0;

  // Drift and Nitro State
  public isDrifting = false;
  public driftAngle = 0; // Radians between heading and velocity
  public driftMultiplier = 1.0;
  public isNitroActive = false;
  public driftDuration = 0;

  private lateralVelocity = 0;
  private angularVelocity = 0;

  public reset(startX = 0, startZ = 0, heading = 0): void {
    this.position.set(startX, 0.4, startZ);
    this.velocity.set(0, 0, 0);
    this.headingAngle = heading;
    this.steeringAngle = 0;
    this.speed = 0;
    this.roll = 0;
    this.pitch = 0;
    this.isDrifting = false;
    this.driftAngle = 0;
    this.driftMultiplier = 1.0;
    this.isNitroActive = false;
    this.driftDuration = 0;
    this.lateralVelocity = 0;
    this.angularVelocity = 0;
  }

  public update(dt: number, controls: VehicleControls): VehiclePhysicsState {
    const stats = gameStore.getEffectiveVehicleStats();

    // Handle Nitro
    if (controls.nitro && gameStore.run.nitro > 0.05) {
      this.isNitroActive = true;
      gameStore.run.nitro = Math.max(0, gameStore.run.nitro - dt / stats.nitroDuration);
    } else {
      this.isNitroActive = false;
      // Refill nitro slowly over time or faster when drifting
      const refillBonus = this.isDrifting ? 2.5 : 1.0;
      gameStore.run.nitro = Math.min(1.0, gameStore.run.nitro + dt * stats.nitroRefillRate * 0.15 * refillBonus);
    }

    gameStore.run.isNitroActive = this.isNitroActive;

    // Nitro multipliers
    const nitroSpeedBoost = this.isNitroActive ? 1.55 : 1.0;
    const nitroAccelBoost = this.isNitroActive ? 2.0 : 1.0;

    const maxSpeed = stats.topSpeed * nitroSpeedBoost;
    const accel = stats.acceleration * nitroAccelBoost;
    const handling = stats.handling;
    const baseGrip = stats.driftGrip;

    // Steering input smoothing
    const targetSteerAngle = controls.steering * 0.58; // Max ~33 degrees
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteerAngle, dt * 14);

    // Forward/Backward Acceleration & Braking
    // Правый борт машины = forward × up. Для forward = (sin h, 0, cos h) это
    // (-cos h, 0, sin h): раньше здесь стоял вектор с обратным знаком, то есть
    // «правым» считался левый борт — от этого путались крены и снос.
    const forwardDir = new THREE.Vector3(Math.sin(this.headingAngle), 0, Math.cos(this.headingAngle));
    const rightDir = new THREE.Vector3(-Math.cos(this.headingAngle), 0, Math.sin(this.headingAngle));

    // Decompose current velocity into forward and lateral components
    let forwardSpeed = this.velocity.dot(forwardDir);
    this.lateralVelocity = this.velocity.dot(rightDir);

    if (controls.throttle > 0) {
      forwardSpeed += controls.throttle * accel * dt;
      if (forwardSpeed > maxSpeed) forwardSpeed = maxSpeed;
    } else if (controls.throttle < 0) {
      if (forwardSpeed > 2.0) {
        // Braking
        forwardSpeed -= 55 * dt;
      } else {
        // Reverse
        forwardSpeed += controls.throttle * (accel * 0.45) * dt;
        if (forwardSpeed < -maxSpeed * 0.4) forwardSpeed = -maxSpeed * 0.4;
      }
    } else {
      // Rolling drag / friction
      forwardSpeed = THREE.MathUtils.damp(forwardSpeed, 0, 1.8, dt);
    }

    // Handbrake or hard cornering drift condition
    const isHandbrake = controls.handbrake;
    const speedRatio = Math.abs(forwardSpeed) / stats.topSpeed;
    const isHardTurning = Math.abs(controls.steering) > 0.6 && speedRatio > 0.45;

    let lateralGrip = baseGrip;
    if (isHandbrake) {
      lateralGrip = 0.55; // High slide
    } else if (isHardTurning) {
      lateralGrip = 0.72; // Moderate drift slide
    }

    // Apply lateral friction
    this.lateralVelocity = THREE.MathUtils.damp(this.lateralVelocity, 0, (1.0 - lateralGrip) * 45 + 5, dt);

    // Turn rate depends on forward speed and steering
    if (Math.abs(forwardSpeed) > 0.5) {
      // steering > 0 — руль вправо. Поворот вправо при forward = (sin h, 0, cos h)
      // означает УМЕНЬШЕНИЕ heading: без минуса управление было зеркальным.
      const turnFactor = Math.sign(forwardSpeed) * handling * (isHandbrake ? 1.45 : 1.0);
      const turnSpeed = -this.steeringAngle * turnFactor * (0.8 + speedRatio * 0.5);
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, turnSpeed, dt * 12);
    } else {
      this.angularVelocity = THREE.MathUtils.damp(this.angularVelocity, 0, 10, dt);
    }

    this.headingAngle += this.angularVelocity * dt;

    // Recalculate full velocity vector
    const newForwardDir = new THREE.Vector3(Math.sin(this.headingAngle), 0, Math.cos(this.headingAngle));
    const newRightDir = new THREE.Vector3(-Math.cos(this.headingAngle), 0, Math.sin(this.headingAngle));

    this.velocity.copy(newForwardDir).multiplyScalar(forwardSpeed).addScaledVector(newRightDir, this.lateralVelocity);
    this.speed = this.velocity.length();

    // Calculate Drift Angle & Drift Multiplier
    if (this.speed > 4.0) {
      const velNorm = this.velocity.clone().normalize();
      const dot = Math.max(-1, Math.min(1, velNorm.dot(newForwardDir)));
      this.driftAngle = Math.acos(dot); // 0 to PI
    } else {
      this.driftAngle = 0;
    }

    const driftThreshold = 0.28; // ~16 degrees
    if (this.driftAngle > driftThreshold && this.speed > 7.0) {
      this.isDrifting = true;
      this.driftDuration += dt;

      // Accumulate drift score and multiplier
      const angleBonus = (this.driftAngle - driftThreshold) * 2.2;
      this.driftMultiplier = Math.min(4.5, 1.0 + this.driftDuration * 0.8 + angleBonus);
      gameStore.run.stats.driftTimeSeconds += dt;
      gameStore.run.driftCombo = Math.floor(this.driftMultiplier * 10);
      gameStore.run.rageMultiplier = this.driftMultiplier;
    } else {
      this.isDrifting = false;
      this.driftDuration = Math.max(0, this.driftDuration - dt * 2.0);
      this.driftMultiplier = THREE.MathUtils.lerp(this.driftMultiplier, 1.0, dt * 2.5);
      gameStore.run.rageMultiplier = this.driftMultiplier;
      gameStore.run.driftCombo = 1;
    }

    // Chassis dynamic tilt (roll & pitch)
    const targetRoll = -this.steeringAngle * speedRatio * 0.18 - (this.lateralVelocity * 0.015);
    const targetPitch = (controls.throttle < 0 ? -0.06 : controls.throttle > 0 ? 0.04 : 0) * (this.isNitroActive ? 1.6 : 1.0);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 10);
    this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, dt * 10);

    // Apply movement
    this.position.addScaledVector(this.velocity, dt);

    // Arena boundary collision clamp & bounce
    const boundLimit = ARENA_HALF - 3.5;
    if (Math.abs(this.position.x) > boundLimit) {
      this.position.x = Math.sign(this.position.x) * boundLimit;
      this.velocity.x *= -0.3;
      eventBus.emit('WALL_IMPACT', { intensity: this.speed / stats.topSpeed });
    }
    if (Math.abs(this.position.z) > boundLimit) {
      this.position.z = Math.sign(this.position.z) * boundLimit;
      this.velocity.z *= -0.3;
      eventBus.emit('WALL_IMPACT', { intensity: this.speed / stats.topSpeed });
    }

    return {
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      velocity: { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z },
      forward: { x: newForwardDir.x, y: newForwardDir.y, z: newForwardDir.z },
      speed: this.speed,
      driftAngle: this.driftAngle,
      isDrifting: this.isDrifting,
      isNitroActive: this.isNitroActive,
      driftMultiplier: this.driftMultiplier,
      grounded: true,
    };
  }
}
