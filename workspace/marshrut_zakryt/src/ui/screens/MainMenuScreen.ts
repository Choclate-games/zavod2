import type { SaveData } from '../../platform/StorageService'

/**
 * Главное меню: заголовок, лучшее время доставки и главное действие —
 * «Начать доставку». Лежит поверх живой сцены; фон только под текстом.
 */
export class MainMenuScreen {
  readonly root: HTMLElement
  private readonly subtitle: HTMLElement
  private save: SaveData | null = null

  constructor(onStart: () => void) {
    this.root = document.createElement('div')
    this.root.className = 'screen screen--menu'

    const head = document.createElement('div')
    head.className = 'screen__head'

    const panel = document.createElement('div')
    panel.className = 'panel'

    const title = document.createElement('h1')
    title.className = 'screen__title'
    title.textContent = 'Курьерский прорыв'

    this.subtitle = document.createElement('p')
    this.subtitle.className = 'screen__subtitle'
    this.subtitle.textContent = 'Лучшее время доставки: неизвестно'

    panel.append(title, this.subtitle)
    head.appendChild(panel)

    const primary = document.createElement('button')
    primary.type = 'button'
    primary.className = 'btn btn--primary'
    primary.setAttribute('data-action', 'start-contract')
    primary.addEventListener('click', onStart)

    const secondary = document.createElement('button')
    secondary.type = 'button'
    secondary.className = 'btn btn--secondary'
    secondary.setAttribute('data-action', 'toggle-sound')
    secondary.textContent = 'Звук'

    const primaryWrap = document.createElement('div')
    primaryWrap.className = 'screen__primary'
    primaryWrap.appendChild(primary)

    const secondaryWrap = document.createElement('div')
    secondaryWrap.className = 'screen__secondary'
    secondaryWrap.appendChild(secondary)

    this.root.append(head, primaryWrap, secondaryWrap)
  }

  show(): void {
    this.root.classList.add('is-visible')
  }

  hide(): void {
    this.root.classList.remove('is-visible')
  }

  setSave(save: SaveData): void {
    this.save = save
    const best = save.bestDeliveryTimeSec
    this.subtitle.textContent =
      best == null ? 'Лучшее время доставки: неизвестно' : `Лучшее время доставки: ${best.toFixed(1)} c`
  }

  getSave(): SaveData | null {
    return this.save
  }
}
