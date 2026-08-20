import * as THREE from 'three';
import { VehicleControls, VehiclePhysicsState } from '../types/vehicle';
import { gameStore } from '../core/Store';
import { ARENA_HALF } from '../core/Constants';
import { eventBus } from '../core/EventBus';
import { ArenaObstacle } from '../graphics/ArenaBuilder';

const _scratchForwardDir = new THREE.Vector3();
const _scratchRightDir = new THREE.Vector3();
const _scratchVelNorm = new THREE.Vector3();

export class VehiclePhysics {
  public position = new THREE.Vector3(0, 0.4, 0);
  public velocity = new THREE.Vector3(0, 0, 0);
  public headingAngle = 0; // Yaw angle in radians
  public steeringAngle = 0; // Front wheels visual steer angle
  public speed = 0; // Forward speed

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

  // Cached state return object to avoid GC
  private cachedState: VehiclePhysicsState = {
    position: { x: 0, y: 0.4, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    speed: 0,
    driftAngle: 0,
    isDrifting: false,
    isNitroActive: false,
    driftMultiplier: 1.0,
    grounded: true,
  };

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

  public update(
    dt: number,
    controls: VehicleControls,
    obstacles?: ArenaObstacle[],
    onObstacleHit?: (obs: ArenaObstacle, impactSpeed: number, hitX: number, hitZ: number) => void
  ): VehiclePhysicsState {
    const stats = gameStore.getEffectiveVehicleStats();

    // Handle Nitro
    if (controls.nitro && gameStore.run.nitro > 0.05) {
      this.isNitroActive = true;
      gameStore.run.nitro = Math.max(0, gameStore.run.nitro - dt / stats.nitroDuration);
    } else {
      this.isNitroActive = false;
      // Refill nitro over time, moderate bonus when drifting
      const refillBonus = this.isDrifting ? 1.75 : 1.0;
      gameStore.run.nitro = Math.min(1.0, gameStore.run.nitro + dt * stats.nitroRefillRate * 0.18 * refillBonus);
    }

    gameStore.run.isNitroActive = this.isNitroActive;

    // Nitro multipliers
    const nitroSpeedBoost = this.isNitroActive ? 1.35 : 1.0;
    const nitroAccelBoost = this.isNitroActive ? 1.6 : 1.0;

    const maxSpeed = stats.topSpeed * nitroSpeedBoost;
    const accel = stats.acceleration * nitroAccelBoost;
    const handling = stats.handling;
    const baseGrip = stats.driftGrip;

    // Steering input smoothing
    const targetSteerAngle = controls.steering * 0.58; // Max ~33 degrees
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteerAngle, dt * 14);

    const sinH = Math.sin(this.headingAngle);
    const cosH = Math.cos(this.headingAngle);

    _scratchForwardDir.set(sinH, 0, cosH);
    _scratchRightDir.set(-cosH, 0, sinH);

    // Decompose current velocity into forward and lateral components
    let forwardSpeed = this.velocity.dot(_scratchForwardDir);
    this.lateralVelocity = this.velocity.dot(_scratchRightDir);

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
    const speedRatio = Math.abs(forwardSpeed) / Math.max(1, stats.topSpeed);
    const isHardTurning = Math.abs(controls.steering) > 0.55 && speedRatio > 0.4 && forwardSpeed > 3.0;

    let lateralGrip = baseGrip;
    if (forwardSpeed < -0.2) {
      // Stable high grip when reversing unless handbraking
      lateralGrip = isHandbrake ? 0.6 : Math.max(baseGrip, 0.94);
    } else if (isHandbrake) {
      lateralGrip = 0.52; // High slide
    } else if (isHardTurning) {
      lateralGrip = 0.70; // Moderate drift slide
    }

    // Apply lateral friction
    this.lateralVelocity = THREE.MathUtils.damp(this.lateralVelocity, 0, (1.0 - lateralGrip) * 45 + 5, dt);

    // Turn rate depends on forward speed and steering
    if (Math.abs(forwardSpeed) > 0.5) {
      const turnFactor = Math.sign(forwardSpeed) * handling * (isHandbrake ? 1.45 : 1.0);
      const turnSpeed = -this.steeringAngle * turnFactor * (0.8 + speedRatio * 0.5);
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, turnSpeed, dt * 12);
    } else {
      this.angularVelocity = THREE.MathUtils.damp(this.angularVelocity, 0, 10, dt);
    }

    this.headingAngle += this.angularVelocity * dt;

    const newSinH = Math.sin(this.headingAngle);
    const newCosH = Math.cos(this.headingAngle);
    _scratchForwardDir.set(newSinH, 0, newCosH);
    _scratchRightDir.set(-newCosH, 0, newSinH);

    this.velocity.copy(_scratchForwardDir).multiplyScalar(forwardSpeed).addScaledVector(_scratchRightDir, this.lateralVelocity);
    this.speed = this.velocity.length();

    // Calculate Drift Angle & Drift Multiplier (ONLY during forward movement)
    if (forwardSpeed > 3.5 && this.speed > 4.0) {
      _scratchVelNorm.copy(this.velocity).normalize();
      const dot = Math.max(0, Math.min(1, _scratchVelNorm.dot(_scratchForwardDir)));
      this.driftAngle = Math.acos(dot); // 0 to PI/2
    } else {
      this.driftAngle = 0;
    }

    const driftThreshold = 0.25; // ~14 degrees
    if (forwardSpeed > 3.5 && this.driftAngle > driftThreshold && this.speed > 6.5) {
      this.isDrifting = true;
      this.driftDuration += dt;

      // Accumulate drift score and multiplier up to 2.5x (debuffed by 2x)
      const angleBonus = (this.driftAngle - driftThreshold) * 1.25;
      this.driftMultiplier = Math.min(2.5, 1.0 + this.driftDuration * 0.45 + angleBonus);
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
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // ==========================================
    // SOLID OBSTACLES COLLISION RESOLUTION
    // ==========================================
    if (obstacles) {
      const carRadius = 1.35;

      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (!obs.active) continue;

        if (obs.type === 'cylinder') {
          const radius = obs.radius || obs.width;
          const dx = this.position.x - obs.x;
          const dz = this.position.z - obs.z;
          const distSq = dx * dx + dz * dz;
          const minDist = carRadius + radius;

          if (distSq < minDist * minDist) {
            const dist = Math.max(0.001, Math.sqrt(distSq));
            const nx = dx / dist;
            const nz = dz / dist;
            const pen = minDist - dist;

            this.position.x += nx * pen;
            this.position.z += nz * pen;

            const velDotN = this.velocity.x * nx + this.velocity.z * nz;
            if (velDotN < 0) {
              const vNx = nx * velDotN;
              const vNz = nz * velDotN;
              const vTx = this.velocity.x - vNx;
              const vTz = this.velocity.z - vNz;
              const restitution = obs.isTireStack ? 0.55 : 0.28;
              const friction = obs.isTireStack ? 0.8 : 0.9;

              this.velocity.x = vTx * friction - vNx * restitution;
              this.velocity.z = vTz * friction - vNz * restitution;

              if (onObstacleHit) {
                onObstacleHit(obs, Math.abs(velDotN), this.position.x - nx * 0.9, this.position.z - nz * 0.9);
              }
            }
          }
        } else {
          // Box / Rotated OBB
          const cosR = Math.cos(-obs.rotation);
          const sinR = Math.sin(-obs.rotation);
          const relX = this.position.x - obs.x;
          const relZ = this.position.z - obs.z;
          const localX = relX * cosR - relZ * sinR;
          const localZ = relX * sinR + relZ * cosR;

          const hx = obs.width;
          const hz = obs.depth;

          const clampX = Math.max(-hx, Math.min(hx, localX));
          const clampZ = Math.max(-hz, Math.min(hz, localZ));

          const diffX = localX - clampX;
          const diffZ = localZ - clampZ;
          const distSq = diffX * diffX + diffZ * diffZ;

          let collided = false;
          let localNormX = 0;
          let localNormZ = 0;
          let pen = 0;

          if (distSq < 0.0001) {
            // Inside box
            const penLeft = localX - (-hx);
            const penRight = hx - localX;
            const penFront = localZ - (-hz);
            const penBack = hz - localZ;
            const minPen = Math.min(penLeft, penRight, penFront, penBack);

            if (minPen === penLeft) {
              localNormX = -1; pen = penLeft + carRadius;
            } else if (minPen === penRight) {
              localNormX = 1; pen = penRight + carRadius;
            } else if (minPen === penFront) {
              localNormZ = -1; pen = penFront + carRadius;
            } else {
              localNormZ = 1; pen = penBack + carRadius;
            }
            collided = true;
          } else if (distSq < carRadius * carRadius) {
            const dist = Math.sqrt(distSq);
            localNormX = diffX / dist;
            localNormZ = diffZ / dist;
            pen = carRadius - dist;
            collided = true;
          }

          if (collided) {
            const cosWorld = Math.cos(obs.rotation);
            const sinWorld = Math.sin(obs.rotation);
            const worldNormX = localNormX * cosWorld - localNormZ * sinWorld;
            const worldNormZ = localNormX * sinWorld + localNormZ * cosWorld;

            this.position.x += worldNormX * pen;
            this.position.z += worldNormZ * pen;

            const velDotN = this.velocity.x * worldNormX + this.velocity.z * worldNormZ;
            if (velDotN < 0) {
              const vNx = worldNormX * velDotN;
              const vNz = worldNormZ * velDotN;
              const vTx = this.velocity.x - vNx;
              const vTz = this.velocity.z - vNz;
              const restitution = 0.28;
              const friction = 0.9;

              this.velocity.x = vTx * friction - vNx * restitution;
              this.velocity.z = vTz * friction - vNz * restitution;

              if (onObstacleHit) {
                onObstacleHit(obs, Math.abs(velDotN), this.position.x - worldNormX * 0.9, this.position.z - worldNormZ * 0.9);
              }
            }
          }
        }
      }
    }

    // Arena boundary collision clamp & bounce
    const boundLimit = ARENA_HALF - 3.5;
    if (Math.abs(this.position.x) > boundLimit) {
      this.position.x = Math.sign(this.position.x) * boundLimit;
      this.velocity.x *= -0.3;
      eventBus.emit('WALL_IMPACT', { intensity: this.speed / Math.max(1, stats.topSpeed) });
    }
    if (Math.abs(this.position.z) > boundLimit) {
      this.position.z = Math.sign(this.position.z) * boundLimit;
      this.velocity.z *= -0.3;
      eventBus.emit('WALL_IMPACT', { intensity: this.speed / Math.max(1, stats.topSpeed) });
    }

    // Sync cached state without allocating objects
    this.cachedState.position.x = this.position.x;
    this.cachedState.position.y = this.position.y;
    this.cachedState.position.z = this.position.z;

    this.cachedState.velocity.x = this.velocity.x;
    this.cachedState.velocity.y = this.velocity.y;
    this.cachedState.velocity.z = this.velocity.z;

    this.cachedState.forward.x = _scratchForwardDir.x;
    this.cachedState.forward.y = _scratchForwardDir.y;
    this.cachedState.forward.z = _scratchForwardDir.z;

    this.cachedState.speed = this.speed;
    this.cachedState.driftAngle = this.driftAngle;
    this.cachedState.isDrifting = this.isDrifting;
    this.cachedState.isNitroActive = this.isNitroActive;
    this.cachedState.driftMultiplier = this.driftMultiplier;
    this.cachedState.grounded = true;

    return this.cachedState;
  }
}
