import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld, WHEEL_RAY_GROUPS } from '../physics/PhysicsWorld';

export interface RacingCarInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  recover?: boolean;
}

export interface RacingCarSpec {
  wheelRadius: number;
  wheelHalfWidth: number;
  wheelPositions: Array<{ x: number; y: number; z: number; isSteer: boolean; isDrive: boolean }>;
  suspension: {
    connectionY: number;
    restLength: number;
    stiffness: number;
    compression: number;
    relaxation: number;
    maxTravel: number;
    maxForce: number;
  };
  tire: {
    frictionSlip: number;
    sideFrictionStiffness: number;
    driftFrictionSlip: number;
    driftSideFrictionStiffness: number;
  };
  engine: {
    baseForce: number;
    maxSpeed: number; // m/s
    brakeForce: number;
    reverseForce: number;
    maxReverseSpeed: number;
  };
}

export const DEFAULT_SPORTS_SPEC: RacingCarSpec = {
  wheelRadius: 0.35,
  wheelHalfWidth: 0.15,
  wheelPositions: [
    { x: -0.88, y: 0.05, z: 1.25, isSteer: true, isDrive: true },  // Front Left
    { x: 0.88,  y: 0.05, z: 1.25, isSteer: true, isDrive: true },  // Front Right
    { x: -0.90, y: 0.05, z: -1.25, isSteer: false, isDrive: true }, // Rear Left
    { x: 0.90,  y: 0.05, z: -1.25, isSteer: false, isDrive: true }, // Rear Right
  ],
  suspension: {
    connectionY: 0.05,
    restLength: 0.26,
    stiffness: 85.0,
    compression: 4.2,
    relaxation: 6.0,
    maxTravel: 0.22,
    maxForce: 38000.0,
  },
  tire: {
    frictionSlip: 3.2,
    sideFrictionStiffness: 1.6,
    driftFrictionSlip: 0.85,
    driftSideFrictionStiffness: 0.55,
  },
  engine: {
    baseForce: 4200.0,
    maxSpeed: 60.0, // ~216 km/h
    brakeForce: 5200.0,
    reverseForce: 1600.0,
    maxReverseSpeed: 14.0,
  },
};

interface WheelRig {
  steer: THREE.Group;
  spin: THREE.Group;
  isSteer: boolean;
  isDrive: boolean;
}

export class RacingCarController {
  readonly chassis = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, 1);

  // Sub-step render interpolation
  private readonly prevPosition = new THREE.Vector3();
  private readonly prevRotation = new THREE.Quaternion();
  readonly interpPosition = new THREE.Vector3();
  readonly interpRotation = new THREE.Quaternion();
  readonly interpForward = new THREE.Vector3(0, 0, 1);

  body: RAPIER.RigidBody | null = null;
  vehicle: RAPIER.DynamicRayCastVehicleController | null = null;

  readonly wheels: WheelRig[] = [];
  readonly spec: RacingCarSpec;

  speed = 0; // km/h
  steerAngle = 0;
  slipAngle = 0;
  isDrifting = false;
  driftPoints = 0;
  driftMultiplier = 1;
  driftComboTimer = 0;

  private upsideDownTimer = 0;
  private readonly spawnPos = new THREE.Vector3();
  private readonly spawnRot = new THREE.Quaternion();

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: THREE.Scene,
    public readonly isPlayer = false,
    public readonly carColor = 0xdd2222,
    spec: Partial<RacingCarSpec> = {},
  ) {
    this.spec = {
      ...DEFAULT_SPORTS_SPEC,
      ...spec,
      suspension: { ...DEFAULT_SPORTS_SPEC.suspension, ...spec.suspension },
      tire: { ...DEFAULT_SPORTS_SPEC.tire, ...spec.tire },
      engine: { ...DEFAULT_SPORTS_SPEC.engine, ...spec.engine },
    };
  }

  build(position: THREE.Vector3, heading = 0): void {
    this.spawnPos.copy(position);
    this.spawnRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);

    this.position.copy(position);
    this.prevPosition.copy(position);
    this.interpPosition.copy(position);
    this.rotation.copy(this.spawnRot);
    this.prevRotation.copy(this.spawnRot);
    this.interpRotation.copy(this.spawnRot);

    this.buildVisuals();

    // Create dynamic chassis rigid body
    this.body = this.physics.createChassis(this.chassis, position);
    this.physics.placeBody(this.body, position, heading);

    // Chassis Colliders elevated above wheels so no ground snagging
    this.physics.addBoxCollider(this.body, new THREE.Vector3(0.90, 0.16, 1.95), new THREE.Vector3(0, 0.22, 0), 650);
    this.physics.addBoxCollider(this.body, new THREE.Vector3(0.70, 0.18, 0.8), new THREE.Vector3(0, 0.50, -0.15), 150);

    // Create Vehicle Controller
    this.vehicle = this.physics.createVehicle(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;

    const direction = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };
    const susp = this.spec.suspension;

    for (let i = 0; i < this.spec.wheelPositions.length; i++) {
      const w = this.spec.wheelPositions[i];
      this.vehicle.addWheel({ x: w.x, y: susp.connectionY, z: w.z }, direction, axle, susp.restLength, this.spec.wheelRadius);
      this.vehicle.setWheelSuspensionStiffness(i, susp.stiffness);
      this.vehicle.setWheelSuspensionCompression(i, susp.compression);
      this.vehicle.setWheelSuspensionRelaxation(i, susp.relaxation);
      this.vehicle.setWheelMaxSuspensionTravel(i, susp.maxTravel);
      this.vehicle.setWheelMaxSuspensionForce(i, susp.maxForce);
      this.vehicle.setWheelFrictionSlip(i, this.spec.tire.frictionSlip);
      this.vehicle.setWheelSideFrictionStiffness(i, this.spec.tire.sideFrictionStiffness);
    }

    this.scene.add(this.chassis);
  }

  reset(position: THREE.Vector3, heading = 0): void {
    if (!this.body) return;
    this.spawnPos.copy(position);
    this.physics.placeBody(this.body, position, heading);
    this.steerAngle = 0;
    this.speed = 0;
    this.slipAngle = 0;
    this.isDrifting = false;
    this.upsideDownTimer = 0;

    this.position.copy(position);
    this.prevPosition.copy(position);
    this.interpPosition.copy(position);
    this.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    this.prevRotation.copy(this.rotation);
    this.interpRotation.copy(this.rotation);
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);
    this.interpForward.copy(this.forward);

    this.chassis.position.copy(position);
    this.chassis.quaternion.copy(this.rotation);

    if (this.vehicle) {
      for (let i = 0; i < this.wheels.length; i++) {
        this.vehicle.setWheelEngineForce(i, 0);
        this.vehicle.setWheelBrake(i, 0);
        this.vehicle.setWheelSteering(i, 0);
        this.vehicle.setWheelFrictionSlip(i, this.spec.tire.frictionSlip);
        this.vehicle.setWheelSideFrictionStiffness(i, this.spec.tire.sideFrictionStiffness);
      }
    }
  }

  /**
   * 1. FixedUpdate: Called BEFORE physics.step()
   */
  fixedUpdate(dt: number, input: RacingCarInput): void {
    const vehicle = this.vehicle;
    const body = this.body;
    if (!vehicle || !body) return;

    this.prevPosition.copy(this.position);
    this.prevRotation.copy(this.rotation);

    const forwardSpeed = vehicle.currentVehicleSpeed();
    const absSpeed = Math.abs(forwardSpeed);

    // 1. Steering
    const lock = 0.52 / (1 + absSpeed * 0.024);
    const steerSign = -1;
    const targetSteer = input.steer * steerSign * lock;
    const steerRate = (input.steer === 0 ? 14.0 : 9.0) * dt;
    this.steerAngle += THREE.MathUtils.clamp(targetSteer - this.steerAngle, -steerRate, steerRate);

    for (let i = 0; i < this.wheels.length; i++) {
      if (this.wheels[i].isSteer) {
        vehicle.setWheelSteering(i, this.steerAngle);
      }
    }

    // 2. Handbrake & Drift Physics
    this.isDrifting = Boolean(input.handbrake && absSpeed > 3.0);
    const rearSlip = this.isDrifting ? this.spec.tire.driftFrictionSlip : this.spec.tire.frictionSlip;
    const rearSide = this.isDrifting ? this.spec.tire.driftSideFrictionStiffness : this.spec.tire.sideFrictionStiffness;

    for (let i = 0; i < this.wheels.length; i++) {
      if (!this.wheels[i].isSteer) {
        vehicle.setWheelFrictionSlip(i, rearSlip);
        vehicle.setWheelSideFrictionStiffness(i, rearSide);
      }
    }

    // 3. Engine Throttle & Braking
    let engineForce = 0;
    let brake = 0;

    if (input.handbrake) {
      engineForce = 0;
      brake = 90.0;
    } else if (input.throttle > 0 && forwardSpeed > -1.5) {
      const speedFalloff = Math.max(0, 1 - absSpeed / this.spec.engine.maxSpeed);
      engineForce = this.spec.engine.baseForce * input.throttle * speedFalloff;
      brake = 0;
    } else if (input.brake > 0 && forwardSpeed < 1.0) {
      const revFalloff = Math.max(0, 1 - absSpeed / this.spec.engine.maxReverseSpeed);
      engineForce = -this.spec.engine.reverseForce * input.brake * revFalloff;
      brake = 0;
    } else if (input.brake > 0) {
      brake = this.spec.engine.brakeForce * input.brake;
      engineForce = 0;
    }

    for (let i = 0; i < this.wheels.length; i++) {
      if (this.wheels[i].isDrive) {
        vehicle.setWheelEngineForce(i, engineForce);
      }
      vehicle.setWheelBrake(i, brake);
    }

    // 4. Aerodynamic Downforce
    const downforce = 0.5 * 1.225 * 0.45 * (forwardSpeed * forwardSpeed) * 35;
    body.applyImpulse({ x: 0, y: -downforce * dt, z: 0 }, true);

    // 5. Update vehicle wheel rays
    vehicle.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS);

    // 6. Rollover Recovery
    this.checkRollover(body, dt);
  }

  /**
   * 2. PostStep: Called AFTER physics.step()
   */
  postStep(dt: number): void {
    const vehicle = this.vehicle;
    const body = this.body;
    if (!vehicle || !body) return;

    const t = body.translation();
    const r = body.rotation();
    this.position.set(t.x, t.y, t.z);
    this.rotation.set(r.x, r.y, r.z, r.w);
    this.forward.set(0, 0, 1).applyQuaternion(this.rotation);

    const lv = body.linvel();
    const linVel3 = new THREE.Vector3(lv.x, lv.y, lv.z);
    this.speed = linVel3.length() * 3.6; // km/h

    // Calculate Drift Slip Angle
    if (linVel3.lengthSq() > 1.0) {
      const velDir = linVel3.clone().normalize();
      const dot = THREE.MathUtils.clamp(this.forward.dot(velDir), -1, 1);
      this.slipAngle = Math.acos(dot) * (180 / Math.PI);
    } else {
      this.slipAngle = 0;
    }

    // Drift Scoring
    if (this.slipAngle > 18 && this.speed > 22) {
      this.driftComboTimer = 1.2;
      this.driftMultiplier = Math.min(4.0, this.driftMultiplier + dt * 0.45);
      this.driftPoints += Math.round((this.slipAngle * 0.6 + this.speed * 0.3) * this.driftMultiplier * dt * 10);
    } else if (this.driftComboTimer > 0) {
      this.driftComboTimer -= dt;
      if (this.driftComboTimer <= 0) {
        this.driftMultiplier = 1;
      }
    }
  }

  /**
   * 3. Render: Sub-step visual interpolation
   */
  render(alpha: number): void {
    this.interpPosition.lerpVectors(this.prevPosition, this.position, alpha);
    this.interpRotation.slerpQuaternions(this.prevRotation, this.rotation, alpha);
    this.interpForward.set(0, 0, 1).applyQuaternion(this.interpRotation);

    this.chassis.position.copy(this.interpPosition);
    this.chassis.quaternion.copy(this.interpRotation);

    const vehicle = this.vehicle;
    if (!vehicle) return;

    // Synchronize Wheel Meshes with Vehicle Rigs
    for (let i = 0; i < this.wheels.length; i++) {
      const rig = this.wheels[i];
      const hardPt = this.spec.wheelPositions[i];
      const suspLen = vehicle.wheelSuspensionLength(i) ?? this.spec.suspension.restLength;

      // Wheel suspension displacement
      rig.steer.position.set(hardPt.x, this.spec.suspension.connectionY - suspLen, hardPt.z);

      // Wheel steering yaw angle
      if (rig.isSteer) {
        rig.steer.rotation.y = vehicle.wheelSteering(i) ?? 0;
      }

      // Wheel rolling rotation
      const rotDelta = vehicle.wheelRotation(i) ?? 0;
      rig.spin.rotation.x = rotDelta;
    }
  }

  private checkRollover(body: RAPIER.RigidBody, dt: number): void {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rotation);
    if (up.y < 0.2) {
      this.upsideDownTimer += dt;
      if (this.upsideDownTimer > 2.2) {
        this.upsideDownTimer = 0;
        this.reset(this.position.clone().setY(this.position.y + 0.6), Math.atan2(this.forward.x, this.forward.z));
      }
    } else {
      this.upsideDownTimer = 0;
    }
  }

  private buildVisuals(): void {
    const carGroup = new THREE.Group();

    // Body Paint Material
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.carColor });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x111622 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x151618 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });

    // Lower Main Body
    const mainChassis = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.36, 4.1), bodyMat);
    mainChassis.position.set(0, 0.18, 0);
    mainChassis.castShadow = true;
    mainChassis.receiveShadow = true;
    carGroup.add(mainChassis);

    // Front Nose / Splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, 0.45), darkMat);
    splitter.position.set(0, 0.04, 2.12);
    carGroup.add(splitter);

    // Cabin / Cockpit Roof
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.44, 1.95), glassMat);
    cabin.position.set(0, 0.54, -0.22);
    cabin.castShadow = true;
    carGroup.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.08, 1.45), bodyMat);
    roof.position.set(0, 0.77, -0.3);
    carGroup.add(roof);

    // GT Rear Wing
    const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.12), darkMat);
    wingPostL.position.set(-0.64, 0.48, -1.92);
    const wingPostR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.12), darkMat);
    wingPostR.position.set(0.64, 0.48, -1.92);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.42), darkMat);
    wingBlade.position.set(0, 0.64, -1.94);
    wingBlade.rotation.x = 0.08;
    carGroup.add(wingPostL, wingPostR, wingBlade);

    // Headlights & Taillights
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), lightMat);
    hlL.position.set(-0.68, 0.22, 2.06);
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), lightMat);
    hlR.position.set(0.68, 0.22, 2.06);

    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.08), redLightMat);
    tlL.position.set(-0.65, 0.26, -2.06);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.08), redLightMat);
    tlR.position.set(0.65, 0.26, -2.06);

    carGroup.add(hlL, hlR, tlL, tlR);
    this.chassis.add(carGroup);

    // Build 4 Wheel Rigs (Steer -> Spin -> Mesh)
    const tireGeom = new THREE.CylinderGeometry(this.spec.wheelRadius, this.spec.wheelRadius, this.spec.wheelHalfWidth * 2, 20);
    tireGeom.rotateZ(Math.PI / 2);
    const rimGeom = new THREE.CylinderGeometry(this.spec.wheelRadius * 0.65, this.spec.wheelRadius * 0.65, this.spec.wheelHalfWidth * 2 + 0.01, 14);
    rimGeom.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1c });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });

    for (let i = 0; i < this.spec.wheelPositions.length; i++) {
      const wPos = this.spec.wheelPositions[i];
      const steerGroup = new THREE.Group();
      const spinGroup = new THREE.Group();

      const tireMesh = new THREE.Mesh(tireGeom, tireMat);
      tireMesh.castShadow = true;
      const rimMesh = new THREE.Mesh(rimGeom, rimMat);

      spinGroup.add(tireMesh, rimMesh);
      steerGroup.add(spinGroup);
      steerGroup.position.set(wPos.x, this.spec.suspension.connectionY - this.spec.suspension.restLength, wPos.z);

      this.chassis.add(steerGroup);

      this.wheels.push({
        steer: steerGroup,
        spin: spinGroup,
        isSteer: wPos.isSteer,
        isDrive: wPos.isDrive,
      });
    }
  }
}
