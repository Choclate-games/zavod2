// Р“Р»Р°РІРЅС‹Р№ РєРѕРѕСЂРґРёРЅР°С‚РѕСЂ: РјР°С€РёРЅР° СЃРѕСЃС‚РѕСЏРЅРёР№ СЂРµР№РґР°, РєРѕРјРїРѕР·РёС†РёСЏ РєР°РјРµСЂС‹,
// СЃРІСЏР·С‹РІР°РЅРёРµ РІРІРѕРґР°, СЃРёСЃС‚РµРј, СЂРµРЅРґРµСЂР° Рё РёРЅС‚РµСЂС„РµР№СЃР°.

import * as THREE from 'three'
import { GameLoop } from './GameLoop'
import { EventBus } from './EventBus'
import { RULES, phaseFor } from '../config/rules'
import { createHudState, emptyRunResult, type DefeatReason } from './state'
import type { PlaygamaService } from '../platform/PlaygamaService'
import type { StorageService } from '../platform/StorageService'
import type { UiRoot } from '../ui/UiRoot'
import type { InputRouter } from '../input/InputRouter'
import type { AudioManager } from '../audio/AudioManager'
import { SceneManager } from '../rendering/SceneManager'
import { ParticleSystem } from '../rendering/ParticleSystem'
import { PALETTE, buildCarbineModel, buildLocomotiveGeometry, buildWagonGeometry, makeStandard } from '../rendering/ProceduralModels'
import { StormWindSystem } from '../systems/StormWindSystem'
import { TrainMovementController } from '../systems/TrainMovementController'
import { DroneSwarmManager } from '../systems/DroneSwarmManager'
import { DebrisKinematicsEngine } from '../systems/DebrisKinematicsEngine'
import { WeaponSystem } from '../systems/WeaponSystem'
import { BossController } from '../systems/BossController'
import { Player } from '../entities/Player'

type RaidState = 'MENU' | 'RAID' | 'PAUSED' | 'VICTORY' | 'DEFEAT'

const CHAIN_STEP_S = 0.08

interface ChainBlast {
  atS: number
  index: number
  multiplier: number
}

export class Game {
  readonly bus = new EventBus()
  readonly hudState = createHudState()
  readonly runResult = { ...emptyRunResult }

  private readonly sceneManager: SceneManager
  private readonly particles = new ParticleSystem()
  private readonly wind = new StormWindSystem()
  private readonly ride = new TrainMovementController()
  private readonly player: Player
  private readonly swarm = new DroneSwarmManager()
  private readonly debris = new DebrisKinematicsEngine()
  private readonly boss = new BossController()
  private weapon: WeaponSystem

  private readonly loop: GameLoop
  private state: RaidState = 'MENU'
  private timeS = 0
  private score = 0
  private kills = 0
  private spawnTimerS = 1.5
  private ambientDebrisTimerS = 6
  private bossActivated = false
  private bossDead = false
  private reviveUsedThisRun = false
  private chainQueue: ChainBlast[] = []
  private sessionTime = 0

  // РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РІРµРєС‚РѕСЂС‹: РЅРѕР»СЊ Р°Р»Р»РѕРєР°С†РёР№ РІ РєР°РґСЂРµ
  private readonly camEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly camQuat = new THREE.Quaternion()
  private readonly aimDir = new THREE.Vector3()
  private readonly eyePoint = { x: 0, y: 0, z: 0 }

  private shakeAmpPx = 0
  private missMarkerCooldownS = 0

  constructor(
    private readonly ui: UiRoot,
    private readonly input: InputRouter,
    private readonly audio: AudioManager,
    private readonly platform: PlaygamaService,
    private readonly storage: StorageService,
    private readonly callbacks: {
      onVictory: () => void
      onDefeat: () => void
      onRevived: () => void
      onScoreChanged: (score: number) => void
    },
  ) {
    this.sceneManager = new SceneManager(ui.canvas, platform.deviceKind !== 'desktop')
    this.player = new Player(this.ride)
    this.weapon = this.createWeapon()

    // СЃРѕСЃС‚Р°РІ РїРѕРґ РЅРѕРіР°РјРё РёРіСЂРѕРєР°: 5 РІР°РіРѕРЅРѕРІ + Р»РѕРєРѕРјРѕС‚РёРІ
    const wagonMat = makeStandard(PALETTE.armorLight, 0.8, 0.25)
    for (let k = 0; k < RULES.wagonsTotal; k++) {
      const wagon = new THREE.Mesh(buildWagonGeometry(RULES.wagonLengthM), wagonMat)
      wagon.position.set(0, 0, -(RULES.wagonLengthM * (k + 0.5)))
      this.sceneManager.scene.add(wagon)
    }
    const locomotive = new THREE.Mesh(
      buildLocomotiveGeometry(20),
      makeStandard(PALETTE.ironFrame, 0.7, 0.3),
    )
    locomotive.position.set(0, 0, -RULES.trainLengthM - 10)
    this.sceneManager.scene.add(locomotive)

    this.sceneManager.scene.add(this.swarm.mesh)
    this.sceneManager.scene.add(this.swarm.orbs)
    this.sceneManager.scene.add(this.debris.mesh)
    this.sceneManager.scene.add(this.boss.root)
    this.sceneManager.scene.add(this.boss.torpedoes)
    this.sceneManager.scene.add(this.particles.points)
    this.sceneManager.scene.add(this.weapon.bulletsMesh)

    // РІСЊСЋРјРѕРґРµР»СЊ РєР°СЂР°Р±РёРЅР°: РґРІР° Р±Р»РѕРєР° СЂСѓРє + СЃС‚РІРѕР», РєСЂРµРїРёС‚СЃСЏ Рє РєР°РјРµСЂРµ
    const carbine = buildCarbineModel()
    carbine.root.position.set(0.22, -0.24, -0.45)
    this.sceneManager.camera.add(carbine.root)
    this.carbineCoreMaterial = carbine.coreMaterial

    this.boss.root.position.set(0, 9, -RULES.trainLengthM - 34)

    this.loop = new GameLoop(
      (step) => this.fixedUpdate(step),
      (frameDelta) => this.render(frameDelta),
    )

    this.bus.on('platform:pause', (paused) => {
      if (paused !== true) return
      if (this.state === 'RAID') this.pauseRaid()
      else if (this.state === 'PAUSED') this.resumeRaid(true)
    })

    input.applyDevice(platform.deviceKind)
    if (input.scheme === 'touch') ui.ensureTouchControls()
  }

  private carbineCoreMaterial: THREE.MeshBasicMaterial

  private get camera(): THREE.PerspectiveCamera {
    return this.sceneManager.camera
  }

  private createWeapon(): WeaponSystem {
    return new WeaponSystem(this.swarm, this.boss, this.wind, {
      onShot: () => this.audio.playShot(),
      onTeslaStart: () => this.audio.playTesla(),
      onImpact: (x, y, z) => {
        this.particles.burst(x, y, z, 6, 0.4, 0.95, 1)
        this.ui.hud.flashHit()
        this.audio.playHit()
      },
      onExplosion: (x, y, z) => {
        this.particles.burst(x, y, z, 26, 1, 0.5, 0.12)
        this.audio.playExplosion()
      },
      onKill: () => {
        this.kills++
        this.score += RULES.killBaseScore
        this.audio.playKill()
      },
      onMissMarker: (errorM) => {
        if (this.missMarkerCooldownS > 0) return
        this.missMarkerCooldownS = 0.5
        this.hudState.missErrorM = errorM
        this.hudState.precisionHit = false
        this.hudState.leadVisible = true
        this.ui.hud.flashMiss()
      },
      onLeaderKilled: (x, ly, lz, formationId) => {
        // РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅС‹Р№ С‚СЏР¶С‘Р»С‹Р№ РѕР±Р»РѕРјРѕРє СЃ РєР°Р¶РґРѕРіРѕ Р»РёРґРµСЂР° + РІРѕР»РЅР° РєР°СЃРєР°РґР°
        const phase = phaseFor(this.timeS)
        this.debris.spawnAt(this.player.x, lz, phase.speedKmh / 3.6, this.wind.sample.ms)
        void x
        const followers = this.swarm.followersOf(formationId, x, ly, lz)
        let multiplierIndex = 0
        for (const follower of followers) {
          this.chainQueue.push({
            atS: this.sessionTime + CHAIN_STEP_S * (multiplierIndex + 1),
            index: follower,
            multiplier: RULES.chainMultipliers[Math.min(multiplierIndex, RULES.chainMultipliers.length - 1)],
          })
          multiplierIndex++
        }
        if (followers.length === 0) this.weapon.addTeslaUnits(RULES.teslaStackUnits)
      },
      onBossDamagedTick: () => undefined,
    })
  }

  startRaid(): void {
    this.state = 'RAID'
    this.timeS = 0
    this.sessionTime = 0
    this.score = 0
    this.kills = 0
    this.spawnTimerS = 1.2
    this.ambientDebrisTimerS = 6
    this.bossActivated = false
    this.bossDead = false
    this.reviveUsedThisRun = false
    this.chainQueue.length = 0
    this.wind.reset()
    this.ride.reset()
    this.player.reset()
    this.swarm.reset()
    this.debris.reset()
    this.boss.reset()
    this.weapon.reset()
    this.ui.show('HUD_INGAME')
    this.audio.ensureStarted()
    this.loop.resetDelta()
  }

  pauseRaid(): void {
    if (this.state !== 'RAID') return
    this.state = 'PAUSED'
    this.input.resetAxes()
    this.ui.show('PAUSE_MODAL')
  }

  resumeRaid(fromPlatform = false): void {
    if (this.state !== 'PAUSED') return
    this.state = 'RAID'
    this.ui.show('HUD_INGAME')
    if (!fromPlatform) this.loop.resetDelta()
    this.loop.resetDelta()
  }

  toMenu(): void {
    this.state = 'MENU'
    this.input.resetAxes()
    this.ui.show('MAIN_MENU')
    this.platform.maybeShowInterstitial()
  }

  requestRevive(): void {
    if (this.reviveUsedThisRun || !this.platform.capabilities.rewarded) return
    this.reviveUsedThisRun = true
    this.platform.showRewarded(
      'revive_run',
      () => {
        this.player.healFull()
        this.state = 'RAID'
        this.ui.show('HUD_INGAME')
        this.loop.resetDelta()
        this.callbacks.onRevived()
      },
      () => undefined,
    )
  }

  private finishVictory(): void {
    this.state = 'VICTORY'
    const shieldPct = this.player.shieldPct
    this.score += Math.ceil(this.hudState.timeLeftS) * RULES.scorePerSecondLeft
    this.score += Math.round(shieldPct * RULES.scorePerShieldPct)
    const rank = shieldPct > 66 ? 'S' : shieldPct > 33 ? 'A' : 'B'
    Object.assign(this.runResult, {
      score: this.score,
      kills: this.kills,
      timeLeftS: this.hudState.timeLeftS,
      shieldPct,
      rank,
    })
    const previousBest = this.storage.data.bestScore
    const isRecord = this.score > previousBest
    if (isRecord) {
      this.storage.update({ bestScore: this.score })
      void this.platform.submitScore('global_storm_score', this.score)
    }
    this.ui.showVictory(this.runResult.score, this.kills, this.hudState.timeLeftS, rank, isRecord)
    this.ui.show('VICTORY_SCREEN')
    this.audio.playVictory()
    this.callbacks.onVictory()
  }

  private finishDefeat(reason: DefeatReason): void {
    if (this.state !== 'RAID') return
    this.state = 'DEFEAT'
    Object.assign(this.runResult, { score: this.score, kills: this.kills, rank: '' })
    if (this.score > this.storage.data.bestScore) this.storage.update({ bestScore: this.score })
    const reviveAvailable = !this.reviveUsedThisRun && this.platform.capabilities.rewarded && reason !== 'timeout'
    this.ui.showDefeat(this.score, this.kills, reason, reviveAvailable)
    this.ui.show('DEFEAT_MODAL')
    this.audio.playDefeat()
    this.callbacks.onDefeat()
  }

  /** Р’РЅРµС€РЅРёР№ РґРѕСЃС‚СѓРї РґР»СЏ СЌРєСЂР°РЅР° РїРѕСЂР°Р¶РµРЅРёСЏ РїРѕСЃР»Рµ СЃРјРµРЅС‹ РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№ РјРѕСЃС‚Р°. */
  refreshReviveAvailability(): void {
    this.ui.setReviveVisible(!this.reviveUsedThisRun && this.platform.capabilities.rewarded)
  }

  private fixedUpdate(dt: number): void {
    this.missMarkerCooldownS -= dt
    this.carbineChargeVisual(dt)

    if (this.state === 'MENU' || this.state === 'VICTORY' || this.state === 'DEFEAT') {
      // СЃС†РµРЅР° Р·Р° РјРµРЅСЋ Р¶РёРІС‘С‚: РїРѕРµР·Рґ РјС‡РёС‚СЃСЏ, С€С‚РѕСЂРј РґС‹С€РёС‚
      this.timeS += dt
      this.wind.update(this.timeS, dt)
      this.applyEnvironment(dt)
      this.particles.update(dt, this.wind.lateralMs())
      return
    }
    if (this.state === 'PAUSED') return

    this.sessionTime += dt
    this.consumePause()

    // РІРІРѕРґ РїСЂРёС†РµР»Р°
    const snap = this.input.snapshot
    this.player.yawRad -= snap.aimDX * 0.0026
    this.player.pitchRad -= snap.aimDY * 0.0026
    snap.aimDX = 0
    snap.aimDY = 0
    this.player.yawRad = Math.max(-1.35, Math.min(1.35, this.player.yawRad))
    this.player.pitchRad = Math.max(-0.85, Math.min(0.85, this.player.pitchRad))

    if (snap.strafeQueued !== 0) {
      this.player.queueStrafe(snap.strafeQueued)
      snap.strafeQueued = 0
    }
    if (snap.jumpQueued) {
      snap.jumpQueued = false
      this.ride.queueJump()
    }
    if (snap.slideQueued) {
      snap.slideQueued = false
      this.player.queueSlide()
    }
    if (snap.overloadQueued) {
      snap.overloadQueued = false
      this.weapon.tryActivateTesla()
    }
    const fireHeld = snap.fireHeld
    if (snap.firePulsed) {
      snap.firePulsed = false
      this.weapon.wantsPulse = true
    }

    // СЃРёРјСѓР»СЏС†РёСЏ
    this.wind.update(this.timeS, dt)
    this.timeS += dt
    this.hudState.timeLeftS = Math.max(0, RULES.runDurationS - this.timeS)
    this.ride.update(dt, this.wind.sample.ms)
    if (this.ride.fellIntoGap) {
      this.finishDefeat('fall')
      return
    }
    this.player.update(dt)
    this.applyEnvironment(dt)

    // СЃРїР°РІРЅ СЌСЃРєР°РґСЂРёР»СЊРё РїРѕ С„Р°Р·Р°Рј С€С‚РѕСЂРјР°
    const phase = phaseFor(this.timeS)
    this.spawnTimerS -= dt
    if (this.spawnTimerS <= 0 && this.swarm.aliveCount < 24) {
      this.spawnTimerS = phase.index === 0 ? 5 : phase.index === 1 ? 3.6 : 2.8
      this.swarm.spawnFormation(this.ride.playerZ, phase.index >= 1 ? 0.5 : 0)
    }

    // РїР»Р°Р·РјРѕРёРґС‹ СЂРѕСЏ
    this.swarm.update(dt, this.playerHitbox(), this.wind.lateralMs(), () => {
      if (this.player.damage(RULES.plasmaoidDamagePct)) {
        this.audio.playDamage()
        if (this.player.shieldPct <= 0) this.finishDefeat('shield')
      }
    })
    // РѕР±Р»РѕРјРєРё
    this.ambientDebrisTimerS -= dt
    if (this.ambientDebrisTimerS <= 0 && phase.index >= 1) {
      this.ambientDebrisTimerS = 5
      this.debris.spawnAt(this.player.x, this.ride.playerZ, phase.speedKmh / 3.6, this.wind.sample.ms)
    }
    const debrisHit = this.debris.update(dt, this.playerHitbox())
    if (debrisHit >= 0) {
      if (this.player.damage(RULES.debrisShieldDamagePct)) {
        this.audio.playDamage()
        this.ride.playerZ += RULES.debrisKnockbackM
        if (this.player.shieldPct <= 0) {
          this.finishDefeat('shield')
          return
        }
      }
    }

    // Р±РѕСЃСЃ
    if (!this.bossActivated && this.timeS >= 55) {
      this.bossActivated = true
      this.boss.activate()
    }
    if (this.boss.active && !this.bossDead) {
      this.boss.update(dt, this.playerHitbox(), () => {
        if (this.player.damage(RULES.bossPlasmaDamagePct)) {
          this.audio.playDamage()
          if (this.player.shieldPct <= 0) this.finishDefeat('shield')
        }
      })
      if (this.boss.hp <= 0) {
        this.bossDead = true
        this.boss.active = false
        this.boss.root.visible = false
        this.particles.burst(this.boss.coreX, this.boss.coreWorldY, this.boss.coreZ, 60, 1, 0.85, 0.36)
        this.audio.playExplosion()
      }
    }

    // РѕСЂСѓР¶РёРµ: Р°РІС‚РѕРѕРіРѕРЅСЊ С‚Р°С‡-СЃС…РµРјС‹ РїСЂРё СЃРѕРІРјРµС‰РµРЅРёРё СЃ РјР°СЂРєРµСЂРѕРј СѓРїСЂРµР¶РґРµРЅРёСЏ
    const ctx = this.fireContext()
    if (this.input.scheme === 'touch' && this.ui.touch != null && this.ui.touch.aiming && fireHeld === false) {
      const target = this.swarm.findTargetAlong(this.eyePoint.x, this.eyePoint.y, this.eyePoint.z, ctx.dirX, ctx.dirY, ctx.dirZ, 0.05, 140)
      if (target >= 0) this.weapon.wantsPulse = true
    }
    this.weapon.tryFire(ctx, fireHeld)
    this.weapon.update(dt, ctx)
    this.weapon.writeBulletVisuals()

    // РєР°СЃРєР°РґРЅР°СЏ РІРѕР»РЅР° РґРµС‚РѕРЅР°С†РёРё
    while (this.chainQueue.length > 0 && this.chainQueue[0].atS <= this.sessionTime) {
      const blast = this.chainQueue.shift()
      if (blast == null) break
      const pos = { x: 0, y: 0, z: 0 }
      this.swarm.positionOf(blast.index, pos)
      this.swarm.deactivate(blast.index)
      this.particles.burst(pos.x, pos.y, pos.z, 22, 1, 0.55, 0.14)
      this.audio.playExplosion()
      this.kills++
      this.score += RULES.killBaseScore * blast.multiplier
      this.debris.spawnAt(this.player.x, pos.z, phase.speedKmh / 3.6, this.wind.sample.ms)
      this.weapon.addTeslaUnits(RULES.teslaStackUnits / 2)
    }

    this.particles.update(dt, this.wind.lateralMs())

    // СѓСЃР»РѕРІРёСЏ РєРѕРЅС†Р°
    if (this.bossDead && this.kills >= RULES.killsToWin) {
      this.finishVictory()
      return
    }
    if (this.timeS >= RULES.runDurationS && !this.bossDead) {
      this.finishDefeat('timeout')
    }
  }

  private consumePause(): void {
    if (this.input.snapshot.pauseQueued) {
      this.input.snapshot.pauseQueued = false
      if (this.state === 'RAID') this.pauseRaid()
    }
  }

  private applyEnvironment(dt: number): void {
    const phase = phaseFor(this.timeS)
    this.sceneManager.setEnvironment(phase.speedKmh / 3.6, this.wind.lateralMs())
    this.sceneManager.update(dt)
    this.audio.setWindIntensity(this.wind.sample.ms)
    this.shakeAmpPx = RULES.vibrationAmpPx * (phase.speedKmh / 250)
  }

  private playerHitbox(): { x: number; y: number; z: number; radiusM: number } {
    return {
      x: this.player.x,
      y: this.ride.playerY,
      z: this.ride.playerZ,
      radiusM: this.player.isSliding ? 0.45 : 0.62,
    }
  }

  private fireContext(): {
    eyeX: number
    eyeY: number
    eyeZ: number
    dirX: number
    dirY: number
    dirZ: number
  } {
    this.camera.getWorldDirection(this.aimDir)
    const p = this.camera.position
    this.eyePoint.x = p.x
    this.eyePoint.y = p.y
    this.eyePoint.z = p.z
    return { eyeX: p.x, eyeY: p.y, eyeZ: p.z, dirX: this.aimDir.x, dirY: this.aimDir.y, dirZ: this.aimDir.z }
  }

  private carbineChargeVisual(dt: number): void {
    // РєРѕРЅРґРµРЅСЃР°С‚РѕСЂ РЅР° СЃС‚РІРѕР»Рµ СЃРІРµС‚Р»РµРµС‚ РїРѕ РјРµСЂРµ Р·Р°СЂСЏРґР°
    const ratio = this.weapon.teslaCharge / RULES.teslaCapacity
    this.carbineCoreMaterial.color.setRGB(ratio * 0.0, 0.94 * ratio, 1 * ratio)
    void dt
  }

  private render(frameDeltaS: number): void {
    // РєР°РјРµСЂР°: РїРѕР·РёС†РёСЏ РіР»Р°Р· + РІРёР±СЂР°С†РёСЏ СЃРѕСЃС‚Р°РІР°, РѕСЂРёРµРЅС‚Р°С†РёСЏ YXZ
    const bobY = Math.sin(this.sessionTime * Math.PI * 2 * RULES.vibrationHz) * this.shakeAmpPx * 0.01
    const bobX = Math.cos(this.sessionTime * Math.PI * 2 * RULES.vibrationHz * 0.5) * this.shakeAmpPx * 0.008
    this.camEuler.set(this.player.pitchRad, this.player.yawRad, this.player.yawRollTarget)
    this.camQuat.setFromEuler(this.camEuler)
    this.camera.position.set(this.player.x + bobX, this.player.eyeY() + bobY, this.ride.playerZ)
    this.camera.quaternion.copy(this.camQuat)

    // HUD: РјР°СЂРєРµСЂ СѓРїСЂРµР¶РґРµРЅРёСЏ РїРѕ РґРёСЃС‚Р°РЅС†РёРё С†РµР»Рё РІРґРѕР»СЊ РІР·РіР»СЏРґР°
    const ctx = this.fireContext()
    const targetIndex = this.swarm.findTargetAlong(this.eyePoint.x, this.eyePoint.y, this.eyePoint.z, ctx.dirX, ctx.dirY, ctx.dirZ, 0.16, 160)
    let distance = 60
    if (targetIndex >= 0) {
      const pos = { x: 0, y: 0, z: 0 }
      this.swarm.positionOf(targetIndex, pos)
      distance = Math.hypot(pos.x - ctx.eyeX, pos.y - ctx.eyeY, pos.z - ctx.eyeZ)
    }
    this.hudState.leadOffsetXpx = this.weapon.leadOffsetPx(distance)
    this.hudState.leadVisible = targetIndex >= 0
    if (targetIndex >= 0) this.hudState.precisionHit = true

    this.hudState.shieldPct = this.player.shieldPct
    this.hudState.speedKmh = phaseFor(this.timeS).speedKmh
    this.hudState.windMs = this.wind.sample.ms
    this.hudState.windDirRad = this.wind.sample.dirRad
    this.hudState.kills = this.kills
    this.hudState.score = this.score
    this.hudState.teslaCharge = this.weapon.teslaCharge
    this.hudState.teslaCapacity = RULES.teslaCapacity
    this.hudState.progress01 = this.ride.progress01
    this.hudState.gapMarkerDistanceM = this.ride.nextGapDistance()
    this.hudState.slideActive = this.player.isSliding
    this.hudState.airborne = !this.ride.grounded
    this.ui.hud.update(this.hudState, frameDeltaS)
    if (this.ui.touch != null) this.ui.touch.setOverloadReady(this.weapon.teslaCharge >= RULES.teslaCapacity)

    this.sceneManager.render()
  }

  start(): void {
    this.loop.start()
  }

  stop(): void {
    this.loop.stop()
  }
}


