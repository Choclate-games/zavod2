import * as THREE from 'three'
import { BAL } from '../config/balance.js'
import { lineBlockedBy, type Obstacle, clampToWalkable, type WalkRect } from '../render/world.js'
import { mergeGeometries } from '../render/meshUtil.js'

/**
 * Стража эшелонов: конус зрения с конкретным углом и дальностью, двухступенчатая
 * проверка видимости (дешёвый угол+дистанция каждый кадр, дорогая проверка
 * преград — только для прошедших и с ограниченной частотой), шкала подозрения
 * с тремя состояниями и маркером над головой. Смерть — верлет-рэгдолл из тех же
 * мешей; тело удаляется по таймеру.
 */

export type GuardState = 'calm' | 'suspicious' | 'alert'

export interface GuardContext {
  playerX: number
  playerZ: number
  /** Вор в маскировке толпы: заметность падает на 85%. */
  playerDisguised: boolean
  /** Вор в тени навеса: подозрение копится медленнее. */
  playerInShade: boolean
  obstacles: readonly Obstacle[]
  walkable: readonly WalkRect[]
  onAlert: (guard: Guard) => void
  onStrike: (guard: Guard) => void
  onTakedown: () => void
}

const SUSPICIOUS_THRESHOLD = 0.35
const CHASE_SPEED = BAL.marchSpeed * 1.35
const PATROL_SPEED = BAL.marchSpeed * 0.55
const ATTACK_RANGE = 1.7
const WINDUP_TIME = 0.55
const RAYCAST_INTERVAL = 0.15
/** Верхняя граница времени до обнаружения: стоять на краю конуса вечно нельзя. */
const MAX_SEEN_TIME = 2.2

interface RagdollPoint {
  x: number
  y: number
  z: number
  px: number
  py: number
  pz: number
}

export class Guard {
  readonly root = new THREE.Group()
  private readonly bodyMesh: THREE.Mesh
  private readonly headMesh: THREE.Mesh
  private readonly halberd: THREE.Group
  private readonly coneMesh: THREE.Mesh
  private readonly suspiciousMark: THREE.Mesh
  private readonly alertMark: THREE.Mesh

  readonly viewDist: number
  private readonly halfFov: number
  private suspicionRate: number

  state: GuardState = 'calm'
  suspicion = 0
  facing = 0
  stunnedTimer = 0
  blindedTimer = 0
  alive = true

  private readonly waypoints: { x: number; z: number }[] = []
  private waypointIndex = 0
  private seenTime = 0
  private raycastCooldown = 0
  private lastLosClear = false
  private investigateX = 0
  private investigateZ = 0
  private windupTimer = 0
  private strikeCooldown = 0
  private deadTimer = 0
  private readonly ragdollPoints: RagdollPoint[] = []
  private readonly pos = new THREE.Vector3()

  constructor(elite: boolean, waypoints: Array<{ x: number; z: number }>) {
    this.waypoints.push(...waypoints)
    this.pos.set(waypoints[0].x, 0, waypoints[0].z)
    this.viewDist = elite ? 11 : 8.5
    this.halfFov = ((elite ? 62 : 52) * Math.PI) / 180
    this.suspicionRate = elite ? 0.85 : 0.6

    const armorMat = new THREE.MeshLambertMaterial({ color: elite ? 0x4a5462 : 0x5b6673 })
    const trimMat = new THREE.MeshLambertMaterial({ color: elite ? 0xc8342e : 0x8f9aa8 })
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc99b6c })

    // Торс и алебарда: минимальное число мешей на стража.
    const torso = new THREE.CylinderGeometry(0.34, 0.44, 1.15, 7)
    torso.translate(0, 0.9, 0)
    const plume = new THREE.ConeGeometry(0.09, 0.4, 5)
    plume.rotateZ(Math.PI)
    plume.translate(0, 2.05, 0)
    this.bodyMesh = new THREE.Mesh(mergeGeometries([torso, plume]), armorMat)
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 9, 7), skinMat)
    this.headMesh.position.y = 1.72

    this.halberd = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a26 }))
    const bladeGeo = mergeGeometries([
      (() => {
        const g = new THREE.ConeGeometry(0.16, 0.5, 4)
        g.scale(0.5, 1, 1)
        return g
      })(),
      (() => {
        const g = new THREE.BoxGeometry(0.06, 0.3, 0.12)
        return g
      })(),
    ])
    const blade = new THREE.Mesh(bladeGeo, trimMat)
    blade.position.y = 1.25
    this.halberd.add(shaft, blade)
    this.halberd.position.set(0.42, 1.1, 0)

    // Конус зрения: буфер выделяется один раз, координаты локальные (апекс в нуле).
    const height = this.viewDist
    const baseRadius = Math.tan(this.halfFov) * height
    const coneGeo = new THREE.ConeGeometry(baseRadius, height, 20, 1, true)
    coneGeo.translate(0, -height / 2, 0)
    coneGeo.rotateX(-Math.PI / 2)
    this.coneMesh = new THREE.Mesh(coneGeo, guardCalmMaterial())
    this.coneMesh.position.y = 0.07

    this.suspiciousMark = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.42, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc94d }),
    )
    this.suspiciousMark.rotation.x = Math.PI
    this.suspiciousMark.position.y = 2.5
    this.alertMark = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial({ color: 0xff4136 }),
    )
    this.alertMark.position.y = 2.5

    this.root.add(this.coneMesh, this.bodyMesh, this.headMesh, this.halberd, this.suspiciousMark, this.alertMark)

    for (let i = 0; i < 4; i++) {
      this.ragdollPoints.push({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 })
    }
    this.syncMesh()
  }

  get x(): number {
    return this.pos.x
  }

  get z(): number {
    return this.pos.z
  }

  hearNoise(x: number, z: number): void {
    if (!this.alive || this.state === 'alert') return
    if (this.stunnedTimer > 0 || this.blindedTimer > 0) return
    // Шум переводит в проверку и разворачивает к источнику, но сам тревогу не поднимает.
    if (this.suspicion < SUSPICIOUS_THRESHOLD) this.suspicion = SUSPICIOUS_THRESHOLD + 0.01
    this.investigateX = x
    this.investigateZ = z
    this.state = 'suspicious'
  }

  blind(duration: number): void {
    if (!this.alive) return
    this.blindedTimer = Math.max(this.blindedTimer, duration)
    this.windupTimer = 0
  }

  stunAfterParry(dirX: number, dirZ: number): void {
    if (!this.alive) return
    this.stunnedTimer = BAL.stunDuration
    this.suspicion = 0
    this.state = 'suspicious'
    this.windupTimer = 0
    void dirX
    void dirZ
  }

  /** Пинок оглушённого: тряпичный сброс импульсом из баланса. */
  launchRagdoll(dirX: number, dirZ: number): void {
    if (!this.alive) return
    this.alive = false
    this.deadTimer = 6
    this.coneMesh.visible = false
    this.suspiciousMark.visible = false
    this.alertMark.visible = false
    const len = Math.hypot(dirX, dirZ) || 1
    const speed = BAL.kickImpulse / 60
    const pts = this.ragdollPoints
    pts[0].x = this.pos.x
    pts[0].y = 1.72
    pts[0].z = this.pos.z
    pts[1].x = this.pos.x
    pts[1].y = 1.1
    pts[1].z = this.pos.z
    pts[2].x = this.pos.x
    pts[2].y = 0.45
    pts[2].z = this.pos.z
    pts[3].x = this.pos.x + len * 0.3
    pts[3].y = 0.3
    pts[3].z = this.pos.z + len * 0.3
    for (let i = 0; i < pts.length; i++) {
      pts[i].px = pts[i].x - (dirX / len) * speed * (i === 3 ? 1.2 : 0.8)
      pts[i].py = pts[i].y
      pts[i].pz = pts[i].z - (dirZ / len) * speed * (i === 3 ? 1.2 : 0.8)
    }
    // Алебарда выпадает с сохранением мирового трансформа.
    this.root.updateMatrixWorld(true)
    const worldPos = this.halberd.getWorldPosition(new THREE.Vector3())
    const worldQuat = this.halberd.getWorldQuaternion(new THREE.Quaternion())
    this.root.parent?.attach(this.halberd)
    this.halberd.position.copy(worldPos)
    this.halberd.quaternion.copy(worldQuat)
    // Дальше точки рэгдолла хранятся в мировых координатах — корень в нуле.
    this.root.position.set(0, 0, 0)
    this.root.rotation.y = 0
  }

  update(dt: number, ctx: GuardContext): void {
    if (!this.alive) {
      this.updateRagdoll(dt)
      this.deadTimer -= dt
      if (this.deadTimer <= 0 && this.root.parent) {
        this.root.parent.remove(this.root)
      }
      return
    }

    this.blindedTimer = Math.max(0, this.blindedTimer - dt)
    this.stunnedTimer = Math.max(0, this.stunnedTimer - dt)
    this.strikeCooldown = Math.max(0, this.strikeCooldown - dt)

    if (this.stunnedTimer > 0 || this.blindedTimer > 0) {
      this.decaySuspicion(dt)
      this.syncMesh()
      return
    }

    this.sensePlayer(dt, ctx)
    this.act(dt, ctx)
    this.syncMesh()
  }

  /** Двухступенчатое зрение: дешёвый фильтр каждый кадр, преграды — редко. */
  private sensePlayer(dt: number, ctx: GuardContext): void {
    const dx = ctx.playerX - this.pos.x
    const dz = ctx.playerZ - this.pos.z
    const distSq = dx * dx + dz * dz
    let visible = false
    if (distSq <= this.viewDist * this.viewDist) {
      const angleToPlayer = Math.abs(angleDelta(this.facing, Math.atan2(dx, dz)))
      if (angleToPlayer <= this.halfFov) {
        this.raycastCooldown -= dt
        if (this.raycastCooldown <= 0) {
          this.raycastCooldown = RAYCAST_INTERVAL
          this.lastLosClear = !lineBlockedBy(ctx.obstacles, this.pos.x, this.pos.z, ctx.playerX, ctx.playerZ)
        }
        visible = this.lastLosClear
      }
    } else {
      this.raycastCooldown = Math.min(this.raycastCooldown, RAYCAST_INTERVAL)
    }

    if (!visible) {
      this.seenTime = Math.max(0, this.seenTime - dt * 1.6)
      this.decaySuspicion(dt)
      if (this.state === 'alert' && this.suspicion < SUSPICIOUS_THRESHOLD * 1.4) {
        // Потерял цель: возвращается к обходу, глобальная тревога остаётся у сессии.
        this.state = 'suspicious'
      }
      return
    }

    // Период прощения: мелькнувший в углу вор не становится подозрительным мгновенно.
    this.seenTime += dt
    if (this.seenTime < BAL.exposureGrace) return

    let rate = this.suspicionRate
    if (ctx.playerDisguised) rate *= BAL.disguiseFactor
    if (ctx.playerInShade) rate *= 0.5
    // Край конуса видит хуже: чем ближе к границе угла/дистанции, тем медленнее рост.
    this.suspicion = Math.min(1.2, this.suspicion + rate * dt)
    if (this.state !== 'alert' && this.suspicion >= 1) {
      this.state = 'alert'
      ctx.onAlert(this)
    } else if (this.state === 'calm' && this.suspicion >= SUSPICIOUS_THRESHOLD) {
      this.state = 'suspicious'
      this.investigateX = ctx.playerX
      this.investigateZ = ctx.playerZ
    }
    if (this.seenTime > MAX_SEEN_TIME && this.suspicion < 1) {
      this.suspicion = Math.min(1, this.suspicion + this.suspicionRate * dt)
      if (this.suspicion >= 1 && this.state !== 'alert') {
        this.state = 'alert'
        ctx.onAlert(this)
      }
    }
  }

  private decaySuspicion(dt: number): void {
    this.suspicion = Math.max(0, this.suspicion - dt * 0.22)
    if (this.suspicion < SUSPICIOUS_THRESHOLD && this.state === 'suspicious' && this.stunnedTimer <= 0) {
      this.state = 'calm'
    }
  }

  private act(dt: number, ctx: GuardContext): void {
    const dx = ctx.playerX - this.pos.x
    const dz = ctx.playerZ - this.pos.z
    const dist = Math.hypot(dx, dz)

    if (this.state === 'alert') {
      this.facing = turnTowards(this.facing, Math.atan2(dx, dz), 3.4 * dt)
      if (this.windupTimer > 0) {
        this.windupTimer -= dt
        if (this.windupTimer <= 0 && dist < ATTACK_RANGE + 0.4) {
          ctx.onStrike(this)
          this.strikeCooldown = 1.1
        }
        return
      }
      if (dist > ATTACK_RANGE) {
        this.moveTowards(ctx.playerX, ctx.playerZ, CHASE_SPEED * dt, ctx.walkable)
      } else if (this.strikeCooldown <= 0) {
        this.windupTimer = WINDUP_TIME
      }
      return
    }

    if (this.state === 'suspicious') {
      const ix = this.investigateX
      const iz = this.investigateZ
      const dInv = Math.hypot(ix - this.pos.x, iz - this.pos.z)
      if (dInv > 1.2) {
        this.facing = turnTowards(this.facing, Math.atan2(ix - this.pos.x, iz - this.pos.z), 2.4 * dt)
        this.moveTowards(ix, iz, PATROL_SPEED * 1.6 * dt, ctx.walkable)
      } else {
        this.facing += dt * 1.4
        this.decaySuspicion(dt * 1.4)
      }
      return
    }

    // Патруль по маршруту.
    const wp = this.waypoints[this.waypointIndex]
    const wdx = wp.x - this.pos.x
    const wdz = wp.z - this.pos.z
    const wd = Math.hypot(wdx, wdz)
    if (wd < 0.6) {
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length
    } else {
      this.facing = turnTowards(this.facing, Math.atan2(wdx, wdz), 1.8 * dt)
      this.moveTowards(wp.x, wp.z, PATROL_SPEED * dt, ctx.walkable)
    }
  }

  private moveTowards(x: number, z: number, step: number, walkable: readonly WalkRect[]): void {
    const dx = x - this.pos.x
    const dz = z - this.pos.z
    const len = Math.hypot(dx, dz)
    if (len < 1e-4) return
    this.pos.x += (dx / len) * step
    this.pos.z += (dz / len) * step
    clampToWalkable(walkable as WalkRect[], this.pos, 0.5)
  }

  /** Верлет-интеграция тряпичного тела: импульс вдоль удара, пределы земли. */
  private updateRagdoll(dt: number): void {
    const pts = this.ragdollPoints
    const fixedDt2 = (dt * dt)
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const vx = p.x - p.px
      const vy = p.y - p.py
      const vz = p.z - p.pz
      p.px = p.x
      p.py = p.y
      p.pz = p.z
      p.x += vx
      p.y += vy - 14 * fixedDt2
      p.z += vz
      if (p.y < 0.28) {
        p.y = 0.28
        p.py = p.y + vy * 0.35
      }
    }
    // Раскосины держат корпус: расстояния между точками сохраняются.
    for (let iter = 0; iter < 3; iter++) {
      constrain(pts, 0, 1, 0.65)
      constrain(pts, 1, 2, 0.65)
      constrain(pts, 2, 3, 0.55)
      constrain(pts, 0, 2, 1.25)
    }
    this.bodyMesh.position.set(pts[1].x, pts[2].y + 0.35, pts[1].z)
    this.bodyMesh.rotation.set(Math.PI / 2.2, Math.atan2(pts[0].x - pts[2].x, pts[0].z - pts[2].z), 0)
    this.headMesh.position.set(pts[0].x, pts[0].y, pts[0].z)
  }

  private syncMesh(): void {
    this.root.position.set(this.pos.x, 0, this.pos.z)
    this.root.rotation.y = this.facing

    const targetCone = this.state === 'alert' ? guardAlertMaterial()
      : this.state === 'suspicious' ? guardSuspiciousMaterial() : guardCalmMaterial()
    if (this.coneMesh.material !== targetCone) this.coneMesh.material = targetCone
    this.coneMesh.visible = this.alive && this.blindedTimer <= 0

    this.suspiciousMark.visible = this.alive && this.state === 'suspicious'
    this.alertMark.visible = this.alive && this.state === 'alert'
    if (this.alertMark.visible) this.alertMark.rotation.y += 0.1

    if (this.stunnedTimer > 0) {
      this.bodyMesh.rotation.z = 0.35
      this.halberd.rotation.x = -1.2
    } else if (this.windupTimer > 0) {
      const t = 1 - this.windupTimer / WINDUP_TIME
      this.bodyMesh.rotation.z = 0
      this.halberd.rotation.x = -t * 1.5
    } else if (this.strikeCooldown > 0.75) {
      this.halberd.rotation.x = 0.9 * (this.strikeCooldown - 0.75) / 0.35
      this.bodyMesh.rotation.z = 0
    } else {
      this.bodyMesh.rotation.z = 0
      this.halberd.rotation.x = 0
    }
    const bob = Math.sin(performance.now() * 0.004 + this.pos.x) * 0.03
    this.headMesh.position.y = 1.72 + bob
  }
}

const CONE_COLORS = {
  calm: 0x7fb8ff,
  suspicious: 0xffc94d,
  alert: 0xff4136,
} as const

function makeConeMaterial(hex: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

let calmMat: THREE.MeshBasicMaterial | null = null
let suspMat: THREE.MeshBasicMaterial | null = null
let alertMat: THREE.MeshBasicMaterial | null = null

function guardCalmMaterial(): THREE.MeshBasicMaterial {
  if (!calmMat) calmMat = makeConeMaterial(CONE_COLORS.calm)
  return calmMat
}

function guardSuspiciousMaterial(): THREE.MeshBasicMaterial {
  if (!suspMat) suspMat = makeConeMaterial(CONE_COLORS.suspicious)
  return suspMat
}

function guardAlertMaterial(): THREE.MeshBasicMaterial {
  if (!alertMat) alertMat = makeConeMaterial(CONE_COLORS.alert)
  return alertMat
}

function angleDelta(from: number, to: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function turnTowards(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to)
  if (Math.abs(d) <= maxStep) return to
  return from + Math.sign(d) * maxStep
}

function constrain(pts: RagdollPoint[], a: number, b: number, rest: number): void {
  const pa = pts[a]
  const pb = pts[b]
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const dz = pb.z - pa.z
  const dist = Math.hypot(dx, dy, dz) || 1e-5
  const diff = (dist - rest) / dist / 2
  pa.x += dx * diff
  pa.y += dy * diff
  pa.z += dz * diff
  pb.x -= dx * diff
  pb.y -= dy * diff
  pb.z -= dz * diff
}
