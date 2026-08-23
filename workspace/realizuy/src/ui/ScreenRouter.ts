export type ScreenId = 'menu' | 'game' | 'workbench' | 'pause' | 'victory' | 'defeat'

export interface ScreenView {
  root: HTMLElement
  show(): void
  hide(): void
}

export class ScreenRouter {
  private current: ScreenId | null = null
  private stack: ScreenId[] = []
  private views = new Map<ScreenId, ScreenView>()

  constructor(private readonly layer: HTMLElement) {}

  public register(id: ScreenId, view: ScreenView): void {
    this.views.set(id, view)
    view.root.classList.add('screen--hidden')
    this.layer.appendChild(view.root)
  }

  public async go(id: ScreenId, opts: { replace?: boolean } = {}): Promise<void> {
    if (id === this.current) return
    const prev = this.current ? this.views.get(this.current) : null
    const next = this.views.get(id)
    if (!next) throw new Error(`Unknown screen: ${id}`)

    if (prev) {
      prev.root.classList.add('is-leaving')
      await new Promise((r) => setTimeout(r, 250))
      prev.hide()
      prev.root.classList.remove('is-leaving')
      prev.root.classList.add('screen--hidden')
    }

    if (!opts.replace && this.current) {
      this.stack.push(this.current)
    }

    this.current = id
    next.root.classList.remove('screen--hidden')
    next.show()
  }

  public back(): void {
    const prev = this.stack.pop()
    if (prev) {
      this.go(prev, { replace: true })
    }
  }

  public getCurrent(): ScreenId | null {
    return this.current
  }
}
