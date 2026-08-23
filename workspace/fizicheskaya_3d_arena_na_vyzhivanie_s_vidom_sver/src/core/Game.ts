import bridge from '@playgama/bridge'
import { EventBus } from './EventBus'
import { I18n } from '../ui/I18n'
import { GameLoop } from './GameLoop'
import { InputRouter } from './InputRouter'

import type { BuyResult } from '../ui/types'
import { PlatformService } from '../platform/PlaygamaService'
import { StorageService } from '../platform/StorageService'
import { PhysicsWorld } from '../physics/PhysicsWorld'
import { EntityManager } from '../entities/EntityManager'
import { IceArenaFracturingSystem } from '../systems/IceArenaFracturingSystem'
import { KineticImpulseCollisionSystem } from '../systems/KineticImpulseCollisionSystem'
import { SumoBotAiSystem } from '../systems/SumoBotAiSystem'
import { MatchDirectorLeagueSystem } from '../systems/MatchDirectorLeagueSystem'
import { SceneManager } from '../rendering/SceneManager'
import { AudioManager } from '../audio/AudioManager'
import { Hud } from '../ui/Hud'
import { TouchControls } from '../ui/TouchControls'
import { UiRoot } from '../ui/UiRoot'
import { ScreenRouter as UiScreenRouter } from '../ui/ScreenRouter'

import { MainMenuScreen } from '../ui/screens/MainMenuScreen'
import { HUDGameScreen } from '../ui/screens/HUDGameScreen'
import { RevivePromptModal } from '../ui/screens/RevivePromptModal'
import { VictoryDefeatScreen } from '../ui/screens/VictoryDefeatScreen'
import { GarageScreen } from '../ui/screens/GarageScreen'
import { LeaderboardScreen } from '../ui/screens/LeaderboardScreen'
import { PauseModalScreen } from '../ui/screens/PauseModalScreen'
import { TUBES, PILOTS, TRAILS } from './Catalog'

/**
 * Координатор: владеет системами, машиной состояний матча и мостом
 * между геймплеем и интерфейсом. Порядок кадра фиксирован:
 * ввод -> ИИ -> контроллеры -> физика -> синхронизация мешей -> камера -> кадр.
 */
const SCREEN_MENU = 'main_menu'
const SCREEN_HUD = 'match_hud'
const SCREEN_RESULTS = 'match_results'
const SCREEN_GARAGE = 'customization_hangar'
const SCREEN_BOARD = 'leaderboard_screen'
const SCREEN_REVIVE = 'revive_prompt'
const SCREEN_PAUSE = 'pause_settings'

export class Game {
  private readonly bus = new EventBus()
  private readonly platform: PlatformService
  private readonly storage = new StorageService()
  private readonly physics = new PhysicsWorld()
  private readonly input: InputRouter
  private entities!: EntityManager
  private arena!: IceArenaFracturingSystem
  private collisions!: KineticImpulseCollisionSystem
  private bots!: SumoBotAiSystem
  private director!: MatchDirectorLeagueSystem
  private sceneManager!: SceneManager
  private audio!: AudioManager
  private loop!: GameLoop
  private ui!: UiRoot
  private touch: TouchControls | null = null

  private pausedByPlatform = false
  private pausedByPlayer = false
  private inMatch = false
  private lastResult = { trophies: 0, coins: 0 }
  private readonly axisBuffer = { x: 0, y: 0 }

  constructor(_container: HTMLElement) {
    this.platform = new PlatformService(this.bus)
    this.input = new InputRouter(this.platform.deviceType())
  }

  async init(): Promise<void> {
    await this.platform.initialize()
    this.input.setDeviceType(this.platform.deviceType())
    this.platform.reportLoadingProgress(10)
    await this.physics.init()
    this.platform.reportLoadingProgress(45)

    this.entities = new EntityManager(this.physics)
    this.entities.build()
    this.arena = new IceArenaFracturingSystem(this.physics)
    this.arena.build()
    this.collisions = new KineticImpulseCollisionSystem(this.physics, this.entities)
    this.collisions.build()
    this.bots = new SumoBotAiSystem(this.entities, this.arena)
    this.bots.build()
    this.director = new MatchDirectorLeagueSystem(this.bus, this.entities, this.arena, this.collisions)

    const app = document.getElementById('app')
    if (!app) throw new Error('не найден #app')
    this.sceneManager = new SceneManager(app)
    this.sceneManager.buildArena(this.arena.plates)
    this.sceneManager.buildTubes(this.entities)
    this.audio = new AudioManager(this.bus)
    this.platform.reportLoadingProgress(75)

    await this.storage.load()

    const i18n = new I18n()
    i18n.setLanguage(this.platform.language())
    this.buildInterface(i18n)

    this.audio.setUserMuted(this.storage.get().muted)
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )
    this.subscribeLifecycle()
    this.platform.reportLoadingProgress(100)
    // Меню интерактивно — здесь уходит единственный сигнал готовности площадке.
    this.platform.notifyGameReady()
    this.loop.start()
  }

  // ── Интерфейс ──────────────────────────────────────────────────────────

  private buildInterface(i18n: I18n): void {
    const hud = new Hud(this.bus, i18n)
    if (this.input.mode === 'touch') {
      this.touch = new TouchControls({ boost: i18n.t('boost'), rebound: i18n.t('rebound') })
    }
    const getState = () => {
      const data = this.storage.get()
      return {
        trophies: data.trophies,
        selectedTube: data.selectedTube,
        selectedPilot: data.selectedPilot,
        selectedTrail: data.selectedTrail,
        unlockedTubes: data.unlockedTubes,
        unlockedPilots: data.unlockedPilots,
        unlockedTrails: data.unlockedTrails,
        bestScores: data.localScores,
        muted: data.muted,
        rewardedSupported: this.platform.capabilities().rewarded,
      }
    }
    const actions = {
      startMatch: () => this.startMatch(),
      openGarage: () => this.ui.showScreen(SCREEN_GARAGE),
      openLeaderboard: () => this.ui.showScreen(SCREEN_BOARD),
      backToMenu: () => this.leaveToMenu(),
      nextMatch: () => {
        this.platform.requestInterstitialFromClick('between_matches')
        this.startMatch()
      },
      acceptRevive: () => void this.requestRevive(),
      declineRevive: () => this.director.declineRevive(),
      resumeMatch: () => this.setPaused(false),
      toggleSound: () => this.toggleSound(),
      claimTripleReward: () => void this.claimTripleReward(),
      buyItem: (kind: 'tube' | 'pilot' | 'trail', id: string): BuyResult => this.buyItem(kind, id),
      selectItem: (kind: 'tube' | 'pilot' | 'trail', id: string) => this.selectItem(kind, id),
    }

    const menuScreen = new MainMenuScreen(i18n, actions, getState)
    const hudScreen = new HUDGameScreen(hud)
    const reviveScreen = new RevivePromptModal(i18n, actions, getState)
    const resultsScreen = new VictoryDefeatScreen(i18n, actions, getState, this.bus)
    const garageScreen = new GarageScreen(i18n, actions, getState)
    const boardScreen = new LeaderboardScreen(i18n, actions, getState, () => this.loadRemoteScores())
    const pauseScreen = new PauseModalScreen(i18n, actions, getState)


    const app = document.getElementById('app') as HTMLElement
    const uiRouter = new UiScreenRouter()
    this.ui = new UiRoot(app, i18n, uiRouter, hud, this.touch)
    uiRouter.attachLayer(this.ui.screensLayer)
    uiRouter.register(menuScreen)
    uiRouter.register(hudScreen)
    uiRouter.register(resultsScreen)
    uiRouter.register(garageScreen)
    uiRouter.register(boardScreen)
    uiRouter.register(reviveScreen)
    uiRouter.register(pauseScreen)

    hud.onPauseRequested = () => this.setPaused(!this.pausedByPlayer)
    this.ui.applyInputMode(this.input.mode)
    this.input.onModeChanged = (mode) => {
      if (mode === 'touch' && !this.touch) {
        this.touch = new TouchControls({ boost: i18n.t('boost'), rebound: i18n.t('rebound') })
      }
      this.ui.applyInputMode(mode)
    }
    this.ui.showScreen(SCREEN_MENU)
  }

  // ── Действия интерфейса ────────────────────────────────────────────────

  startMatch(): void {
    this.inMatch = true
    this.pausedByPlayer = false
    this.entities.layoutForMatch()
    this.arena.reset()
    this.bots.reset()
    this.sceneManager.buildArena(this.arena.plates)
    this.director.startMatch()
    this.ui.showScreen(SCREEN_HUD)
    this.audio.countdownBeep(false)
  }

  private leaveToMenu(): void {
    this.platform.requestInterstitialFromClick('leaving_results')
    this.inMatch = false
    this.pausedByPlayer = false
    this.director.toIdle()
    this.ui.showScreen(SCREEN_MENU)
  }

  private setPaused(paused: boolean): void {
    this.pausedByPlayer = paused
    if (paused && this.inMatch) {
      this.ui.showScreen(SCREEN_PAUSE)
    } else if (this.inMatch && this.director.phase !== 'COUNTDOWN') {
      this.ui.showScreen(SCREEN_HUD)
    } else if (this.inMatch) {
      this.ui.showScreen(SCREEN_HUD)
    }
    this.applyPauseState()
  }

  private toggleSound(): boolean {
    const muted = !this.storage.get().muted
    this.storage.update((data) => {
      data.muted = muted
    })
    this.audio.setUserMuted(muted)
    return muted
  }

  /** Ледовое Спасение: награда только за реально просмотренный ролик. */
  private async requestRevive(): Promise<void> {
    const rewarded = await this.platform.showRewarded('revive_second_chance')
    if (rewarded) {
      this.director.grantRevive()
      this.ui.showScreen(SCREEN_HUD)
    } else {
      this.director.declineRevive()
    }
  }

  private async claimTripleReward(): Promise<void> {
    const rewarded = await this.platform.showRewarded('multiply_match_rewards')
    if (!rewarded) return
    this.lastResult.trophies *= 3
    this.lastResult.coins *= 3
    this.storage.update((data) => {
      data.trophies += this.lastResult.trophies
      data.coins += this.lastResult.coins
    })
    this.submitLeaderboardScore()
  }

  private buyItem(kind: 'tube' | 'pilot' | 'trail', id: string): BuyResult {
    const catalog = kind === 'tube' ? TUBES : kind === 'pilot' ? PILOTS : TRAILS
    const item = catalog.find((entry) => entry.id === id)
    if (!item) return 'owned'
    const data = this.storage.get()
    const list = kind === 'tube' ? data.unlockedTubes : kind === 'pilot' ? data.unlockedPilots : data.unlockedTrails
    if (list.includes(id)) return 'owned'
    if (data.trophies < item.price) return 'poor'
    this.storage.update((save) => {
      save.trophies -= item.price
      if (kind === 'tube') save.unlockedTubes.push(id)
      else if (kind === 'pilot') save.unlockedPilots.push(id)
      else save.unlockedTrails.push(id)
    })
    return 'ok'
  }

  private selectItem(kind: 'tube' | 'pilot' | 'trail', id: string): void {
    this.storage.update((save) => {
      if (kind === 'tube') save.selectedTube = id
      else if (kind === 'pilot') save.selectedPilot = id
      else save.selectedTrail = id
    })
  }

  private loadRemoteScores(): Promise<number[] | null> {
    if (!this.platform.capabilities().leaderboard) return Promise.resolve(null)
    return bridge.leaderboards
      .getEntries('trophies_global')
      .then((entries) => entries.map((entry) => entry.score))
      .catch(() => null)
  }

  private submitLeaderboardScore(): void {
    if (!this.platform.capabilities().leaderboard) return
    try {
      void bridge.leaderboards.setScore('trophies_global', this.storage.get().trophies)
    } catch {
      // Нет площадки — некуда отправлять.
    }
  }

  // ── Жизненный цикл ─────────────────────────────────────────────────────

  private subscribeLifecycle(): void {
    this.bus.on('platform:pause', ({ value }) => {
      this.pausedByPlatform = value === 'PAUSED'
      this.applyPauseState()
      if (value === 'RESUMED') this.loop?.resetDelta()
    })

    document.addEventListener('visibilitychange', () => {
      // Вкладка без площадки тоже обязана ставить игру на паузу.
      if (document.visibilityState === 'hidden') {
        this.pausedByPlatform = true
      } else {
        this.pausedByPlatform = false
        this.loop?.resetDelta()
      }
      this.applyPauseState()
    })

    window.addEventListener('pointerdown', this.unlockAudioOnce)
    window.addEventListener('keydown', this.unlockAudioOnce)
    this.input.onFirstGesture = () => {
      this.audio.unlock()
      window.removeEventListener('pointerdown', this.unlockAudioOnce)
      window.removeEventListener('keydown', this.unlockAudioOnce)
    }

    this.bus.on('match:over', (payload) => {
      this.lastResult = { trophies: payload.trophies, coins: payload.coins }
      this.storage.update((data) => {
        data.trophies += payload.trophies
        data.coins += payload.coins
        data.matchesPlayed++
        const score = Math.round(payload.trophies + payload.coins / 2)
        data.localScores.push(score)
        data.localScores.sort((a, b) => b - a)
        data.localScores.length = Math.min(data.localScores.length, 10)
      })
      this.submitLeaderboardScore()
      this.platform.armInterstitial()
      window.setTimeout(() => this.ui.showScreen(SCREEN_RESULTS), 900)
    })

    this.bus.on('revive:offer', () => {
      this.ui.showScreen(SCREEN_REVIVE)
    })

    this.bus.on('hud:survivors', ({ count }) => {
      if (count <= 1 && this.entities.player.alive && this.director.phase === 'PLAYING') {
        this.audio.coin()
      }
    })
    this.bus.on('tube:killed', ({ byPlayer }) => {
      this.audio.splash()
      if (byPlayer) this.audio.coin()
    })
    this.bus.on('arena:collapse', () => {
      this.audio.crack()
      this.sceneManager.triggerShake(0.6)
    })
    this.bus.on('match:phase', ({ value }) => {
      if (value === 'COUNTDOWN') this.audio.countdownBeep(false)
      if (value === 'ROUND_OVER') this.audio.setEngineActive(false, 0)
    })
    this.bus.on('revive:used', ({ ok }) => {
      if (ok) this.audio.coin()
    })
  }

  private unlockAudioOnce = (): void => {
    this.audio.unlock()
    window.removeEventListener('pointerdown', this.unlockAudioOnce)
    window.removeEventListener('keydown', this.unlockAudioOnce)
  }

  private applyPauseState(): void {
    const shouldRun = !this.pausedByPlatform && !this.pausedByPlayer
    if (shouldRun && !this.loop.isRunning) {
      this.loop.resetDelta()
      this.loop.start()
    } else if (!shouldRun && this.loop.isRunning) {
      this.loop.stop()
    }
  }

  // ── Кадр ───────────────────────────────────────────────────────────────

  private update(dt: number): void {
    const timeSec = performance.now() / 1000
    const player = this.entities.player
    const playing = this.director.phase === 'PLAYING'

    if (this.input.consumePause()) this.setPaused(!this.pausedByPlayer)

    // Ввод игрока до физики.
    if (playing && player.alive && !this.pausedByPlayer) {
      this.input.getMoveAxis(this.axisBuffer)
      player.input.throttle = this.axisBuffer.y
      player.input.steer = this.axisBuffer.x
      player.input.boost = this.input.isBoostHeld()
      if (this.input.consumeRebound()) player.triggerRebound(timeSec)
    } else {
      player.input.throttle = 0
      player.input.steer = 0
      player.input.boost = false
    }

    if (this.pausedByPlayer || this.pausedByPlatform) return

    // Hitstop: короткая заморозка мира при сильном ударе.
    const scaledDt = this.collisions.consumeHitstop(dt)
    if (scaledDt <= 0) {
      this.sceneManager.updateCamera(
        player.body?.translation().x ?? 0,
        player.body?.translation().z ?? 0,
        player.boosting,
        !this.inMatch,
        dt,
      )
      return
    }

    this.bots.update(scaledDt)
    for (let i = 0; i < this.entities.tubes.length; i++) {
      const tube = this.entities.tubes[i]
      if (tube.alive) tube.update(scaledDt)
    }
    this.physics.step()
    this.collisions.decayShake(scaledDt)
    this.arena.update(scaledDt, this.entities)
    this.director.update(scaledDt)

    // Синхронизация мешей ПОСЛЕ шага мира.
    this.sceneManager.syncAfterPhysics(this.entities, this.arena, scaledDt)
    this.sceneManager.updateCamera(
      player.body?.translation().x ?? 0,
      player.body?.translation().z ?? 0,
      player.boosting,
      !this.inMatch,
      dt,
    )

    // HUD-состояния.
    this.bus.emit('hud:nitro', { ratio: player.boostFuel / 100 })
    this.bus.emit('hud:mass', { kilograms: player.massKg })
    let mask = 0
    const plates = this.arena.plates
    for (let i = 0; i < plates.length; i++) {
      if (!plates[i].sunk && !plates[i].sinking) mask |= 1 << i
    }
    this.bus.emit('hud:radar', { mask })

    // Звук форсажа и музыка.
    this.audio.setEngineActive(player.alive && player.boosting, player.boostFuel / 100)
    this.audio.updateMusic(dt, this.inMatch && playing && !this.pausedByPlayer)

  }

  private render(): void {
    const frameStart = performance.now()
    this.sceneManager.render(performance.now() / 1000)
    this.sceneManager.adaptQuality(performance.now() - frameStart)
  }

  dispose(): void {
    this.loop.stop()
    this.input.dispose()
    this.ui.dispose()
    this.sceneManager.dispose()
    this.audio.dispose()
    this.entities.dispose()
    this.arena.dispose()
  }
}
