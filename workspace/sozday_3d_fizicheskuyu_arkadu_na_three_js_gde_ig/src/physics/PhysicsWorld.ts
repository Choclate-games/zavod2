/**
 * PhysicsWorld: 3D Physics Simulation using Rapier3D.
 * Compound Inverted Pendulum cargo stack solver inside non-inertial train frame.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { BALANCE } from '../config/BalanceConfig';
import { MetroKinematicsState } from './MetroKinematics';

export interface CargoItemDef {
  id: string;
  name: string;
  type: 'tv' | 'aquarium' | 'pizza_stack' | 'vase' | 'crate' | 'parcel';
  width: number;
  height: number;
  depth: number;
  massKg: number;
  isFragile: boolean;
  friction: number;
  restitution: number;
}

export interface CargoBodyState {
  def: CargoItemDef;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  initialY: number;
  fallen: boolean;
  tiltAngleDeg: number;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotW: number;
}

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  private world: RAPIER.World | null = null;
  private isReady: boolean = false;
  private cargoBodies: CargoBodyState[] = [];

  // Courier base state
  private courierBaseX: number = 0;
  private targetCourierBaseX: number = 0;
  private courierCrouchOffset: number = 0;
  private courierPitchAngleRad: number = 0;
  private isGripActive: boolean = false;
  private gripTimerSec: number = 0;
  private gripCooldownSec: number = 0;

  // Fluid sloshing state
  private sloshPhase: number = 0;
  private sloshDisplacement: number = 0;

  public static get(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async init(): Promise<void> {
    if (this.isReady) return;
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(0, -9.81, 0);
    this.world = new RAPIER.World(gravity);
    this.buildCarriageColliders();
    this.isReady = true;
  }

  private buildCarriageColliders(): void {
    if (!this.world) return;

    // Carriage Floor: width = 1.8m corridor
    const floorDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
    const floorBody = this.world.createRigidBody(floorDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.1, 4.0)
      .setFriction(BALANCE.baseSway.boxFrictionCoeff)
      .setRestitution(0.1);
    this.world.createCollider(floorColliderDesc, floorBody);

    // Left Wall
    const leftWallDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(-1.2, 1.5, 0);
    const leftWallBody = this.world.createRigidBody(leftWallDesc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 1.5, 4.0).setFriction(0.2), leftWallBody);

    // Right Wall
    const rightWallDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(1.2, 1.5, 0);
    const rightWallBody = this.world.createRigidBody(rightWallDesc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 1.5, 4.0).setFriction(0.2), rightWallBody);
  }

  public resetStack(items: CargoItemDef[]): void {
    if (!this.world) return;

    // Cleanup existing cargo bodies
    for (const item of this.cargoBodies) {
      this.world.removeRigidBody(item.body);
    }
    this.cargoBodies = [];
    this.courierBaseX = 0;
    this.targetCourierBaseX = 0;
    this.courierCrouchOffset = 0;
    this.courierPitchAngleRad = 0;
    this.isGripActive = false;
    this.gripTimerSec = 0;
    this.gripCooldownSec = 0;
    this.sloshPhase = 0;
    this.sloshDisplacement = 0;

    let currentY = 0.95; // Courier hands height

    for (let i = 0; i < items.length; i++) {
      const def = items[i];
      const halfH = def.height * 0.5;
      const posY = currentY + halfH;

      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, posY, 0)
        .setLinearDamping(0.8)
        .setAngularDamping(1.4)
        .setCcdEnabled(def.isFragile || def.type === 'pizza_stack');

      const body = this.world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.cuboid(def.width * 0.5, halfH, def.depth * 0.5)
        .setMass(def.massKg)
        .setFriction(def.friction)
        .setRestitution(def.restitution);

      const collider = this.world.createCollider(colDesc, body);

      this.cargoBodies.push({
        def,
        body,
        collider,
        initialY: posY,
        fallen: false,
        tiltAngleDeg: 0,
        posX: 0,
        posY,
        posZ: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        rotW: 1
      });

      currentY += def.height + 0.02;
    }
  }

  public setCourierInput(targetX: number, isCrouching: boolean, pitchOffset: number): void {
    // Clamp within 1.8m corridor
    const maxHalfWidth = BALANCE.baseSway.carriageCorridorWidth * 0.5 - 0.2;
    this.targetCourierBaseX = Math.max(-maxHalfWidth, Math.min(maxHalfWidth, targetX));

    // Crouch calculation
    const targetCrouch = isCrouching ? BALANCE.microCrouch.crouchDepth : 0;
    this.courierCrouchOffset += (targetCrouch - this.courierCrouchOffset) * 0.2;

    // Pitch lean
    const maxPitchRad = (BALANCE.pitchCounterLean.maxLeanAngleDeg * Math.PI) / 180;
    this.courierPitchAngleRad = Math.max(-maxPitchRad, Math.min(maxPitchRad, pitchOffset * maxPitchRad));
  }

  public triggerEmergencyGrip(): boolean {
    if (this.gripCooldownSec > 0 || this.isGripActive) return false;
    this.isGripActive = true;
    this.gripTimerSec = BALANCE.emergencyGrip.holdDurationSec;
    this.gripCooldownSec = BALANCE.emergencyGrip.cooldownSec;
    return true;
  }

  public step(dt: number, trainState: MetroKinematicsState): void {
    if (!this.world) return;

    // Update emergency grip timer & cooldown
    if (this.isGripActive) {
      this.gripTimerSec -= dt;
      if (this.gripTimerSec <= 0) {
        this.isGripActive = false;
      }
    }
    if (this.gripCooldownSec > 0) {
      const speedMult = this.getMaxTiltAngleDeg() < 8 ? (1 + BALANCE.emergencyGrip.cleanBalanceCdBonusPercent / 100) : 1.0;
      this.gripCooldownSec = Math.max(0, this.gripCooldownSec - dt * speedMult);
    }

    // Lerp courier base support point
    const speedLimit = BALANCE.baseSway.maxCourierMoveSpeed * (1 - (this.courierCrouchOffset > 0.1 ? BALANCE.microCrouch.speedPenaltyPercent / 100 : 0));
    const deltaX = this.targetCourierBaseX - this.courierBaseX;
    const moveStep = Math.sign(deltaX) * Math.min(Math.abs(deltaX), speedLimit * dt);
    this.courierBaseX += moveStep;

    // Sloshing water calculation (Aquarium)
    this.sloshPhase += BALANCE.sloshingCargo.waterEigenfrequencyRadPerSec * dt;
    this.sloshDisplacement = Math.sin(this.sloshPhase - BALANCE.sloshingCargo.wavePhaseLagSec * 4) * (trainState.accelLateralMps2 * 0.05);

    // Apply forces and constraints to bottom base and stack items
    if (this.cargoBodies.length > 0 && !this.cargoBodies[0].fallen) {
      const bottomItem = this.cargoBodies[0];
      const targetBaseY = 0.95 - this.courierCrouchOffset;
      const targetBaseZ = this.courierPitchAngleRad * BALANCE.pitchCounterLean.cargoZOffsetMeters;

      const currentPos = bottomItem.body.translation();
      const springX = (this.courierBaseX - currentPos.x) * 35.0;
      const springY = (targetBaseY - currentPos.y) * 45.0;
      const springZ = (targetBaseZ - currentPos.z) * 35.0;

      bottomItem.body.applyImpulse(new RAPIER.Vector3(springX * dt, springY * dt, springZ * dt), true);
    }

    // Apply train inertial forces (centrifugal + longitudinal)
    for (let i = 0; i < this.cargoBodies.length; i++) {
      const item = this.cargoBodies[i];
      if (item.fallen) continue;

      const m = item.def.massKg;
      // In non-inertial frame: F = -m * a
      let forceX = -m * trainState.accelLateralMps2;
      let forceZ = m * trainState.accelForwardMps2; // push backwards during acceleration, forward during braking
      let forceY = trainState.railVibrationY * m * 20;

      // Extra normal force on crouch
      if (this.courierCrouchOffset > 0.1) {
        forceY -= m * 9.81 * (BALANCE.microCrouch.normalForceMultiplier - 1.0);
      }

      // Aquarium slosh hydrodynamic torque
      if (item.def.type === 'aquarium') {
        const sloshTorqueZ = this.sloshDisplacement * BALANCE.sloshingCargo.aquariumWaterMassKg * 4.0;
        item.body.applyTorqueImpulse(new RAPIER.Vector3(0, 0, sloshTorqueZ * dt), true);
      }

      // Emergency grip torque dampener on highest item
      if (this.isGripActive && i === this.cargoBodies.length - 1) {
        const angVel = item.body.angvel();
        item.body.setAngvel(new RAPIER.Vector3(angVel.x * 0.1, angVel.y * 0.1, angVel.z * 0.1), true);
        forceX *= 0.15;
      }

      item.body.applyImpulse(new RAPIER.Vector3(forceX * dt, forceY * dt, forceZ * dt), true);
    }

    // Step Rapier simulation
    this.world.step();

    // Update body states & detect falls
    for (const item of this.cargoBodies) {
      const pos = item.body.translation();
      const rot = item.body.rotation();

      item.posX = pos.x;
      item.posY = pos.y;
      item.posZ = pos.z;
      item.rotX = rot.x;
      item.rotY = rot.y;
      item.rotZ = rot.z;
      item.rotW = rot.w;

      // Calculate tilt angle in degrees from up-vector (0, 1, 0)
      const upY = 1 - 2 * (rot.x * rot.x + rot.z * rot.z);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, upY)));
      item.tiltAngleDeg = (angleRad * 180) / Math.PI;

      // Detect fall to floor (<0.3m) or toppled over
      if (pos.y < 0.35 || Math.abs(pos.x) > 1.1) {
        item.fallen = true;
      }
    }
  }

  public getCargoBodies(): CargoBodyState[] {
    return this.cargoBodies;
  }

  public getMaxTiltAngleDeg(): number {
    let maxAngle = 0;
    for (const item of this.cargoBodies) {
      if (!item.fallen && item.tiltAngleDeg > maxAngle) {
        maxAngle = item.tiltAngleDeg;
      }
    }
    return maxAngle;
  }

  public getPreservedCount(): { saved: number; total: number; percent: number } {
    const total = this.cargoBodies.length;
    if (total === 0) return { saved: 0, total: 0, percent: 100 };
    const saved = this.cargoBodies.filter(b => !b.fallen).length;
    const percent = Math.round((saved / total) * 100);
    return { saved, total, percent };
  }

  public isCriticalFragileItemDropped(): boolean {
    return this.cargoBodies.some(b => b.fallen && b.def.isFragile);
  }

  public getCourierState() {
    return {
      baseX: this.courierBaseX,
      crouchOffset: this.courierCrouchOffset,
      pitchAngleRad: this.courierPitchAngleRad,
      isGripActive: this.isGripActive,
      gripCooldownSec: this.gripCooldownSec,
      gripCooldown01: 1 - Math.min(1, this.gripCooldownSec / BALANCE.emergencyGrip.cooldownSec)
    };
  }

  public getSloshDisplacement(): number {
    return this.sloshDisplacement;
  }
}
