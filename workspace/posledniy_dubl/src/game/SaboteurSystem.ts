import * as THREE from 'three'
import { BALANCE } from '../config/balance.js'
import { SCENE_COLORS } from '../rendering/PavilionScene.js'
import { raySphere, rayCapsuleApprox } from './RayMath.js'

/**
 * Саботажники: процедурные силуэты, читаемые на расстоянии формой,
 * а не цветом. Пул из шести сущностей переиспользуется между дублями.
 */

type SaboteurState = 'hidden' | 'running' | 'arming' | 'dead'

const SABOTEUR_HP = 2 // два корпусных попадания или один хедшот

interface Bolt {
  active: boolean
  pos: THREE.Vector3
  vel: THREE.Vector3
  mesh: THREE.Mesh
}

export interface SaboteurEvents {
  onShotAtPlayer: (fromX: number, fromY: number, fromZ: number, willMissFirst: boolean) => void
  onChargeArmed: () => void
  onKilled: () => void
}

interface SaboteurEntity {
  state: SaboteurState
  hp: number
  group: THREE.Group
  legLeft: THREE.Mesh
  legRight: THREE.Mesh
  targetStation: { x: number; z: number }
  fireTimerS: number
  reactionS: number
  hasFiredOnce: boolean
  armProgressS: number
  walkPhase: number
  corpseTimerS: number
  /** Токен атаки удерживается короткое время после выстрела. */
  tokenTimerS: number
}

export class SaboteurSystem {
  private readonly entities: SaboteurEntity[] = []
  private readonly bolts: Bolt[] = []
  private readonly bodyGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly headGeometry = new THREE.BoxGeometry(0.3, 0.32, 0.32)
  private readonly boltGeometry = new THREE.SphereGeometry(0.09, 8, 6)

  private attackTokenCount = 0

  constructor(
    scene: THREE.Scene,
    private readonly events: SaboteurEvents,
  ) {
    const suitMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4453, roughness: 0.7, metalness: 0.15 })
    const accentMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.redLamp, roughness: 0.5, metalness: 0.1 })
    const boltMaterial = new THREE.MeshBasicMaterial({ color: SCENE_COLORS.redLamp })

    for (let i = 0; i < BALANCE.session.saboteursTotal; i++) {
      const group = new THREE.Group()
      const torso = new THREE.Mesh(this.bodyGeometry, suitMaterial)
      torso.scale.set(0.56, 0.78, 0.34)
      torso.position.y = 1.05
      const head = new THREE.Mesh(this.headGeometry, accentMaterial)
      head.position.y = 1.62
      const legLeft = new THREE.Mesh(this.bodyGeometry, suitMaterial)
      legLeft.scale.set(0.2, 0.66, 0.24)
      legLeft.position.set(-0.14, 0.33, 0)
      const legRight = new THREE.Mesh(this.bodyGeometry, suitMaterial)
      legRight.scale.set(0.2, 0.66, 0.24)
      legRight.position.set(0.14, 0.33, 0)
      const tool = new THREE.Mesh(this.bodyGeometry, accentMaterial)
      tool.scale.set(0.12, 0.12, 0.5)
      tool.position.set(0.3, 1.1, -0.25)
      group.add(torso, head, legLeft, legRight, tool)
      group.visible = false
      scene.add(group)
      this.entities.push({
        state: 'hidden',
        hp: SABOTEUR_HP,
        group,
        legLeft,
        legRight,
        targetStation: { x: 0, z: 0 },
        fireTimerS: 0,
        reactionS: 0,
        hasFiredOnce: false,
        armProgressS: 0,
        walkPhase: 0,
        corpseTimerS: 0,
        tokenTimerS: 0,
      })
    }

    for (let b = 0; b < 8; b++) {
      const mesh = new THREE.Mesh(this.boltGeometry, boltMaterial)
      mesh.visible = false
      scene.add(mesh)
      this.bolts.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        mesh,
      })
    }
  }

  get activeCount(): number {
    let n = 0
    for (const e of this.entities) {
      if (e.state === 'running' || e.state === 'arming') n++
    }
    return n
  }

  /** Рестарт дубля: телепорт в скрытую зону, сброс состояния без пересоздания. */
  resetAll(): void {
    for (const e of this.entities) {
      e.state = 'hidden'
      e.hp = SABOTEUR_HP
      e.group.visible = false
      e.group.rotation.set(0, 0, 0)
      e.fireTimerS = 0
      e.reactionS = 0
      e.hasFiredOnce = false
      e.armProgressS = 0
      e.corpseTimerS = 0
      e.tokenTimerS = 0
    }
    for (const bolt of this.bolts) {
      bolt.active = false
      bolt.mesh.visible = false
    }
    this.attackTokenCount = 0
  }

  spawn(x: number, z: number, station: { x: number; z: number }): void {
    const e = this.entities.find((candidate) => candidate.state === 'hidden')
    if (!e) return
    e.state = 'running'
    e.hp = SABOTEUR_HP
    e.hasFiredOnce = false
    e.reactionS = BALANCE.saboteur.reactionTimeS
    e.fireTimerS = BALANCE.saboteur.fireCooldownS
    e.armProgressS = 0
    e.corpseTimerS = 0
    e.tokenTimerS = 0
    e.targetStation = station
    e.group.visible = true
    e.group.rotation.set(0, Math.PI / 2, 0)
    e.group.position.set(x, 0, z)
  }

  /**
   * Попадание по саботажнику. Возвращает true, если это добило.
   * Хедшот обезвреживает за один выстрел.
   */
  applyHit(entity: SaboteurEntity, headshot: boolean): boolean {
    if (entity.state === 'dead' || entity.state === 'hidden') return false
    entity.hp -= headshot ? SABOTEUR_HP : 1
    if (entity.hp > 0) return false
    entity.state = 'dead'
    entity.corpseTimerS = BALANCE.saboteur.corpseLifetimeS
    entity.group.rotation.z = Math.PI / 2 + Math.random() * 0.3
    entity.group.position.y = 0.35
    if (entity.tokenTimerS > 0) {
      entity.tokenTimerS = 0
      this.attackTokenCount--
    }
    this.events.onKilled()
    return true
  }

  findHit(
    origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number,
  ): { entity: SaboteurEntity; headshot: boolean; dist: number } | null {
    let best: { entity: SaboteurEntity; headshot: boolean; dist: number } | null = null
    for (const e of this.entities) {
      if (e.state !== 'running' && e.state !== 'arming') continue
      const p = e.group.position
      // Зоны урона — сферы (голова) и вертикальный цилиндр корпуса, не меш.
      const distHead = raySphere(origin, dir, p.x, p.y + BALANCE.vystrelMontazh.headHeightM, p.z,
        BALANCE.vystrelMontazh.headshotRadiusM)
      const distBody = rayCapsuleApprox(origin, dir, p.x, p.y + BALANCE.vystrelMontazh.bodyCenterHeightM, p.z,
        BALANCE.vystrelMontazh.bodyHalfWidthM, BALANCE.vystrelMontazh.bodyHalfHeightM)
      if (distHead >= 0 && distHead <= maxDist && (!best || distHead < best.dist)) {
        best = { entity: e, headshot: true, dist: distHead }
      } else if (distBody >= 0 && distBody <= maxDist && (!best || distBody < best.dist)) {
        best = { entity: e, headshot: false, dist: distBody }
      }
    }
    return best
  }

  forEachAlive(cb: (e: SaboteurEntity) => void): void {
    for (const e of this.entities) {
      if (e.state === 'running' || e.state === 'arming') cb(e)
    }
  }

  fixedUpdate(stepS: number, playerPos: THREE.Vector3, hasLineOfSight: (fx: number, fy: number, fz: number) => boolean): void {
    for (const e of this.entities) {
      if (e.state === 'running') {
        const p = e.group.position
        const dx = e.targetStation.x - p.x
        const dz = e.targetStation.z - p.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.7) {
          e.state = 'arming'
          e.armProgressS = 0
          continue
        }
        const speed = BALANCE.saboteur.runSpeedMs
        const nx = dx / dist
        const nz = dz / dist
        p.x += nx * speed * stepS
        p.z += nz * speed * stepS
        e.group.rotation.y = Math.atan2(nx, nz)
        e.walkPhase += speed * stepS * 2.4
        const swing = Math.sin(e.walkPhase) * 0.5
        e.legLeft.rotation.x = swing
        e.legRight.rotation.x = -swing

        // Стрельба по игроку: время реакции, паузы между выстрелами,
        // промах первой очередью и токены атаки (не больше двух стрелков).
        const pdx = playerPos.x - p.x
        const pdy = playerPos.y - p.y
        const pdz = playerPos.z - p.z
        const pdist = Math.hypot(pdx, pdy, pdz)
        e.reactionS -= stepS
        if (e.tokenTimerS > 0) {
          e.tokenTimerS -= stepS
          if (e.tokenTimerS <= 0) this.attackTokenCount--
        }
        e.fireTimerS -= stepS
        if (
          e.reactionS <= 0 && e.fireTimerS <= 0 && pdist < 20 &&
          this.attackTokenCount < BALANCE.saboteur.maxSimultaneousAttackers &&
          hasLineOfSight(p.x, p.y + BALANCE.vystrelMontazh.headHeightM, p.z)
        ) {
          e.fireTimerS = BALANCE.saboteur.fireCooldownS * (0.85 + Math.random() * 0.3)
          const missFirst = BALANCE.saboteur.firstShotMiss && !e.hasFiredOnce
          e.hasFiredOnce = true
          e.tokenTimerS = 0.9
          this.attackTokenCount++
          this.events.onShotAtPlayer(p.x, p.y + 1.2, p.z, missFirst)
        }
      } else if (e.state === 'arming') {
        e.armProgressS += stepS
        if (e.armProgressS >= BALANCE.session.chargeArmS) {
          e.armProgressS = 0
          e.fireTimerS = BALANCE.saboteur.fireCooldownS
          e.state = 'running'
          this.events.onChargeArmed()
        }
      } else if (e.state === 'dead') {
        e.corpseTimerS -= stepS
        if (e.corpseTimerS <= 0) {
          // У тела есть срок жизни: вечное кладбище не нужно.
          e.state = 'hidden'
          e.group.visible = false
        }
      }
    }

    // Болты саботажников летят по прямой, попадание проверяется по капсуле игрока.
    for (const bolt of this.bolts) {
      if (!bolt.active) continue
      bolt.pos.addScaledVector(bolt.vel, stepS)
      bolt.mesh.position.copy(bolt.pos)
      const dx = bolt.pos.x - playerPos.x
      const dy = bolt.pos.y - playerPos.y
      const dz = bolt.pos.z - playerPos.z
      if (Math.hypot(dx, dy, dz) < 0.75) {
        bolt.active = false
        bolt.mesh.visible = false
        this.playerWasHit = true
      } else if (bolt.pos.y < 0 || bolt.pos.z < -95 || Math.abs(bolt.pos.x) > 9) {
        bolt.active = false
        bolt.mesh.visible = false
      }
    }
  }

  playerWasHit = false

  launchBolt(fx: number, fy: number, fz: number, missFirstShot: boolean): void {
    const bolt = this.bolts.find((b) => !b.active)
    if (!bolt) return
    bolt.active = true
    bolt.mesh.visible = true
    bolt.pos.set(fx, fy, fz)
    // Первая очередь всегда промахивается: игрок читает вход как угрозу, а не как приговор.
    const spread = missFirstShot ? 2.2 : 0.25
    dirTmp.set(
      this.lastPlayerX - fx,
      this.lastPlayerY + 0.2 - fy,
      this.lastPlayerZ - fz,
    ).normalize()
    dirTmp.x += (Math.random() - 0.5) * spread
    dirTmp.y += (Math.random() - 0.5) * spread * 0.4
    dirTmp.z += (Math.random() - 0.5) * spread
    dirTmp.normalize()
    bolt.vel.copy(dirTmp).multiplyScalar(11)
    bolt.mesh.position.copy(bolt.pos)
  }

  lastPlayerX = 0
  lastPlayerY = 1.6
  lastPlayerZ = 0

  notifyPlayerPosition(pos: THREE.Vector3): void {
    this.lastPlayerX = pos.x
    this.lastPlayerY = pos.y
    this.lastPlayerZ = pos.z
  }
}

const dirTmp = new THREE.Vector3()
