// WeaponSystem: С‚РµСЃР»Р°-РєР°СЂР°Р±РёРЅ. РРјРїСѓР»СЊСЃРЅС‹Рµ РїСѓР»Рё СЃ РІРµС‚СЂРѕРІС‹Рј СЃРЅРѕСЃРѕРј,
// С‚РѕС‡РЅС‹Р№ РІС‹СЃС‚СЂРµР» РїРѕ РѕРєРЅСѓ СѓРїСЂРµР¶РґРµРЅРёСЏ Рё С‚РµСЃР»Р°-РїРµСЂРµРіСЂСѓР·РєР° Р»СѓС‡РѕРј РјРѕР»РЅРёРё.

import * as THREE from 'three'
import { RULES } from '../config/rules'
import type { DroneSwarmManager } from '../systems/DroneSwarmManager'
import type { BossController } from '../systems/BossController'
import type { StormWindSystem } from '../systems/StormWindSystem'

const MAX_BULLETS = 40

export interface FireContext {
  eyeX: number
  eyeY: number
  eyeZ: number
  dirX: number
  dirY: number
  dirZ: number
}

interface BulletState {
  active: boolean
  x: number
  y: number
  z: number
  px: number
  py: number
  pz: number
  vx: number
  vy: number
  vz: number
  damage: number
  lifeS: number
}

export class WeaponSystem {
  readonly bulletsMesh: THREE.InstancedMesh
  private readonly bullets: BulletState[] = []
  private readonly dummy = new THREE.Object3D()
  private fireCooldownS = 0

  // РўРµСЃР»Р°-РїРµСЂРµРіСЂСѓР·РєР°
  teslaCharge = 0
  teslaTimerS = 0
  perfectShotCounter = 0

  // РЎРѕСЃС‚РѕСЏРЅРёРµ Р»СѓС‡Р° РґР»СЏ СЂРµРЅРґРµСЂР° (РєРѕРЅС†С‹ Р»РёРЅРёРё РїРµСЂРµР·Р°РїРёСЃС‹РІР°СЋС‚СЃСЏ Р±РµР· Р°Р»Р»РѕРєР°С†РёР№)
  beamActive = false
  beamFromX = 0
  beamFromY = 0
  beamFromZ = 0
  beamToX = 0
  beamToY = 0
  beamToZ = 0

  constructor(
    private readonly drones: DroneSwarmManager,
    private readonly boss: BossController,
    private readonly wind: StormWindSystem,
    private readonly hooks: {
      onShot: () => void
      onTeslaStart: () => void
      onImpact: (x: number, y: number, z: number) => void
      onExplosion: (x: number, y: number, z: number) => void
      onKill: () => void
      onMissMarker: (errorM: number) => void
      onLeaderKilled: (x: number, y: number, z: number, formationId: number) => void
      onBossDamagedTick: () => void
    },
  ) {
    const geo = new THREE.BoxGeometry(0.035, 0.035, 1.4)
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE_CYAN, blending: THREE.AdditiveBlending, transparent: true })
    this.bulletsMesh = new THREE.InstancedMesh(geo, mat, MAX_BULLETS)
    this.bulletsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.bulletsMesh.frustumCulled = false
    for (let i = 0; i < MAX_BULLETS; i++) {
      this.bullets.push({ active: false, x: 0, y: -80, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, damage: RULES.shotBaseDamage, lifeS: 0 })
      this.dummy.position.set(0, -80, 0)
      this.dummy.updateMatrix()
      this.bulletsMesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.teslaCharge = 0
  }

  reset(): void {
    for (let i = 0; i < MAX_BULLETS; i++) {
      this.bullets[i].active = false
      this.dummy.position.set(0, -80, 0)
      this.dummy.updateMatrix()
      this.bulletsMesh.setMatrixAt(i, this.dummy.matrix)
    }
    ;(this.bulletsMesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
    this.teslaCharge = 0
    this.teslaTimerS = 0
    this.perfectShotCounter = 0
    this.beamActive = false
    this.fireCooldownS = 0
  }

  /** Р’С‹СЃС‚СЂРµР»: РїРѕР»СѓР°РІС‚РѕРјР°С‚ РїРѕ СЃРѕР±С‹С‚РёСЋ, Р°РІС‚РѕРјР°С‚ вЂ” СѓРґРµСЂР¶Р°РЅРёРµРј СЃ РёРЅС‚РµСЂРІР°Р»РѕРј. */
  tryFire(ctx: FireContext, heldFire: boolean): void {
    if (this.fireCooldownS > 0) return
    if (!heldFire && !this.wantsPulse) return
    this.fireCooldownS = RULES.fireIntervalS
    this.wantsPulse = false
    this.hooks.onShot()

    const windLateral = this.wind.lateralMs()
    const driftFactor = 0.38
    let precision = false
    const targetIndex = this.drones.findTargetAlong(ctx.eyeX, ctx.eyeY, ctx.eyeZ, ctx.dirX, ctx.dirY, ctx.dirZ, 0.14, 140)
    const targetPos = { x: 0, y: 0, z: 0 }
    if (targetIndex >= 0) {
      this.drones.positionOf(targetIndex, targetPos)
      const dist = Math.hypot(targetPos.x - ctx.eyeX, targetPos.y - ctx.eyeY, targetPos.z - ctx.eyeZ)
      const flightS = dist / RULES.bulletSpeedMs
      const driftM = windLateral * driftFactor * flightS
      // РёРґРµР°Р»СЊРЅР°СЏ РєРѕРјРїРµРЅСЃР°С†РёСЏ: СЃС‚РІРѕР» СЃРјРµС‰Р°СЋС‚ РїСЂРѕС‚РёРІ СЃРЅРѕСЃР°
      const px = targetPos.x - driftM
      const invLen = 1 / Math.hypot(px - ctx.eyeX, targetPos.y - ctx.eyeY, targetPos.z - ctx.eyeZ)
      const pdx = (px - ctx.eyeX) * invLen
      const pdy = (targetPos.y - ctx.eyeY) * invLen
      const pdz = (targetPos.z - ctx.eyeZ) * invLen
      const dot = Math.min(1, Math.max(-1, pdx * ctx.dirX + pdy * ctx.dirY + pdz * ctx.dirZ))
      precision = Math.acos(dot) < 0.02
      if (!precision) this.hooks.onMissMarker(Math.abs(driftM))
    }

    let damage = RULES.shotBaseDamage
    if (precision) {
      damage *= RULES.precisionMultiplier
      this.perfectShotCounter++
      if (this.perfectShotCounter >= 3) {
        this.perfectShotCounter = 0
        // С‘РјРєРѕСЃС‚СЊ РЅР°Р±РёСЂР°РµС‚СЃСЏ РёРґРµР°Р»СЊРЅС‹РјРё РїРѕРїР°РґР°РЅРёСЏРјРё РїРѕ СѓРїСЂРµР¶РґРµРЅРёСЋ
        this.addTeslaUnits(RULES.teslaCapacity / 12)
      }
    }

    const bullet = this.bullets.find((b) => !b.active)
    if (!bullet) return
    bullet.active = true
    bullet.px = ctx.eyeX + ctx.dirX * 0.6
    bullet.py = ctx.eyeY + ctx.dirY * 0.6 - 0.12
    bullet.pz = ctx.eyeZ + ctx.dirZ * 0.6
    bullet.x = bullet.px
    bullet.y = bullet.py
    bullet.z = bullet.pz
    bullet.vx = ctx.dirX * RULES.bulletSpeedMs + windLateral * driftFactor
    bullet.vy = ctx.dirY * RULES.bulletSpeedMs
    bullet.vz = ctx.dirZ * RULES.bulletSpeedMs
    bullet.damage = damage
    bullet.lifeS = 1.6
  }

  wantsPulse = false

  addTeslaUnits(units: number): void {
    this.teslaCharge = Math.min(RULES.teslaCapacity, this.teslaCharge + units)
  }

  tryActivateTesla(): boolean {
    if (this.beamActive || this.teslaCharge < RULES.teslaCapacity) return false
    this.teslaCharge = 0
    this.teslaTimerS = RULES.teslaBeamDurationS
    this.beamActive = true
    this.hooks.onTeslaStart()
    return true
  }

  /** РЎРґРІРёРі РјР°СЂРєРµСЂР° СѓРїСЂРµР¶РґРµРЅРёСЏ РІ РїРёРєСЃРµР»СЏС… РґР»СЏ HUD (С„РѕСЂРјСѓР»Р° РёР· СЃРїРµС†РёС„РёРєР°С†РёРё). */
  leadOffsetPx(distanceM: number): number {
    const raw =
      ((this.wind.sample.ms * Math.sin(this.wind.sample.dirRad) * distanceM) / RULES.bulletSpeedMs) *
      RULES.reticleScaleK
    return Math.max(-RULES.reticleClampPx, Math.min(RULES.reticleClampPx, raw))
  }

  update(dt: number, ctx: FireContext): void {
    if (this.fireCooldownS > 0) this.fireCooldownS -= dt

    if (this.beamActive) {
      this.teslaTimerS -= dt
      if (this.teslaTimerS <= 0) this.beamActive = false
      this.updateBeam(dt, ctx)
    }

    this.updateBullets(dt)
  }

  private updateBeam(dt: number, ctx: FireContext): void {
    this.beamFromX = ctx.eyeX + ctx.dirX * 0.6
    this.beamFromY = ctx.eyeY + ctx.dirY * 0.6 - 0.12
    this.beamFromZ = ctx.eyeZ + ctx.dirZ * 0.6

    const halfAngle = (RULES.teslaAutoAimHalfAngleDeg * Math.PI) / 180
    const index = this.drones.findTargetAlong(ctx.eyeX, ctx.eyeY, ctx.eyeZ, ctx.dirX, ctx.dirY, ctx.dirZ, halfAngle, 110)
    if (index >= 0) {
      const pos = { x: 0, y: 0, z: 0 }
      this.drones.positionOf(index, pos)
      this.beamToX = pos.x
      this.beamToY = pos.y
      this.beamToZ = pos.z
      // С€С‚РѕСЂРј СЂРµР·РѕРЅРёСЂСѓРµС‚: РІРѕ РІСЂРµРјСЏ РІСЃРїС‹С€РєРё РјРѕР»РЅРёРё Р»СѓС‡ СЃРёР»СЊРЅРµРµ
      const resonance = 1 + RULES.stormResonanceBonus
      const kill = this.drones.damage(index, RULES.teslaBeamDps * resonance * dt)
      if (kill != null) this.handleKill(kill.index, kill.wasLeader, kill.formationId)
      return
    }
    // РЅРµС‚ РґСЂРѕРЅР° вЂ” Р»СѓС‡ РґРµСЂР¶Р°С‚ РЅР° СЏРґСЂРµ Р±РѕСЃСЃР°, РµСЃР»Рё РѕРЅ РІ СЃРµРєС‚РѕСЂРµ
    if (this.boss.active) {
      const dx = this.boss.coreX - ctx.eyeX
      const dy = this.boss.coreWorldY - ctx.eyeY
      const dz = this.boss.coreZ - ctx.eyeZ
      const dist = Math.hypot(dx, dy, dz)
      const dot = Math.min(1, Math.max(-1, (dx * ctx.dirX + dy * ctx.dirY + dz * ctx.dirZ) / (dist || 1)))
      if (Math.acos(dot) < halfAngle * 1.4 && dist < 160) {
        this.beamToX = this.boss.coreX
        this.beamToY = this.boss.coreWorldY
        this.beamToZ = this.boss.coreZ
        this.hooks.onBossDamagedTick()
        return
      }
    }
    this.beamToX = ctx.eyeX + ctx.dirX * 90
    this.beamToY = ctx.eyeY + ctx.dirY * 90
    this.beamToZ = ctx.eyeZ + ctx.dirZ * 90
  }

  private handleKill(index: number, wasLeader: boolean, _formationId: number): void {
    const pos = { x: 0, y: 0, z: 0 }
    this.drones.positionOf(index, pos)
    this.drones.deactivate(index)
    this.hooks.onExplosion(pos.x, pos.y, pos.z)
    this.hooks.onKill()
    if (wasLeader) {
      // РєР°СЃРєР°Рґ Р·Р°РїСѓСЃРєР°РµС‚ СЃРµСЃСЃРёСЏ: РІРµРґРѕРјС‹Рµ РґРµС‚РѕРЅРёСЂСѓСЋС‚ РІРѕР»РЅРѕР№ СЃ Р·Р°РґРµСЂР¶РєРѕР№
      this.hooks.onLeaderKilled(pos.x, pos.y, pos.z, _formationId)
    }
  }

  private updateBullets(dt: number): void {
    let dirty = false
    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = this.bullets[i]
      if (!b.active) continue
      dirty = true
      b.px = b.x
      b.py = b.y
      b.pz = b.z
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.z += b.vz * dt
      b.lifeS -= dt

      let consumed = false
      // СЃРµРіРјРµРЅС‚ РїСѓС‚Рё РїСЂРѕС‚РёРІ СЃС„РµСЂ РґСЂРѕРЅРѕРІ
      for (let d = 0; d < this.drones.drones.length; d++) {
        const drone = this.drones.drones[d]
        if (!drone.active) continue
        if (this.segHitsSphere(b.px, b.py, b.pz, b.x, b.y, b.z, drone.x, drone.y, drone.z, 0.95)) {
          const kill = this.drones.damage(d, b.damage)
          this.hooks.onImpact(drone.x, drone.y, drone.z)
          if (kill != null) this.handleKill(kill.index, kill.wasLeader, kill.formationId)
          consumed = true
          break
        }
        // Р±Р»РёР·РєРёР№ РїСЂРѕРјР°С…: РєСЂР°СЃРЅС‹Р№ РјР°СЂРєРµСЂ РѕС€РёР±РєРё РІ РјРµС‚СЂР°С…
        const missSq = segPointDistSq(b.px, b.py, b.pz, b.x, b.y, b.z, drone.x, drone.y, drone.z)
        if (missSq < 4 && !drone.isLeader) {
          const err = Math.sqrt(Math.max(0, missSq))
          this.hooks.onMissMarker(err)
        }
      }

      if (!consumed && this.boss.active) {
        if (this.segHitsSphere(b.px, b.py, b.pz, b.x, b.y, b.z, this.boss.coreX, this.boss.coreWorldY, this.boss.coreZ, 1.15)) {
          const dead = this.boss.damageCore(b.damage)
          this.hooks.onImpact(this.boss.coreX, this.boss.coreWorldY, this.boss.coreZ)
          if (dead) this.hooks.onBossDamagedTick()
          consumed = true
        }
      }

      if (consumed || b.lifeS <= 0 || b.y < -3) {
        b.active = false
        this.writeHiddenBullet(i)
      }
    }
    if (dirty) (this.bulletsMesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  private writeHiddenBullet(i: number): void {
    this.dummy.position.set(0, -80, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.scale.setScalar(1)
    this.dummy.updateMatrix()
    this.bulletsMesh.setMatrixAt(i, this.dummy.matrix)
  }

  /** РџСѓР»Рё СЂРёСЃСѓСЋС‚СЃСЏ РІС‹С‚СЏРЅСѓС‚С‹РјРё РїРѕ РЅР°РїСЂР°РІР»РµРЅРёСЋ РїРѕР»С‘С‚Р° (+Z РіРµРѕРјРµС‚СЂРёСЏ РїРѕРґ lookAt). */
  writeBulletVisuals(): void {
    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = this.bullets[i]
      if (!b.active) continue
      this.dummy.position.set(b.x, b.y, b.z)
      this.dummy.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.bulletsMesh.setMatrixAt(i, this.dummy.matrix)
    }
    ;(this.bulletsMesh.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
  }

  private segHitsSphere(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cx: number, cy: number, cz: number, radius: number): boolean {
    const dx = x1 - x0
    const dy = y1 - y0
    const dz = z1 - z0
    const fx = x0 - cx
    const fy = y0 - cy
    const fz = z0 - cz
    const a = dx * dx + dy * dy + dz * dz
    if (a < 1e-9) return fx * fx + fy * fy + fz * fz <= radius * radius
    const t = -(fx * dx + fy * dy + fz * dz) / a
    const tc = Math.max(0, Math.min(1, t))
    const ex = fx + dx * tc
    const ey = fy + dy * tc
    const ez = fz + dz * tc
    return ex * ex + ey * ey + ez * ez <= radius * radius
  }
}

function segPointDistSq(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, px: number, py: number, pz: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const dz = z1 - z0
  const lenSq = dx * dx + dy * dy + dz * dz
  const fx = px - x0
  const fy = py - y0
  const fz = pz - z0
  if (lenSq < 1e-9) return fx * fx + fy * fy + fz * fz
  const t = Math.max(0, Math.min(1, (fx * dx + fy * dy + fz * dz) / lenSq))
  const ex = fx - dx * t
  const ey = fy - dy * t
  const ez = fz - dz * t
  return ex * ex + ey * ey + ez * ez
}

const PALETTE_CYAN = 0x00f0ff

