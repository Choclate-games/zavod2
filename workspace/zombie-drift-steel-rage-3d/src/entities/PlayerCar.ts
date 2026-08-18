import * as THREE from 'three';
import { VehiclePhysics } from '../physics/VehiclePhysics';
import { VehicleBuilder, VehicleMeshResult } from '../graphics/VehicleBuilder';
import { WeaponSystem } from './WeaponModule';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { SkidmarkSystem } from '../graphics/SkidmarkSystem';
import { VehicleControls } from '../types/vehicle';
import { gameStore } from '../core/Store';
import { audioManager } from '../core/AudioManager';
import { eventBus } from '../core/EventBus';

/** Переиспользуемый вектор: в игровом цикле нельзя аллоцировать каждый кадр. */
const _scratchForward = new THREE.Vector3();
const _scratchRearLeft = new THREE.Vector3();
const _scratchRearRight = new THREE.Vector3();

export class PlayerCar {
  public physics = new VehiclePhysics();
  public meshResult: VehicleMeshResult;
  public weapons = new WeaponSystem();
  public currentVehicleId: string;

  private wheelRotation = 0;

  constructor(vehicleId = 'iron_fang') {
    this.currentVehicleId = vehicleId;
    this.meshResult = VehicleBuilder.buildVehicle(vehicleId);
  }

  public rebuildVehicle(vehicleId: string): void {
    this.currentVehicleId = vehicleId;
    this.weapons.clear();
    // Replace mesh
    const newMesh = VehicleBuilder.buildVehicle(vehicleId);
    this.meshResult.root.parent?.remove(this.meshResult.root);
    this.meshResult = newMesh;
  }

  public reset(startX = 0, startZ = 0): void {
    this.physics.reset(startX, startZ);
    this.weapons.clear();
    this.updateMeshTransforms();
  }

  public update(
    dt: number,
    controls: VehicleControls,
    particleSystem: ParticleSystem,
    skidmarkSystem: SkidmarkSystem
  ): void {
    const state = this.physics.update(dt, controls);
    this.updateMeshTransforms();

    // Качение колёс. Знак берём из реальной скорости вдоль корпуса, а не из
    // положения газа: на выкате и в заносе машина едет, когда газ уже отпущен.
    const forwardSpeed = this.physics.velocity.dot(
      _scratchForward.set(state.forward.x, state.forward.y, state.forward.z)
    );
    const wheelRadius = 0.45;
    this.wheelRotation += (forwardSpeed / wheelRadius) * dt;
    this.meshResult.allWheelSpins.forEach((spin) => {
      spin.rotation.x = this.wheelRotation;
    });

    // Поворот руля крутит только внешнюю группу — качение живёт во вложенной,
    // поэтому передние колёса не «косят» при одновременном повороте и вращении.
    // Знак тот же, что у поворота корпуса: руль вправо (steering > 0) уменьшает yaw.
    const visualSteer = -this.physics.steeringAngle;
    this.meshResult.frontLeftWheel.rotation.y = visualSteer;
    this.meshResult.frontRightWheel.rotation.y = visualSteer;

    // Динамическое освещение тормозов и задних фонарей
    const isBraking = controls.throttle < -0.05 || controls.handbrake || state.isDrifting;
    if (isBraking) {
      this.meshResult.taillightMat.emissiveIntensity = 3.2;
      this.meshResult.brakeLight.intensity = 2.0;
    } else {
      this.meshResult.taillightMat.emissiveIntensity = 0.8;
      this.meshResult.brakeLight.intensity = 0.05;
    }

    // Динамический свет нитро
    if (state.isNitroActive) {
      this.meshResult.nitroLight.intensity = 3.2 + Math.random() * 0.8;
    } else {
      this.meshResult.nitroLight.intensity = 0;
    }

    // Audio update
    const speedRatio = Math.min(1.0, state.speed / 32);
    audioManager.updateEngine(speedRatio, state.isDrifting, state.isNitroActive);

    // Particle & Skidmark emission
    const forwardDir = new THREE.Vector3(state.forward.x, state.forward.y, state.forward.z);

    // Nitro flames
    if (state.isNitroActive) {
      for (const ex of this.meshResult.exhaustPoints) {
        const exWorld = ex.clone().applyMatrix4(this.meshResult.root.matrixWorld);
        particleSystem.emitNitroFire(exWorld.x, exWorld.y, exWorld.z, forwardDir, 2);
      }
    }

    // Drift smoke & skidmarks
    if (state.isDrifting) {
      const rearLeftWorld = this.meshResult.rearLeftWheel.getWorldPosition(_scratchRearLeft);
      const rearRightWorld = this.meshResult.rearRightWheel.getWorldPosition(_scratchRearRight);

      particleSystem.emitSmoke(rearLeftWorld.x, rearLeftWorld.y, rearLeftWorld.z, 2);
      particleSystem.emitSmoke(rearRightWorld.x, rearRightWorld.y, rearRightWorld.z, 2);

      skidmarkSystem.addSkidmark(rearLeftWorld, rearRightWorld, state.driftMultiplier * 0.35);
    } else {
      skidmarkSystem.breakSkidmark();
    }
  }

  private updateMeshTransforms(): void {
    this.meshResult.root.position.copy(this.physics.position);
    this.meshResult.root.rotation.y = this.physics.headingAngle;

    // Chassis dynamic tilt (roll & pitch)
    this.meshResult.chassis.rotation.z = this.physics.roll;
    this.meshResult.chassis.rotation.x = this.physics.pitch;
  }

  public takeDamage(amount: number): boolean {
    gameStore.run.health -= amount;
    eventBus.emit('VEHICLE_DAMAGE', { current: gameStore.run.health, max: gameStore.run.maxHealth });
    audioManager.playRamImpact(1.2);

    if (gameStore.run.health <= 0) {
      gameStore.run.health = 0;
      eventBus.emit('VEHICLE_DESTROYED');
      return true;
    }
    return false;
  }

  public heal(amount: number): void {
    gameStore.run.health = Math.min(gameStore.run.maxHealth, gameStore.run.health + amount);
    eventBus.emit('VEHICLE_HEAL', { current: gameStore.run.health, max: gameStore.run.maxHealth });
  }
}
