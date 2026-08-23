import * as THREE from 'three'
import { bus } from './eventBus.js'
import { BALANCE } from './balance.js'
import { GameLoop } from './gameLoop.js'
import type { PlaygamaService } from '../platform/PlaygamaService.js'
import type { StorageService } from '../platform/StorageService.js'
import { SceneManager, type AimResult } from '../rendering/SceneManager.js'
import { WORLD } from '../rendering/ProceduralModels.js'
import { PhysicsWorld } from '../physics/PhysicsWorld.js'
import { WindSystem } from '../systems/WindSystem.js'
import { BallisticsSystem } from '../systems/BallisticsSystem.js'
import { TitanSystem } from '../systems/TitanSystem.js'
import { AvalancheSystem } from '../systems/AvalancheSystem.js'
import { InputRouter } from '../systems/InputRouter.js'
import { AdaptiveQuality } from '../systems/AdaptiveQuality.js'
import { AudioManager } from '../audio/AudioManager.js'

type GameState = 'boot' | 'menu' | 'briefing' | 'playing' | 'bulletcam' | 'avalanche' | 'victory' | 'defeat'

const ZOOM_LEVELS = [8, 16, 24] as const
const ZOOM_LABELS = ['8x', '16x', '24x'] as const
const BULLET_TIME_SCALE = 0.15

export interface UiHost {
  show(screenId: string): void
}

/** Главный координатор: состояние контракта, выстрел и рапид, лавина,
 * победа и поражение. DOM не создаёт; ввод читает только из InputRouter. */
export class Game {
  readonly scene: SceneManager
  readonly physics = new PhysicsWorld()
  readonly audio = new AudioManager()
  readonly quality = new AdaptiveQuality()
  readonly router: InputRouter
  readonly wind: WindSystem
  readonly titan: TitanSystem
  readonly avalanche: AvalancheSystem
  readonly loop: GameLoop

  private state: GameState = 'boot'
  private pausedByPlatform = false
  private pausedByUser = false
  private armInterstitial = false
  private timeScale = 1
  private elapsedReal = 0

  // параметры текущего перевала
  private passIndex = 1
  private ammo = BALANCE.contract.startAmmo
  private timeLeft = BALANCE.contract.timeLimitSeconds
  private echoCharges = 1
  private droneScan = false
  private goldenUsed = false
  private glacierFractured = false
  private tremorShots = 0
  private lastScore = 0

  // стрелок
  private ledgeX = 0
  private yaw = 0
  private pitch = -0.06
  private zoomIdx = 0
  private crouchTarget = false
  private crouchDeploy = 0
  private breathHeldActive = false
  private breathHoldTime = 0
  private breathRecovery = 0
  private tremorActive = false
  private recoilPitch = 0
  private shakeAmp = 0

  // полёт пули
  private flying = false
  private flightP = 0
  private flightDistance = 1
  private flightOrigin = new THREE.Vector3()
  private flightDir = new THREE.Vector3()
  private flightRight = new THREE.Vector3()
  private flightUp = new THREE.Vector3()
  private flightImpact = new THREE.Vector3()
  private flightOnGlacier = false
  private bulletPrev = new THREE.Vector3()
  private bulletPos = new THREE.Vector3()

  // переиспользуемые объекты кадра
  private eyePos = new THREE.Vector3()
  private forwardDir = new THREE.Vector3()
  private aimPoint = new THREE.Vector3()
  private frameAim: AimResult | null = null
  private aimConsumer = { dx: 0, dy: 0 }
  private coreCenter = new THREE.Vector3()
  private hudSnapshot = {
    state: 'menu', timeLeft: 90, ammo: 3, breathPct: 100, windX10: 0, windDeg: 0,
    titanDistance: 999, massPct: -1, zoomLabel: '8x', rangefinder: false, droneScan: false,
    dropMilX10: 0, driftMilX10: 0, holdActive: false, deployPct: 0, strafe01: 128,
    echoAvailable: true,
  }

  constructor(
    canvas: HTMLCanvasElement,
    private platform: PlaygamaService,
    private storage: StorageService,
    private ui: UiHost,
    router: InputRouter,
  ) {
    this.scene = new SceneManager(canvas)
    this.router = router
    this.wind = new WindSystem(2.5, 2)
    this.titan = new TitanSystem(WORLD.titanStartX, WORLD.outpostLineX)
    this.avalanche = new AvalancheSystem(this.physics)

    this.titan.onStep = () => this.audio.titanStep()

    bus.on('input:fire', () => {
      this.audio.resume()
      this.tryFire()
    })
    bus.on('input:zoom', (payload) => {
      const dir = (payload as { dir?: number } | undefined)?.dir ?? 1
      if (this.state !== 'playing') return
      this.zoomIdx = (this.zoomIdx + (dir > 0 ? 1 : ZOOM_LEVELS.length - 1)) % ZOOM_LEVELS.length
      this.audio.scopeClick()
    })
    bus.on('input:rangefinder', () => {
      if (this.state === 'playing') this.hudSnapshot.rangefinder = !this.hudSnapshot.rangefinder
    })
    bus.on('input:echo', () => this.useEcho())
    bus.on('input:crouch', () => {
      if (this.state === 'playing') this.crouchTarget = !this.crouchTarget
    })
    bus.on('input:pause', () => this.pauseToMenu())
    bus.on('briefing:accept', () => {
      if (this.state === 'briefing') this.beginRun()
    })

    bus.on('game:start', (payload) => {
      const requested = Math.max(1, Math.round(Number((payload as { pass?: number }).pass ?? this.passIndex)))
      const unlocked = this.storage.get().unlockedPasses
      this.passIndex = Math.min(requested, unlocked)
      this.beginBriefing()
    })
    bus.on('game:resume', () => this.resumeFromMenu())
    bus.on('game:retry', () => {
      if (this.armInterstitial) {
        this.armInterstitial = false
        this.platform.maybeShowInterstitial()
      }
      this.beginRun()
    })
    bus.on('game:next', () => {
      if (this.armInterstitial) {
        this.armInterstitial = false
        this.platform.maybeShowInterstitial()
      }
      this.passIndex = Math.min(15, this.passIndex + 1)
      this.beginBriefing()
    })
    bus.on('game:menu', () => {
      if (this.armInterstitial) {
        this.armInterstitial = false
        this.platform.maybeShowInterstitial()
      }
      this.goToMenu(false)
    })

    bus.on('reward:scan', () => {
      this.droneScan = true
      this.emitBriefingData()
    })
    bus.on('reward:extraammo', () => {
      this.goldenUsed = true
      this.ammo += 1
      this.ui.show('hud')
      this.state = 'playing'
      this.router.releaseAll()
    })
    bus.on('reward:double', () => {
      this.lastScore *= 2
      this.persistScore(this.lastScore)
      bus.emit('contract:won', {
        score: this.lastScore,
        stars: 0,
        massPct: this.hudSnapshot.massPct,
        timeLeft: Math.max(0, Math.round(this.timeLeft)),
        ammoLeft: this.ammo,
        doubled: true,
      })
    })

    bus.on('sound:mute', (payload) => {
      const muted = Boolean((payload as { muted?: boolean }).muted)
      this.audio.setPlayerMuted(muted)
      this.storage.update((data) => {
        data.muted = muted
      })
      this.emitMenuState(this.pausedByUser)
    })
    bus.on('platform:paused', (payload) => this.handlePlatformPause(Boolean((payload as { paused?: boolean }).paused)))
    bus.on('platform:audio', (payload) => this.audio.setPlatformMuted(Boolean((payload as { muted?: boolean }).muted)))
    bus.on('quality:changed', (payload) => this.scene.applyQuality(Math.max(0, Math.min(2, Number((payload as { level?: number }).level ?? 1)))))

    this.loop = new GameLoop(
      1 / 60,
      (dt) => this.update(dt),
      () => this.scene.render(),
    )
  }

  async warmUp(): Promise<void> {
    await this.physics.init()
    // статические коллайдеры: пол и северная стена с ледником
    this.physics.createStaticBox(300, 2, 260, -60, -2, -321)
    this.physics.createStaticBox(300, 80, 6, -60, 78, -518)
    this.scene.applyQuality(this.quality.currentLevel)
    this.state = 'menu'
  }

  start(): void {
    this.loop.start()
    this.goToMenu(false)
  }

  // ── маршруты состояний ────────────────────────────────────────────────

  private goToMenu(canResume: boolean): void {
    this.pausedByUser = false
    this.timeScale = 1
    this.state = 'menu'
    this.router.setScreen('menu')
    this.scene.setMode('menu')
    this.emitMenuState(canResume)
    this.ui.show('menu')
  }

  private emitMenuState(canResume: boolean): void {
    const save = this.storage.get()
    let best = 0
    for (const value of Object.values(save.bestScores)) best = Math.max(best, value)
    bus.emit('menu:state', {
      canResume,
      pass: this.passIndex,
      unlocked: save.unlockedPasses,
      best,
      muted: save.muted,
    })
  }

  private beginBriefing(): void {
    this.pausedByUser = false
    this.state = 'briefing'
    this.router.setScreen('brief')
    this.emitBriefingData()
    this.ui.show('brief')
  }

  private emitBriefingData(): void {
    const gustMax = Math.round(Math.min(BALANCE.ballistics.maxWindSpeed, 2.5 + this.passIndex * 0.9))
    bus.emit('briefing:data', {
      pass: this.passIndex,
      distance: 372 + ((this.passIndex * 13) % 40),
      windMax: gustMax,
      ammo: BALANCE.contract.startAmmo,
      timeLimit: BALANCE.contract.timeLimitSeconds,
      massThreshold: BALANCE.glacier.burialMassThresholdPct,
      scanActive: this.droneScan,
      rewardedSupported: this.platform.isRewardedSupported,
    })
  }

  private beginRun(): void {
    this.avalanche.finish()
    this.scene.resetGlacier()
    this.glacierFractured = false
    const idx = this.passIndex
    this.wind.reconfigure(Math.min(8, 1.5 + idx * 0.7), Math.min(6, 0.8 + idx * 0.55))
    this.scene.placeGlacier(
      WORLD.killzoneCenterX + (((idx * 7) % 5) - 2) * 7,
      24 + (((idx * 3) % 4) - 1) * 2.5,
    )
    this.ammo = BALANCE.contract.startAmmo
    this.timeLeft = BALANCE.contract.timeLimitSeconds
    this.echoCharges = 1
    this.goldenUsed = false
    this.tremorShots = 0
    this.flying = false
    this.timeScale = 1
    this.shakeAmp = 0
    this.recoilPitch = 0
    this.ledgeX = 0
    this.yaw = 0
    this.pitch = -0.06
    this.zoomIdx = 0
    this.crouchTarget = false
    this.crouchDeploy = 0
    this.breathRecovery = 0
    this.breathHoldTime = 0
    this.breathHeldActive = false
    this.hudSnapshot.rangefinder = false
    this.titan.reset(1 + idx * 0.02)
    this.pausedByUser = false
    this.state = 'playing'
    this.router.setScreen('hud')
    this.scene.setMode('sniper')
    this.ui.show('hud')
    this.router.releaseAll()
  }

  private pauseToMenu(): void {
    if (this.state !== 'playing' && this.state !== 'bulletcam' && this.state !== 'avalanche') return
    this.pausedByUser = true
    this.router.releaseAll()
    this.audio.setHeartbeat(false)
    this.timeScale = 1
    this.flying = false
    this.scene.hideTracer()
    this.goToMenu(true)
  }

  private resumeFromMenu(): void {
    if (!this.pausedByUser || this.state !== 'menu') return
    this.state = 'playing'
    this.pausedByUser = false
    this.router.setScreen('hud')
    this.scene.setMode('sniper')
    this.ui.show('hud')
  }

  private handlePlatformPause(paused: boolean): void {
    this.pausedByPlatform = paused
    this.router.releaseAll()
    if (paused) {
      this.loop.stop()
      this.audio.setHeartbeat(false)
    } else {
      this.loop.resetAccumulator()
      this.loop.start()
    }
  }

  // ── обновление ────────────────────────────────────────────────────────

  private update(rawDt: number): void {
    this.elapsedReal += rawDt
    this.quality.sample(rawDt * 1000, rawDt)
    this.router.tick(rawDt)
    const dt = rawDt * this.timeScale
    if (!this.pausedByPlatform && !this.pausedByUser) {
      this.wind.update(dt)
    }
    this.audio.update(dt)
    this.scene.pulseCore(dt)
    this.scene.updateFlagsAndEffects(dt, this.wind.lateral)

    switch (this.state) {
      case 'menu':
      case 'briefing':
      case 'victory':
      case 'defeat':
        this.scene.updateMenuCamera(rawDt)
        this.updateSnowAroundCamera(rawDt * 0.4)
        break
      case 'playing':
        this.updatePlaying(dt, rawDt)
        break
      case 'bulletcam':
        this.updateFlight(dt)
        this.updateSnowAroundCamera(rawDt * 0.4)
        break
      case 'avalanche':
        this.updateAvalancheCinematic(rawDt)
        break
      default:
        break
    }
  }

  private updateSnowAroundCamera(dt: number): void {
    const p = this.scene.camera.position
    this.scene.particles.updateSnow(dt, p.x, p.y, p.z, this.wind.lateral)
    this.scene.particles.updateDust(dt)
  }

  private updatePlaying(dt: number, rawDt: number): void {
    // наведение
    this.router.consumeAim(this.aimConsumer)
    const zoom = ZOOM_LEVELS[this.zoomIdx]
    const sensitivity = 0.0026 * (8 / zoom)
    this.yaw -= this.aimConsumer.dx * sensitivity
    this.pitch -= this.aimConsumer.dy * sensitivity
    this.pitch = Math.max(-1.15, Math.min(0.65, this.pitch))

    // шаг по карнизу
    this.ledgeX += this.router.state.strafe * BALANCE.ledge.strafeSpeed * dt
    this.ledgeX = Math.max(WORLD.ledgeMinX, Math.min(WORLD.ledgeMaxX, this.ledgeX))

    // сошки
    const deploySpeed = dt / BALANCE.ledge.bipodDeployTime
    if (this.crouchTarget && this.crouchDeploy < 1) this.crouchDeploy = Math.min(1, this.crouchDeploy + deploySpeed)
    else if (!this.crouchTarget && this.crouchDeploy > 0) this.crouchDeploy = Math.max(0, this.crouchDeploy - deploySpeed)
    this.scene.setBipodVisible(this.crouchDeploy > 0.6)

    // дыхание
    this.updateBreath(dt)
    this.audio.setHeartbeat(this.breathHeldActive)

    // отдача и тряска оседают
    this.recoilPitch *= Math.pow(0.001, dt)
    this.shakeAmp *= Math.pow(0.08, dt)

    // ветер и таймер контракта
    this.timeLeft -= rawDt
    if (this.timeLeft <= 0) {
      this.doDefeat('timeout')
      return
    }

    // титан
    const titanState = this.titan.update(dt)
    this.scene.titan.root.position.x = titanState.x
    this.scene.titan.walkPhase = (this.scene.titan.walkPhase + titanState.walkPhaseDelta) % 1
    this.scene.titan.animate(this.scene.titan.walkPhase, titanState.moving)
    if (this.titan.crossedLine) {
      this.doDefeat('crossed')
      return
    }

    // прицельный рейкаст со sway
    this.applySniperPose()
    this.eyePos.set(this.ledgeX, WORLD.eyeHeight, WORLD.playerZ)
    this.forwardDir.set(0, 0, -1).applyQuaternion(this.scene.camera.quaternion)
    this.frameAim = this.scene.raycastAim(this.eyePos, this.forwardDir, this.aimPoint)
    this.scene.corePosition(this.coreCenter)

    this.updateSnowAroundCamera(dt)
    this.audio.setWind(this.wind.speed)
    this.emitHud()
  }

  private applySniperPose(): void {
    const swayScale = this.swayScale()
    const amp = BALANCE.breath.swayAmplitudeRad * (1 - BALANCE.ledge.bipodStabilityBonus * this.crouchDeploy) * swayScale
    const t = this.elapsedReal
    const yawSway = amp * (Math.sin(t * 1.9) + 0.6 * Math.sin(t * 3.7))
    const pitchSway = amp * 0.8 * (Math.cos(t * 1.6) + 0.5 * Math.sin(t * 2.9))
    const shakeYaw = (Math.random() - 0.5) * this.shakeAmp * 0.02
    const shakePitch = (Math.random() - 0.5) * this.shakeAmp * 0.02
    const zoom = ZOOM_LEVELS[this.zoomIdx]
    const magnification = zoom * (this.breathHeldActive ? BALANCE.breath.focusZoomFactor : 1)
    const aspect = Math.max(0.4, window.innerWidth / Math.max(1, window.innerHeight))
    const fov = this.scene.baseFov(aspect) / magnification
    this.scene.setSniperPose(
      this.ledgeX,
      WORLD.eyeHeight + Math.sin(t * 0.9) * 0.05,
      WORLD.playerZ,
      this.yaw + yawSway + shakeYaw,
      this.pitch + pitchSway + this.recoilPitch + shakePitch,
      fov,
    )
  }

  private swayScale(): number {
    if (this.breathHeldActive && !this.tremorActive) return 0.08
    if (this.breathRecovery > 0 && this.tremorActive) return 2
    return 1
  }

  private updateBreath(dt: number): void {
    const wantsHold = this.router.state.breathHeld && this.breathRecovery <= 0
    if (wantsHold && !this.breathHeldActive) {
      this.breathHeldActive = true
      this.breathHoldTime = 0
    }
    if (this.breathHeldActive) {
      this.breathHoldTime += dt
      if (this.breathHoldTime >= BALANCE.breath.holdMaxSeconds) {
        // спазм: принудительный выдох и двойной тремор на время восстановления
        this.breathHeldActive = false
        this.breathRecovery = BALANCE.breath.recoverySeconds
        this.tremorActive = true
        this.shakeAmp = Math.max(this.shakeAmp, 0.8)
      }
    } else if (this.breathRecovery > 0) {
      this.breathRecovery -= dt
      if (this.breathRecovery <= 0) this.tremorActive = false
    }
  }

  private useEcho(): void {
    if (this.state !== 'playing' || this.echoCharges <= 0) return
    this.echoCharges--
    this.titan.holdByEcho()
    this.audio.whistle()
  }

  // ── выстрел и рапид ───────────────────────────────────────────────────

  private tryFire(): void {
    if (this.state !== 'playing' || this.flying || this.ammo <= 0) return
    if (!this.frameAim) return
    this.ammo -= 1
    if (this.tremorActive && this.breathRecovery > 0) this.tremorShots++

    const distance = Math.max(20, this.frameAim.distance)
    this.flightOnGlacier = this.frameAim.onGlacier
    this.flightDistance = distance
    this.flightOrigin.copy(this.eyePos)
    this.flightDir.copy(this.forwardDir).normalize()
    this.flightRight.crossVectors(this.flightDir, UP).normalize()
    this.flightUp.crossVectors(this.flightRight, this.flightDir).normalize()

    const drift = BallisticsSystem.driftMeters(distance, this.wind.lateral)
    const drop = BallisticsSystem.dropMeters(distance)
    this.flightImpact.copy(this.frameAim.point)
      .addScaledVector(this.flightRight, drift)
      .addScaledVector(this.flightUp, -drop)

    this.flightP = 0
    this.flying = true
    this.bulletPrev.copy(this.flightOrigin)
    this.bulletPos.copy(this.flightOrigin)
    this.timeScale = BULLET_TIME_SCALE
    this.state = 'bulletcam'
    this.recoilPitch += 0.045
    this.shakeAmp = Math.max(this.shakeAmp, 0.35)
    this.audio.shot()
    this.scene.muzzleFlash(1)
    bus.emit('bullet:flight', { active: true })
  }

  private updateFlight(scaledDt: number): void {
    if (!this.flying) return
    const speedFactor = BallisticsSystem.muzzleVelocity / this.flightDistance
    this.flightP += scaledDt * speedFactor
    const p = Math.min(1, this.flightP)
    const totalDrift = BallisticsSystem.driftMeters(this.flightDistance, this.wind.lateral)
    const totalDrop = BallisticsSystem.dropMeters(this.flightDistance)
    this.bulletPos.copy(this.flightOrigin)
      .addScaledVector(this.flightDir, this.flightDistance * p)
      .addScaledVector(this.flightRight, totalDrift * driftCurve(p))
      .addScaledVector(this.flightUp, -totalDrop * dropCurve(p))
    this.scene.showTracer(this.bulletPrev, this.bulletPos)
    this.bulletPrev.copy(this.bulletPos)
    this.scene.setBulletCamPose(this.bulletPos, this.flightOrigin)
    if (p >= 1) this.resolveImpact()
  }

  private resolveImpact(): void {
    this.flying = false
    this.timeScale = 1
    this.scene.hideTracer()
    bus.emit('bullet:flight', { active: false })
    const impact = this.flightImpact
    if (this.flightOnGlacier) {
      this.scene.corePosition(this.coreCenter)
      const dx = impact.x - this.coreCenter.x
      const dy = impact.y - this.coreCenter.y
      const offset = Math.sqrt(dx * dx + dy * dy)
      if (offset <= BALANCE.glacier.coreRadiusMeters) {
        this.triggerAvalanche(offset)
        return
      }
    }
    // рикошет о скалу или лёд вне ядра
    this.scene.particles.spawnDust(impact.x, impact.y, impact.z, { count: 26 }, 0.7)
    this.audio.ricochet()
    this.afterShotSettled()
  }

  private triggerAvalanche(offset: number): void {
    const radius = BALANCE.glacier.coreRadiusMeters
    const factor = Math.max(0.05, Math.pow(1 - offset / radius, 2))
    this.scene.corePosition(this.coreCenter)
    this.scene.flashCore()
    this.scene.fractureGlacier()
    this.glacierFractured = true
    this.avalanche.trigger(factor, this.coreCenter.x, this.coreCenter.y, this.coreCenter.z)
    this.scene.particles.spawnDust(this.coreCenter.x, this.coreCenter.y, this.coreCenter.z, { count: 140 }, 2.2)
    this.shakeAmp = 1.6
    this.audio.iceCrack()
    this.audio.avalancheRumble(7)
    this.state = 'avalanche'
  }

  private updateAvalancheCinematic(dt: number): void {
    this.physics.step()
    this.syncChunks()
    this.avalanche.update(dt, this.scene.titan.root.position.x)
    this.updateSnowAroundCamera(dt)
    this.shakeAmp = Math.max(this.shakeAmp, 0.55)

    // титан продолжает шаг под грохот обвала
    const titanState = this.titan.update(dt)
    this.scene.titan.root.position.x = titanState.x
    this.scene.titan.animate(this.scene.titan.walkPhase, titanState.moving)

    if (this.titan.buriedProgress >= 0) {
      this.scene.titan.bury(this.titan.buriedProgress)
      this.applySpectatorPose()
      if (this.titan.buriedProgress >= 1) {
        this.doVictory(this.avalanche.result?.massPct ?? 100)
      }
      return
    }

    const outcome = this.avalanche.result
    if (outcome) {
      const nearCore = Math.abs(titanState.x - this.scene.glacierX) <= BALANCE.titan.killzoneLengthMeters / 2 + 10
      if (outcome.factor >= BALANCE.glacier.burialMassThresholdPct / 100 && outcome.buriedTitan && nearCore) {
        this.titan.bury()
        return
      }
      // обвал частичный или титан вне зоны: оглушён, но жив
      this.titan.stagger(2)
      this.afterShotSettled()
      return
    }

    if (this.titan.crossedLine) {
      this.doDefeat('crossed')
      return
    }
    this.applySpectatorPose()
  }

  /** Камера наблюдателя за лавиной с той же точки карниза. */
  private applySpectatorPose(): void {
    const shakeYaw = (Math.random() - 0.5) * this.shakeAmp * 0.02
    const shakePitch = (Math.random() - 0.5) * this.shakeAmp * 0.02
    const aspect = Math.max(0.4, window.innerWidth / Math.max(1, window.innerHeight))
    const fov = (this.scene.baseFov(aspect) / ZOOM_LEVELS[this.zoomIdx]) * 0.6
    this.scene.setSniperPose(
      this.ledgeX, WORLD.eyeHeight, WORLD.playerZ,
      this.yaw + shakeYaw, this.pitch + shakePitch - 0.12, fov,
    )
  }

  private syncChunks(): void {
    const count = BALANCE.glacier.avalancheBodies
    for (let i = 0; i < count; i++) {
      const chunk = this.physics.getChunk(i)
      if (!chunk) continue
      const p = chunk.body.translation()
      this.scene.setChunkTransform(i, p.x, p.y, p.z, chunk.halfX * 2, chunk.halfY * 2, chunk.halfZ * 2)
    }
    this.scene.commitChunks()
  }

  private afterShotSettled(): void {
    this.state = 'playing'
    this.router.setScreen('hud')
    this.scene.setMode('sniper')
    if (this.ammo <= 0) this.doDefeat('outofammo')
  }

  // ── итоги ─────────────────────────────────────────────────────────────

  private doVictory(massPct: number): void {
    const stars = massPct >= BALANCE.glacier.perfectMassBonusPct ? 3 : 2
    const score =
      BALANCE.contract.basePassScore * stars +
      this.ammo * BALANCE.contract.perUnspentAmmo +
      Math.max(0, Math.round(this.timeLeft)) * BALANCE.contract.perSecondLeft +
      (massPct >= BALANCE.glacier.perfectMassBonusPct ? BALANCE.contract.perfectMassBonus : 0) -
      this.tremorShots * BALANCE.contract.tremorShotPenalty
    this.lastScore = Math.max(0, score)
    this.persistScore(this.lastScore)
    this.armInterstitial = true
    this.audio.victoryChord()
    void this.platform.submitMasteryScore(this.lastScore).then((sent) => {
      bus.emit('leaderboard:result', { sent })
    })
    bus.emit('contract:won', {
      score: this.lastScore,
      stars,
      massPct,
      timeLeft: Math.max(0, Math.round(this.timeLeft)),
      ammoLeft: this.ammo,
      doubled: false,
    })
    this.showResultScreen('victory')
  }

  private persistScore(score: number): void {
    this.storage.update((data) => {
      data.unlockedPasses = Math.max(data.unlockedPasses, Math.min(15, this.passIndex + 1))
      const key = String(this.passIndex)
      data.bestScores[key] = Math.max(data.bestScores[key] ?? 0, Math.round(score))
    })
  }

  private doDefeat(reason: 'timeout' | 'crossed' | 'outofammo'): void {
    this.armInterstitial = true
    this.audio.defeatLow()
    this.router.releaseAll()
    bus.emit('contract:lost', {
      reason,
      canGolden: reason === 'outofammo' && !this.goldenUsed && !this.glacierFractured,
      rewardedSupported: this.platform.isRewardedSupported,
    })
    this.showResultScreen('defeat')
  }

  private showResultScreen(id: 'victory' | 'defeat'): void {
    this.state = id
    this.router.setScreen(id)
    this.scene.setMode('menu')
    this.ui.show(id)
  }

  // ── HUD ───────────────────────────────────────────────────────────────

  private emitHud(): void {
    const snap = this.hudSnapshot
    snap.state = this.state
    snap.timeLeft = Math.max(0, Math.ceil(this.timeLeft))
    snap.ammo = this.ammo
    snap.breathPct = this.breathHeldActive
      ? Math.round(100 * Math.max(0, 1 - this.breathHoldTime / BALANCE.breath.holdMaxSeconds))
      : this.breathRecovery > 0
        ? 0
        : 100
    snap.windX10 = Math.round(this.wind.speed * 10)
    snap.windDeg = Math.round(this.wind.directionDeg * (this.wind.lateral < 0 ? -1 : 1))
    snap.titanDistance = Math.round(this.titan.distanceToOutpost)
    snap.zoomLabel = ZOOM_LABELS[this.zoomIdx]
    snap.droneScan = this.droneScan
    snap.holdActive = this.breathHeldActive
    snap.deployPct = Math.round(this.crouchDeploy * 100)
    snap.strafe01 = Math.round(((this.ledgeX - WORLD.ledgeMinX) / (WORLD.ledgeMaxX - WORLD.ledgeMinX)) * 255)
    snap.echoAvailable = this.echoCharges > 0
    const distance = this.frameAim?.distance ?? 0
    if (distance > 0) {
      snap.dropMilX10 = Math.round(BallisticsSystem.dropMil(distance) * 10)
      snap.driftMilX10 = Math.round(BallisticsSystem.driftMil(distance, this.wind.lateral) * 10)
    } else {
      snap.dropMilX10 = 0
      snap.driftMilX10 = 0
    }
    snap.massPct = this.avalanche.isActive && !this.avalanche.result
      ? Math.min(100, Math.round((this.avalanche.secondsElapsed / BALANCE.titan.avalancheFallSeconds) * 80))
      : -1
    bus.emit('hud:state', snap)
  }
}

const UP = new THREE.Vector3(0, 1, 0)

function driftCurve(p: number): number {
  return Math.pow(p, 1.7)
}

function dropCurve(p: number): number {
  return p * p
}
