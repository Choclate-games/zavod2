import './ui/theme.css'
import { playgamaService } from './platform/PlaygamaService'
import { storageService } from './platform/StorageService'
import { Game } from './core/Game'
import { audioManager } from './audio/AudioManager'

let isBootFinished = false

async function bootstrap(): Promise<void> {
  // 1. Initialize Platform Bridge
  playgamaService.setProgress(15)
  await playgamaService.initialize()

  // 2. Load Save State
  playgamaService.setProgress(40)
  const savedData = await storageService.load()
  audioManager.setMuted(savedData.soundMuted)

  // 3. Build Engine, Physics & UI
  playgamaService.setProgress(70)
  const game = new Game()
  await game.init()

  // 4. Progress reaches 100%
  playgamaService.setProgress(100)
  await new Promise((r) => setTimeout(r, 300))

  // 5. Send Game Ready single-shot
  isBootFinished = true
  playgamaService.sendGameReady()

  // 6. Request sticky banner if supported
  playgamaService.showBanner()
}

// Watchdog timer (15 seconds) to ensure platform signal is always sent
const watchdog = setTimeout(() => {
  if (!isBootFinished) {
    console.warn('Boot watchdog fired — forcing ready signal')
    playgamaService.sendGameReady()
    playgamaService.showBanner()
  }
}, 15_000)

bootstrap()
  .then(() => {
    clearTimeout(watchdog)
  })
  .catch((err) => {
    console.error('Boot error:', err)
    if (!isBootFinished) {
      playgamaService.sendGameReady()
      playgamaService.showBanner()
    }
  })
