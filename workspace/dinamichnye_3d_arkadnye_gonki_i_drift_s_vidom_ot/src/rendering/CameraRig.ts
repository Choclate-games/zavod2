import * as THREE from 'three'
import type { PlayerVehicle } from '../entities/Player'

/**
 * Следящая камера: позиция за кормой со сглаживанием 1 - exp(-k*dt),
 * вынос в сторону заноса, динамический FOV от скорости, тряска от
 * гидроудара. В меню камера медленно облетает стоящий тягач.
 */
export class CameraRig {
  private readonly desired = new THREE.Vector3()
  private readonly lookAt = new THREE.Vector3()
  private shakeFor = 0
  private menuAngle = 0

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    camera.position.set(0, 8, -16)
  }

  shake(strength: number): void {
    this.shakeFor = Math.min(0.5, this.shakeFor + strength * 0.35)
  }

  followRace(vehicle: PlayerVehicle, dt: number, driftAngleDeg: number): void {
    const pos = vehicle.position()
    const k = 1 - Math.exp(-4.2 * dt)
    const driftOffset = Math.max(-1, Math.min(1, driftAngleDeg / 40)) * 3.4
    this.desired.set(
      pos.x - vehicle.forwardX() * 11 + vehicle.rightX() * driftOffset,
      pos.y + 4.6,
      pos.z - vehicle.forwardZ() * 11 - vehicle.rightZ() * driftOffset,
    )
    this.camera.position.lerp(this.desired, k)
    this.lookAt.lerp(
      this.tmpSet(pos.x + vehicle.forwardX() * 8, pos.y + 1.4, pos.z + vehicle.forwardZ() * 8),
      1 - Math.exp(-6 * dt),
    )
    this.applyShake(dt)
    const speedKmh = Math.abs(vehicle.forwardSpeed())
    const targetFov = 55 + Math.min(10, speedKmh / 14) + (vehicle.turboActiveFor > 0 ? 6 : 0)
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-2.5 * dt))
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.lookAt)
  }

  /** Сцена за меню: медленный облёт тягача на утёсе. */
  orbitMenu(focus: THREE.Vector3, dt: number): void {
    this.menuAngle += dt * 0.22
    const radius = 13
    this.desired.set(
      focus.x + Math.cos(this.menuAngle) * radius,
      focus.y + 3.6,
      focus.z + Math.sin(this.menuAngle) * radius,
    )
    this.camera.position.lerp(this.desired, 1 - Math.exp(-2.2 * dt))
    this.lookAt.lerp(focus, 1 - Math.exp(-3 * dt))
    this.applyShake(dt)
    this.camera.lookAt(this.lookAt)
  }

  snapTo(focus: THREE.Vector3): void {
    this.menuAngle = 0
    this.camera.position.set(focus.x + 12, focus.y + 4, focus.z + 12)
    this.lookAt.copy(focus)
    this.camera.lookAt(this.lookAt)
  }

  private readonly tmpVec = new THREE.Vector3()

  private tmpSet(x: number, y: number, z: number): THREE.Vector3 {
    return this.tmpVec.set(x, y, z)
  }

  private applyShake(dt: number): void {
    if (this.shakeFor <= 0) return
    this.shakeFor = Math.max(0, this.shakeFor - dt * 1.6)
    const amp = this.shakeFor * 0.28
    this.camera.position.x += (Math.random() - 0.5) * amp
    this.camera.position.y += (Math.random() - 0.5) * amp
  }
}
