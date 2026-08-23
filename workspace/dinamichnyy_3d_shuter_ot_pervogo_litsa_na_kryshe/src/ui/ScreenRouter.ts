// Экраны как автомат: один видимый экран, общий переход <=300 мс.
// Скрытый экран получает display:none и не ловит нажатия.

export type ScreenName = 'MAIN_MENU' | 'HUD_INGAME' | 'PAUSE_MODAL' | 'VICTORY_SCREEN' | 'DEFEAT_MODAL'

export class ScreenRouter {
  private readonly roots = new Map<ScreenName, HTMLElement>()
  private current: ScreenName | null = null
  private readonly container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
  }

  /** Корень вставляется в слой при регистрации: сколько экранов — столько детей. */
  register(name: ScreenName, root: HTMLElement): void {
    root.classList.add('screen')
    if (this.current !== name) root.classList.add('hidden')
    this.container.appendChild(root)
    this.roots.set(name, root)
  }

  show(name: ScreenName): void {
    if (this.current === name) return
    const previous = this.current != null ? this.roots.get(this.current) : undefined
    if (previous != null) {
      previous.classList.add('hidden')
      previous.style.opacity = '0'
    }
    const next = this.roots.get(name)
    if (next == null) return
    next.classList.remove('hidden')
    next.style.transition = 'none'
    next.style.transform = 'scale(0.985)'
    requestAnimationFrame(() => {
      next.style.transition = `opacity var(--dur-screen) ease, transform var(--dur-screen) ease`
      next.style.opacity = '1'
      next.style.transform = 'none'
    })
    this.current = name
  }

  get active(): ScreenName | null {
    return this.current
  }
}
