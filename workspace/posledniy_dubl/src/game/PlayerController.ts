import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { BALANCE } from '../config/balance.js'
import type { PhysicsWorld } from '../physics/PhysicsWorld.js'
import type { InputRouter } from '../input/InputRouter.js'

/**
 * FPS-контроллер игрока на кинематическом контроллере Rapier.
 * «На земле» определяется контроллером персонажа, а не velocity.y === 0.
 */

const SENSITIVITY_DESKTOP = 0.0023
const SENSITIVITY_TOUCH = 0.0044
const MAX_PITCH = Math.PI / 2 - 0.05

export class PlayerController {
  readonly yawObject = new THREE.Object3D()
  private pitch = 0
  private yaw = Math.PI // смотрим в -Z

  private controller: RAPIER.KinematicCharacterController | null = null
  private body: RAPIER.RigidBody | null = null
  collider: RAPIER.Collider | null = null

  /** Отдача: подброс камеры оседает пружиной за время возврата из баланса. */
  private recoilPitch = 0
  private recoilVelocity = 0

  private grounded = false
  private stepAccumulatorM = 0
  private readonly tmpDesired = { x: 0, y: 0, z: 0 }
  private readonly tmpMovement = { x: 0, y: 0, z: 0 }
  private readonly prevPos = new THREE.Vector3()
  private readonly currPos = new THREE.Vector3()
  private readonly forward = new THREE.Vector3()
  private readonly right = new THREE.Vector3()

  onFootstep: (() => void) | null = null

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: InputRouter,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.yawObject.add(this.camera)
  }

  /** Высота центра капсулы над полом при спавне, м. */
  private static readonly CAPSULE_HALF_HEIGHT = 0.55

  spawn(x: number, z: number): void {
    const radius = BALANCE.player.radiusM
    const halfHeight = PlayerController.CAPSULE_HALF_HEIGHT
    const centerY = radius + halfHeight
    const created = this.physics.createPlayerCapsule(x, centerY, z, halfHeight, radius)
    this.controller = created.controller
    this.body = created.body
    this.collider = created.collider
    this.yaw = Math.PI
    this.pitch = 0
    this.prevPos.set(x, centerY, z)
    this.currPos.set(x, centerY, z)
  }

  get position(): THREE.Vector3 {
    return this.currPos
  }

  get isGrounded(): boolean {
    return this.grounded
  }

  /** Подброс камеры от отдачи или встряски (масштаб <1 — слабая тряска). */
  applyRecoilKick(scale = 1): void {
    // Сдвиг камеры от отдачи (градусы → радианы) двухуровневой пружиной:
    // быстрый подброс и медленный возврат не до нуля.
    const kickRad = (BALANCE.vystrelMontazh.recoilKickDeg * Math.PI) / 180 * scale
    this.recoilVelocity += kickRad * 14
  }

  fixedUpdate(stepS: number): void {
    if (!this.controller || !this.body || !this.collider) return

    // Обзор: forward/right выводятся из yaw с правильными знаками.
    this.yaw -= this.input.lookDX * (this.input.scheme === 'desktop' ? SENSITIVITY_DESKTOP : SENSITIVITY_TOUCH)
    this.pitch -= this.input.lookDY * (this.input.scheme === 'desktop' ? SENSITIVITY_DESKTOP : SENSITIVITY_TOUCH)
    if (this.pitch > MAX_PITCH) this.pitch = MAX_PITCH
    if (this.pitch < -MAX_PITCH) this.pitch = -MAX_PITCH

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    const speed = BALANCE.player.moveSpeedMs
    let mx = this.input.moveX
    let my = this.input.moveY
    const len = Math.hypot(mx, my)
    if (len > 1) {
      mx /= len
      my /= len
    }
    this.tmpDesired.x = (this.forward.x * my + this.right.x * mx) * speed * stepS
    this.tmpDesired.y = -0.6 * stepS // прижим к полу: вертикали (прыжка) в игре нет
    this.tmpDesired.z = (this.forward.z * my + this.right.z * mx) * speed * stepS

    this.controller.computeColliderMovement(this.collider, this.tmpDesired)
    const corrected = this.controller.computedMovement()
    this.tmpMovement.x = corrected.x
    this.tmpMovement.y = corrected.y
    this.tmpMovement.z = corrected.z

    const t = this.body.translation()
    const nx = t.x + this.tmpMovement.x
    const ny = t.y + this.tmpMovement.y
    const nz = t.z + this.tmpMovement.z
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz })

    // Интерполяция меша между физическими шагами.
    this.prevPos.copy(this.currPos)
    this.currPos.set(nx, ny, nz)

    this.grounded = this.controller.computedGrounded()

    const moved = Math.hypot(this.tmpMovement.x, this.tmpMovement.z)
    this.stepAccumulatorM += moved
    if (this.stepAccumulatorM > 2.1 && this.grounded) {
      this.stepAccumulatorM = 0
      if (this.onFootstep) this.onFootstep()
    }

    // Пружина отдачи: подброс оседает, но не до нуля мгновенно.
    const omega = Math.PI * 2 / (BALANCE.vystrelMontazh.recoilReturnS * 2)
    this.recoilVelocity += (-omega * omega * this.recoilPitch - 2 * 0.9 * omega * this.recoilVelocity) * stepS
    this.recoilPitch += this.recoilVelocity * stepS
    if (Math.abs(this.recoilPitch) < 0.0004 && Math.abs(this.recoilVelocity) < 0.001) {
      this.recoilPitch = 0
      this.recoilVelocity = 0
    }
  }

  /** Синхронизация камеры после шага физики. */
  updateCamera(alpha: number, zoomActive: boolean): void {
    const px = this.prevPos.x + (this.currPos.x - this.prevPos.x) * alpha
    const py = this.prevPos.y + (this.currPos.y - this.prevPos.y) * alpha
    const pz = this.prevPos.z + (this.currPos.z - this.prevPos.z) * alpha

    // Глаза на высоте из DESIGN.md; центр капсулы ниже глаз на фиксированный отступ.
    const eyeOffset = BALANCE.player.eyeHeightM -
      (BALANCE.player.radiusM + PlayerController.CAPSULE_HALF_HEIGHT)
    this.camera.position.set(px, py + eyeOffset, pz)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw, 0)
    const targetFov = zoomActive ? BALANCE.player.zoomFovDeg : BALANCE.player.aimFovDeg
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * 0.25
      this.camera.updateProjectionMatrix()
    }
  }

  getLookRay(outOrigin: THREE.Vector3, outDir: THREE.Vector3): void {
    this.camera.getWorldPosition(outOrigin)
    this.camera.getWorldDirection(outDir)
  }

  teleportTo(x: number, z: number): void {
    if (!this.body) return
    const t = this.body.translation()
    this.physics.teleportBody(this.body, x, t.y, z)
    this.prevPos.set(x, t.y, z)
    this.currPos.set(x, t.y, z)
    this.yaw = Math.PI
    this.pitch = 0
  }

  dispose(): void {
    if (this.body && this.collider) {
      this.physics.disposeBody(this.body)
    }
    this.body = null
    this.collider = null
    this.controller = null
  }
}
