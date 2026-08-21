import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { InputSnapshot, TruckId, TruckUpgrades } from '../core/types';
import { PhysicsWorld, WHEEL_RAY_GROUPS } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { TireTracksManager } from '../rendering/TireTracksManager';
import {
  BRAKE,
  MUD,
  RIDE_HEIGHT,
  STEERING,
  TRUCKS,
  getTruckConfig,
  type TruckConfig,
} from './truckSpec';

const SPAWN_Z = 2;

interface WheelRig {
  steer: THREE.Group;
  spin: THREE.Group;
  tireMesh: THREE.Mesh;
  isSteering: boolean;
  isDrive: boolean;
}

/**
 * The truck is a dynamic chassis body driven by Rapier's ray-cast vehicle controller.
 * Features:
 * - 4 distinct highly detailed, stylized low-poly trucks (ZIL-130, GAZ-66, KrAZ-255, Ural-4320)
 * - Authentic Soviet cabin aesthetics: curved hoods, iconic grilles, bezels, mirrors, snorkels, spare wheels, winches, roof racks
 * - Tiered visual upgrades: tire treads (0..4), engine exhausts/turbos (0..5), suspension lift & springs (0..3), cargo sides (0..3)
 * - SnowRunner-style progressive terrain rut carving, raised side mud berms, and persistent 3D tire tracks
 * - Multi-layered fluid water VFX: fan spray sheets, foam crests, surface ripple rings, wet tire dripping
 * - Integrated advanced zero-allocation ParticleSystem (diesel smoke, wheel dust, ballistic mud, water splashes, collision sparks, leaves, celebration)
 */
export class TruckController {
  readonly chassis = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);
  speed = 0;
  positionZ = SPAWN_Z;
  mudLevel = 0; // 0.0 (clean) to 1.0 (heavily caked in mud)
  currentMudFactor = 0;
  currentWaterFactor = 0;
  wetTimer = 0;

  currentTruckId: TruckId = 'zil';
  config: TruckConfig = TRUCKS.zil;

  readonly particles: ParticleSystem;
  readonly tireTracks: TireTracksManager;

  private body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private readonly wheels: WheelRig[] = [];
  private readonly spawn = new THREE.Vector3();
  private steerAngle = 0;
  private upsideDownFor = 0;
  private prevWheelRotations: number[] = [0, 0, 0, 0, 0, 0];

  // Interpolation state: previous physics-step position/rotation for smooth rendering at any FPS
  private readonly prevPosition = new THREE.Vector3();
  private readonly prevRotation = new THREE.Quaternion();
  private readonly interpPosition = new THREE.Vector3();
  private readonly interpRotation = new THREE.Quaternion();

  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchVec2 = new THREE.Vector3();
  private readonly exhaustLocalPos = new THREE.Vector3();
  private exhaustIsVertical = false;

  // Materials instances for dynamic mud soiling & color customization
  private truckMat: THREE.MeshLambertMaterial | null = null;
  private truckDarkMat: THREE.MeshLambertMaterial | null = null;
  private tireMat: THREE.MeshLambertMaterial | null = null;
  private baseTruckColor = new THREE.Color(0xc75c32);
  private baseTruckDarkColor = new THREE.Color(0x51362b);
  private baseTireColor = new THREE.Color(0x222320);
  private mudColor = new THREE.Color(0x3e2918);

  private currentUpgrades: TruckUpgrades = {
    engine: 0,
    tires: 0,
    suspension: 0,
    sides: 0,
    color: '#c75c32',
  };

  private exhaustTimer = 0;
  private dustTimer = 0;
  private leafTimer = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {
    this.particles = new ParticleSystem(this.scene, this.road);
    this.tireTracks = new TireTracksManager(this.scene, this.road);
  }

  build(truckId: TruckId = 'zil', upgrades?: TruckUpgrades, customColor?: string): void {
    this.currentTruckId = truckId;
    this.config = getTruckConfig(truckId);
    this.currentUpgrades = {
      engine: upgrades?.engine ?? 0,
      tires: upgrades?.tires ?? 0,
      suspension: upgrades?.suspension ?? 0,
      sides: upgrades?.sides ?? 0,
      color: customColor || upgrades?.color || this.config.defaultColor,
    };

    this.baseTruckColor.set(this.currentUpgrades.color);

    this.spawn.set(0, this.road.roadHeightAt(SPAWN_Z) + RIDE_HEIGHT + 0.1, SPAWN_Z);
    this.scene.truckGroup.add(this.chassis);

    this.buildVisuals();
    this.body = this.physics.createChassis(this.chassis, this.spawn);
    this.buildColliders();
    this.buildVehicle(this.currentUpgrades);
    this.reset();
  }

  rebuild(truckId: TruckId, upgrades?: TruckUpgrades, customColor?: string): void {
    if (this.body) {
      this.physics.removeBody(this.body);
      this.body = null;
    }
    this.vehicle = null;
    this.wheels.length = 0;
    this.scene.clearGroup(this.chassis);
    this.build(truckId, upgrades, customColor);
  }

  setColor(hexColor: string): void {
    this.baseTruckColor.set(hexColor);
    this.currentUpgrades.color = hexColor;
    if (this.truckMat) this.truckMat.color.copy(this.baseTruckColor);
  }

  reset(): void {
    if (!this.body) return;
    this.physics.placeBody(this.body, this.spawn);
    this.steerAngle = 0;
    this.upsideDownFor = 0;
    this.speed = 0;
    this.mudLevel = 0;
    this.currentMudFactor = 0;
    this.currentWaterFactor = 0;
    this.prevWheelRotations = [0, 0, 0, 0, 0, 0];
    this.position.copy(this.spawn);
    this.rotation.identity();
    this.forward.set(0, 0, 1);
    this.positionZ = this.spawn.z;
    this.chassis.position.copy(this.spawn);
    this.chassis.quaternion.identity();
    // Reset interpolation state so we start clean at the spawn point
    this.prevPosition.copy(this.spawn);
    this.prevRotation.identity();

    if (this.truckMat) this.truckMat.color.copy(this.baseTruckColor);
    if (this.truckDarkMat) this.truckDarkMat.color.copy(this.baseTruckDarkColor);
    if (this.tireMat) this.tireMat.color.copy(this.baseTireColor);

    this.particles.reset();
    this.tireTracks.reset();
    this.wetTimer = 0;

    if (this.vehicle) {
      for (let i = 0; i < this.wheels.length; i += 1) {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 0);
        this.vehicle.setWheelSteering(i, 0);
        this.vehicle.setWheelFrictionSlip(i, this.config.tire.frictionSlip);
        this.vehicle.setWheelSideFrictionStiffness(i, this.config.tire.sideFrictionStiffness);
      }
    }
  }

  localToWorld(local: THREE.Vector3): THREE.Vector3 {
    return local.applyQuaternion(this.rotation).add(this.position);
  }

  fixedUpdate(dt: number, controls: InputSnapshot, upgrades?: Partial<TruckUpgrades>, invertSteering = false): void {
    const vehicle = this.vehicle;
    const body = this.body;
    if (!vehicle || !body) return;

    // Save previous state BEFORE the physics step for render interpolation
    this.prevPosition.copy(this.position);
    this.prevRotation.copy(this.rotation);

    const speed = vehicle.currentVehicleSpeed();
    this.applySteering(vehicle, dt, controls, speed, invertSteering);
    this.applyDrive(vehicle, controls, upgrades, speed);

    vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);

    // Read the vehicle speed and transform after the physics step
    this.speed = Math.abs(vehicle.currentVehicleSpeed()) * 3.6;
    const p = body.translation();
    const r = body.rotation();
    this.position.set(p.x, p.y, p.z);
    this.rotation.set(r.x, r.y, r.z, r.w);
    this.positionZ = p.z;
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);

    this.applyEnvironmentalPhysics(vehicle, body, dt, speed, controls, upgrades);
    this.tireTracks.update(dt);

    this.updateVFX(dt, controls, speed);
    this.particles.update(dt);
    if (controls.recover) {
      this.recoverNow();
    } else {
      this.recoverFromRollover(body, dt);
    }
  }

  recoverNow(): void {
    const body = this.body;
    if (!body) return;
    this.upsideDownFor = 0;
    this.tireTracks.breakAllTracks();
    const heading = Math.atan2(this.forward.x, this.forward.z);
    this.physics.placeBody(
      body,
      new THREE.Vector3(
        THREE.MathUtils.clamp(this.position.x, -4, 4),
        this.road.roadHeightAt(this.position.z) + RIDE_HEIGHT + 0.45,
        this.position.z,
      ),
      heading,
    );
    this.speed = 0;
  }

  /**
   * Continuous dynamic VFX updates (exhaust, wheel dust, leaves, bottoming sparks).
   */
  private updateVFX(dt: number, controls: InputSnapshot, speed: number): void {
    // 1. Diesel exhaust smoke puffs
    this.exhaustTimer += dt;
    const exhaustInterval = controls.throttle > 0 ? 0.08 : 0.22;
    if (this.exhaustTimer >= exhaustInterval) {
      this.exhaustTimer = 0;
      const exWorld = this.localToWorld(this.scratchVec.copy(this.exhaustLocalPos));
      this.particles.emitExhaust(
        exWorld,
        this.forward,
        controls.throttle,
        this.speed,
        this.exhaustIsVertical,
      );
    }

    // 2. Wheel dust clouds on dry ground
    if (this.currentMudFactor < 0.12 && this.currentWaterFactor < 0.1 && this.speed > 8) {
      this.dustTimer += dt;
      if (this.dustTimer >= 0.12) {
        this.dustTimer = 0;
        for (let i = 0; i < this.wheels.length; i += 1) {
          const wCfg = this.config.wheels[i];
          const wWorld = this.localToWorld(this.scratchVec.set(wCfg.x, this.config.suspension.connectionY - this.config.wheelRadius * 0.7, wCfg.z));
          this.particles.emitDustCloud(wWorld, this.forward, speed, Math.min(1.0, this.speed / 30), this.config.wheelRadius);
        }
      }
    }

    // 3. Forest swirling leaves in tree corridors
    this.leafTimer += dt;
    if (this.leafTimer >= 0.35 && this.speed > 14) {
      this.leafTimer = 0;
      if (Math.random() < 0.6) {
        this.particles.emitLeaves(this.position, speed, 1);
      }
    }

    // 4. Chassis bottoming out sparks
    const frameBottom = this.position.y - this.config.frame.hy;
    const roadY = this.road.heightAt(this.position.x, this.position.z);
    if (frameBottom - roadY < 0.06 && this.speed > 16) {
      this.particles.emitSparks(this.scratchVec.set(this.position.x, roadY + 0.05, this.position.z), undefined, 6);
    }
  }

  /**
   * Environmental physics: mud, water fords, road deformation & splash effects.
   */
  private applyEnvironmentalPhysics(
    vehicle: RAPIER.DynamicRayCastVehicleController,
    body: RAPIER.RigidBody,
    dt: number,
    speed: number,
    controls: InputSnapshot,
    upgrades?: Partial<TruckUpgrades>,
  ): void {
    let avgMud = 0;
    let avgWater = 0;
    let anyInContact = false;
    const tireUp = upgrades?.tires ?? this.currentUpgrades.tires;
    const frictionDropCoeff = MUD.frictionDrop * (1 - tireUp * 0.20);
    const dragReduction = 1 - tireUp * 0.16;

    // Vehicle linear speed in m/s along the forward axis
    const linVel = body.linvel();
    const forwardSpeed = this.forward.x * linVel.x + this.forward.z * linVel.z; // signed, m/s
    const absSpeed = Math.abs(forwardSpeed);

    // Lateral slip: side component of velocity relative to the truck heading
    const lateralVel = Math.abs(-this.forward.z * linVel.x + this.forward.x * linVel.z);
    const wheelCount = this.wheels.length;

    for (let i = 0; i < wheelCount; i += 1) {
      const inContact = vehicle.wheelIsInContact(i);
      const wheelCfg = this.config.wheels[i] || this.config.wheels[0];
      const wheelWorld = this.localToWorld(
        this.scratchVec.set(wheelCfg.x, this.config.suspension.connectionY - this.config.wheelRadius * 0.85, wheelCfg.z),
      );

      const mud = this.road.getMudIntensity(wheelWorld.x, wheelWorld.z);
      const water = this.road.getWaterIntensity(wheelWorld.x, wheelWorld.z);
      avgMud += mud / wheelCount;
      avgWater += water / wheelCount;

      // Dynamic traction & hydroplaning
      const friction = this.config.tire.frictionSlip * (1 - mud * frictionDropCoeff) * (1 - water * 0.45);
      const sideStiff = this.config.tire.sideFrictionStiffness * (1 - mud * MUD.sideFrictionDrop * (1 - tireUp * 0.18)) * (1 - water * 0.35);
      vehicle.setWheelFrictionSlip(i, friction);
      vehicle.setWheelSideFrictionStiffness(i, sideStiff);

      if (inContact) {
        anyInContact = true;

        // ── Physically-correct tire slip detection ──────────────────────────
        // wheelRotation() gives cumulative angle in radians.
        // Angular velocity (rad/s) = delta_angle / dt
        // Rim surface speed (m/s) = angularVel * wheelRadius
        const curRot = vehicle.wheelRotation(i) ?? 0;
        const angularVel = (curRot - (this.prevWheelRotations[i] ?? curRot)) / Math.max(dt, 1e-4);
        this.prevWheelRotations[i] = curRot;
        const rimSpeed = angularVel * this.config.wheelRadius; // m/s at rim

        // Slip ratio: how much rim speed deviates from vehicle forward speed.
        // > 0  → wheel spinning faster than ground (burnout / пробуксовка)
        // < 0  → wheel slower than ground (braking lockup / торможение)
        const slipVelocity = rimSpeed - forwardSpeed; // m/s
        const slipRef = Math.max(absSpeed, Math.abs(rimSpeed), 0.5);
        const slipRatio = slipVelocity / slipRef; // normalized –1..+1

        // Lateral slip: absolute lateral body velocity compared to forward speed
        const lateralSlipRatio = lateralVel / Math.max(absSpeed, 0.5);

        // ── 3 Conditions for Tire Tracks ────────────────────────────────────
        // 1. При резком старте / пробуксовке (Hard launch / burnout / wheel spin)
        const isSpinning =
          (slipRatio > 0.18 && controls.throttle > 0.1) ||
          (controls.throttle > 0.5 && absSpeed < 3.0 && rimSpeed > absSpeed + 0.8) ||
          (controls.throttle > 0.2 && absSpeed < 0.5 && Math.abs(angularVel) > 1.2);

        // 2. При торможении (Braking / lockup)
        const isBraking =
          (controls.brake > 0.05 && absSpeed > 0.4) ||
          (slipRatio < -0.15 && absSpeed > 0.5);

        // 3. При заносе / ручнике (Drift / sideslip / handbrake)
        const isDrifting =
          (lateralSlipRatio > 0.20 && absSpeed > 0.8) ||
          (controls.handbrake && absSpeed > 0.3);

        // Отрисовка строго по 3 условиям: торможение, занос, резкий старт
        const leaveTrack = isBraking || isDrifting || isSpinning;

        // Real-time SnowRunner-style road rut deformation
        const rutDepth = 0.032 + mud * 0.075
          + (controls.throttle > 0 ? 0.020 : 0)
          + (isSpinning ? 0.055 : 0);
        this.road.deformRoad(wheelWorld.x, wheelWorld.z, rutDepth, isSpinning);

        // Wheel heading including steering angle for authentic curvature in turns
        const steerAngle = vehicle.wheelSteering(i) ?? 0;
        const cosS = Math.cos(steerAngle);
        const sinS = Math.sin(steerAngle);
        const wheelForwardX = this.forward.x * cosS + this.forward.z * sinS;
        const wheelForwardZ = -this.forward.x * sinS + this.forward.z * cosS;

        if (leaveTrack) {
          this.tireTracks.addPoint(
            i,
            wheelWorld.x,
            wheelWorld.z,
            wheelForwardX,
            wheelForwardZ,
            this.config.wheelHalfWidth,
            mud,
            water,
            this.wetTimer,
            isSpinning,
            isBraking,
            isDrifting,
          );
        } else {
          // No slip → clean rolling → break track so the next slip creates a fresh mark
          this.tireTracks.breakTrack(i);
        }

        // Particle emissions on spinning/sliding tires
        if (mud > 0.10 && (Math.abs(angularVel) > 2.0 || isSpinning)) {
          this.particles.emitMudSpray(wheelWorld, this.forward, angularVel, mud, this.config.wheelRadius);
        }
        if (water > 0.12 && (absSpeed > 1.8 || Math.abs(angularVel) > 3.0)) {
          this.particles.emitWaterSplash(wheelWorld, this.forward, forwardSpeed, water, this.config.wheelRadius);
        }
      } else {
        // Wheel is airborne – break track ribbon to avoid floating lines
        this.tireTracks.breakTrack(i);
      }
    }

    this.currentMudFactor = avgMud;
    this.currentWaterFactor = avgWater;
    this.road.flushDeformations();
    this.tireTracks.flush();

    // Manage wetness timer (wet tires leave dark wet tracks after exiting fords)
    if (avgWater > 0.08) {
      this.wetTimer = 4.5;
    } else if (this.wetTimer > 0) {
      this.wetTimer = Math.max(0, this.wetTimer - dt);
    }

    // 1. Mud drag
    if (avgMud > 0.05 && anyInContact) {
      const dragMag = avgMud * dragReduction * (MUD.baseDragForce + MUD.speedDragCoeff * Math.abs(speed));
      const dragDir = speed >= 0 ? -1 : 1;
      const impulse = this.scratchVec.copy(this.forward).multiplyScalar(dragDir * dragMag * dt);
      body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
      this.mudLevel = Math.min(1.0, this.mudLevel + (avgMud * 0.08 + (controls.throttle > 0 ? 0.05 : 0)) * dt);
    }

    // 2. Water hydrodynamic resistance & washing effect
    if (avgWater > 0.05 && anyInContact) {
      const waterDragMag = avgWater * (35 + 2.2 * speed * speed);
      const dragDir = speed >= 0 ? -1 : 1;
      const impulse = this.scratchVec.copy(this.forward).multiplyScalar(dragDir * waterDragMag * dt);
      body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);

      // Water washes off caked mud
      this.mudLevel = Math.max(0, this.mudLevel - avgWater * 0.35 * dt);
    }

    this.updateMudVisuals();
  }

  private updateMudVisuals(): void {
    if (this.truckMat && this.tireMat) {
      const tintColor = new THREE.Color().copy(this.baseTruckColor).lerp(this.mudColor, this.mudLevel * 0.75);
      this.truckMat.color.copy(tintColor);

      const tireTintColor = new THREE.Color().copy(this.baseTireColor).lerp(this.mudColor, this.mudLevel * 0.9);
      this.tireMat.color.copy(tireTintColor);
    }
  }

  render(alpha: number): void {
    const vehicle = this.vehicle;
    if (!vehicle) return;

    // Interpolate chassis position and rotation between previous and current physics states.
    // This makes the truck visually smooth at ANY frame rate, not just 60 FPS.
    this.interpPosition.lerpVectors(this.prevPosition, this.position, alpha);
    this.interpRotation.slerpQuaternions(this.prevRotation, this.rotation, alpha);
    this.chassis.position.copy(this.interpPosition);
    this.chassis.quaternion.copy(this.interpRotation);

    const tireUp = this.currentUpgrades.tires;
    for (let i = 0; i < this.wheels.length; i += 1) {
      const rig = this.wheels[i];
      const suspension = vehicle.wheelSuspensionLength(i) ?? this.config.suspension.restLength;

      const wheelCfg = this.config.wheels[i] || this.config.wheels[0];
      const wheelWorld = this.localToWorld(this.scratchVec2.set(wheelCfg.x, this.config.suspension.connectionY, wheelCfg.z));
      const mud = this.road.getMudIntensity(wheelWorld.x, wheelWorld.z);
      const water = this.road.getWaterIntensity(wheelWorld.x, wheelWorld.z);
      const inContact = vehicle.wheelIsInContact(i);

      // Visual sinking of wheels down into mud/puddles:
      const mudSink = mud * (0.22 + (this.currentMudFactor > 0.3 ? 0.08 : 0)) * (1 - tireUp * 0.12);
      const waterSink = water * 0.16;
      const targetSink = inContact ? Math.max(mudSink, waterSink) : 0;

      rig.steer.position.y = this.config.suspension.connectionY - suspension - targetSink;
      rig.steer.rotation.y = vehicle.wheelSteering(i) ?? 0;
      rig.spin.rotation.x = vehicle.wheelRotation(i) ?? 0;
    }
  }

  private applySteering(
    vehicle: RAPIER.DynamicRayCastVehicleController,
    dt: number,
    controls: InputSnapshot,
    speed: number,
    invertSteering = false,
  ): void {
    const lock = STEERING.maxAngle / (1 + Math.abs(speed) * STEERING.speedFalloff);
    const steerSign = invertSteering ? 1 : -1;
    const steerInput = controls.steer * steerSign;
    const target = steerInput * lock;
    const rate = (controls.steer === 0 ? STEERING.returnRate : STEERING.turnRate) * dt;
    this.steerAngle += THREE.MathUtils.clamp(target - this.steerAngle, -rate, rate);

    for (let i = 0; i < this.wheels.length; i += 1) {
      if (this.wheels[i].isSteering) {
        vehicle.setWheelSteering(i, this.steerAngle);
      }
    }
  }

  private applyDrive(
    vehicle: RAPIER.DynamicRayCastVehicleController,
    controls: InputSnapshot,
    upgrades?: Partial<TruckUpgrades>,
    speed = 0,
  ): void {
    const engUp = upgrades?.engine ?? this.currentUpgrades.engine;
    const maxSpeed = this.config.engine.maxSpeed + engUp * this.config.engine.speedPerUpgrade;
    const power = this.config.engine.baseForce + engUp * this.config.engine.forcePerUpgrade;
    let engineForce = 0;
    let brake: number = BRAKE.idle;

    if (controls.throttle > 0 && speed > -0.8) {
      engineForce = power * controls.throttle * Math.max(0, 1 - Math.max(0, speed) / maxSpeed);
      brake = 0;
    } else if (controls.brake > 0 && speed < 0.8) {
      engineForce = -this.config.engine.reverseForce * controls.brake * Math.max(0, 1 - Math.abs(Math.min(0, speed)) / this.config.engine.maxReverseSpeed);
      brake = 0;
    } else if (controls.brake > 0 || (controls.throttle > 0 && speed <= -0.8)) {
      brake = BRAKE.foot;
    }

    if (controls.handbrake) {
      engineForce = 0;
      brake = BRAKE.hand;
    }

    for (let i = 0; i < this.wheels.length; i += 1) {
      if (this.wheels[i].isDrive) {
        vehicle.setWheelEngineForce(i, engineForce);
      }
      vehicle.setWheelBrake(i, brake);
    }
  }

  private recoverFromRollover(body: RAPIER.RigidBody, dt: number): void {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rotation);
    if (up.y > 0.25) {
      this.upsideDownFor = 0;
      return;
    }
    this.upsideDownFor += dt;
    if (this.upsideDownFor < 2) return;
    this.upsideDownFor = 0;
    this.tireTracks.breakAllTracks();
    const heading = Math.atan2(this.forward.x, this.forward.z);
    this.physics.placeBody(
      body,
      new THREE.Vector3(
        THREE.MathUtils.clamp(this.position.x, -4, 4),
        this.road.roadHeightAt(this.position.z) + RIDE_HEIGHT + 0.4,
        this.position.z,
      ),
      heading,
    );
  }

  private buildVehicle(upgrades?: Partial<TruckUpgrades>): void {
    const body = this.body;
    if (!body) return;
    const vehicle = this.physics.createVehicle(body);
    vehicle.indexUpAxis = 1;
    vehicle.setIndexForwardAxis = 2;
    const direction = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };

    const suspUp = upgrades?.suspension ?? this.currentUpgrades.suspension;
    const susp = this.config.suspension;
    const stiffness = susp.stiffness * (1 + suspUp * 0.15);
    const compression = susp.compression * (1 + suspUp * 0.12);
    const relaxation = susp.relaxation * (1 + suspUp * 0.14);

    for (let i = 0; i < this.config.wheels.length; i += 1) {
      const w = this.config.wheels[i];
      vehicle.addWheel({ x: w.x, y: susp.connectionY, z: w.z }, direction, axle, susp.restLength, this.config.wheelRadius);
    }

    for (let i = 0; i < this.config.wheels.length; i += 1) {
      vehicle.setWheelSuspensionStiffness(i, stiffness);
      vehicle.setWheelSuspensionCompression(i, compression);
      vehicle.setWheelSuspensionRelaxation(i, relaxation);
      vehicle.setWheelMaxSuspensionTravel(i, susp.maxTravel);
      vehicle.setWheelMaxSuspensionForce(i, susp.maxForce);
      vehicle.setWheelFrictionSlip(i, this.config.tire.frictionSlip);
      vehicle.setWheelSideFrictionStiffness(i, this.config.tire.sideFrictionStiffness);
    }
    this.vehicle = vehicle;
  }

  private buildColliders(): void {
    const body = this.body;
    if (!body) return;
    const { frame, cabin, bed, mass } = this.config;

    const extraWall = this.currentUpgrades.sides * 0.12;
    const wallHalfY = bed.wallHalfY + extraWall;
    const wallHalfZ = (bed.frontZ - bed.backZ) / 2;
    const wallCentreZ = (bed.frontZ + bed.backZ) / 2;
    const wallY = bed.floorY + wallHalfY;

    this.physics.addBoxCollider(body, new THREE.Vector3(frame.hx, frame.hy, frame.hz), new THREE.Vector3(0, 0, 0), mass.frame);
    this.physics.addBoxCollider(body, new THREE.Vector3(cabin.hx, cabin.hy, cabin.hz), new THREE.Vector3(0, cabin.y, cabin.z), mass.cabin);

    // Left and right side walls
    for (const side of [-1, 1]) {
      this.physics.addBoxCollider(
        body,
        new THREE.Vector3(bed.wallThickness, wallHalfY, wallHalfZ),
        new THREE.Vector3(side * (bed.innerHalfX + bed.wallThickness), wallY, wallCentreZ),
        mass.wall,
      );
    }

    // Front (headboard) and Back (tailgate) walls
    for (const z of [bed.frontZ + bed.wallThickness, bed.backZ - bed.wallThickness]) {
      this.physics.addBoxCollider(
        body,
        new THREE.Vector3(bed.innerHalfX + bed.wallThickness * 2, wallHalfY, bed.wallThickness),
        new THREE.Vector3(0, wallY, z),
        mass.wall,
      );
    }
  }

  private buildVisuals(): void {
    const { materials } = this.scene;
    this.truckMat = materials.truck.clone();
    this.truckMat.color.copy(this.baseTruckColor);
    this.truckDarkMat = materials.truckDark.clone();
    this.tireMat = materials.tire.clone();

    const { frame, style } = this.config;

    // 1. Chassis Frame (heavy steel rails & crossmembers)
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2, frame.hy * 2, frame.hz * 2), materials.metalDark);
    frameMesh.castShadow = true;
    this.chassis.add(frameMesh);

    // Lateral chassis rails
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, frame.hy * 1.8, frame.hz * 2.02), materials.metalDark);
      rail.position.set(side * (frame.hx * 0.75), 0, 0);
      this.chassis.add(rail);
    }

    // 2. Specific Detailed Visuals per Truck Style
    if (style === 'cab-over') {
      this.buildGaz66Visuals();
    } else if (style === 'heavy-6x6') {
      this.buildKraz255Visuals();
    } else if (style === 'expedition-6x6') {
      this.buildUral4320Visuals();
    } else {
      this.buildZil130Visuals();
    }

    // 3. Upgrade Visual Accessories (Engine, Suspension)
    this.buildUpgradeVisualAccessories();

    // 4. Cargo Bed Visuals
    this.buildBedVisual();

    // 5. Wheels
    this.buildWheels();
  }

  /**
   * ZIL-130 «Ветеран»: Iconic Soviet two-tone hooded truck with rounded cabin,
   * white radiator grille with curved slots, front fender wings, chrome mirrors, roof marker lights.
   */
  private buildZil130Visuals(): void {
    const { materials } = this.scene;
    const { cabin, frame } = this.config;

    // Main Cabin Body
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 1.7, cabin.hz * 1.2), this.truckMat!);
    cab.position.set(0, cabin.y + 0.1, cabin.z - 0.35);
    cab.castShadow = true;

    // Curved White Roof Cap
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2.04, 0.22, cabin.hz * 1.25), materials.truckCabTop);
    roof.position.set(0, cabin.y + cabin.hy * 0.95, cabin.z - 0.35);
    roof.castShadow = true;

    // Roof 3-amber marker lights
    for (const rx of [-0.4, 0, 0.4]) {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), materials.turnSignalAmber);
      marker.rotateX(Math.PI / 2);
      marker.position.set(rx, cabin.y + cabin.hy * 1.08, cabin.z - 0.3);
      this.chassis.add(marker);
    }

    // Rounded Engine Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.55, cabin.hy * 0.95, cabin.hz * 1.15), this.truckMat!);
    hood.position.set(0, cabin.y - 0.25, cabin.z + cabin.hz * 0.42);
    hood.castShadow = true;

    // Rounded Front Fender Wings over front wheels
    for (const side of [-1, 1]) {
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.42, cabin.hy * 0.9, cabin.hz * 1.25), this.truckMat!);
      fender.position.set(side * (cabin.hx * 0.95), cabin.y - 0.28, cabin.z + cabin.hz * 0.38);
      fender.castShadow = true;
      this.chassis.add(fender);
    }

    // Iconic ZIL White Radiator Grille Insert
    const grille = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.35, cabin.hy * 0.82, 0.08), materials.truckWhite);
    grille.position.set(0, cabin.y - 0.25, cabin.z + cabin.hz * 0.98);

    // Grille ventilation ribs
    for (let r = -2; r <= 2; r += 1) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.1, 0.035, 0.09), materials.metalDark);
      rib.position.set(0, cabin.y - 0.25 + r * 0.08, cabin.z + cabin.hz * 0.99);
      this.chassis.add(rib);
    }

    // Front Round Headlights with Chrome Bezels
    for (const side of [-1, 1]) {
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14), materials.headlightBezel);
      bezel.rotateX(Math.PI / 2);
      bezel.position.set(side * (cabin.hx * 0.85), cabin.y - 0.2, cabin.z + cabin.hz * 0.98);

      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.10, 14), materials.headlightGlass);
      lamp.rotateX(Math.PI / 2);
      lamp.position.set(side * (cabin.hx * 0.85), cabin.y - 0.2, cabin.z + cabin.hz * 0.99);

      // Amber turn signal underneath
      const signal = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), materials.turnSignalAmber);
      signal.rotateX(Math.PI / 2);
      signal.position.set(side * (cabin.hx * 0.85), cabin.y - 0.44, cabin.z + cabin.hz * 0.98);

      this.chassis.add(bezel, lamp, signal);
    }

    // Split Windshield with Center Post
    const windshieldL = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 0.82, 0.65, 0.06), materials.glass);
    windshieldL.position.set(-cabin.hx * 0.45, cabin.y + 0.22, cabin.z + 0.25);
    const windshieldR = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 0.82, 0.65, 0.06), materials.glass);
    windshieldR.position.set(cabin.hx * 0.45, cabin.y + 0.22, cabin.z + 0.25);
    const centerPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.68, 0.08), this.truckMat!);
    centerPost.position.set(0, cabin.y + 0.22, cabin.z + 0.26);

    // Side Door Windows & Rear Window
    for (const side of [-1, 1]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, cabin.hz * 0.7), materials.glass);
      sideGlass.position.set(side * (cabin.hx + 0.02), cabin.y + 0.22, cabin.z - 0.35);

      // Chrome Door Handles
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.16), materials.chrome);
      handle.position.set(side * (cabin.hx + 0.03), cabin.y - 0.05, cabin.z - 0.45);

      // Side Mirrors on Tubular Mounts
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), materials.metalDark);
      arm.rotateZ(side * (Math.PI / 3));
      arm.position.set(side * (cabin.hx + 0.16), cabin.y + 0.18, cabin.z + 0.05);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.18), materials.chrome);
      mirror.position.set(side * (cabin.hx + 0.30), cabin.y + 0.22, cabin.z + 0.05);

      this.chassis.add(sideGlass, handle, arm, mirror);
    }

    // Rear Cabin Window
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.1, 0.42, 0.06), materials.glass);
    rearGlass.position.set(0, cabin.y + 0.25, cabin.z - cabin.hz * 0.95);

    // Steering Wheel visible inside
    const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 12), materials.interiorDark);
    steerWheel.rotateX(Math.PI / 3);
    steerWheel.position.set(-0.45, cabin.y + 0.08, cabin.z - 0.05);

    // Heavy Channel Steel Front Bumper with Tow Hooks
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.15, 0.26, 0.2), materials.metal);
    bumper.position.set(0, -0.06, frame.hz + 0.08);

    for (const side of [-1, 1]) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10), materials.metalDark);
      hook.position.set(side * 0.65, -0.06, frame.hz + 0.18);
      this.chassis.add(hook);
    }

    // Fuel Tank on Driver's Side under frame
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.25, 14), materials.metalDark);
    fuelTank.rotateX(Math.PI / 2);
    fuelTank.position.set(-frame.hx * 0.95, -0.08, -0.4);

    // Battery / Toolbox on Passenger's Side
    const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.65), materials.metalDark);
    toolbox.position.set(frame.hx * 0.92, -0.06, -0.4);

    // Exhaust System (underbody pipe routing to driver side rear)
    this.exhaustLocalPos.set(-frame.hx * 0.85, -0.12, -0.95);
    this.exhaustIsVertical = false;

    const exhaustMuffler = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 10), materials.exhaustDark);
    exhaustMuffler.rotateX(Math.PI / 2);
    exhaustMuffler.position.set(-0.35, -0.14, -0.6);

    const tailPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 8), materials.chrome);
    tailPipe.rotateZ(Math.PI / 3);
    tailPipe.position.copy(this.exhaustLocalPos);

    this.chassis.add(
      cab,
      roof,
      hood,
      grille,
      windshieldL,
      windshieldR,
      centerPost,
      rearGlass,
      steerWheel,
      bumper,
      fuelTank,
      toolbox,
      exhaustMuffler,
      tailPipe,
    );
  }

  /**
   * GAZ-66 «Шишига»: Forward-control (cab-over-engine) military 4x4 with winch, snorkel,
   * roof observation hatch, spare wheel carrier behind cab, high portal axles.
   */
  private buildGaz66Visuals(): void {
    const { materials } = this.scene;
    const { cabin, frame } = this.config;

    // Main Cab-over Box with Chamfered Front
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 1.85, cabin.hz * 1.95), this.truckMat!);
    cab.position.set(0, cabin.y + 0.05, cabin.z);
    cab.castShadow = true;

    // Sloped Military Roof Panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2.02, 0.18, cabin.hz * 1.98), materials.truckCabTop);
    roof.position.set(0, cabin.y + cabin.hy * 0.98, cabin.z);
    roof.castShadow = true;

    // Roof Observation Hatch
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12), materials.metalDark);
    hatch.position.set(0.35, cabin.y + cabin.hy * 1.08, cabin.z - 0.15);

    // Dual Panoramic Split Windshields
    for (const side of [-1, 1]) {
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 0.88, 0.68, 0.06), materials.glass);
      windshield.position.set(side * (cabin.hx * 0.48), cabin.y + 0.25, cabin.z + cabin.hz + 0.02);

      // Wiper blades
      const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.38, 0.03), materials.metalDark);
      wiper.rotateZ(side * 0.4);
      wiper.position.set(side * (cabin.hx * 0.48), cabin.y + 0.22, cabin.z + cabin.hz + 0.06);

      // Side Windows
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, cabin.hz * 0.8), materials.glass);
      sideGlass.position.set(side * (cabin.hx + 0.02), cabin.y + 0.25, cabin.z - 0.1);

      // Heavy Military Side Mirrors on Dual Struts
      const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), materials.metalDark);
      strut1.rotateZ(side * (Math.PI / 4));
      strut1.position.set(side * (cabin.hx + 0.18), cabin.y + 0.35, cabin.z + cabin.hz * 0.6);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.22), materials.metalDark);
      mirror.position.set(side * (cabin.hx + 0.32), cabin.y + 0.32, cabin.z + cabin.hz * 0.6);

      this.chassis.add(windshield, wiper, sideGlass, strut1, mirror);
    }

    // Front Grille Mesh and Round Headlights with Protective Stone Guards
    const grilleMesh = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.5, 0.32, 0.04), materials.metalDark);
    grilleMesh.position.set(0, cabin.y - 0.28, cabin.z + cabin.hz + 0.02);

    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14), materials.headlightGlass);
      lamp.rotateX(Math.PI / 2);
      lamp.position.set(side * (cabin.hx * 0.72), cabin.y - 0.18, cabin.z + cabin.hz + 0.03);

      // Stone guard cross-bars over headlight
      const guardH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), materials.metalDark);
      guardH.position.set(side * (cabin.hx * 0.72), cabin.y - 0.18, cabin.z + cabin.hz + 0.08);
      const guardV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.03), materials.metalDark);
      guardV.position.set(side * (cabin.hx * 0.72), cabin.y - 0.18, cabin.z + cabin.hz + 0.08);

      // Rectangular Turn Signal
      const signal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.05), materials.turnSignalAmber);
      signal.position.set(side * (cabin.hx * 0.72), cabin.y - 0.42, cabin.z + cabin.hz + 0.03);

      this.chassis.add(lamp, guardH, guardV, signal);
    }

    // Heavy Military Front Bumper with Mechanical Winch
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.2, 0.28, 0.24), materials.metalDark);
    bumper.position.set(0, -0.04, frame.hz + 0.08);

    const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.52, 12), materials.metalDark);
    winchDrum.rotateZ(Math.PI / 2);
    winchDrum.position.set(0, -0.02, frame.hz + 0.24);

    const winchHook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 10), materials.chrome);
    winchHook.position.set(0, -0.02, frame.hz + 0.34);

    // Snorkel Air Intake on Right Side with Cyclone Cap
    const snorkelPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.45, 8), materials.metalDark);
    snorkelPipe.position.set(cabin.hx + 0.08, cabin.y + 0.35, cabin.z + 0.2);

    const snorkelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.16, 10), materials.metalDark);
    snorkelCap.position.set(cabin.hx + 0.08, cabin.y + 1.12, cabin.z + 0.2);

    // Full-size Spare Wheel mounted behind Cabin
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.24, 16), materials.tire);
    spareTire.rotateY(Math.PI / 2);
    spareTire.position.set(-0.25, cabin.y + 0.1, cabin.z - cabin.hz - 0.22);

    const spareRack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.1), materials.metalDark);
    spareRack.position.set(-0.25, cabin.y + 0.1, cabin.z - cabin.hz - 0.08);

    // Military Jerry Cans on Frame Rail
    const jerryCan = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.32), materials.jerryCanGreen);
    jerryCan.position.set(frame.hx * 0.88, -0.05, 0.1);

    // Exhaust tailpipe
    this.exhaustLocalPos.set(frame.hx * 0.82, -0.12, -0.85);
    this.exhaustIsVertical = false;

    const tailPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), materials.metalDark);
    tailPipe.rotateZ(-Math.PI / 3);
    tailPipe.position.copy(this.exhaustLocalPos);

    this.chassis.add(
      cab,
      roof,
      hatch,
      grilleMesh,
      bumper,
      winchDrum,
      winchHook,
      snorkelPipe,
      snorkelCap,
      spareTire,
      spareRack,
      jerryCan,
      tailPipe,
    );
  }

  /**
   * KrAZ-255 «Богатырь»: Giant 3-axle 6x6 with massive flat-paneled cab,
   * huge long hood, giant balloon tires ("Лапти"), tall vertical exhaust stack, dual fuel tanks.
   */
  private buildKraz255Visuals(): void {
    const { materials } = this.scene;
    const { cabin, frame } = this.config;

    // Massive Flat Wooden/Steel Cabin Structure
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 1.85, cabin.hz * 1.05), this.truckMat!);
    cab.position.set(0, cabin.y + 0.08, cabin.z - 0.35);
    cab.castShadow = true;

    // Heavy Roof with Sun Visor
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2.06, 0.18, cabin.hz * 1.15), materials.truckCabTop);
    roof.position.set(0, cabin.y + cabin.hy * 0.98, cabin.z - 0.35);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2.1, 0.14, 0.32), materials.metalDark);
    visor.rotateX(0.25);
    visor.position.set(0, cabin.y + cabin.hy * 0.94, cabin.z + 0.28);

    // Massive Long Square Nose Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.72, cabin.hy * 0.98, cabin.hz * 1.45), this.truckMat!);
    hood.position.set(0, cabin.y - 0.15, cabin.z + cabin.hz * 0.65);
    hood.castShadow = true;

    // Side Hood Engine Cooling Louvers
    for (const side of [-1, 1]) {
      const louvers = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, cabin.hz * 0.9), materials.metalDark);
      louvers.position.set(side * (cabin.hx * 0.87), cabin.y - 0.12, cabin.z + cabin.hz * 0.65);
      this.chassis.add(louvers);
    }

    // Massive Vertical Radiator Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.62, cabin.hy * 0.92, 0.08), materials.metalDark);
    grille.position.set(0, cabin.y - 0.15, cabin.z + cabin.hz * 1.38);

    // Front Dual Round Headlights with Heavy Protective Steel Grilles
    for (const side of [-1, 1]) {
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 12), materials.metalDark);
      bucket.rotateX(Math.PI / 2);
      bucket.position.set(side * (cabin.hx * 0.92), cabin.y - 0.15, cabin.z + cabin.hz * 1.36);

      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12), materials.headlightGlass);
      lamp.rotateX(Math.PI / 2);
      lamp.position.set(side * (cabin.hx * 0.92), cabin.y - 0.15, cabin.z + cabin.hz * 1.38);

      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 10), materials.metal);
      guard.position.set(side * (cabin.hx * 0.92), cabin.y - 0.15, cabin.z + cabin.hz * 1.48);

      this.chassis.add(bucket, lamp, guard);
    }

    // Split Windshield with Thick Center Frame
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.82, 0.68, 0.06), materials.glass);
    windshield.position.set(0, cabin.y + 0.25, cabin.z + 0.18);

    // Huge Channel Steel Front Bumper with Heavy Push-Bar
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.25, 0.34, 0.28), materials.metalDark);
    bumper.position.set(0, -0.02, frame.hz + 0.12);

    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 1.5, 0.12, 0.12), materials.metal);
    pushBar.position.set(0, 0.22, frame.hz + 0.22);

    // Iconic Tall Vertical Exhaust Stack behind Cab with Rain Flap
    this.exhaustLocalPos.set(cabin.hx * 0.92, cabin.y + cabin.hy + 0.75, cabin.z - 0.65);
    this.exhaustIsVertical = true;

    const stackPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.1, 10), materials.exhaustDark);
    stackPipe.position.set(cabin.hx * 0.92, cabin.y + 0.45, cabin.z - 0.65);

    const rainCap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), materials.metalDark);
    rainCap.rotateX(-0.35);
    rainCap.position.set(cabin.hx * 0.92, cabin.y + cabin.hy + 0.82, cabin.z - 0.65);

    // Dual Heavy Fuel Tanks on Both Sides
    for (const side of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 14), materials.metalDark);
      tank.rotateX(Math.PI / 2);
      tank.position.set(side * (frame.hx * 0.96), -0.05, -0.45);

      // Metal Mounting Straps
      for (const sz of [-0.45, 0.45]) {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 12), materials.metal);
        strap.rotateY(Math.PI / 2);
        strap.position.set(side * (frame.hx * 0.96), -0.05, -0.45 + sz);
        this.chassis.add(strap);
      }
      this.chassis.add(tank);
    }

    this.chassis.add(cab, roof, visor, hood, grille, windshield, bumper, pushBar, stackPipe, rainCap);
  }

  /**
   * Ural-4320 «Тайфун»: Aggressive aerodynamic sloped hood, expedition bullbar,
   * roof halogen rack ("люстра"), dual air horns, high snorkel, expedition cage.
   */
  private buildUral4320Visuals(): void {
    const { materials } = this.scene;
    const { cabin, frame } = this.config;

    // Main Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 1.85, cabin.hz * 1.05), this.truckMat!);
    cab.position.set(0, cabin.y + 0.05, cabin.z - 0.25);
    cab.castShadow = true;

    // Aerodynamic Sloped Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.68, cabin.hy * 0.85, cabin.hz * 1.25), this.truckMat!);
    hood.position.set(0, cabin.y - 0.16, cabin.z + cabin.hz * 0.52);
    hood.castShadow = true;

    // Radiator Grille with Ural Emblem
    const grille = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.45, cabin.hy * 0.78, 0.06), materials.metalDark);
    grille.position.set(0, cabin.y - 0.16, cabin.z + cabin.hz * 1.15);

    // Headlights
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12), materials.headlightGlass);
      lamp.rotateX(Math.PI / 2);
      lamp.position.set(side * (cabin.hx * 0.78), cabin.y - 0.14, cabin.z + cabin.hz * 1.14);

      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 12), materials.headlightBezel);
      bezel.position.set(side * (cabin.hx * 0.78), cabin.y - 0.14, cabin.z + cabin.hz * 1.18);

      const signal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), materials.turnSignalAmber);
      signal.position.set(side * (cabin.hx * 0.78), cabin.y - 0.36, cabin.z + cabin.hz * 1.14);

      this.chassis.add(lamp, bezel, signal);
    }

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.78, 0.66, 0.06), materials.glass);
    windshield.position.set(0, cabin.y + 0.24, cabin.z + 0.28);

    // Heavy Off-road Bullbar / Brush Guard with Winch
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.2, 0.32, 0.24), materials.metalDark);
    bumper.position.set(0, -0.04, frame.hz + 0.1);

    const bullbar = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 1.6, 0.65, 0.08), materials.rollcage);
    bullbar.position.set(0, 0.35, frame.hz + 0.2);

    const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.48, 12), materials.metal);
    winch.rotateZ(Math.PI / 2);
    winch.position.set(0, -0.02, frame.hz + 0.24);

    // Roof Expedition Rack with 5 Halogen Spotlights ("Люстра")
    const rack = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.85, 0.12, cabin.hz * 0.95), materials.rollcage);
    rack.position.set(0, cabin.y + cabin.hy + 0.08, cabin.z - 0.25);

    for (let s = -2; s <= 2; s += 1) {
      const spotHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 10), materials.metalDark);
      spotHousing.rotateX(Math.PI / 2);
      spotHousing.position.set(s * 0.36, cabin.y + cabin.hy + 0.18, cabin.z + 0.18);

      const spotGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 10), materials.headlightGlass);
      spotGlass.rotateX(Math.PI / 2);
      spotGlass.position.set(s * 0.36, cabin.y + cabin.hy + 0.18, cabin.z + 0.19);

      this.chassis.add(spotHousing, spotGlass);
    }

    // Dual Chrome Air Horns on Roof
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.025, 0.45, 8), materials.chrome);
      horn.rotateX(-Math.PI / 2);
      horn.position.set(side * 0.72, cabin.y + cabin.hy + 0.18, cabin.z - 0.35);
      this.chassis.add(horn);
    }

    // Snorkel on Right A-pillar
    const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.55, 8), materials.rollcage);
    snorkel.position.set(cabin.hx + 0.08, cabin.y + 0.35, cabin.z + 0.12);

    // High Side Exhaust Stack
    this.exhaustLocalPos.set(-cabin.hx * 0.88, cabin.y + cabin.hy + 0.65, cabin.z - 0.6);
    this.exhaustIsVertical = true;

    const stackPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 10), materials.exhaustDark);
    stackPipe.position.set(-cabin.hx * 0.88, cabin.y + 0.35, cabin.z - 0.6);

    const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.1, 10, 1, true), materials.metal);
    heatShield.position.set(-cabin.hx * 0.88, cabin.y + 0.45, cabin.z - 0.6);

    this.chassis.add(cab, hood, grille, windshield, bumper, bullbar, winch, rack, snorkel, stackPipe, heatShield);
  }

  /**
   * Visual accessories corresponding to Engine & Suspension upgrade tiers.
   */
  private buildUpgradeVisualAccessories(): void {
    const { materials } = this.scene;
    const { frame } = this.config;
    const engLvl = this.currentUpgrades.engine;
    const suspLvl = this.currentUpgrades.suspension;

    // 1. High Engine Upgrades: Add chrome turbo plumbing / dual exhaust tips
    if (engLvl >= 3) {
      const turboAirIntake = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12), materials.chrome);
      turboAirIntake.rotateZ(Math.PI / 2);
      turboAirIntake.position.set(frame.hx * 0.75, 0.3, frame.hz * 0.65);
      this.chassis.add(turboAirIntake);
    }

    // 2. High Suspension Upgrades: Add visible performance shock absorber coils & heavy leaf spring packs
    if (suspLvl >= 1) {
      for (const w of this.config.wheels) {
        // Red / Gold Performance Coilover Spring
        const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.38, 8), materials.suspensionSpring);
        spring.position.set(w.x * 0.72, 0.15, w.z);

        // Heavy leaf spring pack
        const leafSpring = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.85), materials.metalDark);
        leafSpring.position.set(w.x * 0.82, -0.05, w.z);

        this.chassis.add(spring, leafSpring);
      }
    }
  }

  /**
   * Detailed Cargo Bed with tiered upgrades (side stakes, metal mesh, heavy armored walls).
   */
  private buildBedVisual(): void {
    const { materials } = this.scene;
    const { bed, style } = this.config;

    const extraWall = this.currentUpgrades.sides * 0.12;
    const wallHalfY = bed.wallHalfY + extraWall;
    const wallLength = bed.frontZ - bed.backZ;
    const wallCentreZ = (bed.frontZ + bed.backZ) / 2;
    const wallY = bed.floorY + wallHalfY;

    // Wooden / Steel Bed Floor with Plank Seams
    const floor = new THREE.Mesh(new THREE.BoxGeometry(bed.innerHalfX * 2, 0.08, wallLength), this.truckDarkMat ?? materials.truckDark);
    floor.position.set(0, bed.floorY + 0.04, wallCentreZ);
    floor.receiveShadow = true;
    this.chassis.add(floor);

    // Left and right side walls
    const sideGeometry = new THREE.BoxGeometry(bed.wallThickness * 2, wallHalfY * 2, wallLength);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(sideGeometry, this.truckDarkMat ?? materials.truckDark);
      wall.position.set(side * (bed.innerHalfX + bed.wallThickness), wallY, wallCentreZ);
      wall.castShadow = true;
      this.chassis.add(wall);

      // Vertical reinforcement stakes along the sides
      const stakeCount = 5;
      for (let s = 0; s < stakeCount; s += 1) {
        const sz = bed.backZ + (wallLength / (stakeCount - 1)) * s;
        const stake = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallHalfY * 2.2, 0.06), materials.woodDark);
        stake.position.set(side * (bed.innerHalfX + bed.wallThickness * 2.2), wallY, sz);
        this.chassis.add(stake);
      }
    }

    // Front and back end caps
    const capGeometry = new THREE.BoxGeometry((bed.innerHalfX + bed.wallThickness * 2) * 2, wallHalfY * 2, bed.wallThickness * 2);
    for (const z of [bed.frontZ + bed.wallThickness, bed.backZ - bed.wallThickness]) {
      const cap = new THREE.Mesh(capGeometry, this.truckDarkMat ?? materials.truckDark);
      cap.position.set(0, wallY, z);
      cap.castShadow = true;
      this.chassis.add(cap);
    }

    // Rear Mudflaps behind rear wheels
    const rearZ = this.config.wheels[this.config.wheels.length - 1].z;
    for (const side of [-1, 1]) {
      const mudflap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 0.04), materials.mudflap);
      mudflap.position.set(side * (this.config.wheelOffsetX * 0.95), -0.15, rearZ - this.config.wheelRadius - 0.12);

      // White hazard line on mudflap
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.05), materials.hazardYellow);
      stripe.position.set(side * (this.config.wheelOffsetX * 0.95), -0.28, rearZ - this.config.wheelRadius - 0.12);

      // Rear Taillights (Red Brake + Amber Turn)
      const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.05), materials.taillightRed);
      redLight.position.set(side * (bed.innerHalfX + 0.02), bed.floorY - 0.05, bed.backZ - 0.08);

      const amberLight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.05), materials.turnSignalAmber);
      amberLight.position.set(side * (bed.innerHalfX - 0.12), bed.floorY - 0.05, bed.backZ - 0.08);

      this.chassis.add(mudflap, stripe, redLight, amberLight);
    }

    // High Sides Upgrade Visuals: Extra Extension Mesh / Steel Cage (Tiers 2 & 3)
    if (this.currentUpgrades.sides >= 2) {
      const cageY = wallY + wallHalfY + 0.22;
      for (const side of [-1, 1]) {
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, wallLength), materials.metal);
        topRail.position.set(side * (bed.innerHalfX + bed.wallThickness), cageY, wallCentreZ);
        this.chassis.add(topRail);
      }
    }

    // Expedition Rollcage for Ural-4320
    if (style === 'expedition-6x6') {
      const cageHeight = 1.45;
      for (const z of [bed.frontZ + 0.2, wallCentreZ, bed.backZ - 0.2]) {
        const arch = new THREE.Mesh(new THREE.BoxGeometry((bed.innerHalfX + 0.08) * 2, 0.06, 0.06), materials.rollcage);
        arch.position.set(0, bed.floorY + cageHeight, z);
        this.chassis.add(arch);

        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, cageHeight, 0.06), materials.rollcage);
          post.position.set(side * (bed.innerHalfX + 0.06), bed.floorY + cageHeight * 0.5, z);
          this.chassis.add(post);
        }
      }

      for (const side of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, wallLength), materials.rollcage);
        bar.position.set(side * (bed.innerHalfX + 0.06), bed.floorY + cageHeight, wallCentreZ);
        this.chassis.add(bar);
      }
    }
  }

  /**
   * High-performance merged wheel models with rims, wheel hub caps, and aggressive 3D tread lugs.
   * Merges all sub-parts into single geometries per material, eliminating 100+ separate meshes and draw calls.
   */
  private buildWheels(): void {
    const { materials } = this.scene;
    const r = this.config.wheelRadius;
    const hw = this.config.wheelHalfWidth;
    const susp = this.config.suspension;
    const tireTier = this.currentUpgrades.tires;
    const isHeavyKraz = this.config.style === 'heavy-6x6';

    // 1. Build Merged Tire Geometry (cylinder + 3D offroad tread lugs) once for the truck
    const tireCylinder = new THREE.CylinderGeometry(r, r, hw * 2, 18);
    tireCylinder.rotateZ(Math.PI / 2);
    const tireParts: THREE.BufferGeometry[] = [tireCylinder];

    const lugCount = isHeavyKraz ? 16 : 14;
    const lugHeight = 0.035 + tireTier * 0.015;
    const lugWidth = hw * 1.85;

    for (let l = 0; l < lugCount; l += 1) {
      const angle = (l / lugCount) * Math.PI * 2;
      const lx = 0;
      const ly = Math.cos(angle) * (r + lugHeight * 0.45);
      const lz = Math.sin(angle) * (r + lugHeight * 0.45);

      const lugGeom = new THREE.BoxGeometry(lugWidth, lugHeight, 0.08 + tireTier * 0.02);
      lugGeom.rotateX(-angle);
      lugGeom.translate(lx, ly, lz);
      tireParts.push(lugGeom);
    }
    const mergedTireGeometry = BufferGeometryUtils.mergeGeometries(tireParts, false);

    // 2. Build Merged Steel Rim Geometry (rim dish + hub + spoke) once for the truck
    const rimGeom = new THREE.CylinderGeometry(r * 0.62, r * 0.62, hw * 1.95, 14);
    rimGeom.rotateZ(Math.PI / 2);
    const hubGeom = new THREE.CylinderGeometry(r * 0.28, r * 0.28, hw * 2.15, 10);
    hubGeom.rotateZ(Math.PI / 2);
    const spokeGeom = new THREE.BoxGeometry(hw * 2.05, r * 1.15, 0.09);
    const mergedRimGeometry = BufferGeometryUtils.mergeGeometries([rimGeom, hubGeom, spokeGeom], false);

    for (const w of this.config.wheels) {
      const steer = new THREE.Group();
      const spin = new THREE.Group();

      const tireMesh = new THREE.Mesh(mergedTireGeometry, this.tireMat ?? materials.tire);
      tireMesh.castShadow = true;

      const rimMesh = new THREE.Mesh(mergedRimGeometry, materials.rim);

      spin.add(tireMesh, rimMesh);
      steer.add(spin);
      steer.position.set(w.x, susp.connectionY - susp.restLength, w.z);
      this.chassis.add(steer);

      this.wheels.push({
        steer,
        spin,
        tireMesh,
        isSteering: w.isSteering,
        isDrive: w.isDrive,
      });
    }
  }
}
