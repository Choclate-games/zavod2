import { applyTranslations, t } from './lang.js'

/**
 * Роутер экранов: корень каждого экрана вставлен в слой при регистрации,
 * скрытый экран получает display:none и не ловит нажатия.
 */

export type ScreenName = 'menu' | 'hud' | 'result' | 'workshop'

interface ScreenEntry {
  root: HTMLElement
}

export class ScreenRouter {
  private readonly layer: HTMLElement
  private readonly screens = new Map<ScreenName, ScreenEntry>()
  private current: ScreenName | null = null

  constructor(host: HTMLElement) {
    this.layer = document.createElement('div')
    this.layer.id = 'ui'
    host.appendChild(this.layer)
  }

  register(name: ScreenName, root: HTMLElement): void {
    root.classList.add('screen')
    root.hidden = true
    this.layer.appendChild(root)
    this.screens.set(name, { root })
  }

  show(name: ScreenName): void {
    if (this.current === name) {
      const entry = this.screens.get(name)
      if (entry) entry.root.hidden = false
      return
    }
    for (const [key, entry] of this.screens) {
      entry.root.hidden = key !== name
      if (key === name) applyTranslations(entry.root)
    }
    this.current = name
    document.title = `${t('game.title')}: ${t('game.subtitle')}`
  }

  hideAll(): void {
    for (const entry of this.screens.values()) entry.root.hidden = true
    this.current = null
  }

  get activeScreen(): ScreenName | null {
    return this.current
  }

  /** Слой, в который вставляются корни экранов и тач-управление. */
  layerHost(): HTMLElement {
    return this.layer
  }

  isScreenVisible(name: ScreenName): boolean {
    const entry = this.screens.get(name)
    return Boolean(entry && !entry.root.hidden)
  }
}
