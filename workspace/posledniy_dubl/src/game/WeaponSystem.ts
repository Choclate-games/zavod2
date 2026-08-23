import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { BALANCE } from '../config/balance.js'
import type { PhysicsWorld } from '../physics/PhysicsWorld.js'
import type { GateSystem } from './GateSystem.js'
import type { SaboteurSystem } from './SaboteurSystem.js'
import type { VfxSystem } from '../rendering/VfxSystem.js'
import type { AudioManager } from '../audio/AudioManager.js'
import type { PlayerController } from './PlayerController.js'

export type ShotOutcome = 'headshot' | 'body' | 'node' | 'spotlight' | 'wall' | 'empty' | 'cooldown'

/**
 * Выстрел-монтаж: полуавтоматический луч до 80 м с зоной хедшота,
 * узлами цепей и прожекторами. Ёмкость дубля живёт здесь же:
 * промах съедает патрон и вместимость, хедшот магазин возвращает.
 */
export class WeaponSystem {
  private currentAmmo: number = BALANCE.emkostDublya.startAmmo
  private capacity: number = BALANCE.emkostDublya.startCapacity
  private cooldownS: number = 0

  shotsFired: number = 0
  hitsBody: number = 0
  headshots: number = 0

  /** Колбэки наружу: их наполняет Game. */
  onShotResolved: ((outcome: ShotOutcome) => void) | null = null
  onAmmoChanged: ((current: number, capacity: number) => void) | null = null
  onOutOfAmmo: (() => void) | null = null

  private readonly origin = new THREE.Vector3()
  private readonly dir = new THREE.Vector3()
  private readonly hitPoint = new THREE.Vector3()

  constructor(
    private readonly player: PlayerController,
    private readonly physics: PhysicsWorld,
    private readonly saboteurs: SaboteurSystem,
    private readonly gates: GateSystem,
    private readonly vfx: VfxSystem,
    private readonly audio: AudioManager,
  ) {}

  get ammo(): number {
    return this.currentAmmo
  }

  get magazineCapacity(): number {
    return this.capacity
  }

  reset(): void {
    this.currentAmmo = BALANCE.emkostDublya.startAmmo
    this.capacity = BALANCE.emkostDublya.startCapacity
    this.cooldownS = 0
    this.shotsFired = 0
    this.hitsBody = 0
    this.headshots = 0
    this.reportAmmo()
  }

  fixedUpdate(stepS: number): void {
    if (this.cooldownS > 0) this.cooldownS -= stepS
  }

  tryFire(): void {
    if (this.cooldownS > 0) {
      this.finish('cooldown')
      return
    }
    if (this.currentAmmo <= 0) {
      this.audio.playMissClick()
      this.finish('empty')
      return
    }
    this.cooldownS = BALANCE.vystrelMontazh.shotIntervalS
    this.player.applyRecoilKick()
    this.audio.playGunshot()
    this.shotsFired++

    this.player.getLookRay(this.origin, this.dir)
    // Рейкаст исключает собственное тело стрелка.
    let wallDist: number = BALANCE.vystrelMontazh.rayRangeM
    if (this.player.collider) {
      const ray = new RAPIER.Ray(
        { x: this.origin.x, y: this.origin.y, z: this.origin.z },
        { x: this.dir.x, y: this.dir.y, z: this.dir.z },
      )
      wallDist = Math.min(wallDist, this.physics.castRayExclude(ray, BALANCE.vystrelMontazh.rayRangeM, this.player.collider))
    }

    // Приоритет целей: саботажник ближе стены, узел или прожектор — ближе стены.
    const saboteurHit = this.saboteurs.findHit(this.origin, this.dir, wallDist)
    const decorHit = this.gates.findHit(this.origin, this.dir, wallDist)

    if (saboteurHit && (!decorHit || saboteurHit.dist <= decorHit.dist)) {
      const killed = this.saboteurs.applyHit(saboteurHit.entity, saboteurHit.headshot)
      void killed
      this.hitPoint.copy(this.origin).addScaledVector(this.dir, saboteurHit.dist)
      this.sparksAt(this.hitPoint, saboteurHit.headshot ? 0xffffff : SCENE_SPARK_BODY)
      this.tracerTo(this.hitPoint)
      this.audio.playHitConfirm()
      if (saboteurHit.headshot) {
        this.headshots++
        // Хедшот мгновенно возвращает магазин к вместимости дубля.
        this.currentAmmo = this.capacity
        this.audio.playHeadshotRefill()
        this.hitsBody++
      } else {
        this.hitsBody++
        this.consumeAmmo(false)
      }
      this.reportAmmo()
      this.finish(saboteurHit.headshot ? 'headshot' : 'body')
      return
    }

    if (decorHit) {
      this.hitPoint.copy(this.origin).addScaledVector(this.dir, decorHit.dist)
      this.tracerTo(this.hitPoint)
      this.sparksAt(this.hitPoint, SCENE_SPARK_AMBER)
      if (decorHit.kind === 'node') {
        // Направление импульса берётся от стороны игрока относительно узла:
        // падение читается как монтажное решение, а не случайный обвал.
        const dirSign = this.origin.x < 0 ? -1 : 1
        this.gates.breakNode(decorHit.gateIndex, dirSign)
        this.audio.playChainCrack()
      } else {
        const dirSign = this.origin.x < 2.4 ? -1 : 1
        this.gates.destroySpotlight(decorHit.chamberIndex, dirSign)
        this.audio.playCollapse(0.6)
      }
      this.consumeAmmo(false)
      this.reportAmmo()
      this.finish(decorHit.kind === 'node' ? 'node' : 'spotlight')
      return
    }

    // Промах: серый след луча, нет тона подтверждения, минус патрон вместимости.
    this.hitPoint.copy(this.origin).addScaledVector(this.dir, wallDist)
    this.tracerTo(this.hitPoint)
    if (wallDist < BALANCE.vystrelMontazh.rayRangeM) {
      this.sparksAt(this.hitPoint, SCENE_SPARK_WALL)
    }
    this.audio.playMissClick()
    this.consumeAmmo(true)
    this.reportAmmo()
    this.finish('wall')
  }

  private consumeAmmo(isMiss: boolean): void {
    this.currentAmmo -= 1
    if (isMiss && this.capacity > BALANCE.emkostDublya.minCapacity) {
      this.capacity -= BALANCE.emkostDublya.missCapacityPenalty
      if (this.currentAmmo > this.capacity) this.currentAmmo = this.capacity
    }
    if (this.currentAmmo < 0) this.currentAmmo = 0
    if (this.currentAmmo === 0 && this.onOutOfAmmo) {
      // Сухой сигнал пустого магазина отличим от других причин провала.
      this.onOutOfAmmo()
    }
  }

  private reportAmmo(): void {
    if (this.onAmmoChanged) this.onAmmoChanged(this.currentAmmo, this.capacity)
  }

  private finish(outcome: ShotOutcome): void {
    if (this.onShotResolved) this.onShotResolved(outcome)
  }

  private tracerTo(point: THREE.Vector3): void {
    const muzzleOffset = tmpMuzzle.set(0.16, -0.14, -0.5).applyQuaternion(this.player.yawObject.quaternion)
    const mx = this.origin.x + muzzleOffset.x
    const my = this.origin.y + muzzleOffset.y
    const mz = this.origin.z + muzzleOffset.z
    this.vfx.muzzleFlash(mx, my, mz)
    this.vfx.spawnTracer(mx, my, mz, point.x, point.y, point.z)
  }

  private sparksAt(point: THREE.Vector3, color: number): void {
    this.vfx.spawnBurst(point.x, point.y, point.z, -this.dir.x, -this.dir.y, -this.dir.z, 10, 4, color, 0.35, 1.2)
  }
}

// Цвета эффектов повторяют палитру DESIGN.md.
const SCENE_SPARK_AMBER = 0xffb454
const SCENE_SPARK_WALL = 0xd8d2c4
const SCENE_SPARK_BODY = 0xff8d7a
const tmpMuzzle = new THREE.Vector3()
