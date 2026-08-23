import * as THREE from 'three'
import { BAL } from '../config/balance.js'

/**
 * Вор: кинематическое движение без физдвижка (аркадные столкновения считаются
 * в heist-сессии), маскировка, выпад рапирой, парирование, переноска тотема.
 * Все векторы переиспользуются — аллокаций в цикле нет.
 */

export interface MoveInput {
  moveX: number
  moveZ: number
  blend: boolean
}

const TURN_RATE_LOADED = BAL.loadedTurnRateDeg * (Math.PI / 180)
/** Скорость вора свободным шагом — вдвое от темпа шествия, чтобы толпу можно было обгонять. */
const BASE_SPEED = BAL.marchSpeed * 2
/** Таранный рывок с тотемом ускоряет сверх «ползучей» переноски. */
const DASH_MULT = 1.7
const DASH_TIME = 0.55

export class Player {
  readonly root = new THREE.Group()
  readonly pos = new THREE.Vector3()
  private readonly vel = new THREE.Vector3()
  facing = Math.PI
  private readonly swordArm: THREE.Group

  hitsTaken = 0
  carryingTotem = false
  /** Вор идёт в такт музыке — груз «левитирует», штраф веса падает. */
  rhythmInStep = false
  invulnTimer = 0

  private lungeTimer = 0
  private lungeTotal = 0
  private readonly lungeDir = new THREE.Vector3()
  /** Выпад сделан в такт — стража не слышит шума. */
  lungeSilent = false
  lungeHitDone = false

  parryTimer = 0
  parryRecovery = 0
  parrySuccessFlash = 0

  private dashTimer = 0
  private dashCooldown = 0
  private inertiaFactor = 0
  private walkPhase = 0
  hitStopFrames = 0

  constructor() {
    const cloakMat = new THREE.MeshLambertMaterial({ color: 0xf2ede2 })
    const accentMat = new THREE.MeshLambertMaterial({ color: 0x2c2f45 })
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a06b })

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.35, 8), cloakMat)
    cloak.position.y = 0.68
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat)
    head.position.y = 1.52
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 10), accentMat)
    hat.position.y = 1.72
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 5), new THREE.MeshLambertMaterial({ color: 0xc8342e }))
    feather.position.set(0.16, 1.92, 0)
    feather.rotation.z = -0.7

    this.swordArm = new THREE.Group()
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.05), new THREE.MeshLambertMaterial({ color: 0xcfd6e4 }))
    blade.position.set(0, 0, 0.55)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.08), accentMat)
    this.swordArm.add(blade, guard)
    this.swordArm.position.set(0.34, 1.05, 0)

    this.root.add(cloak, head, hat, feather, this.swordArm)

    // Круглая тень под ногами — дешевле настоящих теней и читается сверху.
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 14),
      new THREE.MeshBasicMaterial({ color: 0x0d0a20, transparent: true, opacity: 0.35, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.position.y = 0.03
    this.root.add(blob)
  }

  get isLunging(): boolean {
    return this.lungeTimer > 0
  }

  get isDashing(): boolean {
    return this.dashTimer > 0
  }

  get canAct(): boolean {
    return this.parryRecovery <= 0 && this.hitStopFrames <= 0
  }

  placeAt(x: number, z: number): void {
    this.pos.set(x, 0, z)
    this.vel.set(0, 0, 0)
    this.hitsTaken = 0
    this.carryingTotem = false
    this.lungeTimer = 0
    this.parryTimer = 0
    this.parryRecovery = 0
    this.dashTimer = 0
    this.invulnTimer = 0
    this.hitStopFrames = 0
    this.syncMesh()
  }

  tryLunge(dirX: number, dirZ: number, silent: boolean): boolean {
    if (!this.canAct || this.isLunging) return false
    const len = Math.hypot(dirX, dirZ) || 1
    this.lungeDir.set(dirX / len, 0, dirZ / len)
    this.lungeTotal = BAL.lungeAnimTime
    this.lungeTimer = this.lungeTotal
    this.lungeSilent = silent
    this.lungeHitDone = false
    return true
  }

  tryParry(): boolean {
    if (!this.canAct || this.parryTimer > 0) return false
    this.parryTimer = BAL.parryWindow
    return true
  }

  tryDash(): boolean {
    if (!this.carryingTotem || this.dashCooldown > 0 || !this.canAct) return false
    this.dashTimer = DASH_TIME
    this.dashCooldown = 1.6
    return true
  }

  registerParrySuccess(): void {
    this.parrySuccessFlash = 0.25
  }

  takeHit(): void {
    this.hitsTaken++
    this.invulnTimer = 1.0
  }

  update(dt: number, input: MoveInput, crowdFlow: { x: number; z: number }, inCrowd: boolean): void {
    if (this.hitStopFrames > 0) {
      this.hitStopFrames--
      return
    }
    this.invulnTimer = Math.max(0, this.invulnTimer - dt)
    this.parryRecovery = Math.max(0, this.parryRecovery - dt)
    this.parrySuccessFlash = Math.max(0, this.parrySuccessFlash - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    if (this.parryTimer > 0) {
      this.parryTimer -= dt
      if (this.parryTimer <= 0 && this.parrySuccessFlash <= 0) {
        // Замах в пустоту: штраф восстановления, спам парирования наказан.
        this.parryRecovery = BAL.whiffRecovery
      }
    }

    let speedLimit = BASE_SPEED
    if (this.carryingTotem) {
      this.inertiaFactor = Math.min(1, this.inertiaFactor + dt / BAL.inertiaRampTime)
      const effectivePenalty = BAL.totemSlowFactor * (this.rhythmInStep ? 1 - BAL.rhythmLevitation : 1)
      speedLimit *= 1 - effectivePenalty
    } else {
      this.inertiaFactor = Math.max(0, this.inertiaFactor - dt / BAL.inertiaRampTime)
    }
    if (input.blend && inCrowd) {
      // Шаг шествия: скорость синхронизируется с потоком танцоров.
      this.vel.x = crowdFlow.x
      this.vel.z = crowdFlow.z
    } else if (this.isLunging) {
      this.lungeTimer -= dt
      const progress = 1 - Math.max(0, this.lungeTimer) / this.lungeTotal
      const burst = BAL.lungeDistance / BAL.lungeAnimTime * (progress < 0.5 ? 1.25 : 0.85)
      this.vel.x = this.lungeDir.x * burst
      this.vel.z = this.lungeDir.z * burst
      if (this.lungeTimer <= 0) this.lungeTimer = 0
    } else {
      const len = Math.hypot(input.moveX, input.moveZ)
      let wishX = 0
      let wishZ = 0
      if (len > 0.01) {
        wishX = (input.moveX / Math.max(1, len)) * speedLimit
        wishZ = (input.moveZ / Math.max(1, len)) * speedLimit
        if (this.carryingTotem) {
          // Инерция груза: разгон до желаемой скорости занимает время из баланса.
          const ramp = Math.min(1, this.inertiaFactor * 1.2)
          wishX *= 0.35 + 0.65 * ramp
          wishZ *= 0.35 + 0.65 * ramp
        }
      }
      const accel = 12
      this.vel.x += (wishX - this.vel.x) * Math.min(1, accel * dt)
      this.vel.z += (wishZ - this.vel.z) * Math.min(1, accel * dt)
    }

    if (this.isDashing) {
      this.dashTimer -= dt
      const fx = Math.sin(this.facing)
      const fz = Math.cos(this.facing)
      this.vel.x = fx * BASE_SPEED * DASH_MULT
      this.vel.z = fz * BASE_SPEED * DASH_MULT
      if (this.dashTimer <= 0) this.dashTimer = 0
    }

    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt

    const speed = Math.hypot(this.vel.x, this.vel.z)
    if (!this.isDashing && speed > 0.4) {
      const target = Math.atan2(this.vel.x, this.vel.z)
      let delta = shortestAngle(this.facing, target)
      if (this.carryingTotem) {
        const maxStep = TURN_RATE_LOADED * dt
        delta = Math.max(-maxStep, Math.min(maxStep, delta))
      }
      this.facing += delta
    }

    this.walkPhase += speed * dt * 2.4
    this.syncMesh()
  }

  private syncMesh(): void {
    this.root.position.copy(this.pos)
    this.root.rotation.y = this.facing
    const bob = Math.abs(Math.sin(this.walkPhase)) * 0.09
    this.root.children[0].position.y = 0.68 + bob
    this.root.children[1].position.y = 1.52 + bob
    this.root.children[2].position.y = 1.72 + bob
    const armSwing = this.isLunging ? 1.15 : Math.sin(this.walkPhase) * 0.25
    this.swordArm.rotation.x = -armSwing
    this.swordArm.position.y = 1.05 + bob
    this.root.visible = !(this.invulnTimer > 0 && Math.floor(this.invulnTimer * 12) % 2 === 0)
  }
}

function shortestAngle(from: number, to: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
