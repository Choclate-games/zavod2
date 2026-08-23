import { bus } from '../core/eventBus.js'

export type ScreenId = 'menu' | 'brief' | 'hud' | 'bulletcam' | 'victory' | 'defeat'

interface ScreenEntry {
  id: ScreenId
  root: HTMLElement
}

/** Экраны как автомат: виден ровно один, скрытый — display:none. */
export class ScreenRouter {
  private current: ScreenId | null = null
  private entries = new Map<ScreenId, ScreenEntry>()

  constructor(private layer: HTMLElement) {}

  register(id: ScreenId, root: HTMLElement): void {
    this.entries.set(id, { id, root })
    this.layer.appendChild(root)
    root.classList.add('screen')
  }

  show(id: ScreenId): void {
    if (this.current === id) return
    for (const [, entry] of this.entries) {
      const visible = entry.id === id
      entry.root.classList.toggle('visible', visible)
      entry.root.style.display = visible ? 'flex' : 'none'
    }
    this.current = id
    bus.emit('screen:changed', { id })
  }

  get active(): ScreenId | null {
    return this.current
  }
}
