import * as THREE from 'three'
import type { SceneManager } from './SceneManager'

const MIN_PITCH = 0.18
const MAX_PITCH = 1.25

/** Орбитальная тактическая камера: цели хранятся заранее, кадр только лерпит. */
export class CameraRig {
  private yawTarget = Math.PI * 0.25
  private pitchTarget = 0.62
  private radiusTarget = 120
  private focusTarget = new THREE.Vector3(0, 14, 0)
  private readonly focus = new THREE.Vector3(0, 14, 0)
  private yaw = this.yawTarget
  private pitch = this.pitchTarget
  private radius = this.radiusTarget
  private shakeAmplitude = 0

  constructor(private readonly manager: SceneManager) {}

  /** Короткая тряска при кинетическом ударе каскада. */
  addShake(power: number): void {
    this.shakeAmplitude = Math.min(1.6, this.shakeAmplitude + power * 1.1)
  }

  orbit(dx: number, dy: number): void {
    this.yawTarget += dx * 0.005
    this.pitchTarget = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitchTarget + dy * 0.003))
  }

  zoom(factor: number): void {
    this.radiusTarget = THREE.MathUtils.clamp(this.radiusTarget * factor, 45, 260)
  }

  focusOn(x: number, y: number, z: number, radius: number): void {
    this.focusTarget.set(x, y, z)
    this.radiusTarget = THREE.MathUtils.clamp(radius, 45, 300)
  }

  /** Кинематографичный наезд к эпицентру каскада. */
  snapFocus(x: number, y: number, z: number): void {
    this.focusTarget.x = x
    this.focusTarget.y = y
    this.focusTarget.z = z
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 4.5)
    this.yaw += (this.yawTarget - this.yaw) * k
    this.pitch += (this.pitchTarget - this.pitch) * k
    this.radius += (this.radiusTarget - this.radius) * k
    this.focus.lerp(this.focusTarget, k)
    const camera = this.manager.camera
    const cosP = Math.cos(this.pitch)
    camera.position.set(
      this.focus.x + Math.sin(this.yaw) * cosP * this.radius,
      this.focus.y + Math.sin(this.pitch) * this.radius,
      this.focus.z + Math.cos(this.yaw) * cosP * this.radius,
    )
    if (this.shakeAmplitude > 0.01) {
      const t = performance.now() * 0.001
      camera.position.x += Math.sin(t * 47) * this.shakeAmplitude
      camera.position.y += Math.sin(t * 61) * this.shakeAmplitude * 0.7
      camera.position.z += Math.cos(t * 53) * this.shakeAmplitude
      this.shakeAmplitude *= Math.exp(-dt * 5)
    }
    camera.lookAt(this.focus)
  }

  get currentYaw(): number {
    return this.yaw
  }
}
