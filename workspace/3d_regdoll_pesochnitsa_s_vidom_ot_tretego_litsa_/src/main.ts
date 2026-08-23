import { Game } from './Game.ts'
import { bootstrapPlatform } from './platform/PlaygamaService.ts'
import { bus } from './core/EventBus.ts'

async function main(): Promise<void> {
  const container = document.getElementById('app')
  if (!container) throw new Error('Не найден корневой контейнер #app')

  // Мост площадки инициализируется с таймаутом: блокировщик SDK не оставит
  // чёрный экран навсегда. Игра не ждёт от игрока никаких решений на старте.
  await bootstrapPlatform()
  bus.on('input:schemeChanged', () => { /* подписка в UiRoot; здесь только разогрев шины */ })

  const game = new Game()
  const watchdog = window.setTimeout(() => {
    // Watchdog загрузки: игра обязана показаться даже при упавшем шаге.
    console.error('Загрузка не уложилась в таймаут')
  }, 15_000)
  try {
    await game.boot(container)
    window.clearTimeout(watchdog)
  } catch (error) {
    console.error(error)
  }
  ;(window as unknown as { __game?: Game }).__game = game
}

void main()
