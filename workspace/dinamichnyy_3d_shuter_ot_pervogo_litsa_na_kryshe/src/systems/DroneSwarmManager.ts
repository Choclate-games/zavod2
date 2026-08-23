// DroneSwarmManager: эскадрилья дронов на одном InstancedMesh.
// Звенья из 2–3 машин за золотым лидером; поведение — упрощённые boids
// (разделение + выравнивание к строю + притяжение к цели над игроком).
// Плазмоиды выпускают не больше двух дронов одновременно (токены атаки).

import * as THREE from 'three'
import { RULES } from '../config/rules'
import { PALETTE, buildDroneGeometry } from '../rendering/ProceduralModels'

export const MAX_DRONES = 30

export interface DroneRecord {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  hp: number
  maxHp: number
  isLeader: boolean
  isArmored: boolean
  formationId: number
  formationSize: number
  fireCooldownS: number
  bobPhase: number
}

export interface PlayerPoint {
  x: number
  y: number
  z: number
}

export interface KillEvent {
  index: number
  wasLeader: boolean
  formationId: number
}

const ORB_COUNT = 14
const PLASMA_SPEED_MS = 26
const ATTACK_TOKENS = 2

function makeOrbMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: PALETTE.plasmaOrange })
}

export class DroneSwarmManager {
  readonly mesh: THREE.InstancedMesh
  readonly orbs: THREE.InstancedMesh
  readonly drones: DroneRecord[] = []

  private readonly dummy = new THREE.Object3D()
  private readonly tmpColor = new THREE.Color()
  private nextFormationId = 1
  private activeAttackers = 0
  private timeS = 0

  // плазмоиды
  private readonly orbStates: { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number }[] = []

  constructor() {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.35,
      emissive: PALETTE.visorCyan,
      emissiveIntensity: 0.25,
    })
    this.mesh = new THREE.InstancedMesh(buildDroneGeometry(), material, MAX_DRONES)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    for (let i = 0; i < MAX_DRONES; i++) {
      this.drones.push({
        active: false, x: 0, y: -80, z: 0, vx: 0, vy: 0, vz: 0,
        hp: 50, maxHp: 50, isLeader: false, isArmored: false,
        formationId: 0, formationSize: 1, fireCooldownS: 0, bobPhase: Math.random() * Math.PI * 2,
      })
      this.dummy.position.set(0, -80, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, this.tmpColor.setHex(PALETTE.visorCyan))
    }

    this.orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6), makeOrbMaterial(), ORB_COUNT)
    this.orbs.frustumCulled = false
    for (let i = 0; i < ORB_COUNT; i++) {
      this.orbStates.push({ active: false, x: 0, y: -80, z: 0, vx: 0, vy: 0, vz: 0 })
      this.dummy.position.set(0, -80, 0)
      this.dummy.updateMatrix()
      this.orbs.setMatrixAt(i, this.dummy.matrix)
    }
  }

  reset(): void {
    for (const drone of this.drones) drone.active = false
    for (const orb of this.orbStates) orb.active = false
    this.activeAttackers = 0
    this.nextFormationId = 1
    this.hideAll(this.mesh, MAX_DRONES)
    this.hideAll(this.orbs, ORB_COUNT)
  }

  private hideAll(mesh: THREE.InstancedMesh, count: number): void {
    this.dummy.position.set(0, -80, 0)
    this.dummy.updateMatrix()
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, this.dummy.matrix)
    ;(mesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  get aliveCount(): number {
    let n = 0
    for (const drone of this.drones) if (drone.active) n++
    return n
  }

  /** Звено: лидер + до двух ведомых. Фаза 2 добавляет броню ведомым. */
  spawnFormation(playerZ: number, armoredChance: number): void {
    const free: DroneRecord[] = []
    for (const drone of this.drones) if (!drone.active) free.push(drone)
    if (free.length === 0) return
    const size = Math.min(free.length, 2 + (Math.random() < 0.5 ? 1 : 0))
    const formationId = this.nextFormationId++
    const cx = (Math.random() - 0.5) * 12
    const cy = 4.5 + Math.random() * 4
    const cz = playerZ - (60 + Math.random() * 25)

    for (let i = 0; i < size; i++) {
      const drone = free[i]
      drone.active = true
      drone.isLeader = i === 0
      drone.isArmored = !drone.isLeader && Math.random() < armoredChance
      drone.maxHp = drone.isLeader ? 100 : drone.isArmored ? 100 : 50
      drone.hp = drone.maxHp
      drone.formationId = formationId
      drone.formationSize = size
      drone.fireCooldownS = 3 + Math.random() * 4
      const angle = (i / Math.max(1, size - 1) - 0.5) * Math.PI
      const radius = drone.isLeader ? 0 : 3.2
      drone.x = cx + Math.cos(angle) * radius
      drone.y = cy + (drone.isLeader ? 0 : 0.7)
      drone.z = cz + (i === 0 ? 0 : -2.4)
      const speed = 6
      drone.vx = 0
      drone.vy = 0
      drone.vz = speed
      this.writeColor(drone)
    }
  }

  private writeColor(drone: DroneRecord): void {
    if (drone.isLeader) this.tmpColor.setHex(PALETTE.leaderGold)
    else if (drone.isArmored) this.tmpColor.setHex(PALETTE.copper)
    else this.tmpColor.setHex(PALETTE.visorCyan)
    const index = this.drones.indexOf(drone)
    this.mesh.setColorAt(index, this.tmpColor)
    if (this.mesh.instanceColor != null) (this.mesh.instanceColor as THREE.BufferAttribute).needsUpdate = true
  }

  /**
   * Обновление строя. Соседи ищутся прямым проходом: активных дронов <= 30,
   * квадратичная проверка дешевле пространственной сетки на таком числе.
   */
  update(
    dt: number,
    player: PlayerPoint,
    windX: number,
    onPlasmaArrive: () => void,
  ): void {
    this.timeS += dt
    const list = this.drones
    // разделение + притяжение к якорю строя
    for (let i = 0; i < list.length; i++) {
      const drone = list[i]
      if (!drone.active) continue

      // якорь: лидер патрулирует перед игроком, ведомый держит смещение
      let ax: number
      let ay: number
      let az: number
      if (drone.isLeader) {
        ax = Math.sin(this.timeS * 0.5 + drone.bobPhase) * 7
        ay = 5 + Math.sin(this.timeS * 0.9 + drone.bobPhase) * 2
        az = player.z - 45
      } else {
        const leader = list.find((d) => d.active && d.isLeader && d.formationId === drone.formationId)
        ax = (leader?.x ?? player.x) + (drone.bobPhase > Math.PI ? 3.2 : -3.2)
        ay = (leader?.y ?? 6) + 0.7
        az = (leader?.z ?? player.z - 48) - 2.4
      }

      let sx = 0
      let sy = 0
      for (let j = 0; j < list.length; j++) {
        if (j === i || !list[j].active) continue
        const dx = drone.x - list[j].x
        const dy = drone.y - list[j].y
        const dz = drone.z - list[j].z
        const distSq = dx * dx + dy * dy + dz * dz
        if (distSq > 0.01 && distSq < 9) {
          const inv = 1 / distSq
          sx += dx * inv
          sy += dy * inv
        }
      }

      drone.vx += ((ax - drone.x) * 0.55 + sx * 22) * dt
      drone.vy += ((ay - drone.y) * 0.75 + sy * 22) * dt
      drone.vz += ((az - drone.z) * 0.4) * dt
      const windPush = windX * 0.06
      drone.vx += windPush * dt

      // огибают крышу поезда, а не проходят сквозь неё
      if (drone.y < 2.6 && drone.z > player.z - 40 && drone.z < player.z + 20) drone.vy += 14 * dt

      drone.vx *= 1 - 0.5 * dt
      drone.vy *= 1 - 0.5 * dt
      drone.vz *= 1 - 0.5 * dt
      drone.x += drone.vx * dt
      drone.y += drone.vy * dt
      drone.z += drone.vz * dt

      // отставший далеко позади строй списывается
      if (drone.z > player.z + 24) drone.active = false

      // токены атаки: стреляют максимум двое одновременно
      drone.fireCooldownS -= dt
      if (drone.fireCooldownS <= 0 && this.activeAttackers < ATTACK_TOKENS && drone.z < player.z - 18) {
        drone.fireCooldownS = 4 + Math.random() * 3
        if (this.firePlasmaAt(drone, player)) this.activeAttackers++
      }
    }
    ;(this.mesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
    this.writeVisuals(dt)

    // плазмоиды летят в предсказанную точку и бьют по щиту
    let orbDirty = false
    for (let i = 0; i < ORB_COUNT; i++) {
      const orb = this.orbStates[i]
      if (!orb.active) continue
      orbDirty = true
      orb.x += orb.vx * dt
      orb.y += orb.vy * dt
      orb.z += orb.vz * dt
      const dx = orb.x - player.x
      const dy = orb.y - (player.y - 0.8)
      const dz = orb.z - player.z
      if (dx * dx + dy * dy + dz * dz < 1.1) {
        orb.active = false
        this.writeHidden(this.orbs, i)
        onPlasmaArrive()
        continue
      }
      if (orb.z > player.z + 10) {
        orb.active = false
        this.writeHidden(this.orbs, i)
        continue
      }
      this.dummy.position.set(orb.x, orb.y, orb.z)
      this.dummy.rotation.set(0, 0, 0)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.orbs.setMatrixAt(i, this.dummy.matrix)
    }
    if (orbDirty) (this.orbs.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  private writeVisuals(dt: number): void {
    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i]
      if (!drone.active) continue
      const spin = this.timeS * 14 + drone.bobPhase
      this.dummy.position.set(drone.x, drone.y + Math.sin(spin * 0.4) * 0.15, drone.z)
      this.dummy.rotation.set(Math.sin(spin) * 0.12, spin % (Math.PI * 2), 0)
      // смотрят вдоль движения (+Z геометрия под lookAt-стиль ориентации)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    void dt
  }

  private writeHidden(mesh: THREE.InstancedMesh, i: number): void {
    this.dummy.position.set(0, -80, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.updateMatrix()
    mesh.setMatrixAt(i, this.dummy.matrix)
  }

  private firePlasmaAt(shooter: DroneRecord, player: PlayerPoint): boolean {
    const orb = this.orbStates.find((o) => !o.active)
    if (!orb) return false
    const flightS = Math.hypot(player.x - shooter.x, player.z - shooter.z) / PLASMA_SPEED_MS
    const tx = player.x
    const ty = player.y - 1.1
    const tz = player.z - flightS * 2
    const dx = tx - shooter.x
    const dy = ty - shooter.y
    const dz = tz - shooter.z
    const len = Math.hypot(dx, dy, dz) || 1
    orb.active = true
    orb.x = shooter.x
    orb.y = shooter.y
    orb.z = shooter.z
    orb.vx = (dx / len) * PLASMA_SPEED_MS
    orb.vy = (dy / len) * PLASMA_SPEED_MS
    orb.vz = (dz / len) * PLASMA_SPEED_MS
    return true
  }

  notifyAttackerDone(): void {
    this.activeAttackers = Math.max(0, this.activeAttackers - 1)
  }

  /**
   * Урон дрону. Возвращает событие убийства или null.
   * Цепная детонация обрабатывается вызывающей стороной через killFormation().
   */
  damage(index: number, amount: number): KillEvent | null {
    const drone = this.drones[index]
    if (!drone.active) return null
    drone.hp -= amount
    if (drone.hp > 0) return null
    return { index, wasLeader: drone.isLeader, formationId: drone.formationId }
  }

  /** Ведомые одного звена в радиусе цепного захвата от лидера. */
  followersOf(formationId: number, fromX: number, fromY: number, fromZ: number): number[] {
    const result: number[] = []
    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i]
      if (!drone.active || drone.formationId !== formationId) continue
      const dSq =
        (drone.x - fromX) * (drone.x - fromX) +
        (drone.y - fromY) * (drone.y - fromY) +
        (drone.z - fromZ) * (drone.z - fromZ)
      if (dSq <= RULES.chainRadiusM * RULES.chainRadiusM) result.push(i)
    }
    return result
  }

  deactivate(index: number): void {
    const drone = this.drones[index]
    drone.active = false
    this.writeHidden(this.mesh, index)
  }

  positionOf(index: number, out: { x: number; y: number; z: number }): void {
    const drone = this.drones[index]
    out.x = drone.x
    out.y = drone.y
    out.z = drone.z
  }

  /** Ближайший активный дрон вдоль луча взгляда: для прицела и теслы. */
  findTargetAlong(originX: number, originY: number, originZ: number, dirX: number, dirY: number, dirZ: number, maxAngleRad: number, maxDistM: number): number {
    let best = -1
    let bestScore = Infinity
    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i]
      if (!drone.active) continue
      const dx = drone.x - originX
      const dy = drone.y - originY
      const dz = drone.z - originZ
      const dist = Math.hypot(dx, dy, dz)
      if (dist > maxDistM || dist < 2) continue
      const dot = (dx * dirX + dy * dirY + dz * dirZ) / dist
      const angle = Math.acos(Math.min(1, Math.max(-1, dot)))
      if (angle > maxAngleRad) continue
      const score = angle * 30 + dist * 0.05
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    return best
  }
}
