import { Balance, DERIVED } from '../config/Balance.js'
import { EventBus, type GameState, type RunSummary } from '../core/EventBus.js'
import { GameLoop } from '../core/GameLoop.js'
import { EnemyManager } from '../entities/EnemyManager.js'
import { PhysicsWorld } from '../physics/PhysicsWorld.js'
import { CombatSystem } from '../systems/CombatSystem.js'
import { LensSystem, type LensInput } from '../systems/LensSystem.js'
import { WaveDirector } from '../systems/WaveDirector.js'
import type { InputRouter } from '../input/InputRouter.js'
import type { PlaygamaService } from '../platform/PlaygamaService.js'
import type { StorageService } from '../platform/StorageService.js'
import { AudioManager } from '../audio/AudioManager.js'
import {
  AtmosphereRenderer,
} from '../rendering/AtmosphereRenderer.js'
import { BeamRenderer } from '../rendering/BeamRenderer.js'
import { DayNightCycle } from '../rendering/DayNightCycle.js'
import { EnemyRenderer } from '../rendering/EnemyRenderer.js'
import { OceanRenderer } from '../rendering/OceanRenderer.js'
import { ParticleSystem } from '../rendering/ParticleSystem.js'
import { buildIsland, buildLighthouse } from '../rendering/ProceduralModels.js'
import { SceneManager } from '../rendering/SceneManager.js'

const STEAM_RADIUS_FALLBACK = 6

/**
 * Координатор игры: состояние, фиксированный шаг симуляции и связь слоёв
 * через шину событий. Ни DOM, ни площадка сюда не заходят напрямую.
 */
export class Game {
  readonly events = new EventBus()
  readonly balance = new Balance()
  readonly audio = new AudioManager()

  readonly enemies: EnemyManager
  readonly lens: LensSystem
  private readonly combat: CombatSystem
  private readonly waves: WaveDirector
  private readonly physics: PhysicsWorld
  private readonly loop: GameLoop

  private readonly sceneManager: SceneManager
  private readonly beam: BeamRenderer
  private readonly particles: ParticleSystem
  private readonly atmosphere: AtmosphereRenderer
  private readonly oceanR: OceanRenderer
  private readonly dayNight: DayNightCycle
  private readonly enemyRenderer: EnemyRenderer

  state: GameState = 'LOADING'
  private lighthouseHp: number = DERIVED.lighthouseMaxHp
  private elapsedSec = 0
  private clockAccumulator = 0
  private scoreDirty = 0
  private lastBeamFocus = false
  private lastOverheated = false
  private interstitialArmed = false
  private reviveUsedThisRun = false
  private pendingLensInput: LensInput = { aimDelta: 0, focus: false, steamPressed: false }
  private timeSeconds = 0

  constructor(
    canvasHost: HTMLElement,
    private readonly input: InputRouter,
    private readonly platform: PlaygamaService,
    private readonly storage: StorageService,
  ) {
    this.enemies = new EnemyManager()
    this.lens = new LensSystem(this.balance, this.events)
    this.combat = new CombatSystem(this.enemies, this.lens, this.events, this.balance)
    this.waves = new WaveDirector(this.enemies, this.events)
    this.physics = new PhysicsWorld(this.enemies)

    this.sceneManager = new SceneManager(canvasHost)
    const island = buildIsland()
    this.sceneManager.scene.add(island)
    const lighthouse = buildLighthouse()
    this.sceneManager.scene.add(lighthouse.group)

    this.beam = new BeamRenderer(lighthouse.lampHead)
    this.particles = new ParticleSystem(this.sceneManager.scene)
    this.atmosphere = new AtmosphereRenderer()
    this.sceneManager.scene.add(this.atmosphere.sky)
    this.sceneManager.scene.add(this.atmosphere.rain)
    this.oceanR = new OceanRenderer()
    this.sceneManager.scene.add(this.oceanR.mesh)
    this.enemyRenderer = new EnemyRenderer(this.sceneManager.scene)
    this.dayNight = new DayNightCycle(this.sceneManager, this.atmosphere, this.oceanR)

    this.loop = new GameLoop(
      this.balance,
      (dt) => this.fixedUpdate(dt),
      () => this.frameRender(),
    )

    this.bindEvents()
  }

  setState(state: GameState): void {
    if (this.state === state) return
    this.state = state
    this.events.emit('state:changed', { state })
  }

  start(): void {
    this.loop.start()
  }

  stop(): void {
    this.loop.stop()
  }

  /** Возврат из паузы площадки или рекламы: накопитель дельты сброшен. */
  resumeFromPlatformPause(): void {
    this.loop.resetDelta()
  }

  get bestSurvivalTimeSec(): number {
    return this.storage.save.bestSurvivalTimeSec
  }

  get bestScore(): number {
    return this.storage.save.bestScore
  }

  enterMenu(): void {
    this.resetRun()
    this.sceneManager.setMode('menu')
    this.setState('MENU')
  }

  startRun(): void {
    this.resetRun()
    this.sceneManager.setMode('gameplay')
    this.setState('PLAYING')
    this.events.emit('hud:hp', { ratio: 1 })
    this.events.emit('hud:clock', { minutes: 0 })
    this.events.emit('hud:score', { score: 0, combo: 0 })
    this.events.emit('hud:steam', { charged: false, progress: 0 })
  }

  private resetRun(): void {
    this.lighthouseHp = DERIVED.lighthouseMaxHp
    this.elapsedSec = 0
    this.combat.reset()
    this.waves.reset()
    this.lens.reset()
    this.enemies.reset()
    this.enemyRenderer.reset()
    this.interstitialArmed = false
    this.reviveUsedThisRun = false
    this.lastBeamFocus = false
    this.lastOverheated = false
  }

  private bindEvents(): void {
    this.events.on('fx:shake', ({ power }) => {
      this.sceneManager.addShake(power)
    })
    this.events.on('fx:blast', ({ x, z }) => {
      this.particles.burst(x, 0.9, z, 26, 7.5, 0.11, 0.91, 0.71, 5, 0.55, 0.8, false)
      this.particles.burst(x, 0.7, z, 12, 3.4, 0.35, 0.42, 0.44, -1.2, 1.15, 1.5, true)
      this.sceneManager.addShake(0.45)
      this.audio.blast()
    })
    this.events.on('fx:vaporize', ({ x, z, armored }) => {
      this.particles.burst(x, 0.7, z, armored ? 18 : 10, 5.2, 0.28, 0.85, 0.68, 4.5, 0.34, 0.55, false)
      this.audio.vaporize()
    })
    this.events.on('fx:steam', () => {
      // Кольцо пара от башни наружу: импульс физике плюс белый вихрь.
      const radius = this.balance.get('radius_krugovogo_parovogo_koltsa') || STEAM_RADIUS_FALLBACK
      this.physics.applyRadialImpulse(0, 0, radius, this.balance.get('sila_fizicheskogo_otbrasyvaniya_parom'))
      for (let n = 0; n < 5; n++) {
        const angle = (n / 5) * Math.PI * 2
        this.particles.burst(Math.cos(angle) * 4.4, 1.1, Math.sin(angle) * 4.4, 14, 6.5, 0.86, 0.9, 0.92, -0.6, 1.3, 1.4, true)
      }
      this.sceneManager.addShake(0.5)
      this.audio.steamBurst()
    })
    this.events.on('world:beam', ({ focus, overheated }) => {
      if (overheated && !this.lastOverheated) this.audio.overheatAlarm()
      if (focus !== this.lastBeamFocus) this.audio.setBeamState(focus, overheated)
      this.lastBeamFocus = focus
      this.lastOverheated = overheated
    })
    this.events.on('platform:pause', ({ paused }) => {
      if (this.state === 'PLAYING' && paused) this.setState('PAUSED')
      else if (this.state === 'PAUSED' && !paused) {
        this.setState('PLAYING')
        this.resumeFromPlatformPause()
      }
    })
    this.events.on('audio:mute', ({ muted }) => {
      // Мьют игрока и мьют площадки — независимые входы мастер-гейна.
      this.audio.setPlayerMuted(muted)
    })
  }

  private fixedUpdate(dt: number): void {
    this.timeSeconds += dt
    if (this.state !== 'PLAYING') {
      this.idleScene(dt)
      return
    }

    this.elapsedSec += dt

    // Ввод -> линза -> свет -> движение -> бой.
    const snapshot = this.input.readSnapshot()
    let keyboardAimRad = snapshot.keyboardAim * this.lensAngleSpeed(dt)
    this.pendingLensInput.aimDelta = snapshot.aimDelta + keyboardAimRad
    this.pendingLensInput.focus = snapshot.focus
    this.pendingLensInput.steamPressed = this.input.consumeSteam()
    this.lens.update(dt, this.pendingLensInput)
    this.combat.update(dt)
    this.enemies.step(dt)
    this.physics.step(dt)
    this.waves.update(dt, this.elapsedSec)

    this.applyEnemyAttacks(dt)

    if (this.input.consumePause()) {
      this.setState('PAUSED')
      return
    }

    if (this.lighthouseHp <= 0) {
      this.endRun(false)
      return
    }
    if (this.elapsedSec >= DERIVED.nightDurationSec) {
      this.endRun(true)
    }
  }

  private lensAngleSpeed(dt: number): number {
    // Клавиатурный поворот использует тот же предел скорости башни.
    const radPerSec =
      ((this.balance.get('maksimalnaya_skorost_vrascheniya_prozhektora') || 240) * Math.PI) / 180
    return radPerSec * dt
  }

  private applyEnemyAttacks(dt: number): void {
    for (let i = 0; i < this.enemies.alive.length; i++) {
      if (!this.enemies.alive[i]) continue
      const damage = this.enemies.tryAttack(i, dt)
      if (damage > 0) {
        this.lighthouseHp -= damage
        this.events.emit('hud:hp', { ratio: Math.max(0, this.lighthouseHp / DERIVED.lighthouseMaxHp) })
      }
    }
  }

  private idleScene(dt: number): void {
    // Меню живёт на сниженной нагрузке: сцена дышит, орда спит.
    this.atmosphere.update(this.timeSeconds)
    this.oceanR.update(this.timeSeconds)
    this.dayNight.update(0.08)
    this.beam.sweepMenu(this.timeSeconds)
    this.particles.update(dt)
    void dt
  }

  private endRun(victory: boolean): void {
    const survivedSec = Math.min(DERIVED.nightDurationSec, Math.floor(this.elapsedSec))
    const hpPoints = Math.max(0, Math.round(this.lighthouseHp))
    const summary: RunSummary = {
      victory,
      score: this.computeFinalScore(survivedSec, hpPoints),
      survivedSec,
      chainKills: this.combat.chainKills,
      overheatCount: this.lens.overheatCount,
      lighthouseHpRatio: Math.max(0, this.lighthouseHp / DERIVED.lighthouseMaxHp),
      reviveUsed: this.reviveUsedThisRun,
    }
    this.storage.recordRun(summary.survivedSec, summary.score)
    void this.platform.submitScore(summary.score)
    // Слот interstitial ставится только здесь: показ решит клик игрока.
    this.interstitialArmed = true
    this.events.emit('run:end', { summary })
    if (victory) {
      this.sceneManager.setMode('dawn')
      this.audio.victoryChord()
      this.setState('VICTORY')
    } else {
      this.audio.defeatToll()
      this.setState('DEFEAT')
    }
  }

  computeFinalScore(survivedSec: number, hpPoints: number): number {
    const bonus = this.lens.overheatCount === 0 ? DERIVED.noOverheatBonus : 0
    return (
      survivedSec * DERIVED.scorePerSecond +
      hpPoints * DERIVED.scorePerHpPoint +
      this.combat.chainKills * DERIVED.scorePerChainKill +
      bonus
    )
  }

  /** Спасение вахты за rewarded: награда уже подтверждена площадкой. */
  applyRevive(): void {
    this.reviveUsedThisRun = true
    this.lighthouseHp = DERIVED.lighthouseMaxHp * DERIVED.reviveHealRatio
    this.lens.reset()
    for (let i = 0; i < this.enemies.alive.length; i++) {
      if (!this.enemies.alive[i]) continue
      const distSq =
        this.enemies.posX[i] * this.enemies.posX[i] + this.enemies.posZ[i] * this.enemies.posZ[i]
      if (distSq <= 100) this.enemies.despawn(i)
    }
    this.events.emit('hud:hp', { ratio: this.lighthouseHp / DERIVED.lighthouseMaxHp })
    this.setState('PLAYING')
    this.resumeFromPlatformPause()
  }

  get isReviveUsed(): boolean {
    return this.reviveUsedThisRun
  }

  /** Клик по кнопке выхода с экрана результата: единственное место interstitial. */
  consumeArmedInterstitial(): boolean {
    if (!this.interstitialArmed) return false
    this.interstitialArmed = false
    return this.platform.maybeShowInterstitial()
  }

  get currentScore(): number {
    const survivedSec = Math.min(DERIVED.nightDurationSec, this.elapsedSec)
    return (
      Math.floor(survivedSec) * DERIVED.scorePerSecond +
      Math.max(0, Math.round(this.lighthouseHp)) * DERIVED.scorePerHpPoint +
      this.combat.chainKills * DERIVED.scorePerChainKill
    )
  }

  get nightProgress(): number {
    return Math.min(1, this.elapsedSec / DERIVED.nightDurationSec)
  }

  get clockMinutes(): number {
    return (this.elapsedSec / DERIVED.nightDurationSec) * DERIVED.gameClockMinutes
  }

  private frameRender(): void {
    const playing = this.state === 'PLAYING'
    if (playing) {
      this.atmosphere.update(this.timeSeconds)
      this.oceanR.update(this.timeSeconds)
      this.dayNight.update(this.nightProgress)
      this.beam.update(this.lens)
      this.enemyRenderer.update(this.enemies, this.timeSeconds)
      this.particles.update(1 / this.balance.get('target_fps', 60))

      this.clockAccumulator += 1
      if (this.clockAccumulator >= 5) {
        this.clockAccumulator = 0
        this.events.emit('hud:clock', { minutes: this.clockMinutes })
        const score = this.currentScore
        if (score !== this.scoreDirty) {
          this.scoreDirty = score
          this.events.emit('hud:score', { score, combo: this.combat.chainKills })
        }
      }
    }
    this.sceneManager.update(1 / this.balance.get('target_fps', 60))
    this.sceneManager.render()
  }
}
