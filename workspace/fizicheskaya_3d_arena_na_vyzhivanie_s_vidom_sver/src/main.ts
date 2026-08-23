import './ui/theme.css'
import { Game } from './core/Game'

/**
 * Bootstrap: каркас страницы, инициализация игры, запуск цикла.
 * Игра стартует и без площадки: мост не обязателен для локальной проверки.
 */
async function bootstrap(): Promise<void> {
  const container = document.getElementById('app')
  if (!container) throw new Error('не найден #app')

  const game = new Game(container)
  await game.init()

  // Глобальные запреты браузерных жестов: страница не скроллится,
  // контекстное меню не открывается.
  document.addEventListener('contextmenu', (event) => event.preventDefault())
  document.addEventListener('dragstart', (event) => event.preventDefault())
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault()
    },
    { passive: false },
  )
}

void bootstrap().catch((error) => {
  console.error('Ошибка запуска игры:', error)
})
