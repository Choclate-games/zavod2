import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { InputSnapshot, SaveData } from '../core/types';
import { PhysicsWorld, WHEEL_RAY_GROUPS } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';
import { BED, BRAKE, CABIN, ENGINE, FRAME, MASS, RIDE_HEIGHT, STEERING, SUSPENSION, TIRE, WHEEL } from './truckSpec';

const FRONT_WHEELS = [0, 1];
const REAR_WHEELS = [2, 3];
const SPAWN_Z = 2;

interface WheelRig {
  steer: THREE.Group;
  spin: THREE.Group;
}

/**
 * The truck is a single dynamic chassis body driven by Rapier's ray-cast vehicle controller.
 * Wheels are not physical bodies: each one is a suspension ray, and its visual rig hangs off
 * the chassis group so it inherits the body's roll and pitch exactly.
 */
export class TruckController {
  readonly chassis = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);
  speed = 0;
  positionZ = SPAWN_Z;
  private body: RAPIER.RigidBody | null = null;
  private vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  private readonly wheels: WheelRig[] = [];
  private readonly spawn = new THREE.Vector3();
  private steerAngle = 0;
  private upsideDownFor = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {}

  /** Built exactly once. A run reset only teleports the body — it never re-creates meshes or bodies. */
  build(): void {
    this.spawn.set(0, this.road.roadHeightAt(SPAWN_Z) + RIDE_HEIGHT + 0.1, SPAWN_Z);
    this.scene.truckGroup.add(this.chassis);
    this.buildVisuals();
    this.body = this.physics.createChassis(this.chassis, this.spawn);
    this.buildColliders();
    this.buildVehicle();
    this.reset();
  }

  reset(): void {
    if (!this.body) return;
    this.physics.placeBody(this.body, this.spawn);
    this.steerAngle = 0;
    this.upsideDownFor = 0;
    this.speed = 0;
    this.position.copy(this.spawn);
    this.rotation.identity();
    this.forward.set(0, 0, 1);
    this.positionZ = this.spawn.z;
    this.chassis.position.copy(this.spawn);
    this.chassis.quaternion.identity();
    if (this.vehicle) {
      for (let i = 0; i < this.wheels.length; i += 1) {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 0);
        this.vehicle.setWheelSteering(i, 0);
      }
    }
  }

  /**
   * Chassis-local point → world space, taken from the rigid body rather than the scene graph
   * so it is correct even before the first render has updated any matrices.
   */
  localToWorld(local: THREE.Vector3): THREE.Vector3 {
    return local.applyQuaternion(this.rotation).add(this.position);
  }

  fixedUpdate(dt: number, controls: InputSnapshot, upgrades: SaveData['upgrades']): void {
    const vehicle = this.vehicle;
    const body = this.body;
    if (!vehicle || !body) return;

    const speed = vehicle.currentVehicleSpeed();
    this.applySteering(vehicle, dt, controls, speed);
    this.applyDrive(vehicle, controls, upgrades, speed);
    vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);

    this.speed = Math.abs(speed) * 3.6;
    const p = body.translation();
    const r = body.rotation();
    this.position.set(p.x, p.y, p.z);
    this.rotation.set(r.x, r.y, r.z, r.w);
    this.positionZ = p.z;
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);
    this.recoverFromRollover(body, dt);
  }

  /** Wheels read their transform straight from the controller, so they always meet the ground. */
  render(_alpha: number): void {
    const vehicle = this.vehicle;
    if (!vehicle) return;
    for (let i = 0; i < this.wheels.length; i += 1) {
      const rig = this.wheels[i];
      const suspension = vehicle.wheelSuspensionLength(i) ?? SUSPENSION.restLength;
      rig.steer.position.y = WHEEL.connectionY - suspension;
      rig.steer.rotation.y = vehicle.wheelSteering(i) ?? 0;
      rig.spin.rotation.x = vehicle.wheelRotation(i) ?? 0;
    }
  }

  private applySteering(vehicle: RAPIER.DynamicRayCastVehicleController, dt: number, controls: InputSnapshot, speed: number): void {
    const lock = STEERING.maxAngle / (1 + Math.abs(speed) * STEERING.speedFalloff);
    const target = controls.steer * lock;
    const rate = (controls.steer === 0 ? STEERING.returnRate : STEERING.turnRate) * dt;
    this.steerAngle += THREE.MathUtils.clamp(target - this.steerAngle, -rate, rate);
    for (const index of FRONT_WHEELS) vehicle.setWheelSteering(index, this.steerAngle);
  }

  private applyDrive(
    vehicle: RAPIER.DynamicRayCastVehicleController,
    controls: InputSnapshot,
    upgrades: SaveData['upgrades'],
    speed: number,
  ): void {
    const maxSpeed = ENGINE.maxSpeed + upgrades.engine * ENGINE.speedPerUpgrade;
    const power = ENGINE.baseForce + upgrades.engine * ENGINE.forcePerUpgrade;
    let engineForce = 0;
    let brake: number = BRAKE.idle;

    if (controls.throttle > 0 && speed > -0.6) {
      // Force tapers to zero at top speed instead of a hard clamp, so hills still bog the truck down.
      engineForce = power * controls.throttle * Math.max(0, 1 - Math.max(0, speed) / maxSpeed);
      brake = 0;
    } else if (controls.brake > 0 && speed < 0.6) {
      engineForce = -ENGINE.reverseForce * controls.brake * Math.max(0, 1 - Math.abs(Math.min(0, speed)) / ENGINE.maxReverseSpeed);
      brake = 0;
    } else if (controls.brake > 0 || (controls.throttle > 0 && speed <= -0.6)) {
      brake = BRAKE.foot;
    }

    if (controls.handbrake) {
      engineForce = 0;
      brake = BRAKE.hand;
    }

    for (const index of REAR_WHEELS) vehicle.setWheelEngineForce(index, engineForce);
    for (let i = 0; i < this.wheels.length; i += 1) vehicle.setWheelBrake(i, brake);
  }

  /** A tipped-over truck is a dead run otherwise: flip it back after a beat instead of stranding the player. */
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

  private buildVehicle(): void {
    const body = this.body;
    if (!body) return;
    const vehicle = this.physics.createVehicle(body);
    vehicle.indexUpAxis = 1;
    vehicle.setIndexForwardAxis = 2;
    const direction = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };
    // Order matters: FRONT_WHEELS / REAR_WHEELS index into this list.
    for (const z of [WHEEL.frontZ, WHEEL.rearZ]) {
      for (const x of [-WHEEL.offsetX, WHEEL.offsetX]) {
        vehicle.addWheel({ x, y: WHEEL.connectionY, z }, direction, axle, SUSPENSION.restLength, WHEEL.radius);
      }
    }
    for (let i = 0; i < 4; i += 1) {
      vehicle.setWheelSuspensionStiffness(i, SUSPENSION.stiffness);
      vehicle.setWheelSuspensionCompression(i, SUSPENSION.compression);
      vehicle.setWheelSuspensionRelaxation(i, SUSPENSION.relaxation);
      vehicle.setWheelMaxSuspensionTravel(i, SUSPENSION.maxTravel);
      vehicle.setWheelMaxSuspensionForce(i, SUSPENSION.maxForce);
      vehicle.setWheelFrictionSlip(i, TIRE.frictionSlip);
      vehicle.setWheelSideFrictionStiffness(i, TIRE.sideFrictionStiffness);
    }
    this.vehicle = vehicle;
  }

  private buildColliders(): void {
    const body = this.body;
    if (!body) return;
    const wallHalfZ = (BED.frontZ - BED.backZ) / 2;
    const wallCentreZ = (BED.frontZ + BED.backZ) / 2;
    const wallY = BED.floorY + BED.wallHalfY;
    this.physics.addBoxCollider(body, new THREE.Vector3(FRAME.hx, FRAME.hy, FRAME.hz), new THREE.Vector3(0, 0, 0), MASS.frame);
    this.physics.addBoxCollider(body, new THREE.Vector3(CABIN.hx, CABIN.hy, CABIN.hz), new THREE.Vector3(0, CABIN.y, CABIN.z), MASS.cabin);
    for (const side of [-1, 1]) {
      this.physics.addBoxCollider(
        body,
        new THREE.Vector3(BED.wallThickness, BED.wallHalfY, wallHalfZ),
        new THREE.Vector3(side * (BED.innerHalfX + BED.wallThickness), wallY, wallCentreZ),
        MASS.wall,
      );
    }
    for (const z of [BED.frontZ + BED.wallThickness, BED.backZ - BED.wallThickness]) {
      this.physics.addBoxCollider(
        body,
        new THREE.Vector3(BED.innerHalfX + BED.wallThickness * 2, BED.wallHalfY, BED.wallThickness),
        new THREE.Vector3(0, wallY, z),
        MASS.wall,
      );
    }
  }

  private buildVisuals(): void {
    const { materials } = this.scene;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(FRAME.hx * 2, FRAME.hy * 2, FRAME.hz * 2), materials.truck);
    frame.castShadow = true;
    this.chassis.add(frame);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(CABIN.hx * 2, CABIN.hy * 2, CABIN.hz * 2), materials.truck);
    cabin.position.set(0, CABIN.y, CABIN.z);
    cabin.castShadow = true;
    this.chassis.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(CABIN.hx * 1.7, 0.72, 0.08), materials.glass);
    windshield.position.set(0, CABIN.y + 0.18, CABIN.z + CABIN.hz + 0.02);
    this.chassis.add(windshield);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(FRAME.hx * 2, 0.22, 0.18), materials.metal);
    bumper.position.set(0, -0.05, FRAME.hz + 0.05);
    this.chassis.add(bumper);

    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.1), materials.glass);
      lamp.position.set(side * 0.78, 0.24, FRAME.hz + 0.02);
      this.chassis.add(lamp);
    }

    this.buildBedVisual();
    this.buildWheels();
  }

  private buildBedVisual(): void {
    const { materials } = this.scene;
    const wallLength = BED.frontZ - BED.backZ;
    const wallCentreZ = (BED.frontZ + BED.backZ) / 2;
    const wallY = BED.floorY + BED.wallHalfY;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(BED.innerHalfX * 2, 0.08, wallLength), materials.truckDark);
    floor.position.set(0, BED.floorY + 0.04, wallCentreZ);
    floor.receiveShadow = true;
    this.chassis.add(floor);

    const sideGeometry = new THREE.BoxGeometry(BED.wallThickness * 2, BED.wallHalfY * 2, wallLength);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(sideGeometry, materials.truckDark);
      wall.position.set(side * (BED.innerHalfX + BED.wallThickness), wallY, wallCentreZ);
      wall.castShadow = true;
      this.chassis.add(wall);
    }
    const capGeometry = new THREE.BoxGeometry((BED.innerHalfX + BED.wallThickness * 2) * 2, BED.wallHalfY * 2, BED.wallThickness * 2);
    for (const z of [BED.frontZ + BED.wallThickness, BED.backZ - BED.wallThickness]) {
      const cap = new THREE.Mesh(capGeometry, materials.truckDark);
      cap.position.set(0, wallY, z);
      cap.castShadow = true;
      this.chassis.add(cap);
    }
  }

  /**
   * One group per degree of freedom: `steer` yaws with the steering angle and slides along the
   * suspension, `spin` rolls. Merging them into one Euler would visibly skew the front wheels.
   */
  private buildWheels(): void {
    const { materials } = this.scene;
    const tireGeometry = new THREE.CylinderGeometry(WHEEL.radius, WHEEL.radius, WHEEL.halfWidth * 2, 22);
    tireGeometry.rotateZ(Math.PI / 2);
    const rimGeometry = new THREE.CylinderGeometry(WHEEL.radius * 0.62, WHEEL.radius * 0.62, WHEEL.halfWidth * 1.96, 14);
    rimGeometry.rotateZ(Math.PI / 2);
    const spokeGeometry = new THREE.BoxGeometry(WHEEL.halfWidth * 2.1, WHEEL.radius * 1.15, 0.08);

    for (const z of [WHEEL.frontZ, WHEEL.rearZ]) {
      for (const x of [-WHEEL.offsetX, WHEEL.offsetX]) {
        const steer = new THREE.Group();
        const spin = new THREE.Group();
        const tire = new THREE.Mesh(tireGeometry, materials.tire);
        tire.castShadow = true;
        const rim = new THREE.Mesh(rimGeometry, materials.metal);
        const spoke = new THREE.Mesh(spokeGeometry, materials.metal);
        spin.add(tire, rim, spoke);
        steer.add(spin);
        steer.position.set(x, WHEEL.connectionY - SUSPENSION.restLength, z);
        this.chassis.add(steer);
        this.wheels.push({ steer, spin });
      }
    }
  }
}
