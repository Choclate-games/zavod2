import * as THREE from 'three'
import { BALANCE } from './balanceConfig'
import { CaliberType, Projectile } from '../types'
import { sound } from '../audio/SoundManager'
import { events } from '../core/EventBus'
import { physics } from '../physics/PhysicsWorld'

export class BallisticsManager {
  private static instance: BallisticsManager
  private currentCaliber: CaliberType = '25mm'
  private activeProjectiles: Projectile[] = []
  private nextProjId = 1

  // Gun states and cooldowns
  private howitzerCooldown = 0
  private boforsCooldown = 0
  private boforsBurstLeft = 0
  private boforsBurstTimer = 0

  private gatlingHeat = 20.0
  private gatlingShotTimer = 0
  private isGatlingOverheated = false
  private gatlingOverheatTimer = 0

  // 3D visual tracer meshes
  private tracerGroup = new THREE.Group()

  public static getInstance(): BallisticsManager {
    if (!BallisticsManager.instance) {
      BallisticsManager.instance = new BallisticsManager()
    }
    return BallisticsManager.instance
  }

  public init(parent: THREE.Object3D): void {
    parent.add(this.tracerGroup)
  }

  public setCaliber(caliber: CaliberType): void {
    if (this.currentCaliber !== caliber) {
      this.currentCaliber = caliber
      sound.playCaliberSwitch()
      events.emit('CALIBER_CHANGED', caliber)
    }
  }

  public getCaliber(): CaliberType {
    return this.currentCaliber
  }

  public getGatlingHeat(): number {
    return this.gatlingHeat
  }

  public isOverheated(): boolean {
    return this.isGatlingOverheated
  }

  public getCooldowns(): { howitzer: number; bofors: number; gatlingHeat: number; isOverheated: boolean } {
    return {
      howitzer: Math.max(0, this.howitzerCooldown / BALANCE.howitzer.reloadTime),
      bofors: Math.max(0, this.boforsCooldown / BALANCE.bofors.cooldownTime),
      gatlingHeat: this.gatlingHeat / BALANCE.gatling.maxHeat,
      isOverheated: this.isGatlingOverheated
    }
  }

  public fire(origin: THREE.Vector3, targetPos: THREE.Vector3): boolean {
    const target = { x: targetPos.x, y: 0, z: targetPos.z }

    if (this.currentCaliber === '25mm') {
      if (this.isGatlingOverheated || this.gatlingShotTimer > 0) return false
      this.gatlingShotTimer = 1 / BALANCE.gatling.shotsPerSecond
      this.gatlingHeat += BALANCE.gatling.heatPerShot
      if (this.gatlingHeat >= BALANCE.gatling.maxHeat) {
        this.isGatlingOverheated = true
        this.gatlingOverheatTimer = BALANCE.gatling.jamDuration
        sound.playOverheatBuzzer()
        events.emit('WEAPON_OVERHEATED', true)
      }

      this.spawnProjectile('25mm', origin, target, BALANCE.gatling.projectileSpeed, BALANCE.gatling.flightTime, BALANCE.gatling.suppressionRadius, BALANCE.gatling.bulletDamage)
      sound.play25mmShot()
      events.emit('SHOT_FIRED', '25mm')
      return true
    }

    if (this.currentCaliber === '40mm') {
      if (this.boforsCooldown > 0 || this.boforsBurstLeft > 0) return false
      this.boforsBurstLeft = BALANCE.bofors.burstCount
      this.boforsBurstTimer = 0
      this.boforsCooldown = BALANCE.bofors.cooldownTime
      sound.play40mmShot()
      events.emit('SHOT_FIRED', '40mm')
      return true
    }

    if (this.currentCaliber === '105mm') {
      if (this.howitzerCooldown > 0) return false
      this.howitzerCooldown = BALANCE.howitzer.reloadTime
      this.spawnProjectile('105mm', origin, target, BALANCE.howitzer.projectileSpeed, BALANCE.howitzer.flightTime, BALANCE.howitzer.splashRadius, BALANCE.howitzer.baseDamage)
      sound.play105mmShot()
      events.emit('SHOT_FIRED', '105mm')
      return true
    }

    return false
  }

  private spawnProjectile(
    caliber: CaliberType,
    origin: THREE.Vector3,
    target: { x: number; y: number; z: number },
    speed: number,
    totalTime: number,
    splashRadius: number,
    damage: number
  ): void {
    const proj: Projectile = {
      id: this.nextProjId++,
      caliber,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      target,
      current: { x: origin.x, y: origin.y, z: origin.z },
      speed,
      totalTime,
      elapsedTime: 0,
      splashRadius,
      damage
    }
    this.activeProjectiles.push(proj)
  }

  public update(dt: number, cameraPos: THREE.Vector3, aimPos: THREE.Vector3): void {
    // 1. Cool down 25mm gatling
    if (this.isGatlingOverheated) {
      this.gatlingOverheatTimer -= dt
      if (this.gatlingOverheatTimer <= 0) {
        this.isGatlingOverheated = false
        this.gatlingHeat = 30
        events.emit('WEAPON_OVERHEATED', false)
      }
    } else {
      this.gatlingHeat = Math.max(20.0, this.gatlingHeat - BALANCE.gatling.coolingRate * dt)
    }

    if (this.gatlingShotTimer > 0) {
      this.gatlingShotTimer -= dt
    }

    // 2. 40mm Bofors burst handling
    if (this.boforsBurstLeft > 0) {
      this.boforsBurstTimer -= dt
      if (this.boforsBurstTimer <= 0) {
        this.boforsBurstLeft--
        this.boforsBurstTimer = 0.15 // 150ms between burst shots
        const offsetTarget = {
          x: aimPos.x + (Math.random() - 0.5) * 3,
          y: 0,
          z: aimPos.z + (Math.random() - 0.5) * 3
        }
        this.spawnProjectile('40mm', cameraPos, offsetTarget, BALANCE.bofors.projectileSpeed, BALANCE.bofors.flightTime, BALANCE.bofors.splashRadius, BALANCE.bofors.baseDamage)
        if (this.boforsBurstLeft > 0) {
          sound.play40mmShot()
        }
      }
    }
    if (this.boforsCooldown > 0) {
      this.boforsCooldown -= dt
    }

    // 3. 105mm Howitzer cooldown
    if (this.howitzerCooldown > 0) {
      this.howitzerCooldown -= dt
    }

    // 4. Update flying projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i]
      proj.elapsedTime += dt
      const progress = Math.min(1.0, proj.elapsedTime / proj.totalTime)

      proj.current.x = THREE.MathUtils.lerp(proj.origin.x, proj.target.x, progress)
      proj.current.y = THREE.MathUtils.lerp(proj.origin.y, proj.target.y, progress)
      proj.current.z = THREE.MathUtils.lerp(proj.origin.z, proj.target.z, progress)

      if (progress >= 1.0) {
        this.detonateProjectile(proj)
        this.activeProjectiles.splice(i, 1)
      }
    }
  }

  private detonateProjectile(proj: Projectile): void {
    const impact = proj.target

    if (proj.caliber === '105mm') {
      sound.playExplosionImpact()
      physics.applyExplosionImpulse(impact, proj.splashRadius, BALANCE.howitzer.blastForce)
    } else if (proj.caliber === '40mm') {
      sound.playExplosionImpact()
      physics.applyExplosionImpulse(impact, proj.splashRadius, BALANCE.bofors.blastForce)
    } else {
      // 25mm bullet impact
      physics.applyExplosionImpulse(impact, proj.splashRadius, 2500)
    }

    events.emit('EXPLOSION_DETONATED', {
      caliber: proj.caliber,
      impact,
      radius: proj.splashRadius,
      damage: proj.damage
    })
  }

  public reset(): void {
    this.activeProjectiles = []
    this.howitzerCooldown = 0
    this.boforsCooldown = 0
    this.boforsBurstLeft = 0
    this.gatlingHeat = 20.0
    this.isGatlingOverheated = false
  }
}

export const ballistics = BallisticsManager.getInstance()
