// Bootstrap: мост площадки -> язык -> сохранение -> движок и UI ->
// прогресс до 100% -> сигнал готовности площадке -> живой цикл.

import { Game } from './core/Game'
import { EventBus } from './core/EventBus'
import { PlaygamaService } from './platform/PlaygamaService'
import { StorageService } from './platform/StorageService'
import { AudioManager } from './audio/AudioManager'
import { InputRouter } from './input/InputRouter'
import { createCanvas } from './ui/components'
import { type UiCallbacks, UiRoot } from './ui/UiRoot'
import { setLanguage } from './i18n/messages'

async function boot(): Promise<void> {
  const bus = new EventBus()
  const audio = new AudioManager(bus)
  const platform = new PlaygamaService(bus)
  const storage = new StorageService(platform)

  // Мост инициализируется с таймаутом; сторожевой таймер внутри сервиса
  // гарантирует, что сигнал готовности уйдёт даже при зависшей загрузке.
  await platform.initialize()
  setLanguage(platform.language)
  const save = await storage.load()
  audio.setPlayerMuted(!save.soundOn)

  const canvas = createCanvas()
  const input = new InputRouter(canvas)
  input.sensitivity = save.sensitivity

  let game: Game | null = null
  const callbacks: UiCallbacks = {
    onStart: () => {
      audio.ensureStarted()
      game?.startRaid()
    },
    onResume: () => game?.resumeRaid(),
    onRestart: () => {
      audio.ensureStarted()
      game?.startRaid()
    },
    onToMenu: () => game?.toMenu(),
    onToggleSound: () => {
      const muted = !audio.playerMuted
      audio.setPlayerMuted(muted)
      storage.update({ soundOn: !muted })
      return muted
    },
    onChangeSensitivity: (value) => {
      input.sensitivity = value
      storage.update({ sensitivity: value })
    },
    getSensitivity: () => input.sensitivity,
    onVictoryAgain: () => {
      platform.maybeShowInterstitial()
      audio.ensureStarted()
      game?.startRaid()
    },
    onRevive: () => game?.requestRevive(),
  }

  const ui = new UiRoot(canvas, input, callbacks)
  ui.showLoading()
  ui.setLoadingProgress(0.35)

  game = new Game(ui, input, audio, platform, storage, {
    onVictory: () => undefined,
    onDefeat: () => undefined,
    onRevived: () => undefined,
    onScoreChanged: () => undefined,
  })
  input.applyDevice(platform.deviceKind)

  ui.setMainMenuBest(storage.data.bestScore)
  ui.show('MAIN_MENU')
  ui.setLoadingProgress(1)
  platform.sendReady()
  ui.hideLoading()

  window.addEventListener('beforeunload', () => storage.flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      storage.flush()
      audio.suspendOnBlur()
    }
  })

  game.start()
}

void boot().catch((error: unknown) => {
  // ошибка бутстрапа не глотается: она обязана дойти до консоли площадки
  console.error('boot failed', error)
})
