import * as THREE from 'three'
import { BAL } from '../config/balance.js'
import { mergeGeometries } from '../render/meshUtil.js'

/**
 * Поток танцоров шествия: один InstancedMesh, геометрия и материалы общие.
 * Танцоры маршируют по полосам вдоль трека в сторону старта со скоростью
 * шествия из баланса; маскировка игрока считается по близости к толпе.
 */

const LANES = [-7, -3.5, 0, 3.5, 7]
const TRACK_MIN_Z = -76
const TRACK_MAX_Z = 46

export class Dancers {
  readonly mesh: THREE.InstancedMesh
  private readonly lanes: number[] = []
  private readonly zs: number[] = []
  private readonly phase: number[] = []
  private readonly dummy = new THREE.Object3D()
  private count: number

  constructor() {
    // Силуэт: конус-юбка + сфера-голова одной слитной геометрией.
    const skirt = new THREE.ConeGeometry(0.55, 1.5, 7)
    skirt.translate(0, 0.75, 0)
    const head = new THREE.SphereGeometry(0.24, 8, 6)
    head.translate(0, 1.68, 0)
    const merged = mergeGeometries([skirt, head])
    this.mesh = new THREE.InstancedMesh(
      merged,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      40,
    )
    this.mesh.frustumCulled = false
    this.count = 40
    const palette = [0xff5f9e, 0x5ad7e8, 0xff9a4d, 0x8cff6b, 0xc98bff, 0xf2ede2]
    const color = new THREE.Color()
    for (let i = 0; i < this.count; i++) {
      this.lanes.push(LANES[i % LANES.length] + (Math.random() - 0.5) * 1.2)
      this.zs.push(TRACK_MIN_Z + Math.random() * (TRACK_MAX_Z - TRACK_MIN_Z))
      this.phase.push(Math.random() * Math.PI * 2)
      color.setHex(palette[i % palette.length])
      this.mesh.setColorAt(i, color)
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  /** Шествие идёт в сторону стартовой платформы; зациклено по длине трека. */
  update(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      this.zs[i] += BAL.marchSpeed * dt
      if (this.zs[i] > TRACK_MAX_Z) this.zs[i] = TRACK_MIN_Z
      const sway = Math.sin(this.phase[i] + this.zs[i] * 0.55) * 0.28
      this.dummy.position.set(this.lanes[i] + sway * 0.35, Math.abs(sway) * 0.12, this.zs[i])
      this.dummy.rotation.set(0, Math.atan2(-BAL.marchSpeed, sway), sway * 0.6)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Сколько танцоров в радиусе маскировки от точки. Маскировка работает,
   * когда рядом минимум BAL.crowdMinSize участников потока.
   */
  crowdCountNear(x: number, z: number): number {
    let n = 0
    const r2 = BAL.disguiseRadius * BAL.disguiseRadius
    for (let i = 0; i < this.count; i++) {
      const dx = this.lanes[i] - x
      const dz = this.zs[i] - z
      if (dx * dx + dz * dz <= r2) n++
    }
    return n
  }

  /** Среднее направление потока рядом с точкой — для синхронного «шага шествия». */
  flowDirectionNear(out: { x: number; z: number }): void {
    out.x = 0
    out.z = BAL.marchSpeed
  }
}
