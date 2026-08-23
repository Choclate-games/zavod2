import './ui/theme.css'
import { Game } from './core/Game'

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const appContainer = document.getElementById('app') as HTMLElement

  if (!canvas || !appContainer) {
    throw new Error('Missing #game-canvas or #app root element')
  }

  // Prevent context menu and selection
  document.addEventListener('contextmenu', (e) => e.preventDefault())
  document.addEventListener('selectstart', (e) => e.preventDefault())

  const game = new Game(canvas, appContainer)
  await game.init()
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('[Bootstrap] Game launch error:', err)
  })
})
