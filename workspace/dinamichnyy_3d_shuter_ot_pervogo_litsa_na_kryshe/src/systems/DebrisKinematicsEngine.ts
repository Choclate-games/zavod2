// DebrisKinematicsEngine: горящие обломки сбитых дронов летят на игрока
// по крыше навстречу. Один InstancedMesh, пул фиксированного размера.

import * as THREE from 'three'
import { RULES } from '../config/rules'
import { PALETTE, buildDebrisGeometry } from '../rendering/ProceduralModels'

const MAX_DEBRIS = 12

interface DebrisState {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  spinX: number
  spinY: number
}

export interface PlayerHitbox {
  x: number
  y: number
  z: number
  radiusM: number
}

export class DebrisKinematicsEngine {
  readonly mesh: THREE.InstancedMesh
  private readonly states: DebrisState[] = []
  private readonly dummy = new THREE.Object3D()

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      buildDebrisGeometry(),
      new THREE.MeshStandardMaterial({
        color: PALETTE.armorDark,
        emissive: PALETTE.plasmaOrange,
        emissiveIntensity: 1.6,
        roughness: 0.7,
        metalness: 0.2,
      }),
      MAX_DEBRIS,
    )
    this.mesh.frustumCulled = false
    for (let i = 0; i < MAX_DEBRIS; i++) {
      this.states.push({ active: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, spinX: 0, spinY: 0 })
      this.dummy.position.set(0, -100, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
  }

  reset(): void {
    for (const state of this.states) state.active = false
    this.hideAll()
  }

  private hideAll(): void {
    this.dummy.position.set(0, -100, 0)
    this.dummy.updateMatrix()
    for (let i = 0; i < MAX_DEBRIS; i++) this.mesh.setMatrixAt(i, this.dummy.matrix)
    ;(this.mesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  /**
   * Обломок летит на игрока: встречная скорость складывается из скорости поезда
   * и ветровой добавки — обломки приходят на игрока быстрее, чем поезд едет.
   */
  spawnAt(targetX: number, targetZ: number, trainSpeedMs: number, windMs: number): void {
    const state = this.states.find((s) => !s.active)
    if (!state) return
    state.active = true
    state.x = targetX + (Math.random() - 0.5) * 10
    state.y = 4 + Math.random() * 5
    state.z = targetZ - (55 + Math.random() * 25)
    const speed = trainSpeedMs + windMs * 0.4
    state.vx = (targetX - state.x) * 0.25
    state.vy = (1.1 - state.y) * 0.35
    state.vz = speed
    state.spinX = (Math.random() - 0.5) * 9
    state.spinY = (Math.random() - 0.5) * 9
  }

  /** Возвращает индекс столкнувшегося обломка или -1. */
  update(dt: number, player: PlayerHitbox): number {
    let hitIndex = -1
    let dirty = false
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const state = this.states[i]
      if (!state.active) continue
      dirty = true
      state.x += state.vx * dt
      state.y += state.vy * dt
      state.z += state.vz * dt

      const dx = state.x - player.x
      const dy = state.y - (player.y - 0.8)
      const dz = state.z - player.z
      if (dx * dx + dy * dy + dz * dz < (player.radiusM + 0.55) * (player.radiusM + 0.55)) {
        hitIndex = i
        state.active = false
        this.writeHidden(i)
        continue
      }
      if (state.z > player.z + 14 || state.y < -6 || state.z < player.z - 130) {
        state.active = false
        this.writeHidden(i)
        continue
      }
      this.dummy.position.set(state.x, state.y, state.z)
      this.dummy.rotation.set(state.x * state.spinX * dt * 60 % (Math.PI * 2), state.z * state.spinY * dt * 60 % (Math.PI * 2), 0)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    if (dirty) (this.mesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
    return hitIndex
  }

  private writeHidden(i: number): void {
    this.dummy.position.set(0, -100, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.updateMatrix()
    this.mesh.setMatrixAt(i, this.dummy.matrix)
  }

  get debrisShieldDamagePct(): number {
    return RULES.debrisShieldDamagePct
  }
}
