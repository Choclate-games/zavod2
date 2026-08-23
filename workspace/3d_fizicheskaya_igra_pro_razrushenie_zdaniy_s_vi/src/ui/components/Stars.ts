import { el } from './Button'

export class Stars {
  readonly root: HTMLElement
  private lastCount = -1

  constructor() {
    this.root = el('div', 'stars')
    for (let i = 0; i < 3; i++) {
      const holder = el('span')
      holder.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#icon-star"></use></svg>'
      this.root.appendChild(holder)
    }
  }

  set(count: number): void {
    const clamped = Math.min(3, Math.max(0, count))
    if (clamped === this.lastCount) return
    this.lastCount = clamped
    const holders = this.root.children
    for (let i = 0; i < holders.length; i++) {
      holders[i]?.classList.toggle('stars__lit', i < clamped)
    }
  }

  setStatic(count: number): void {
    this.set(count)
    this.lastCount = -1
  }
}
