import './ui/theme.css'
import { Game } from './core/Game.js'
import type { RunSummary } from './core/EventBus.js'
import { EventBus } from './core/EventBus.js'
import { InputRouter } from './input/InputRouter.js'
import { PlaygamaService } from './platform/PlaygamaService.js'
import { StorageService } from './platform/StorageService.js'
import { detectLocale } from './ui/i18n.js'
import { UiRoot } from './ui/UiRoot.js'

async function run(): Promise<void> {
  const canvasHost = document.getElementById('scene-root') as HTMLElement
  const uiHost = document.getElementById('ui-root') as HTMLElement

  const events = new EventBus()
  const platform = new PlaygamaService(events)
  const storage = new StorageService(events)

  // Порядок загрузки: инициализация моста с таймаутом -> сохранение -> движок.
  await platform.initialize()
  platform.setLoadingProgress(0.4)

  await storage.load(async (key) => platform.readStored(key))
  platform.setLoadingProgress(0.7)

  const locale = detectLocale(null)
  const input = new InputRouter(events, platform.detectDeviceType(), uiHost, 0.0042)
  const game = new Game(canvasHost, input, platform, storage)
  // Аудиосостояние площадки приходит отдельным от мьюта игрока входом.
  platform.onAudioState = (muted) => game.audio.setPlatformMuted(muted)

  let lastSummary: RunSummary | null = null
  let scoreDoubled = false

  const ui = new UiRoot(
    uiHost,
    events,
    input,
    locale,
    {
      leaderboardSupported: platform.isLeaderboardSupported,
      rewardedSupported: platform.isRewardedSupported,
      soundMuted: storage.save.muted,
    },
    (action) => {
      switch (action) {
        case 'start':
          game.startRun()
          break
        case 'pause':
          if (game.state === 'PLAYING') game.setState('PAUSED')
          break
        case 'resume':
          game.setState('PLAYING')
          game.resumeFromPlatformPause()
          break
        case 'menu':
          game.enterMenu()
          ui.setMenuBest(storage.save.bestSurvivalTimeSec, storage.save.bestScore)
          break
        case 'menu-from-result':
          // Естественная пауза после забега: interstitial решается кликом здесь.
          game.consumeArmedInterstitial()
          game.enterMenu()
          ui.setMenuBest(storage.save.bestSurvivalTimeSec, storage.save.bestScore)
          break
        case 'restart-from-result':
          if (!game.consumeArmedInterstitial()) game.startRun()
          else window.setTimeout(() => game.startRun(), 400)
          break
        case 'sound': {
          const muted = !storage.save.muted
          storage.applyMute(muted)
          game.audio.setVolume(storage.save.volume)
          break
        }
        case 'revive':
          void platform.showRewarded('revive').then((granted) => {
            if (granted && !game.isReviveUsed) game.applyRevive()
          })
          break
        case 'double':
          void platform.showRewarded('double').then((granted) => {
            if (granted && lastSummary && !scoreDoubled) {
              scoreDoubled = true
              lastSummary.score *= 2
              void platform.submitScore(lastSummary.score)
              ui.showVictoryRefresh(lastSummary)
            }
          })
          break
        default:
          break
      }
    },
  )

  events.on('run:end', ({ summary }) => {
    lastSummary = summary
    scoreDoubled = false
    if (summary.victory) {
      ui.showVictoryRefresh(summary)
    } else {
      ui.showDefeatRefresh(summary)
    }
    ui.setMenuBest(storage.save.bestSurvivalTimeSec, storage.save.bestScore)
  })

  game.enterMenu()
  ui.setMenuBest(storage.save.bestSurvivalTimeSec, storage.save.bestScore)
  game.audio.setVolume(storage.save.volume)
  game.audio.setPlayerMuted(storage.save.muted)
  game.start()

  platform.setLoadingProgress(1)
  // Меню интерактивно: заставка площадки снимается ровно один раз.
  platform.sendReady()
}

void run()
