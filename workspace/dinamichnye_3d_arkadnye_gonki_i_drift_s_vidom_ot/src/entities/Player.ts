import * as THREE from 'three'
import { RAPIER, IG_CHASSIS, WHEEL_RAY_GROUPS, type PhysicsWorld } from '../physics/PhysicsWorld'
import { balance } from '../data/balance'
import { SURFACE_ICE, type TrackBuilder, type TrackData } from '../rendering/TrackBuilder'
import type { InputSnapshot } from '../core/InputRouter'

/**
 * Молоковоз на лучевом контроллере Rapier: три оси, шесть колёс, настоящая
 * подвеска. Плещущееся молоко живёт в SloshSystem и давит на кузов силой
 * реакции в точке над центром масс — крен корпуса отвечает волне с задержкой.
 */

const GRIP_SNOW = 9
const GRIP_ICE_RATIO = balance.iceMu / 0.55
const MAX_STEER_DEG = 38
const ENGINE_FORCE_PER_WHEEL = 17000
const BRAKE_FORCE = 5200
const HANDBRAKE_FORCE = 26000
const CHASSIS_MASS_KG = 14000
const ROLL_LOSS_GRIP_FACTOR = 0.3

export interface VehicleTelemetry {
  speedKmh: number
  slipAngleDeg: number
  rollDeg: number
  dEdge: number
  surfaceIce: boolean
  wheelsGrounded: number
}

export class PlayerVehicle {
  readonly body: RAPIER.RigidBody
  private readonly controller: RAPIER.DynamicRayCastVehicleController
  private readonly group: THREE.Group
  private readonly wheelMeshes: THREE.InstancedMesh
  private readonly milkSurface: THREE.Mesh
  private readonly brakeLights: THREE.Mesh[]

  private readonly wheelLocals: THREE.Vector3[] = []
  private readonly prevPos = new THREE.Vector3()
  private readonly currPos = new THREE.Vector3()
  private readonly prevQuat = new THREE.Quaternion()
  private readonly currQuat = new THREE.Quaternion()
  private readonly dummy = new THREE.Object3D()
  private readonly tmpVec = new THREE.Vector3()
  private readonly tmpVec2 = new THREE.Vector3()
  private readonly tmpQuat = new THREE.Quaternion()

  /** Состояние для систем (переиспользуемые поля, без аллокаций). */
  steerAngleRad = 0
  turboCharge = 0
  turboActiveFor = 0
  valveCooldown = 0
  handbrakeHeldFor = 0
  handbrakeReleasedAt = -1
  rolloverTimer = 0
  fellBelow = false
  gripLossTimer = 0
  latAccelLocal = 0
  private lastLatSpeed = 0

  constructor(
    private readonly physics: PhysicsWorld,
    track: TrackData,
    builder: TrackBuilder,
    group: THREE.Group,
    wheelMeshes: THREE.InstancedMesh,
    milkSurface: THREE.Mesh,
    brakeLights: THREE.Mesh[],
  ) {
    this.group = group
    this.wheelMeshes = wheelMeshes
    this.milkSurface = milkSurface
    this.brakeLights = brakeLights

    const pose = builder.poseAt(track, 4)
    const startQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.heading)

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pose.x, pose.y + 1.7, pose.z)
      .setRotation({ x: startQuat.x, y: startQuat.y, z: startQuat.z, w: startQuat.w })
      .setLinearDamping(0.08)
      .setAngularDamping(0.6)
      .setCcdEnabled(true)
    this.body = this.physics.world.createRigidBody(bodyDesc)
    this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.3, 0.45, 3.6)
        .setMass(CHASSIS_MASS_KG)
        .setCollisionGroups(IG_CHASSIS),
      this.body,
    )

    this.controller = this.physics.world.createVehicleController(this.body)
    this.controller.indexUpAxis = 1
    this.controller.setIndexForwardAxis = 2

    const axleZ = [2.5, 0.1, -2.5]
    for (let axle = 0; axle < 3; axle++) {
      for (const sx of [-1.15, 1.15]) {
        this.controller.addWheel(
          { x: sx, y: -0.55, z: axleZ[axle] },
          { x: 0, y: -1, z: 0 },
          { x: -1, y: 0, z: 0 },
          0.55,
          0.55,
        )
        const idx = this.controller.numWheels() - 1
        this.controller.setWheelSuspensionStiffness(idx, 42)
        this.controller.setWheelMaxSuspensionTravel(idx, 0.35)
        this.controller.setWheelMaxSuspensionForce(idx, 260000)
        this.controller.setWheelSuspensionCompression(idx, 1.6)
        this.controller.setWheelSuspensionRelaxation(idx, 2.6)
        this.controller.setWheelFrictionSlip(idx, GRIP_SNOW)
        this.controller.setWheelSideFrictionStiffness(idx, 1)
        this.controller.setWheelBrake(idx, 120)
        this.wheelLocals.push(new THREE.Vector3(sx, -0.55, axleZ[axle]))
      }
    }

    this.syncTransformInstant()
  }

  get chassisGroup(): THREE.Group {
    return this.group
  }

  /** Порядок кадра: updateVehicle → step() → postStep. */
  updateVehicle(dt: number, input: InputSnapshot, surfaceIce: boolean, frozen: boolean): void {
    const maxSteer = (MAX_STEER_DEG * Math.PI) / 180
    const speedFactor = Math.max(0.45, 1 - this.forwardSpeed() / 60)
    let targetSteer = -input.steer * maxSteer * speedFactor
    if (frozen) targetSteer = 0
    const steerRate = ((balance.steerRateDps * Math.PI) / 180) * dt
    const delta = Math.max(-steerRate, Math.min(steerRate, targetSteer - this.steerAngleRad))
    this.steerAngleRad += delta
    for (const idx of [0, 1]) this.controller.setWheelSteering(idx, this.steerAngleRad)

    const throttle = frozen ? 0 : input.throttle
    const engine = throttle * ENGINE_FORCE_PER_WHEEL * (this.turboActiveFor > 0 ? 1.5 : 1)
    const brakeInput = frozen ? 1 : input.brake

    const handbrake = !frozen && input.handbrake
    if (handbrake) {
      if (this.handbrakeReleasedAt >= 0 && this.handbrakeHeldFor === 0) this.handbrakeReleasedAt = -1
      this.handbrakeHeldFor += dt
      this.handbrakeReleasedAt = -1
    } else if (this.handbrakeHeldFor > 0) {
      this.handbrakeReleasedAt = this.handbrakeHeldFor
      this.handbrakeHeldFor = 0
    }

    const gripBase = (surfaceIce ? GRIP_SNOW * GRIP_ICE_RATIO : GRIP_SNOW) *
      (this.gripLossTimer > 0 ? ROLL_LOSS_GRIP_FACTOR : 1)
    const rearGrip = handbrake ? gripBase * 0.32 : gripBase

    const effectiveBrake = brakeInput > 0 ? BRAKE_FORCE : 0

    for (let i = 0; i < this.controller.numWheels(); i++) {
      const rearOrMid = i >= 2
      this.controller.setWheelEngineForce(i, rearOrMid ? engine : 0)
      if (handbrake && rearOrMid) {
        this.controller.setWheelBrake(i, HANDBRAKE_FORCE)
        this.controller.setWheelFrictionSlip(i, rearGrip)
      } else {
        this.controller.setWheelBrake(i, effectiveBrake + (frozen ? HANDBRAKE_FORCE : 0))
        this.controller.setWheelFrictionSlip(i, rearOrMid ? gripBase * 0.96 : gripBase)
      }
    }

    this.turboActiveFor = Math.max(0, this.turboActiveFor - dt)
    this.valveCooldown = Math.max(0, this.valveCooldown - dt)
    this.gripLossTimer = Math.max(0, this.gripLossTimer - dt)
    this.braking = brakeInput > 0 || handbrake

    // Лучи подвески видят только землю: WHEEL_RAY_GROUPS отфильтрован.
    this.controller.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS)
  }

  forwardSpeed(): number {
    const v = this.body.linvel()
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(0, 0, 1).applyQuaternion(this.tmpQuat)
    return v.x * this.tmpVec.x + v.y * this.tmpVec.y + v.z * this.tmpVec.z
  }

  forwardX(): number {
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    return 2 * (this.tmpQuat.x * this.tmpQuat.z + this.tmpQuat.w * this.tmpQuat.y)
  }

  forwardZ(): number {
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    return 1 - 2 * (this.tmpQuat.x * this.tmpQuat.x + this.tmpQuat.y * this.tmpQuat.y)
  }

  rightX(): number {
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    return 1 - 2 * (this.tmpQuat.y * this.tmpQuat.y + this.tmpQuat.z * this.tmpQuat.z)
  }

  rightZ(): number {
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    return 2 * (this.tmpQuat.x * this.tmpQuat.z - this.tmpQuat.w * this.tmpQuat.y)
  }

  /** Боковая скорость в локальной системе — вход гидродинамического маятника. */
  lateralAccel(dt: number): number {
    const v = this.body.linvel()
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(1, 0, 0).applyQuaternion(this.tmpQuat)
    const latSpeed = v.x * this.tmpVec.x + v.z * this.tmpVec.z
    const accel = (latSpeed - this.lastLatSpeed) / Math.max(dt, 1e-4)
    this.lastLatSpeed = latSpeed
    return accel
  }

  slipAngleDeg(): number {
    const v = this.body.linvel()
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(0, 0, 1).applyQuaternion(this.tmpQuat)
    const fwd = v.x * this.tmpVec.x + v.z * this.tmpVec.z
    this.tmpVec2.set(1, 0, 0).applyQuaternion(this.tmpQuat)
    const lat = v.x * this.tmpVec2.x + v.z * this.tmpVec2.z
    const speed = Math.hypot(v.x, v.z)
    if (speed < 0.8) return 0
    return (Math.atan2(lat, Math.abs(fwd)) * 180) / Math.PI
  }

  rollDeg(): number {
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(0, 1, 0).applyQuaternion(this.tmpQuat)
    return (Math.acos(Math.min(1, Math.abs(this.tmpVec.y))) * 180) / Math.PI
  }

  uprightness(): number {
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(0, 1, 0).applyQuaternion(this.tmpQuat)
    return this.tmpVec.y
  }

  position(): THREE.Vector3 {
    const t = this.body.translation()
    return this.tmpVec2.set(t.x, t.y, t.z)
  }

  velocity(): THREE.Vector3 {
    const v = this.body.linvel()
    return this.tmpVec.set(v.x, v.y, v.z)
  }

  wheelsOnGround(): number {
    let count = 0
    for (let i = 0; i < this.controller.numWheels(); i++) {
      if (this.controller.wheelIsInContact(i)) count++
    }
    return count
  }

  activateTurbo(): boolean {
    if (this.turboCharge < 0.99 || this.turboActiveFor > 0) return false
    this.turboCharge = 0
    this.turboActiveFor = balance.turboDurationS
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(0, 0, 1).applyQuaternion(this.tmpQuat)
    const kick = (balance.turboKickKmh / 3.6) * 0.55 * CHASSIS_MASS_KG * 0.001
    this.body.applyImpulse({ x: this.tmpVec.x * kick, y: 0, z: this.tmpVec.z * kick }, true)
    return true
  }

  activateValve(): boolean {
    if (this.valveCooldown > 0) return false
    this.valveCooldown = balance.valveCooldownS
    this.tmpQuat.set(this.body.rotation.x, this.body.rotation.y, this.body.rotation.z, this.body.rotation.w)
    this.tmpVec.set(0, 0, 1).applyQuaternion(this.tmpQuat)
    const omega = this.body.angvel()
    const rollRate = omega.x * this.tmpVec.x + omega.y * this.tmpVec.y + omega.z * this.tmpVec.z
    const counter = -rollRate * CHASSIS_MASS_KG * 0.02 + (balance.valveCounterRollDeg * Math.PI) / 180 * CHASSIS_MASS_KG * 0.01
    this.body.applyAngularImpulse({ x: this.tmpVec.x * counter, y: this.tmpVec.y * counter, z: this.tmpVec.z * counter }, true)
    return true
  }

  applyLiquidReaction(forceX: number, forceZ: number, pointY: number): void {
    const t = this.body.translation()
    this.body.applyImpulseAtPoint(
      { x: forceX, y: 0, z: forceZ },
      { x: t.x, y: t.y + pointY, z: t.z },
      true,
    )
  }

  respawn(builder: TrackBuilder, track: TrackData, checkpointIdx: number): void {
    const pose = builder.poseAt(track, checkpointIdx)
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.heading)
    this.body.setTranslation({ x: pose.x, y: pose.y + 1.2, z: pose.z }, true)
    this.body.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.steerAngleRad = 0
    this.rolloverTimer = 0
    this.fellBelow = false
    this.gripLossTimer = 1.0
    this.handbrakeHeldFor = 0
    this.turboCharge = 0
    this.syncTransformInstant()
  }

  private syncTransformInstant(): void {
    const t = this.body.translation()
    const r = this.body.rotation()
    this.currPos.set(t.x, t.y, t.z)
    this.currQuat.set(r.x, r.y, r.z, r.w)
    this.prevPos.copy(this.currPos)
    this.prevQuat.copy(this.currQuat)
    this.group.position.copy(this.currPos)
    this.group.quaternion.copy(this.currQuat)
  }

  /** Телеметрия для HUD и гонки: объект переиспользуется вызывающим. */
  fillTelemetry(out: VehicleTelemetry, surface: number, halfWidth: number, lateral: number): VehicleTelemetry {
    out.speedKmh = Math.abs(this.forwardSpeed()) * 3.6
    out.slipAngleDeg = this.slipAngleDeg()
    out.rollDeg = this.rollDeg()
    out.dEdge = halfWidth - Math.abs(lateral) - 1.25
    out.surfaceIce = surface === SURFACE_ICE
    out.wheelsGrounded = this.wheelsOnGround()
    return out
  }

  syncBeforeStep(): void {
    const t = this.body.translation()
    const r = this.body.rotation()
    this.prevPos.copy(this.currPos)
    this.prevQuat.copy(this.currQuat)
    this.currPos.set(t.x, t.y, t.z)
    this.currQuat.set(r.x, r.y, r.z, r.w)
  }

  /** Синхронизация меша ПОСЛЕ step(), интерполяция prev→curr по alpha. */
  render(alpha: number): void {
    this.dummy.position.lerpVectors(this.prevPos, this.currPos, alpha)
    this.dummy.quaternion.slerpQuaternions(this.prevQuat, this.currQuat, alpha)
    this.group.position.copy(this.dummy.position)
    this.group.quaternion.copy(this.dummy.quaternion)

    for (let i = 0; i < this.wheelLocals.length; i++) {
      const susp = this.controller.wheelSuspensionLength(i)
      const local = this.wheelLocals[i]
      this.dummy.position.copy(local)
      if (susp !== null) this.dummy.position.y = local.y - susp + 0.55
      this.dummy.quaternion.identity()
      this.dummy.rotateY(this.controller.wheelSteering(i) ?? 0)
      this.dummy.rotateX(-(this.controller.wheelRotation(i) ?? 0))
      this.wheelMeshes.setMatrixAt(i, this.dummy.matrix)
    }
    this.wheelMeshes.instanceMatrix.needsUpdate = true
  }

  setMilkVisual(volumeRatio: number, sloshTheta: number): void {
    this.milkSurface.position.y = -0.55 + volumeRatio * 1.1
    this.milkSurface.rotation.z = -sloshTheta
    for (const light of this.brakeLights) {
      light.visible = this.braking
    }
  }

  private braking = false
}
