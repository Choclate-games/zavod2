// Босс-перехватчик «Громовержец»: тяжёлая машина над локомотивом.
// Залпы кинетических торпед; энергоядро — единственная зона урона (сфера).

import * as THREE from 'three'
import { RULES } from '../config/rules'
import { PALETTE, buildBossModel } from '../rendering/ProceduralModels'
import type { PlayerPoint } from './DroneSwarmManager'

const TORPEDO_COUNT = 10
const TORPEDO_SPEED_MS = 34

interface TorpedoState {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export class BossController {
  readonly root: THREE.Group
  readonly core: THREE.Mesh
  readonly torpedoes: THREE.InstancedMesh
  private readonly coreMaterial: THREE.MeshBasicMaterial
  private readonly torpedoStates: TorpedoState[] = []
  private readonly dummy = new THREE.Object3D()

  hp = RULES.bossHp
  maxHp = RULES.bossHp
  active = false
  private volleyCooldownS = 4
  private timeS = 0

  constructor() {
    const model = buildBossModel()
    this.root = model.root
    this.core = model.core
    this.coreMaterial = model.coreMaterial
    this.root.visible = false

    this.torpedoes = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.22, 0.7, 3, 8),
      new THREE.MeshStandardMaterial({
        color: PALETTE.armorLight,
        emissive: PALETTE.dangerRed,
        emissiveIntensity: 1.2,
        roughness: 0.5,
        metalness: 0.3,
      }),
      TORPEDO_COUNT,
    )
    this.torpedoes.frustumCulled = false
    for (let i = 0; i < TORPEDO_COUNT; i++) {
      this.torpedoStates.push({ active: false, x: 0, y: -80, z: 0, vx: 0, vy: 0, vz: 0 })
      this.dummy.position.set(0, -80, 0)
      this.dummy.updateMatrix()
      this.torpedoes.setMatrixAt(i, this.dummy.matrix)
    }
  }

  reset(): void {
    this.hp = this.maxHp
    this.active = false
    this.volleyCooldownS = 4
    this.timeS = 0
    this.root.visible = false
    for (let i = 0; i < TORPEDO_COUNT; i++) {
      this.torpedoStates[i].active = false
      this.dummy.position.set(0, -80, 0)
      this.dummy.updateMatrix()
      this.torpedoes.setMatrixAt(i, this.dummy.matrix)
    }
    ;(this.torpedoes.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  activate(): void {
    this.active = true
    this.root.visible = true
  }

  get coreX(): number {
    return this.root.position.x
  }
  get coreY(): number {
    return this.root.position.y + 0 + this.core.position.z * 0
  }
  get coreWorldY(): number {
    return this.root.position.y
  }
  get coreZ(): number {
    return this.root.position.z + this.core.position.z
  }

  damageCore(amount: number): boolean {
    if (!this.active) return false
    this.hp -= amount
    // ядро нащупывает смерть цветом: золотое -> красное
    const ratio = Math.max(0, this.hp / this.maxHp)
    this.coreMaterial.color.setRGB(1, 0.84 * ratio, 0.37 * ratio)
    return this.hp <= 0
  }

  update(dt: number, player: PlayerPoint, onTorpedoArrive: () => void): void {
    if (!this.active) return
    this.timeS += dt
    // держится впереди локомотива, покачивается и смещается по полосам игрока
    const targetX = player.x * 0.6 + Math.sin(this.timeS * 0.4) * 3
    this.root.position.x += (targetX - this.root.position.x) * dt
    this.root.position.y = 8.5 + Math.sin(this.timeS * 0.7) * 1.2
    this.root.rotation.y = Math.sin(this.timeS * 0.3) * 0.25
    const pulse = 1 + Math.sin(this.timeS * 6) * 0.12
    this.core.scale.setScalar(pulse)

    this.volleyCooldownS -= dt
    if (this.volleyCooldownS <= 0) {
      this.volleyCooldownS = 4.5 - Math.max(0, 2.5 * (1 - this.hp / this.maxHp))
      this.fireVolley(player)
    }

    let dirty = false
    for (let i = 0; i < TORPEDO_COUNT; i++) {
      const t = this.torpedoStates[i]
      if (!t.active) continue
      dirty = true
      t.x += t.vx * dt
      t.y += t.vy * dt
      t.z += t.vz * dt
      const dx = t.x - player.x
      const dy = t.y - (player.y - 0.9)
      const dz = t.z - player.z
      if (dx * dx + dy * dy + dz * dz < 1.3) {
        t.active = false
        this.writeHidden(i)
        onTorpedoArrive()
        continue
      }
      if (t.z > player.z + 12) {
        t.active = false
        this.writeHidden(i)
        continue
      }
      this.dummy.position.set(t.x, t.y, t.z)
      this.dummy.rotation.set(Math.PI / 2, 0, 0)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.torpedoes.setMatrixAt(i, this.dummy.matrix)
    }
    if (dirty) (this.torpedoes.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  private fireVolley(player: PlayerPoint): void {
    let fired = 0
    for (let i = 0; i < TORPEDO_COUNT && fired < 3; i++) {
      const t = this.torpedoStates[i]
      if (t.active) continue
      const spreadX = (fired - 1) * 2.2
      const tx = player.x + spreadX
      const ty = player.y - 1
      const tz = player.z - 6
      const dx = tx - this.coreX
      const dy = ty - this.coreWorldY
      const dz = tz - this.coreZ
      const len = Math.hypot(dx, dy, dz) || 1
      t.active = true
      t.x = this.coreX
      t.y = this.coreWorldY
      t.z = this.coreZ
      t.vx = (dx / len) * TORPEDO_SPEED_MS
      t.vy = (dy / len) * TORPEDO_SPEED_MS
      t.vz = (dz / len) * TORPEDO_SPEED_MS
      fired++
    }
  }

  private writeHidden(i: number): void {
    this.dummy.position.set(0, -80, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.updateMatrix()
    this.torpedoes.setMatrixAt(i, this.dummy.matrix)
  }
}
