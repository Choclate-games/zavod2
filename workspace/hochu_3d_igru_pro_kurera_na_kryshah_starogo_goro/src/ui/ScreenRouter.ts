import { events } from '../core/EventBus'
import type { GameState } from '../core/types'

export interface ScreenView {
  root: HTMLElement
  show: () => void
  hide: () => void
}

export class ScreenRouter {
  private current: string | null = null
  private views = new Map<string, ScreenView>()

  public register(id: string, view: ScreenView): void {
    this.views.set(id, view)
  }

  public async go(id: string): Promise<void> {
    if (id === this.current) return

    const prev = this.current ? this.views.get(this.current) : null
    const next = this.views.get(id)
    if (!next) {
      console.warn(`[ScreenRouter] Unknown screen: ${id}`)
      return
    }

    if (prev) {
      prev.root.classList.add('is-leaving')
      await new Promise((resolve) => setTimeout(resolve, 200))
      prev.hide()
      prev.root.classList.remove('is-leaving')
    }

    this.current = id
    next.show()
    next.root.classList.remove('is-leaving')
  }

  public getCurrent(): string | null {
    return this.current
  }

  public handleGameStateChange(state: GameState): void {
    switch (state) {
      case 'BOOT':
        this.go('splash')
        break
      case 'MENU':
        this.go('main_menu')
        break
      case 'PLAYING':
        this.go('gameplay_hud')
        break
      case 'PAUSED':
        // HUD remains visible, modal displays
        break
      case 'VICTORY':
        this.go('victory_screen')
        break
      case 'DEFEAT':
        this.go('defeat_screen')
        break
      case 'WORKSHOP':
        this.go('workshop')
        break
      default:
        break
    }
  }
}
