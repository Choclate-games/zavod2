import { el } from './components/dom'

export interface Screen {
  readonly id: string
  readonly root: HTMLElement
}

/**
 * Экраны как автомат: зарегистрированы все, видим один. Скрытый экран получает
 * hidden (display:none через CSS) и не ловит ввод.
 */
export class ScreenRouter {
  private readonly registered = new Map<string, Screen>()
  private currentId: string | null = null

  constructor(private readonly container: HTMLElement) {}

  register(screen: Screen): void {
    if (this.registered.has(screen.id)) return
    screen.root.hidden = true
    this.container.appendChild(screen.root)
    this.registered.set(screen.id, screen)
  }

  show(id: string): void {
    if (id === this.currentId) return
    const previous = this.currentId ? this.registered.get(this.currentId) : undefined
    if (previous) previous.root.hidden = true
    const next = this.registered.get(id)
    if (!next) throw new Error(`Экран не зарегистрирован: ${id}`)
    next.root.hidden = false
    this.currentId = id
  }

  get current(): string | null {
    return this.currentId
  }
}

export function createScreen(id: string, ...children: HTMLElement[]): Screen & { root: HTMLDivElement } {
  const root = el('div', 'screen')
  root.dataset.screenId = id
  for (const child of children) root.appendChild(child)
  return { id, root }
}

export const SCREEN_IDS = {
  mainMenu: 'screen_main_menu',
  gameplayHud: 'screen_gameplay_hud',
  pause: 'screen_pause',
} as const
