import type { EventBus } from '../core/EventBus'

export type ScreenName =
  | 'splash'
  | 'levelselect'
  | 'gameplay'
  | 'victory'
  | 'defeat'
  | 'pause'

type ScreenEntry = {
  root: HTMLElement
  layer: HTMLElement
  isModal: boolean
  onShow?: () => void
}

/**
 * Экраны как автомат: виден ровно один, скрытые — display:none через класс
 * screen--hidden-hard, поэтому их элементы не ловят нажатия.
 */
export class ScreenRouter {
  private readonly screens = new Map<ScreenName, ScreenEntry>()
  private current: ScreenName | null = null

  constructor(private readonly events: EventBus) {}

  register(
    name: ScreenName,
    root: HTMLElement,
    layer: HTMLElement,
    isModal = false,
    onShow?: () => void,
  ): void {
    root.classList.add('screen')
    if (isModal) {
      const backdrop = document.createElement('div')
      backdrop.className = 'modal-backdrop'
      const card = document.createElement('div')
      card.className = 'panel modal-card'
      while (root.firstChild) card.appendChild(root.firstChild)
      root.appendChild(backdrop)
      backdrop.appendChild(card)
      backdrop.classList.add('screen-host')
    }
    layer.appendChild(root)
    this.screens.set(name, { root, layer, isModal, onShow })
  }

  show(name: ScreenName): void {
    if (this.current === name) return
    for (const [entryName, entry] of this.screens) {
      if (entryName !== name) {
        entry.root.classList.remove('screen--visible')
        entry.root.classList.add('screen--hidden-hard')
      }
    }
    const next = this.screens.get(name)
    if (next) {
      next.root.classList.remove('screen--hidden-hard')
      // Класс видимости вешаем в следующем кадре, чтобы отыграл переход opacity.
      requestAnimationFrame(() => next.root.classList.add('screen--visible'))
      next.onShow?.()
    }
    this.current = name
    this.events.emit('screen:show', { name })
  }

  get active(): ScreenName | null {
    return this.current
  }
}
