/**
 * Роутер экранов: ровно один видимый экран, скрытый — display: none.
 * Каждый экран при регистрации вставляет свой корень в слой.
 */
export interface Screen {
  readonly name: string
  readonly root: HTMLElement
  onShow?(): void
  onHide?(): void
}

export class ScreenRouter {
  private readonly screens = new Map<string, Screen>()
  private current: Screen | null = null
  private layer: HTMLElement | null = null

  constructor(layer: HTMLElement | null = null) {
    this.layer = layer
  }

  /** Слой можно подключить после конструктора: роутер создаётся раньше слоёв. */
  attachLayer(layer: HTMLElement): void {
    this.layer = layer
    for (const screen of this.screens.values()) {
      if (screen.root.parentElement !== layer) layer.appendChild(screen.root)
    }
  }

  register(screen: Screen): void {
    if (this.screens.has(screen.name)) return
    screen.root.classList.add('screen')
    screen.root.classList.add('hidden-screen')
    this.layer?.appendChild(screen.root)
    this.screens.set(screen.name, screen)
  }

  show(name: string): void {
    const next = this.screens.get(name)
    if (!next || next === this.current) return
    if (this.current) {
      this.current.root.classList.add('hidden-screen')
      this.current.onHide?.()
    }
    this.current = next
    next.root.classList.remove('hidden-screen')
    next.onShow?.()
  }

  get activeName(): string | null {
    return this.current ? this.current.name : null
  }
}
