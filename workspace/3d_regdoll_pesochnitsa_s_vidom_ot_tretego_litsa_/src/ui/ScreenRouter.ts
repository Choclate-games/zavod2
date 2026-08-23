export interface Screen {
  readonly root: HTMLElement
  readonly name: string
}

/**
 * Экраны как автомат: один видимый, один общий переход. Корень каждого экрана
 * вставляется в слой при регистрации — созданный, но не вставленный экран
 * игрок никогда не увидит. Скрытый экран снимается из потока display: none,
 поэтому его прежние точки клика ничего не ловят.
 */
export class ScreenRouter {
  private readonly screens = new Map<string, Screen>()
  private current: Screen | null = null

  constructor(private readonly layer: HTMLElement) {}

  register(screen: Screen): void {
    this.screens.set(screen.name, screen)
    screen.root.hidden = true
    this.layer.appendChild(screen.root)
  }

  show(name: string): void {
    const next = this.screens.get(name)
    if (!next || this.current === next) return
    if (this.current) this.current.root.hidden = true
    this.current = next
    next.root.hidden = false
    // Один переход на всю игру: класс пересоздаётся, чтобы анимация сыграла.
    next.root.classList.remove('screen-enter')
    void next.root.offsetWidth
    next.root.classList.add('screen-enter')
  }

  hideAll(): void {
    if (this.current) this.current.root.hidden = true
    this.current = null
  }
}
