import type { GameState } from '../core/Game'

/**
 * Экран как автомат: один видимый, скрытый — display:none.
 * Каждый экран вставляет свой корень в слой при регистрации.
 */
export interface Screen {
  readonly root: HTMLElement
  show(): void
  hide(): void
}

export class ScreenRouter {
  private readonly container: HTMLElement
  private readonly screens = new Map<GameState, Screen>()
  private current: GameState | null = null

  constructor(container?: HTMLElement) {
    this.container = container ?? document.createElement('div')
  }

  getContainer(): HTMLElement {
    return this.container
  }

  register(state: GameState, screen: Screen): void {
    if (screen.root.parentElement !== this.container) this.container.appendChild(screen.root)
    screen.hide()
    this.screens.set(state, screen)
  }

  show(state: GameState): void {
    const next = this.screens.get(state)
    if (!next) return
    for (const [key, screen] of this.screens) {
      if (key !== state) screen.hide()
    }
    next.show()
    this.current = state
  }

  /** Скрыть все экраны (игровой процесс без оверлеев). */
  hideAll(): void {
    for (const screen of this.screens.values()) screen.hide()
    this.current = null
  }

  getCurrent(): GameState | null {
    return this.current
  }
}
