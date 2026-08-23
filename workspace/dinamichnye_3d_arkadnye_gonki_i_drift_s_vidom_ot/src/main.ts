import './ui/theme.css'
import { Game } from './core/Game'
import { InputRouter } from './core/InputRouter'
import { PlaygamaService } from './platform/PlaygamaService'
import { StorageService } from './platform/StorageService'
import { loadBalance } from './data/balance'
import { setLanguage, t } from './data/i18n'
import { TRACKS } from './data/tracks'
import { UiRoot } from './ui/UiRoot'
import type { UiController } from './ui/screens/controller'
import type { HudSnapshot } from './ui/Hud'

/**
 * Точка входа. Порядок загрузки строгий: страница → initialize() с таймаутом
 * → язык → тихий VK/OK → сохранение → выдача покупок → движок и UI → прогресс
 * до 100% → game_ready. Ни один шаг не ждёт решения игрока.
 */
async function bootstrap(): Promise<void> {
  const platform = new PlaygamaService()
  const canvasParent = document.getElementById('app') as HTMLElement

  const splash = new SplashStub()
  let emitProgress: ((percent: number) => void) | null = null
  const progress = (percent: number): void => {
    splash.setProgress(percent)
    emitProgress?.(percent)
  }

  platform.init((p) => progress(p)).catch(() => {})
  setLanguage(platform.getLanguage())

  await loadBalance()
  progress(15)

  await Game.preparePhysics()
  progress(40)

  let schemeChangedBy: ((scheme: 'desktop' | 'touch') => void) | null = null
  const input = new InputRouter((scheme) => schemeChangedBy?.(scheme))
  input.resolveInitialScheme(platform.getDeviceType())
  input.attach()

  const storage = new StorageService(platform)
  await storage.load()
  progress(60)

  await platform.restorePurchases((productId) => {
    if (productId === 'titan_tanker') {
      storage.get().tankerRunsLeft = 3
      storage.save()
    }
  })

  const game = new Game(canvasParent, input, storage)
  game.loop.start()

  let reviveUsedThisRun = false
  let lastResultWin = false
  let leavingResults = false

  const ui = new UiRoot(
    game.bus,
    input,
    buildController(),
    storage,
    { leaderboardsSupported: true, rewardedSupported: platform.getCaps().rewarded },
    {
      get current() {
        return game.currentVehicle
      },
    },
    () => onPauseClicked(),
    () => {
      const v = game.currentVehicle
      if (!v) return { x: 0, z: 0 }
      const p = v.position()
      return { x: p.x, z: p.z }
    },
    () => game.activeTrack?.centerX ?? null,
    () => game.activeTrack?.centerZ ?? null,
  )
  progress(80)
  emitProgress = (percent) => game.bus.emit('boot:progress', percent)
  splash.remove()
  schemeChangedBy = (scheme) => game.bus.emit('scheme:changed', scheme)

  // HUD: закэшированные узлы, запись только при изменении значения
  const snapshot: HudSnapshot = {
    speedKmh: 0, rollDeg: 0, sloshShift: 0, volumeRatio: 1,
    multiplier: 1, timeS: 0, checkpoint: 0, driftTotal: 0, turboCharge: 0,
  }
  game.hudFrameCallback = () => {
    if (game.state !== 'racing' && game.state !== 'countdown' && game.state !== 'paused') return
    const race = game.activeRace
    if (!race) return
    const tel = game.telemetryRef
    snapshot.speedKmh = tel.speedKmh
    snapshot.rollDeg = tel.rollDeg
    snapshot.sloshShift = Math.max(-1, Math.min(1, Math.sin(race.driftChain * 0.13)))
    snapshot.volumeRatio = race.volumeL / race.startVolume()
    snapshot.multiplier = race.edgeMultiplier
    snapshot.timeS = race.time
    snapshot.checkpoint = race.checkpointIndex + 1
    snapshot.driftTotal = race.driftBank + race.driftChain
    snapshot.turboCharge = game.currentVehicle?.turboCharge ?? 0
    ui.hud.update(snapshot, 1 / 60)
  }

  game.countdownTickCallback = (remaining) => {
    if (remaining <= 0) {
      ui.showToast(t('track.go'))
      game.audio.countdownTick(true)
    } else {
      ui.showToast(String(remaining))
      game.audio.countdownTick(false)
    }
  }
  game.wrongWayCallback = () => ui.showToast(t('toast.wrongWay'))

  game.bus.on('vehicle:crashed', ({ reason }) => {
    game.markCrashed()
    ui.crash.show(reason)
    ui.showScreenByName('crash')
  })

  game.bus.on('race:finished', (result) => {
    game.markResults()
    lastResultWin = result.win
    leavingResults = true
    ui.results.show(result, game.trackDefIndex + 1 < TRACKS.length)
    platform.armInterstitial()
    ui.showScreenByName('results')
  })

  platform.onPause((paused) => {
    game.onPlatformPause(paused)
  })
  platform.onAudioState((enabled) => game.audio.setPlatformAudio(enabled))
  game.audio.setPlayerMuted(storage.get().settingsMuted)
  game.audio.setVolume(storage.get().settingsVolume)

  // ── первый открытый перевал и меню поверх живой сцены ──────────────────
  let unlocked = 0
  for (let i = TRACKS.length - 1; i >= 0; i--) {
    if (storage.get().unlockedMask & (1 << i)) unlocked = i
  }
  game.loadTrack(unlocked)
  ui.router.show('menu')

  progress(100)
  ui.hideSplash()
  platform.markGameLoaded()

  function onPauseClicked(): void {
    if (game.state !== 'racing' && game.state !== 'countdown') return
    game.setPaused(true)
    ui.showScreenByName('pause')
  }

  function startTrack(index: number): void {
    const mask = storage.get().unlockedMask
    if (!(mask & (1 << index))) return
    reviveUsedThisRun = false
    leavingResults = false
    game.loadTrack(index)
    game.beginCountdown()
    ui.hud.resetTimer()
    ui.showScreenByName('hud')
  }

  function showResultsInterstitial(): void {
    if (!leavingResults) return
    leavingResults = false
    platform.tryShowInterstitial('run_end')
  }

  function buildController(): UiController {
    return {
      startTrack,
      openTrackSelect: () => {
        showResultsInterstitial()
        game.enterShowcase()
        ui.router.show('trackSelect')
      },
      resume: () => {
        game.setPaused(false)
        ui.showScreenByName('hud')
      },
      restartRun: () => {
        showResultsInterstitial()
        game.setPaused(false)
        reviveUsedThisRun = false
        game.beginCountdown()
        ui.hud.resetTimer()
        ui.showScreenByName('hud')
      },
      toMenu: () => {
        showResultsInterstitial()
        game.toMenu()
        ui.router.show('menu')
      },
      toggleSound: () => {
        const save = storage.get()
        save.settingsMuted = !save.settingsMuted
        storage.save()
        game.audio.setPlayerMuted(save.settingsMuted)
        return save.settingsMuted
      },
      openLeaderboard: () => {
        let total = 0
        for (const def of TRACKS) total += storage.get().starsByTrack[def.id] ?? 0
        void platform.submitLeaderboardTotalStars(total)
        ui.showToast(t('toast.saved'))
      },
      reviveForAd: () => {
        void platform.showRewarded('revive_checkpoint').then((granted) => {
          if (!granted || reviveUsedThisRun) {
            if (!granted) ui.showToast(t('toast.adFail'))
            return
          }
          reviveUsedThisRun = true
          game.markReviveUsed()
          game.activeRace?.respawnAtCheckpoint()
          game.resumeFromCrash()
          ui.showScreenByName('hud')
        })
      },
      reviveAvailableCheck: () => !reviveUsedThisRun,
      doubleReward: () => {
        void platform.showRewarded('double_reward').then((granted) => {
          if (!granted) {
            ui.showToast(t('toast.adFail'))
            return
          }
          const id = TRACKS[game.trackDefIndex].id
          const save = storage.get()
          save.bestScores[id] = Math.round((save.bestScores[id] ?? 0) * 2)
          storage.save()
          ui.results.markDoubled()
          ui.showToast(t('results.doubled'))
        })
      },
      resultsPrimary: () => {
        showResultsInterstitial()
        if (lastResultWin && game.trackDefIndex + 1 < TRACKS.length) {
          startTrack(game.trackDefIndex + 1)
        } else {
          reviveUsedThisRun = false
          game.beginCountdown()
          ui.hud.resetTimer()
          ui.showScreenByName('hud')
        }
      },
    }
  }
}

/** Минимальная заставка на самый первый кадр, до создания UiRoot. */
class SplashStub {
  private element: HTMLElement | null = null
  private fill: HTMLElement | null = null

  private ensure(): void {
    if (this.element) return
    this.element = document.createElement('div')
    this.element.className = 'loading-screen'
    this.element.innerHTML =
      '<div class="loading-title">Ледяной Экспресс</div>' +
      '<div class="loading-bar"><div class="loading-bar-fill"></div></div>'
    this.fill = this.element.querySelector<HTMLElement>('.loading-bar-fill')
    document.body.appendChild(this.element)
  }

  setProgress(percent: number): void {
    this.ensure()
    this.fill?.style.setProperty('transform', `scaleX(${(percent / 100).toFixed(3)})`)
  }

  remove(): void {
    this.element?.remove()
    this.element = null
  }
}

bootstrap().catch((error) => {
  console.error(String(error))
})
