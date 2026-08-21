import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld, physicsWorld, WHEEL_RAY_GROUPS } from '../physics/PhysicsWorld';
import { VehicleInput, CarDefinition, CarUpgrades } from '../types';
import { CONFIG } from '../core/Config';
import { eventBus } from '../core/EventBus';

export class VehicleController {
  readonly chassisGroup = new THREE.Group();
  readonly bodyMeshGroup = new THREE.Group();
  readonly wheelGroups = [
    new THREE.Group(), // FL
    new THREE.Group(), // FR
    new THREE.Group(), // RL
    new THREE.Group(), // RR
  ];

  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);
  readonly up = new THREE.Vector3(0, 1, 0);
  readonly right = new THREE.Vector3(1, 0, 0);

  // Interpolation state for silky 60/120/144+ FPS
  private readonly prevPosition = new THREE.Vector3();
  private readonly prevRotation = new THREE.Quaternion();
  readonly interpPosition = new THREE.Vector3();
  readonly interpRotation = new THREE.Quaternion();
  readonly interpForward = new THREE.Vector3(0, 0, 1);

  speedKmh = 0;
  rpm = 800;
  gear = 1;
  slipAngleDeg = 0;
  isDrifting = false;
  isOnRoad = true;
  nitroAmount = 50.0; // 0..100%
  nitroMax = 100.0;
  isNitroActive = false;
  isNitroOverdrive = false;

  // Slipstream state
  slipstreamCharge = 0;
  slipstreamReady = false;

  // Scandinavian flick detection
  private steerHistory: { time: number; steer: number }[] = [];
  private flickTimer = 0;

  private body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private steerAngle = 0;
  private wheelSpinAngles = [0, 0, 0, 0];
  private bodyRoll = 0;

  constructor(
    private readonly physics: PhysicsWorld = physicsWorld
  ) {
    this.chassisGroup.add(this.bodyMeshGroup);
    for (const wg of this.wheelGroups) {
      this.chassisGroup.add(wg);
    }
  }

  build(startPos: THREE.Vector3, car: CarDefinition, upgrades: CarUpgrades): void {
    const mass = car.baseStats.massKg * (1.0 - (upgrades.weightStage - 1) * 0.08);
    this.body = this.physics.createChassis(startPos, mass);
    this.vehicle = this.physics.createVehicle(this.body);

    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;

    const radius = 0.36;
    const restLength = 0.26;
    const stiffness = 90.0 + (upgrades.handlingStage - 1) * 15.0;
    const frictionSlip = 3.6 + (upgrades.handlingStage - 1) * 0.5;

    const wheelPositions = [
      { x: -0.85, y: 0.06, z: 1.30 },  // FL
      { x: 0.85, y: 0.06, z: 1.30 },   // FR
      { x: -0.86, y: 0.06, z: -1.25 }, // RL
      { x: 0.86, y: 0.06, z: -1.25 },  // RR
    ];

    for (let i = 0; i < 4; i++) {
      const wp = wheelPositions[i];
      this.vehicle.addWheel(wp, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, restLength, radius);
      this.vehicle.setWheelSuspensionStiffness(i, stiffness);
      this.vehicle.setWheelSuspensionCompression(i, 4.5);
      this.vehicle.setWheelSuspensionRelaxation(i, 6.0);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.24);
      this.vehicle.setWheelMaxSuspensionForce(i, 45000.0);
      this.vehicle.setWheelFrictionSlip(i, frictionSlip);
      this.vehicle.setWheelSideFrictionStiffness(i, 2.0);
    }

    this.position.copy(startPos);
    this.prevPosition.copy(startPos);
    this.interpPosition.copy(startPos);
    this.rotation.set(0, 0, 0, 1);
    this.prevRotation.set(0, 0, 0, 1);
    this.interpRotation.set(0, 0, 0, 1);
    this.nitroAmount = 50.0;
  }

  fixedUpdate(dt: number, input: VehicleInput, car: CarDefinition, upgrades: CarUpgrades): void {
    if (!this.vehicle || !this.body) return;

    this.prevPosition.copy(this.position);
    this.prevRotation.copy(this.rotation);

    const now = performance.now() / 1000;
    this.steerHistory.push({ time: now, steer: input.steer });
    while (this.steerHistory.length > 0 && now - this.steerHistory[0].time > CONFIG.combo.flickTimingWindow) {
      this.steerHistory.shift();
    }

    if (this.steerHistory.length >= 2 && !this.isDrifting) {
      const first = this.steerHistory[0].steer;
      const curr = input.steer;
      if (Math.sign(first) !== Math.sign(curr) && Math.abs(first) > 0.6 && Math.abs(curr) > 0.6) {
        this.isDrifting = true;
        this.flickTimer = 1.5;
        eventBus.emit('drift:started', { angleDeg: CONFIG.combo.driftOptimalAngle });
      }
    }

    if (input.handbrake) {
      this.isDrifting = true;
      this.flickTimer = 1.0;
    }

    if (this.flickTimer > 0) {
      this.flickTimer -= dt;
      if (this.flickTimer <= 0) {
        this.isDrifting = false;
      }
    }

    const steerLateral = -1.0 * input.steer;
    const speedFactor = Math.max(0.35, 1.0 - (this.speedKmh / 350) * 0.50);
    const maxSteer = 0.52 * speedFactor;
    const targetSteer = steerLateral * maxSteer;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 10.0 * dt);

    this.vehicle.setWheelSteering(0, this.steerAngle);
    this.vehicle.setWheelSteering(1, this.steerAngle);

    const hasNitro = input.nitro && this.nitroAmount > 0;
    let nitroTorqueMult = 1.0;

    if (hasNitro) {
      const isOverdrive = input.nitroHoldTime > 0.4 && this.nitroAmount > 20.0;
      this.isNitroOverdrive = isOverdrive;
      this.isNitroActive = true;

      const burn = isOverdrive ? CONFIG.nitro.burnRateStage2 : CONFIG.nitro.burnRateStage1;
      this.nitroAmount = Math.max(0, this.nitroAmount - burn * dt);

      nitroTorqueMult = isOverdrive ? CONFIG.nitro.torqueBoostStage2 : CONFIG.nitro.torqueBoostStage1;

      eventBus.emit('nitro:updated', { current: this.nitroAmount, max: this.nitroMax });
    } else {
      this.isNitroActive = false;
      this.isNitroOverdrive = false;
    }

    const engineStageMult = 1.0 + (upgrades.engineStage - 1) * 0.15;
    const baseForce = 4800.0 * engineStageMult * nitroTorqueMult;
    const maxSpeedMs = (car.baseStats.topSpeedKmh + (upgrades.engineStage - 1) * 15 + (hasNitro ? 50 : 0)) / 3.6;

    const currentForwardSpeed = this.vehicle.currentVehicleSpeed();

    for (let i = 0; i < 4; i++) {
      if (this.isDrifting || input.handbrake) {
        this.vehicle.setWheelFrictionSlip(i, 1.8);
      } else {
        this.vehicle.setWheelFrictionSlip(i, 3.6 + (upgrades.handlingStage - 1) * 0.5);
      }

      if (input.throttle > 0 && currentForwardSpeed < maxSpeedMs) {
        this.vehicle.setWheelEngineForce(i, input.throttle * baseForce);
        this.vehicle.setWheelBrake(i, 0);
      } else if (input.brake > 0) {
        if (currentForwardSpeed > 0.5) {
          this.vehicle.setWheelBrake(i, input.brake * 70.0);
          this.vehicle.setWheelEngineForce(i, 0);
        } else {
          this.vehicle.setWheelEngineForce(i, -input.brake * 2000.0);
          this.vehicle.setWheelBrake(i, 0);
        }
      } else if (input.handbrake) {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, i >= 2 ? 90.0 : 20.0);
      } else {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 5.0); // mild rolling resistance
      }
    }

    this.vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);
  }

  postStep(dt: number): void {
    if (!this.vehicle || !this.body) return;

    const p = this.body.translation();
    const r = this.body.rotation();

    this.position.set(p.x, p.y, p.z);
    this.rotation.set(r.x, r.y, r.z, r.w);

    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);
    this.up.set(0, 1, 0).applyQuaternion(this.rotation);
    this.right.set(1, 0, 0).applyQuaternion(this.rotation);

    const linvel = this.body.linvel();
    const vel = new THREE.Vector3(linvel.x, 0, linvel.z);
    this.speedKmh = Math.abs(vel.length() * 3.6);

    if (vel.lengthSq() > 4.0) {
      vel.normalize();
      const dot = THREE.MathUtils.clamp(this.forward.dot(vel), -1.0, 1.0);
      const crossY = this.forward.x * vel.z - this.forward.z * vel.x;
      this.slipAngleDeg = Math.acos(dot) * (180 / Math.PI) * Math.sign(crossY);
    } else {
      this.slipAngleDeg = 0;
    }

    const maxSpeed = 320;
    const normSpeed = this.speedKmh / maxSpeed;
    if (normSpeed < 0.15) { this.gear = 1; }
    else if (normSpeed < 0.35) { this.gear = 2; }
    else if (normSpeed < 0.55) { this.gear = 3; }
    else if (normSpeed < 0.75) { this.gear = 4; }
    else if (normSpeed < 0.90) { this.gear = 5; }
    else { this.gear = 6; }

    const gearRange = 1.0 / 6;
    const gearProgress = (normSpeed - (this.gear - 1) * gearRange) / gearRange;
    this.rpm = 800 + THREE.MathUtils.clamp(gearProgress, 0, 1) * 7500;

    // Wheel spin
    const distance = (this.speedKmh / 3.6) * dt;
    const spinRad = distance / 0.36;
    for (let i = 0; i < 4; i++) {
      this.wheelSpinAngles[i] = (this.wheelSpinAngles[i] + spinRad) % (Math.PI * 2);
    }
  }

  render(alpha: number): void {
    this.interpPosition.lerpVectors(this.prevPosition, this.position, alpha);
    this.interpRotation.slerpQuaternions(this.prevRotation, this.rotation, alpha);
    this.interpForward.set(0, 0, 1).applyQuaternion(this.interpRotation);

    this.chassisGroup.position.copy(this.interpPosition);
    this.chassisGroup.quaternion.copy(this.interpRotation);

    const lateralAccel = this.steerAngle * (this.speedKmh / 100);
    this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, lateralAccel * 0.08, 0.15);
    this.bodyMeshGroup.rotation.z = this.bodyRoll;

    const wheelPositionsLocal = [
      new THREE.Vector3(-0.85, 0.06, 1.30),
      new THREE.Vector3(0.85, 0.06, 1.30),
      new THREE.Vector3(-0.86, 0.06, -1.25),
      new THREE.Vector3(0.86, 0.06, -1.25),
    ];

    for (let i = 0; i < 4; i++) {
      const wg = this.wheelGroups[i];
      wg.position.copy(wheelPositionsLocal[i]);

      if (i < 2) {
        wg.rotation.y = this.steerAngle;
      } else {
        wg.rotation.y = 0;
      }

      if (wg.children.length > 0) {
        const rimGroup = wg.children[0];
        rimGroup.rotation.x = this.wheelSpinAngles[i];
      }
    }
  }

  addNitro(amount: number): void {
    this.nitroAmount = Math.min(this.nitroMax, this.nitroAmount + amount);
    eventBus.emit('nitro:updated', { current: this.nitroAmount, max: this.nitroMax });
  }

  applySlingshotImpulse(boostKmh: number): void {
    if (!this.body) return;
    const impulseMsSquared = boostKmh / 3.6;
    const forwardVec = this.forward.clone().multiplyScalar(impulseMsSquared * 1000);
    this.body.applyImpulse({ x: forwardVec.x, y: 0, z: forwardVec.z }, true);
    eventBus.emit('slingshot:released', { boostKmh });
  }

  teleport(pos: THREE.Vector3, rotY = 0): void {
    if (!this.body) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.wakeUp();

    this.position.copy(pos);
    this.prevPosition.copy(pos);
    this.interpPosition.copy(pos);
    this.rotation.copy(q);
    this.prevRotation.copy(q);
    this.interpRotation.copy(q);
    this.speedKmh = 0;
    this.isDrifting = false;
  }
}
