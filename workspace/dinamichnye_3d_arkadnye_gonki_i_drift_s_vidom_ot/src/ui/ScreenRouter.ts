import type { EventBus } from '../core/EventBus'

/**
 * Роутер экранов-автомат: зарегистрированный экран вставляется в слой сразу,
 * виден ровно один, скрытый уходит из потока нажатий (display:none), переход
 * один на всю игру и укладывается в 300 мс.
 */
export class ScreenRouter {
  private readonly screens = new Map<string, HTMLElement>()
  private currentName: string | null = null

  constructor(
    private readonly container: HTMLElement,
    private readonly bus: EventBus,
  ) {}

  get screenCount(): number {
    return this.screens.size
  }

  get current(): string | null {
    return this.currentName
  }

  register(name: string, root: HTMLElement): void {
    root.classList.add('screen')
    this.screens.set(name, root)
    this.container.appendChild(root)
  }

  show(name: string): void {
    if (this.currentName === name) return
    const previous = this.currentName !== null ? this.screens.get(this.currentName) : null
    const next = this.screens.get(name)
    if (!next) return
    if (previous) {
      previous.classList.add('leaving')
      window.setTimeout(() => {
        previous.classList.remove('active', 'leaving')
      }, 280)
    }
    next.classList.remove('leaving')
    next.classList.add('active')
    this.currentName = name
    this.bus.emit('screen:changed', name)
  }
}
