/**
 * Роутер экранов: один видимый экран, скрытый — display: none.
 */

export interface Screen {
  readonly root: HTMLElement
  readonly id: string
}

export class ScreenRouter {
  private readonly screens = new Map<string, Screen>()
  private activeId: string | null = null

  register(screen: Screen): void {
    this.screens.set(screen.id, screen)
  }

  mountAll(parent: HTMLElement): void {
    for (const screen of this.screens.values()) {
      screen.root.classList.add('screen', 'hidden')
      parent.appendChild(screen.root)
    }
  }

  get count(): number {
    return this.screens.size
  }

  show(id: string): void {
    for (const [key, screen] of this.screens) {
      if (key === id) {
        screen.root.classList.remove('hidden')
        screen.root.style.opacity = '0'
        requestAnimationFrame(() => {
          screen.root.style.opacity = '1'
        })
      } else {
        // display: none: после перехода ни один элемент не ловит нажатие.
        screen.root.classList.add('hidden')
        screen.root.style.opacity = ''
      }
    }
    this.activeId = id
  }

  get active(): string | null {
    return this.activeId
  }

  hideAll(): void {
    for (const screen of this.screens.values()) screen.root.classList.add('hidden')
    this.activeId = null
  }
}
