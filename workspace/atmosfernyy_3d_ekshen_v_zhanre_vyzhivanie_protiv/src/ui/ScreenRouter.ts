/**
 * Роутер экранов: один видимый экран за раз, скрытый — display:none,
 * переход один на всю игру и короче 300 мс.
 */
export class ScreenRouter {
  private current: HTMLElement | null = null

  constructor(private readonly host: HTMLElement) {}

  register(screen: HTMLElement): void {
    screen.classList.add('screen')
    screen.style.display = 'none'
    this.host.appendChild(screen)
  }

  show(screen: HTMLElement): void {
    if (this.current === screen) return
    if (this.current) {
      this.current.classList.remove('is-active')
      this.current.style.display = 'none'
    }
    this.current = screen
    screen.style.display = ''
    // Двойной кадр: display успевает примениться до старта перехода.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => screen.classList.add('is-active')),
    )
  }

  hideAll(): void {
    if (this.current) {
      this.current.classList.remove('is-active')
      this.current.style.display = 'none'
    }
    this.current = null
  }

  get visible(): HTMLElement | null {
    return this.current
  }
}
