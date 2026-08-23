import { bus } from '../../core/eventBus.js'
import { formatNumber, t } from '../../core/i18n.js'
import { REWARDED_PLACEMENTS, type PlaygamaService } from '../../platform/PlaygamaService.js'
import { el, withIcon } from '../components/dom.js'

interface VictoryData {
  score: number
  stars: number
  massPct: number
  timeLeft: number
  ammoLeft: number
  doubled: boolean
}

/** Разбор выстрела: чистота контракта, звёзды, счёт и переход дальше. */
export class VictorySummaryScreen {
  readonly root: HTMLElement
  private starsRow = el('div', 'result-stars')
  private rows = el('div', 'panel modal-wrap')
  private statusLine = el('p', 'status-line')
  private doubleBtn = el('button', 'btn ghost', t('win.double'))

  constructor(private platform: PlaygamaService) {
    this.root = el('div')

    const head = el('div', 'screen-head')
    head.appendChild(el('h2', 'screen-title', t('win.title')))
    head.appendChild(this.starsRow)
    this.root.appendChild(head)

    this.root.appendChild(this.rows)

    const secondary = el('div', 'secondary-row')
    this.doubleBtn.type = 'button'
    this.doubleBtn.addEventListener('click', () => {
      if (this.doubleInFlight || this.doubled || !this.platform.isRewardedSupported) return
      this.doubleInFlight = true
      this.platform.showRewarded(REWARDED_PLACEMENTS.doubleReward, (granted) => {
        this.doubleInFlight = false
        if (!granted) {
          this.statusLine.textContent = t('ui.error.ad')
          this.statusLine.className = 'status-line error'
        } else {
          bus.emit('reward:double')
        }
      })
    })
    secondary.appendChild(this.doubleBtn)

    const nextBtn = el('button', 'btn primary', t('win.next'))
    nextBtn.type = 'button'
    nextBtn.id = 'victory-next'
    nextBtn.addEventListener('click', () => bus.emit('game:next'))
    const menuBtn = withIcon('icon-btn', 'mountain', t('ui.menu'))
    menuBtn.addEventListener('click', () => bus.emit('game:menu'))
    secondary.appendChild(nextBtn)
    secondary.appendChild(menuBtn)
    this.root.appendChild(secondary)
    this.root.appendChild(this.statusLine)
    this.buildRows()

    bus.on('contract:won', (payload) => this.apply(payload as unknown as VictoryData))
    bus.on('leaderboard:result', (payload) => {
      const sent = Boolean((payload as { sent?: boolean }).sent)
      this.statusLine.textContent = sent ? t('ui.leaderboard.sent') : ''
      this.statusLine.className = sent ? 'status-line ok' : 'status-line'
    })
  }

  private doubleInFlight = false
  private doubled = false
  private scoreValue = el('span', 'v hud-num')
  private massValue = el('span', 'v hud-num')
  private timeValue = el('span', 'v hud-num')
  private ammoValue = el('span', 'v hud-num')

  private renderStars(stars: number): void {
    let html = ''
    for (let i = 0; i < 3; i++) {
      html += `<svg viewBox="0 0 24 24" class="${i < stars ? '' : 'dim'}"><use href="#icon-star"></use></svg>`
    }
    this.starsRow.innerHTML = html
  }

  private apply(data: VictoryData): void {
    if (data.doubled) {
      // повторный показ того же экрана с удвоенным счётом
      this.doubled = true
      this.scoreValue.textContent = formatNumber(data.score)
      this.doubleBtn.style.display = 'none'
      this.statusLine.textContent = t('win.doubled')
      this.statusLine.className = 'status-line ok'
      return
    }
    this.doubled = false
    this.scoreValue.textContent = formatNumber(data.score)
    this.massValue.textContent = `${data.massPct}%`
    this.timeValue.textContent = String(data.timeLeft)
    this.ammoValue.textContent = String(data.ammoLeft)
    this.renderStars(data.stars)
    this.statusLine.textContent = ''
    // награда за просмотр доступна только там, где есть rewarded
    this.doubleBtn.style.display = this.platform.isRewardedSupported ? '' : 'none'
  }

  /** Заполняется в конструкторе после инициализации полей значений. */
  buildRows(): void {
    this.rows.replaceChildren(
      this.statRow(t('win.score'), this.scoreValue),
      this.statRow(t('win.mass'), this.massValue),
      this.statRow(t('win.time'), this.timeValue),
      this.statRow(t('win.ammo'), this.ammoValue),
    )
  }

  private statRow(key: string, value: HTMLElement): HTMLElement {
    const row = el('div', 'stat-row')
    row.appendChild(el('span', 'k', key))
    row.appendChild(value)
    return row
  }
}
