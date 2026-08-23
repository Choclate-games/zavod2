import { bus } from '../../core/eventBus.js'
import { t } from '../../core/i18n.js'
import { REWARDED_PLACEMENTS, type PlaygamaService } from '../../platform/PlaygamaService.js'
import { el, withIcon } from '../components/dom.js'

interface DefeatData {
  reason: 'timeout' | 'crossed' | 'outofammo'
  canGolden: boolean
  rewardedSupported: boolean
}

/** Причина срыва контракта и пути назад: ретрай, «Золотой Калибр» или меню. */
export class DefeatRetryScreen {
  readonly root: HTMLElement
  private subtitle = el('p', 'screen-subtitle')
  private goldenBtn = el('button', 'btn ghost', t('lose.golden'))
  private statusLine = el('p', 'status-line')

  constructor(private platform: PlaygamaService) {
    this.root = el('div')

    const head = el('div', 'screen-head title-block')
    head.appendChild(el('h2', 'screen-title', t('lose.title')))
    head.appendChild(this.subtitle)
    this.root.appendChild(head)

    const actions = el('div', 'menu-actions')
    this.goldenBtn.type = 'button'
    this.goldenBtn.addEventListener('click', () => {
      if (this.goldenInFlight || !this.canGoldenNow) return
      this.goldenInFlight = true
      this.platform.showRewarded(REWARDED_PLACEMENTS.extraAmmo, (granted) => {
        this.goldenInFlight = false
        if (!granted) {
          this.statusLine.textContent = t('ui.error.ad')
          this.statusLine.className = 'status-line error'
          return
        }
        bus.emit('reward:extraammo')
      })
    })
    actions.appendChild(this.goldenBtn)
    this.root.appendChild(actions)

    const secondary = el('div', 'secondary-row')
    const retryBtn = el('button', 'btn primary', t('lose.retry'))
    retryBtn.type = 'button'
    retryBtn.id = 'defeat-retry'
    retryBtn.addEventListener('click', () => bus.emit('game:retry'))
    const menuBtn = withIcon('icon-btn', 'mountain', t('ui.menu'))
    menuBtn.addEventListener('click', () => bus.emit('game:menu'))
    secondary.appendChild(retryBtn)
    secondary.appendChild(menuBtn)
    this.root.appendChild(secondary)
    this.root.appendChild(this.statusLine)

    bus.on('contract:lost', (payload) => this.apply(payload as unknown as DefeatData))
  }

  private goldenInFlight = false
  private canGoldenNow = false

  private apply(data: DefeatData): void {
    this.subtitle.textContent = t(`lose.${data.reason}`)
    this.canGoldenNow = data.canGolden && data.rewardedSupported
    // кнопка рисуется только когда награда реально доступна и уместна
    this.goldenBtn.style.display = this.canGoldenNow ? '' : 'none'
    this.statusLine.textContent = ''
  }
}
