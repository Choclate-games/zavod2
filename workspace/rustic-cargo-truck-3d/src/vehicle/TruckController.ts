import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { InputSnapshot, TruckId, TruckUpgrades } from '../core/types';
import { PhysicsWorld, WHEEL_RAY_GROUPS } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';
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

interface MudParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

/**
 * The truck is a dynamic chassis body driven by Rapier's ray-cast vehicle controller.
 * Supports multiple distinct truck chassis (4x2, 4x4, 6x6), visual styling, upgrades,
 * custom paint colors, advanced mud/water physics, dynamic road deformation, and particle spray.
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

  currentTruckId: TruckId = 'zil';
  config: TruckConfig = TRUCKS.zil;

  private body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private readonly wheels: WheelRig[] = [];
  private readonly spawn = new THREE.Vector3();
  private steerAngle = 0;
  private upsideDownFor = 0;
  private prevWheelRotations: number[] = [0, 0, 0, 0, 0, 0];

  private readonly particlePool: MudParticle[] = [];
  private readonly waterParticlePool: MudParticle[] = [];
  private readonly maxParticles = 60;
  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchVec2 = new THREE.Vector3();

  // Materials instances for dynamic mud soiling & color customization
  private truckMat: THREE.MeshLambertMaterial | null = null;
  private tireMat: THREE.MeshLambertMaterial | null = null;
  private baseTruckColor = new THREE.Color(0xc75c32);
  private baseTireColor = new THREE.Color(0x242522);
  private mudColor = new THREE.Color(0x422c1b);

  private currentSidesUpgrade = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {}

  build(truckId: TruckId = 'zil', upgrades?: TruckUpgrades, customColor?: string): void {
    this.currentTruckId = truckId;
    this.config = getTruckConfig(truckId);
    this.currentSidesUpgrade = upgrades?.sides ?? 0;

    const chosenColor = customColor || upgrades?.color || this.config.defaultColor;
    this.baseTruckColor.set(chosenColor);

    this.spawn.set(0, this.road.roadHeightAt(SPAWN_Z) + RIDE_HEIGHT + 0.1, SPAWN_Z);
    this.scene.truckGroup.add(this.chassis);

    this.buildVisuals();
    this.buildParticlePool();
    this.body = this.physics.createChassis(this.chassis, this.spawn);
    this.buildColliders();
    this.buildVehicle(upgrades);
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

    if (this.truckMat) this.truckMat.color.copy(this.baseTruckColor);
    if (this.tireMat) this.tireMat.color.copy(this.baseTireColor);

    // Reset particles
    for (const p of this.particlePool) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const p of this.waterParticlePool) {
      p.active = false;
      p.mesh.visible = false;
    }

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

    const speed = vehicle.currentVehicleSpeed();
    this.applySteering(vehicle, dt, controls, speed, invertSteering);
    this.applyDrive(vehicle, controls, upgrades, speed);
    this.applyEnvironmentalPhysics(vehicle, body, dt, speed, controls, upgrades);

    vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);

    this.speed = Math.abs(speed) * 3.6;
    const p = body.translation();
    const r = body.rotation();
    this.position.set(p.x, p.y, p.z);
    this.rotation.set(r.x, r.y, r.z, r.w);
    this.positionZ = p.z;
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);

    this.updateParticles(dt);
    this.recoverFromRollover(body, dt);
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
    const tireUp = upgrades?.tires ?? 0;
    const frictionDropCoeff = MUD.frictionDrop * (1 - tireUp * 0.20);
    const dragReduction = 1 - tireUp * 0.16;

    const wheelCount = this.wheels.length;

    for (let i = 0; i < wheelCount; i += 1) {
      const inContact = vehicle.wheelIsInContact(i);
      const wheelCfg = this.config.wheels[i] || this.config.wheels[0];
      const wheelWorld = this.localToWorld(this.scratchVec.set(wheelCfg.x, this.config.suspension.connectionY, wheelCfg.z));

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

        // Real-time road rut deformation in mud
        if (mud > 0.04) {
          const rutDepth = (0.015 + mud * 0.035) * (1 + (controls.throttle > 0 ? 0.5 : 0));
          this.road.deformRoad(wheelWorld.x, wheelWorld.z, rutDepth);
        }

        // Particle emissions on spinning tires
        const curRot = vehicle.wheelRotation(i) ?? 0;
        const rotDelta = (curRot - (this.prevWheelRotations[i] ?? 0)) / Math.max(1e-4, dt);
        this.prevWheelRotations[i] = curRot;

        if (mud > 0.12 && Math.abs(rotDelta) > 3.0) {
          this.emitMudSpray(wheelWorld, rotDelta, mud);
        }
        if (water > 0.15 && (Math.abs(speed) > 3.0 || Math.abs(rotDelta) > 4.0)) {
          this.emitWaterSplash(wheelWorld, speed, water);
        }
      }
    }

    this.currentMudFactor = avgMud;
    this.currentWaterFactor = avgWater;
    this.road.flushDeformations();

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

      // Water washes off caked mud!
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

  private emitMudSpray(pos: THREE.Vector3, rotSpeed: number, mud: number): void {
    const count = Math.min(3, Math.round(mud * 2 + Math.abs(rotSpeed) * 0.08));
    for (let c = 0; c < count; c += 1) {
      const p = this.particlePool.find((item) => !item.active);
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.3;
      p.mesh.visible = true;

      // Position at bottom-rear of tire
      const spreadX = (Math.random() - 0.5) * 0.35;
      p.mesh.position.set(pos.x + spreadX, pos.y - this.config.wheelRadius * 0.5 + 0.1, pos.z - 0.2);

      // Velocity: backward spray with upward arc
      const backwardSpeed = -Math.sign(rotSpeed) * (2.5 + Math.random() * 4.5);
      const upwardSpeed = 1.8 + Math.random() * 3.2;
      p.velocity.set(
        spreadX * 4.0,
        upwardSpeed,
        this.forward.z * backwardSpeed + (Math.random() - 0.5) * 1.5,
      );

      const scale = 0.08 + Math.random() * 0.14 * mud;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  private emitWaterSplash(pos: THREE.Vector3, speed: number, water: number): void {
    const count = Math.min(4, Math.round(water * 3 + Math.abs(speed) * 0.2));
    for (let c = 0; c < count; c += 1) {
      const p = this.waterParticlePool.find((item) => !item.active);
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.25;
      p.mesh.visible = true;

      const spreadX = (Math.random() - 0.5) * 0.6;
      p.mesh.position.set(pos.x + spreadX, pos.y - 0.1, pos.z + (Math.random() - 0.5) * 0.4);

      const sideSpeed = spreadX * (5.0 + Math.random() * 5.0);
      const upwardSpeed = 2.4 + Math.random() * 3.8 * water;
      p.velocity.set(sideSpeed, upwardSpeed, (Math.random() - 0.5) * 2.0);

      const scale = 0.12 + Math.random() * 0.18 * water;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.velocity.y -= 14.0 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const groundY = this.road.heightAt(p.mesh.position.x, p.mesh.position.z);
      if (p.mesh.position.y <= groundY) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    for (const p of this.waterParticlePool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 12.0 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      const groundY = this.road.heightAt(p.mesh.position.x, p.mesh.position.z);
      if (p.mesh.position.y <= groundY) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private buildParticlePool(): void {
    const geom = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < this.maxParticles; i += 1) {
      const mesh = new THREE.Mesh(geom, this.scene.materials.mudParticle);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.particlePool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        active: false,
      });
    }

    const waterGeom = new THREE.SphereGeometry(1, 4, 4);
    for (let i = 0; i < this.maxParticles; i += 1) {
      const mesh = new THREE.Mesh(waterGeom, this.scene.materials.waterParticle);
      mesh.visible = false;
      this.scene.particleGroup.add(mesh);
      this.waterParticlePool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  render(_alpha: number): void {
    const vehicle = this.vehicle;
    if (!vehicle) return;
    for (let i = 0; i < this.wheels.length; i += 1) {
      const rig = this.wheels[i];
      const suspension = vehicle.wheelSuspensionLength(i) ?? this.config.suspension.restLength;

      const wheelCfg = this.config.wheels[i] || this.config.wheels[0];
      const wheelWorld = this.localToWorld(this.scratchVec2.set(wheelCfg.x, this.config.suspension.connectionY, wheelCfg.z));
      const mud = this.road.getMudIntensity(wheelWorld.x, wheelWorld.z);
      const sink = mud * MUD.maxSinkDepth;

      rig.steer.position.y = this.config.suspension.connectionY - suspension - sink;
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
    const engUp = upgrades?.engine ?? 0;
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

    const suspUp = upgrades?.suspension ?? 0;
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

    const extraWall = this.currentSidesUpgrade * 0.12;
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
    this.tireMat = materials.tire.clone();

    const { frame, cabin, style } = this.config;

    // 1. Main Frame Chassis
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2, frame.hy * 2, frame.hz * 2), this.truckMat);
    frameMesh.castShadow = true;
    this.chassis.add(frameMesh);

    // 2. Distinct Cabin Mesh per Truck Style
    if (style === 'cab-over') {
      // GAZ-66 Cab-Over style
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 2, cabin.hz * 2), this.truckMat);
      cab.position.set(0, cabin.y, cabin.z);
      cab.castShadow = true;
      this.chassis.add(cab);

      // Panoramic Split Windshield
      for (const side of [-1, 1]) {
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 0.85, 0.65, 0.08), materials.glass);
        windshield.position.set(side * (cabin.hx * 0.48), cabin.y + 0.15, cabin.z + cabin.hz + 0.02);
        this.chassis.add(windshield);
      }

      // Snorkel pipe
      const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), materials.rollcage);
      snorkel.position.set(cabin.hx + 0.06, cabin.y + 0.3, cabin.z - 0.2);
      this.chassis.add(snorkel);

      // Heavy Front Bumper with Winch
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.1, 0.26, 0.22), materials.metal);
      bumper.position.set(0, -0.04, frame.hz + 0.08);
      const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 10), materials.rollcage);
      winch.rotateZ(Math.PI / 2);
      winch.position.set(0, -0.04, frame.hz + 0.22);
      this.chassis.add(bumper, winch);

    } else if (style === 'heavy-6x6') {
      // KRAZ-255 Heavy Long Hood style
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 2, cabin.hz * 1.1), this.truckMat);
      cab.position.set(0, cabin.y, cabin.z - 0.2);
      cab.castShadow = true;

      // Long heavy nose hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.7, cabin.hy * 0.82, cabin.hz * 1.2), this.truckMat);
      hood.position.set(0, cabin.y - 0.1, cabin.z + cabin.hz * 0.55);
      hood.castShadow = true;

      // Massive front grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.6, cabin.hy * 0.75, 0.08), materials.metal);
      grille.position.set(0, cabin.y - 0.1, cabin.z + cabin.hz * 1.16);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.8, 0.68, 0.08), materials.glass);
      windshield.position.set(0, cabin.y + 0.2, cabin.z + 0.36);

      const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.2, 0.32, 0.26), materials.metal);
      bumper.position.set(0, -0.02, frame.hz + 0.08);

      this.chassis.add(cab, hood, grille, windshield, bumper);

    } else if (style === 'expedition-6x6') {
      // URAL-4320 Expedition style
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 2, cabin.hz * 1.05), this.truckMat);
      cab.position.set(0, cabin.y, cabin.z - 0.15);
      cab.castShadow = true;

      // Sloped predatory hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.65, cabin.hy * 0.78, cabin.hz * 1.1), this.truckMat);
      hood.position.set(0, cabin.y - 0.12, cabin.z + cabin.hz * 0.5);
      hood.castShadow = true;

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.75, 0.66, 0.08), materials.glass);
      windshield.position.set(0, cabin.y + 0.2, cabin.z + 0.4);

      // Roof floodlights bar ("Люстра")
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.6, 0.12, 0.12), materials.rollcage);
      lightBar.position.set(0, cabin.y + cabin.hy + 0.1, cabin.z - 0.1);
      for (let s = -2; s <= 2; s += 1) {
        const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 10), materials.gold);
        spot.rotateX(Math.PI / 2);
        spot.position.set(s * 0.35, cabin.y + cabin.hy + 0.1, cabin.z - 0.05);
        this.chassis.add(spot);
      }

      // Snorkel pipe
      const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.5, 8), materials.rollcage);
      snorkel.position.set(cabin.hx + 0.08, cabin.y + 0.35, cabin.z + 0.1);

      const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2.15, 0.3, 0.22), materials.metal);
      bumper.position.set(0, -0.04, frame.hz + 0.08);

      this.chassis.add(cab, hood, windshield, lightBar, snorkel, bumper);

    } else {
      // Classic ZIL-130 Hood style
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 2, cabin.hy * 2, cabin.hz * 2), this.truckMat);
      cab.position.set(0, cabin.y, cabin.z);
      cab.castShadow = true;

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabin.hx * 1.7, 0.72, 0.08), materials.glass);
      windshield.position.set(0, cabin.y + 0.18, cabin.z + cabin.hz + 0.02);

      const bumper = new THREE.Mesh(new THREE.BoxGeometry(frame.hx * 2, 0.22, 0.18), materials.metal);
      bumper.position.set(0, -0.05, frame.hz + 0.05);

      this.chassis.add(cab, windshield, bumper);
    }

    // Headlights
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.1), materials.glass);
      lamp.position.set(side * (frame.hx * 0.72), 0.24, frame.hz + 0.02);
      this.chassis.add(lamp);
    }

    this.buildBedVisual();
    this.buildWheels();
  }

  private buildBedVisual(): void {
    const { materials } = this.scene;
    const { bed, style } = this.config;

    const extraWall = this.currentSidesUpgrade * 0.12;
    const wallHalfY = bed.wallHalfY + extraWall;
    const wallLength = bed.frontZ - bed.backZ;
    const wallCentreZ = (bed.frontZ + bed.backZ) / 2;
    const wallY = bed.floorY + wallHalfY;

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(bed.innerHalfX * 2, 0.08, wallLength), materials.truckDark);
    floor.position.set(0, bed.floorY + 0.04, wallCentreZ);
    floor.receiveShadow = true;
    this.chassis.add(floor);

    // Left and right side walls
    const sideGeometry = new THREE.BoxGeometry(bed.wallThickness * 2, wallHalfY * 2, wallLength);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(sideGeometry, materials.truckDark);
      wall.position.set(side * (bed.innerHalfX + bed.wallThickness), wallY, wallCentreZ);
      wall.castShadow = true;
      this.chassis.add(wall);
    }

    // Front and back end caps
    const capGeometry = new THREE.BoxGeometry((bed.innerHalfX + bed.wallThickness * 2) * 2, wallHalfY * 2, bed.wallThickness * 2);
    for (const z of [bed.frontZ + bed.wallThickness, bed.backZ - bed.wallThickness]) {
      const cap = new THREE.Mesh(capGeometry, materials.truckDark);
      cap.position.set(0, wallY, z);
      cap.castShadow = true;
      this.chassis.add(cap);
    }

    // Special Rollcage frame for Ural-4320 Expedition
    if (style === 'expedition-6x6') {
      const cageHeight = 1.35;
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

      // Longitudinal top bars
      for (const side of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, wallLength), materials.rollcage);
        bar.position.set(side * (bed.innerHalfX + 0.06), bed.floorY + cageHeight, wallCentreZ);
        this.chassis.add(bar);
      }
    }
  }

  private buildWheels(): void {
    const { materials } = this.scene;
    const r = this.config.wheelRadius;
    const hw = this.config.wheelHalfWidth;
    const susp = this.config.suspension;

    const tireGeometry = new THREE.CylinderGeometry(r, r, hw * 2, 22);
    tireGeometry.rotateZ(Math.PI / 2);
    const rimGeometry = new THREE.CylinderGeometry(r * 0.62, r * 0.62, hw * 1.96, 14);
    rimGeometry.rotateZ(Math.PI / 2);
    const spokeGeometry = new THREE.BoxGeometry(hw * 2.1, r * 1.15, 0.08);

    for (const w of this.config.wheels) {
      const steer = new THREE.Group();
      const spin = new THREE.Group();
      const tireMesh = new THREE.Mesh(tireGeometry, this.tireMat ?? materials.tire);
      tireMesh.castShadow = true;
      const rim = new THREE.Mesh(rimGeometry, materials.metal);
      const spoke = new THREE.Mesh(spokeGeometry, materials.metal);
      spin.add(tireMesh, rim, spoke);
      steer.add(spin);
      steer.position.set(w.x, susp.connectionY - susp.restLength, w.z);
      this.chassis.add(steer);
      this.wheels.push({ steer, spin, tireMesh, isSteering: w.isSteering, isDrive: w.isDrive });
    }
  }
}

