import { bus } from '../../core/eventBus.js'
import { t } from '../../core/i18n.js'
import { el, withIcon } from '../components/dom.js'

interface MenuState {
  canResume: boolean
  pass: number
  unlocked: number
  best: number
  muted: boolean
}

/** Главное меню поверх живой сцены: имя игры, единственное главное действие,
 * второстепенный ряд одним весом. */
export class MainMenuScreen {
  readonly root: HTMLElement
  private subtitle = el('p', 'screen-subtitle')
  private playBtn = el('button', 'btn primary')
  private resumeBtn = el('button', 'btn')
  private soundBtn: HTMLButtonElement
  private statsLine = el('p', 'hint-line')
  private canResume = false

  constructor() {
    this.root = el('div')
    this.root.classList.add('menu-root')

    const head = el('div', 'screen-head title-block')
    const title = el('h1', 'screen-title', t('app.title'))
    head.appendChild(title)
    head.appendChild(this.subtitle)
    this.root.appendChild(head)

    const actions = el('div', 'menu-actions')
    this.playBtn.type = 'button'
    this.playBtn.addEventListener('click', () => {
      bus.emit('game:start', { pass: this.lastPass })
    })
    this.resumeBtn.type = 'button'
    this.resumeBtn.addEventListener('click', () => bus.emit('game:resume'))
    actions.appendChild(this.playBtn)
    actions.appendChild(this.resumeBtn)
    actions.appendChild(this.statsLine)
    this.root.appendChild(actions)

    const secondary = el('div', 'secondary-row')
    this.soundBtn = withIcon('icon-btn', 'sound', t('menu.sound.on'))
    this.soundBtn.addEventListener('click', () => {
      this.muted = !this.muted
      bus.emit('sound:mute', { muted: this.muted })
    })
    secondary.appendChild(this.soundBtn)
    this.hintDesktop = el('p', 'hint-line', t('menu.hint.desktop'))
    this.hintTouch = el('p', 'hint-line', t('menu.hint.touch'))
    secondary.appendChild(this.hintDesktop)
    secondary.appendChild(this.hintTouch)
    this.root.appendChild(secondary)

    bus.on('menu:state', (payload) => this.applyState(payload as unknown as MenuState))
    bus.on('input:mode', () => this.refreshHints())
  }

  private lastPass = 1
  private muted = false
  private hintDesktop: HTMLElement
  private hintTouch: HTMLElement

  private applyState(state: MenuState): void {
    this.canResume = state.canResume
    this.lastPass = Math.min(state.pass, state.unlocked)
    this.subtitle.textContent = t('menu.subtitle', { n: this.lastPass })
    this.statsLine.textContent =
      `${t('menu.unlocked', { n: state.unlocked })} · ${t('menu.best', { n: state.best })}`
    this.resumeBtn.style.display = state.canResume ? '' : 'none'
    this.muted = state.muted
    this.refreshSoundIcon()
    this.refreshHints()
  }

  private refreshSoundIcon(): void {
    const name = this.muted ? 'mute' : 'sound'
    this.soundBtn.innerHTML = `<svg viewBox="0 0 24 24"><use href="#icon-${name}"></use></svg>`
    this.soundBtn.setAttribute('aria-label', this.muted ? t('menu.sound.off') : t('menu.sound.on'))
  }

  /** Подсказки соответствуют активной схеме управления. */
  refreshHints(): void {
    void this.canResume
    const touchActive = document.querySelector('.touch-layer:not(.hidden)') !== null
    this.hintDesktop.style.display = touchActive ? 'none' : ''
    this.hintTouch.style.display = touchActive ? '' : 'none'
  }
}
