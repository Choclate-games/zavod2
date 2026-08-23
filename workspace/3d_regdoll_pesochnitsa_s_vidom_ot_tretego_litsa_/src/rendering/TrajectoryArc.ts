import * as THREE from 'three'
import { BALANCE } from '../config/balance.ts'

/**
 * Пунктирная золотая дуга траектории: первые 30% пути, как в спецификации.
 * Геометрия создаётся один раз; в кадре пересчитываются только позиции точек.
 */
const SEGMENTS = 24

export class TrajectoryArc {
  private readonly line: THREE.Line
  private readonly positions: Float32Array

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(SEGMENTS * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    const material = new THREE.LineDashedMaterial({
      color: 0xd4af37,
      dashSize: 0.35,
      gapSize: 0.25,
    })
    this.line = new THREE.Line(geometry, material)
    this.line.visible = false
    this.line.frustumCulled = false
    scene.add(this.line)
  }

  /** Показывает дугу от точки старта с направлением и скоростью выстрела. */
  show(originX: number, originY: number, originZ: number, dirX: number, dirY: number, dirZ: number): void {
    const v0 = BALANCE.sling.baseLaunchVelocity
    const g = 9.81
    for (let i = 0; i < SEGMENTS; i++) {
      const fraction = (i / (SEGMENTS - 1)) * BALANCE.sling.aimTrajectoryFraction
      const t = (fraction * BALANCE.sling.maxPullDistance * v0) / Math.max(v0, 1)
      // Баллистическая парабола без сопротивления — предпросмотр первых процентов пути.
      this.positions[i * 3] = originX + dirX * v0 * t * 0.06
      this.positions[i * 3 + 1] = originY + dirY * v0 * t * 0.06 - 0.5 * g * t * t * 0.06
      this.positions[i * 3 + 2] = originZ + dirZ * v0 * t * 0.06
    }
    this.line.geometry.getAttribute('position').needsUpdate = true
    this.line.computeLineDistances()
    this.line.visible = true
  }

  hide(): void {
    this.line.visible = false
  }
}
