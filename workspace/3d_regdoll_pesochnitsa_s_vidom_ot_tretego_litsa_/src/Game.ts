import { BALANCE } from './config/balance.ts'
import { bus } from './core/EventBus.ts'
import { GameLoop } from './core/GameLoop.ts'
import { InputRouter } from './core/InputRouter.ts'
import { initPhysics, PhysicsWorld } from './physics/PhysicsWorld.ts'
import { Stuntman } from './entities/Stuntman.ts'
import { BanquetHall } from './entities/BanquetHall.ts'
import { SceneManager } from './rendering/SceneManager.ts'
import { HallRenderer } from './rendering/ProceduralModels.ts'
import { ParticleSystem } from './rendering/ParticleSystem.ts'
import { TrajectoryArc } from './rendering/TrajectoryArc.ts'
import { DamageComboScoringSystem, type DamageSource } from './systems/DamageComboScoringSystem.ts'
import { StructuralDestructionSystem } from './systems/StructuralDestructionSystem.ts'
import { CascadeChainSystem } from './systems/CascadeChainSystem.ts'
import { NpcCrowdPanicSystem } from './systems/NpcCrowdPanicSystem.ts'
import { RagdollAerodynamicsSystem } from './systems/RagdollAerodynamicsSystem.ts'
import { AudioManager } from './audio/AudioManager.ts'
import { UiRoot } from './ui/UiRoot.ts'
import { StorageService } from './platform/StorageService.ts'
import {
  armGameReadyWatchdog,
  capabilityLeaderboard,
  capabilityRewarded,
  maybeShowInterstitial,
  sendGameReady,
  showRewardedAd,
  submitScore,
} from './platform/PlaygamaService.ts'

export type Phase = 'aiming' | 'flight' | 'slowmo' | 'cascade' | 'result'

/**
 * Координатор: состояния запуска, склейка систем и отклик на события шины.
 * В кадре никаких аллокаций: векторы и структуры созданы заранее.
 */
export class Game {
  readonly input = new InputRouter()
  readonly audio = new AudioManager()
  loop!: GameLoop

  private physics!: PhysicsWorld
  private sceneManager!: SceneManager
  private particles!: ParticleSystem
  private arc!: TrajectoryArc
  private hallRenderer!: HallRenderer
  private stuntman!: Stuntman
  private hall!: BanquetHall

  private scoring!: DamageComboScoringSystem
  private destruction!: StructuralDestructionSystem
  private cascade!: CascadeChainSystem
  private crowd!: NpcCrowdPanicSystem
  private aero!: RagdollAerodynamicsSystem

  private ui!: UiRoot

  private phase: Phase = 'aiming'
  private slowMoRemaining = 0
  private restTimer = 0
  private flightTimer = 0
  private lastGlassShatterSoundAt = -Infinity
  private readonly pullScratch = { x: 0, y: 0 }
  private launched = false
  private tensionStarted = false
  /** Пул событий столкновений переиспользуется от кадра к кадру. */
  private readonly collisionPool: Array<{ a: number; b: number; started: boolean }> = []
  private collisionCount = 0
  private readonly aeroSteer = { pitch: 0, roll: 0 }

  async boot(container: HTMLElement): Promise<void> {
    this.loop = new GameLoop(
      (dt) => this.fixedUpdate(dt),
      (dtReal) => this.render(dtReal),
    )

    await initPhysics()
    this.physics = new PhysicsWorld()
    this.ui = new UiRoot(container, this.input)
    this.sceneManager = new SceneManager(this.ui.sceneLayer)
    this.particles = new ParticleSystem(this.sceneManager.scene)
    this.arc = new TrajectoryArc(this.sceneManager.scene)

    this.hall = new BanquetHall(this.physics)
    this.hall.build()
    // Стартовая позиция катапульты — ближняя часть зала.
    this.stuntman = new Stuntman(this.physics, 0, 2.2, 8)
    this.stuntman.spawn(0, 2.2, 8)
    this.stuntman.holdAtCatapult()
    this.hallRenderer = new HallRenderer(this.sceneManager.scene, this.hall, this.stuntman)

    this.scoring = new DamageComboScoringSystem()
    this.destruction = new StructuralDestructionSystem(this.stuntman, this.hall)
    this.cascade = new CascadeChainSystem(this.hall)
    this.crowd = new NpcCrowdPanicSystem(this.hall)
    this.aero = new RagdollAerodynamicsSystem()

    await this.buildUi()

    this.wireEvents()
    this.input.install()
    this.ui.onPauseRequest = () => {
      if (this.phase === 'result') return
      this.loop.stop()
      this.ui.showPause()
    }
    this.enterAiming()
    this.loop.start()
  }

  private async buildUi(): Promise<void> {
    const saved = await StorageService.load()
    StorageService.installAutoFlush()
    this.audio.setPlayerMuted(saved.muted)

    this.ui = new UiRoot(document.getElementById('app') as HTMLElement, this.input)

    this.ui.registerMainMenu({
      onPlay: () => this.startRun(),
      onWardrobe: () => this.ui.hud.showPopup('Смокинг уже надет'),
      onCatapults: () => this.ui.hud.showPopup('Катапульта готова'),
      leaderboardSupported: capabilityLeaderboard(),
      onLeaderboard: () => void submitScore('banquet_crash_total', Math.round(saved.totalDamage)),
    })
    this.ui.registerVictory({
      onNextHall: () => {
        void maybeShowInterstitial('interstitial_default')
        this.nextHall()
      },
      onRestart: () => {
        void maybeShowInterstitial('interstitial_default')
        this.restartRun()
      },
      onMenu: () => {
        void maybeShowInterstitial('interstitial_default')
        this.toMenu()
      },
      rewardedSupported: capabilityRewarded(),
      onDoubleCash: async (_button, data) => {
        const granted = await showRewardedAd('double_cash')
        if (!granted) return
        const doubled = data.totalDamage * 2
        this.scoring.registerHitSilently(doubled)
        this.ui.showVictory({
          totalDamage: doubled,
          stars: this.scoring.stars(),
          formatMoney: this.ui.formatMoneyForUi(),
        })
      },
    })
    this.ui.registerPause({
      onResume: () => this.resumeGame(),
      onMenu: () => this.toMenu(),
      onToggleMute: (muted) => {
        this.audio.setPlayerMuted(muted)
        StorageService.update({ muted })
      },
      initialMuted: saved.muted,
    })

    // Загрузка завершена: меню интерактивно, площадке можно сигнал готовности.
    armGameReadyWatchdog(() => sendGameReady())
    this.ui.setProgress(1)
    this.ui.showMenu()
    sendGameReady()
  }

  private wireEvents(): void {
    bus.on('cable:snapped', (p: { x: number; y: number; z: number }) => {
      this.onCableSnapped(p)
    })
    bus.on('cable:tooSlow', () => {
      if (this.phase === 'flight') this.ui.hud.showBadge('TOO SLOW!')
    })
    bus.on('cascade:cakeSmash', (p: { x: number; y: number; z: number; speed: number }) => {
      const mass = this.lastChandelierMass > 0 ? this.lastChandelierMass : 1000
      this.cascade.cakeBlast(p.x, p.y, p.z, mass, Math.max(p.speed, 6))
      this.scoring.registerHit('cake')
      this.audio.creamSplat()
      this.ui.hud.showPopup('CAKE SMASH!')
      bus.emit('cascade:crashPoint', { x: p.x, z: p.z, strength: BALANCE.cascade.cakeBlastRadius })
    })
    bus.on('cascade:crashPoint', (p: { x: number; z: number; strength: number }) => {
      this.crowd.reportHazard(p.x, p.z)
    })
    bus.on('hud:damageChanged', (payload?: { total: number; combo: number }) => {
      if (!payload) return
      const stars = this.scoring.stars()
      this.ui.hud.setStars(stars)
      if (stars >= 1 && payload.total >= this.starThreshold(stars)) {
        this.audio.starChord(stars)
        this.ui.hud.showPopup(`${stars} ЗВЕЗДА${stars > 1 ? 'Ы' : ''}!`)
      }
    })
    bus.on('input:restart', () => {
      if (this.phase !== 'result') this.restartRun()
    })
    bus.on('guest:bowled', () => {
      this.particles.spawn('confetti', this.stuntman.center(), 24, 4)
    })
    bus.on('vfx:creamExplosion', (p: { x: number; y: number; z: number }) => {
      this.particles.spawn('cream', p, 120, 7)
    })
    // Пауза и звук приходят от площадки, а не от visibilitychange.
    bus.on('platform:lifecycle', (payload: { kind: string; value?: unknown }) => {
      const paused = payload.value === true
      if (payload.kind === 'pauseStateChanged') {
        if (paused) this.pauseAll()
        else this.resumeAll()
      } else if (payload.kind === 'audioStateChanged') {
        this.audio.setPlatformMuted(paused)
      }
    })
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true })
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true })
  }

  private starThreshold(stars: number): number {
    if (stars >= 3) return BALANCE.scoring.star3Threshold
    if (stars === 2) return BALANCE.scoring.star2Threshold
    return BALANCE.scoring.star1Threshold
  }

  private lastChandelierMass = 0

  private onCableSnapped(p: { x: number; y: number; z: number }): void {
    this.phase = 'slowmo'
    this.slowMoRemaining = BALANCE.cable.slowMoDurationRealSec
    this.loop.setTimeScale(BALANCE.cable.slowMoTimeScale)
    this.sceneManager.setMode('focus')
    this.sceneManager.setFocus(p.x, p.y, p.z)
    this.particles.spawn('spark', p, 160, 9)
    this.audio.cableSnap()
    this.ui.hud.hideBadge()
    this.ui.hud.showPopup('CRASH!')
    const chandelier = this.hall.chandeliers.find((c) => c.snapped)
    if (chandelier) this.lastChandelierMass = chandelier.body.mass()
  }

  private enterAiming(): void {
    this.phase = 'aiming'
    this.launched = false
    this.flightTimer = 0
    this.restTimer = 0
    this.aero.reset()
    this.crowd.reset()
    this.sceneManager.setMode('menu')
    this.ui.touchControls?.setFlightPhase(false)
  }

  private startRun(): void {
    this.scoring.reset()
    this.hall.reset()
    this.stuntman.resetToPose()
    this.ui.hud.setVisible(true)
    this.ui.showGameplay()
    this.enterAiming()
    this.sceneManager.requestZoom(60)
  }

  private restartRun(): void {
    this.startRun()
  }

  private nextHall(): void {
    const data = StorageService.data
    const stars = this.scoring.stars()
    const total = this.scoring.totalDamage
    const unlocked = stars >= 1 ? data.unlockedHalls + 1 : data.unlockedHalls
    StorageService.update({
      unlockedHalls: unlocked,
      selectedHall: Math.min(data.selectedHall + 1, unlocked - 1),
      totalDamage: data.totalDamage + total,
      launches: data.launches + 1,
      bestStars: { ...data.bestStars, [`hall${data.selectedHall}`]: Math.max(data.bestStars[`hall${data.selectedHall}`] ?? 0, stars) },
    })
    this.startRun()
    this.ui.hud.showPopup(`ЗАЛ ${StorageService.data.selectedHall + 1}`)
  }

  private toMenu(): void {
    this.phase = 'aiming'
    this.launched = false
    this.loop.setTimeScale(1)
    this.audio.stopWind()
    this.audio.stopTension()
    this.hall.reset()
    this.stuntman.resetToPose()
    this.scoring.reset()
    this.sceneManager.setMode('menu')
    this.sceneManager.requestZoom(55)
    this.ui.showMenu()
  }

  private resumeGame(): void {
    this.loop.resetDelta()
    this.ui.resumeFromPause()
  }

  /** Прицел из экранного натяжения. */
  private aimDirection(): { dirX: number; dirY: number; dirZ: number; pull: number } | null {
    this.input.pullVector(this.pullScratch)
    const length = Math.hypot(this.pullScratch.x, this.pullScratch.y)
    if (length < 12) return null
    const maxPullPx = BALANCE.sling.maxPullDistance * 110
    const pull = Math.min(length / maxPullPx, 1)
    const elevFraction = Math.min(Math.abs(this.pullScratch.y) / length, 1)
    const angle = (elevFraction * BALANCE.sling.maxElevationAngleDeg * Math.PI) / 180
    return {
      dirX: -this.pullScratch.x / length * Math.cos(angle),
      dirY: Math.sin(angle),
      dirZ: -this.pullScratch.y / length * Math.cos(angle),
      pull,
    }
  }

  fixedUpdate(dt: number): void {
    if (!this.physics) return
    this.input.applyKeyboardSteer()

    switch (this.phase) {
      case 'aiming':
        this.fixedUpdateAiming(dt)
        break
      case 'flight':
      case 'slowmo':
      case 'cascade':
        this.fixedUpdateFlight(dt)
        break
      case 'result':
        break
    }

    this.crowd.fixedUpdate(dt)
    this.physics.step()

    const eventCount = this.drainEvents()
    for (let i = 0; i < eventCount; i++) {
      const event = this.collisionPool[i]
      if (event) this.destruction.processEvent(event.a, event.b, event.started)
    }

    if (this.phase === 'flight' || this.phase === 'cascade') {
      this.checkGlassesAndTables()
      this.checkRest(dt)
    }

    this.scoring.fixedUpdate(dt)
  }

  /** drainCollisionEvents в пул без аллокаций в кадре. */
  private drainEvents(): number {
    this.collisionCount = 0
    this.physics.eventQueue.drainCollisionEvents((a: number, b: number, started: boolean) => {
      let slot = this.collisionPool[this.collisionCount]
      if (!slot) {
        slot = { a: 0, b: 0, started: false }
        this.collisionPool.push(slot)
      }
      slot.a = a
      slot.b = b
      slot.started = started
      this.collisionCount++
    })
    return this.collisionCount
  }

  private fixedUpdateAiming(dt: number): void {
    void dt
    if (this.input.aiming) {
      const aim = this.aimDirection()
      if (aim && aim.pull > 0.05) {
        if (!this.tensionStarted) {
          this.tensionStarted = true
          this.audio.startTension()
        }
        this.hallRenderer.setPressure(aim.pull)
        this.arc.show(0, 2.4, 8, aim.dirX, aim.dirY, aim.dirZ)
        this.audio.updateTension(aim.pull)
        if (aim.pull < 0.4) this.ui.hud.showBadge('LOW VELOCITY')
        else this.ui.hud.hideBadge()
      }
    }
    if (this.input.consumeLaunch() && !this.launched) {
      const aim = this.aimDirection()
      this.arc.hide()
      this.audio.stopTension()
      this.tensionStarted = false
      this.hallRenderer.setPressure(0)
      this.ui.hud.hideBadge()
      if (!aim || aim.pull < 0.08) {
        this.ui.hud.showBadge('LOW VELOCITY')
        return
      }
      this.stuntman.launch(aim.dirX, aim.dirY, aim.dirZ, aim.pull)
      this.launched = true
      this.phase = 'flight'
      this.audio.launchPop()
      this.audio.startWind()
      this.sceneManager.setMode('chase')
      this.sceneManager.requestZoom(80)
      this.particles.spawn('confetti', { x: 0, y: 2.4, z: 8 }, 60, 5)
      this.ui.touchControls?.setFlightPhase(true)
    }
  }

  private fixedUpdateFlight(dt: number): void {
    this.flightTimer += dt
    if (this.phase === 'slowmo') {
      // Slow-Mo живёт по реальному времени: длительность фиксирована в секундах.
      this.slowMoRemaining -= dt * BALANCE.cable.slowMoTimeScale
      if (this.slowMoRemaining <= 0) {
        this.loop.setTimeScale(1)
        this.sceneManager.setMode('chase')
        this.sceneManager.requestZoom(70)
        this.phase = 'cascade'
      }
    }

    this.aeroSteer.pitch = this.input.steerPitch
    this.aeroSteer.roll = this.input.steerRoll
    this.aero.fixedUpdate(this.stuntman, this.aeroSteer)
    // Оси тача затухают сами: свайп задаёт импульс, а не постоянный наклон.
    if (this.input.mode === 'touch') {
      this.input.steerPitch *= 0.98
      this.input.steerRoll *= 0.98
    }
    this.audio.updateWind(Math.min(this.stuntman.speed() / BALANCE.aero.diveMaxSpeed, 1))

    // Аварийный толчок и доворот в Slow-Mo.
    if (this.input.consumeKick()) {
      if (this.phase === 'slowmo') this.stuntman.kick(3)
      else this.stuntman.kick(5)
      this.audio.glassShatter()
    }
  }

  /** Разлет бокалов и опрокидывание столов проверяются по физическому состоянию. */
  private checkGlassesAndTables(): void {
    for (const glass of this.hall.glasses) {
      if (glass.broken) continue
      const t = glass.body.translation()
      if (t.y < 0.85 || Math.abs(t.x + 6) > 4.2) continue
      glass.broken = true
      this.scoring.registerHit('glass' as DamageSource)
      const now = performance.now() / 1000
      if (now - this.lastGlassShatterSoundAt > 0.12) {
        this.lastGlassShatterSoundAt = now
        this.audio.glassShatter()
      }
      if (Math.random() < 0.25) {
        this.particles.spawn('shard', { x: t.x, y: t.y, z: t.z }, 10, 3)
      }
    }
    for (const table of this.hall.tables) {
      if (table.toppled) continue
      const r = table.body.rotation()
      const tilt = Math.abs(r.w) < 0.94
      const t = table.body.translation()
      if (tilt || t.y < 0.6) {
        table.toppled = true
        this.scoring.registerHit('table' as DamageSource)
        this.audio.creamSplat()
      }
    }
  }

  /** Попытка заканчивается покоем тела, падением за пределы зала или таймаутом. */
  private checkRest(dt: number): void {
    const speed = this.stuntman.speed()
    const center = this.stuntman.center()
    if ((speed < 0.6 && center.y < 3) || center.y < -2 || this.flightTimer > 25) {
      this.restTimer += dt
      if (this.restTimer > 1.2) this.finishRun()
    } else {
      this.restTimer = 0
    }
  }

  private finishRun(): void {
    this.phase = 'result'
    this.loop.setTimeScale(1)
    this.audio.stopWind()
    this.audio.stopTension()
    this.ui.touchControls?.setFlightPhase(false)
    const stars = this.scoring.stars()
    const total = this.scoring.totalDamage
    if (total >= BALANCE.scoring.star1Threshold) {
      this.ui.hud.showPopup('WEDDING RUINED!')
      this.audio.starChord(stars)
    } else {
      this.audio.failThud()
      this.ui.hud.showBadge('Чопорные гости даже не заметили саботажа')
    }
    const data = StorageService.data
    StorageService.update({
      totalDamage: data.totalDamage + total,
      launches: data.launches + 1,
    })
    void submitScore('banquet_crash_total', Math.round(total))
    this.ui.showVictory({ totalDamage: total, stars, formatMoney: this.ui.formatMoneyForUi() })
  }

  render(dtReal: number): void {
    if (!this.physics) return
    const center = this.stuntman.center()
    if (this.phase === 'flight' || this.phase === 'slowmo' || this.phase === 'cascade') {
      const vel = this.stuntman.velocity()
      this.sceneManager.updateChase(center.x, center.y, center.z, vel.z)
    }
    this.hallRenderer.update(dtReal)
    this.particles.update(dtReal)
    this.sceneManager.tick(dtReal)
  }

  pauseAll(): void {
    this.loop.stop()
    this.audio.setPlatformMuted(true)
  }

  resumeAll(): void {
    this.loop.resetDelta()
    this.loop.start()
    this.audio.setPlatformMuted(false)
  }
}
