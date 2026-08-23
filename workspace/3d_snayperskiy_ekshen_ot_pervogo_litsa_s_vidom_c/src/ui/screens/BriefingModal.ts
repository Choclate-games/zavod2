import { bus } from '../../core/eventBus.js'
import { t } from '../../core/i18n.js'
import { REWARDED_PLACEMENTS, type PlaygamaService } from '../../platform/PlaygamaService.js'
import { el } from '../components/dom.js'

interface BriefingData {
  pass: number
  distance: number
  windMax: number
  ammo: number
  timeLimit: number
  massThreshold: number
  scanActive: boolean
  rewardedSupported: boolean
}

/** Тактическая сводка перевала: дистанция, роза ветров, особенности контракта. */
export class BriefingModal {
  readonly root: HTMLElement
  private title = el('h2', 'screen-title')
  private rows = el('div', 'panel modal-wrap')
  private scanRow = el('div', 'secondary-row')
  private scanBtn = el('button', 'btn ghost', t('brief.scan'))
  private statusLine = el('p', 'status-line')

  constructor(private platform: PlaygamaService) {
    this.root = el('div')
    const head = el('div', 'screen-head')
    head.appendChild(this.title)
    this.root.appendChild(head)

    this.root.appendChild(this.rows)
    this.scanBtn.type = 'button'
    this.scanBtn.addEventListener('click', () => {
      if (this.scanInFlight) return
      this.scanInFlight = true
      this.platform.showRewarded(REWARDED_PLACEMENTS.windScan, (granted) => {
        this.scanInFlight = false
        if (!granted) {
          this.statusLine.textContent = t('ui.error.ad')
          this.statusLine.className = 'status-line error'
          return
        }
        bus.emit('reward:scan')
      })
    })
    this.scanRow.appendChild(this.scanBtn)
    this.scanRow.appendChild(this.statusLine)
    this.root.appendChild(this.scanRow)

    const secondary = el('div', 'secondary-row')
    const back = el('button', 'btn ghost', t('brief.back'))
    back.type = 'button'
    back.addEventListener('click', () => bus.emit('game:menu'))
    const accept = el('button', 'btn primary', t('brief.start'))
    accept.type = 'button'
    accept.id = 'brief-accept'
    accept.addEventListener('click', () => bus.emit('briefing:accept'))
    secondary.appendChild(back)
    secondary.appendChild(accept)
    this.root.appendChild(secondary)

    bus.on('briefing:data', (payload) => this.applyData(payload as unknown as BriefingData))
  }

  private scanInFlight = false

  private applyData(data: BriefingData): void {
    this.title.textContent = t('brief.title', { n: data.pass })
    this.rows.replaceChildren(
      this.row(t('brief.distance'), String(data.distance)),
      this.row(t('brief.wind'), String(data.windMax)),
      this.row(t('brief.ammo'), String(data.ammo)),
      this.row(t('brief.time'), String(data.timeLimit)),
      this.row(t('brief.mass'), `${data.massThreshold}%`),
    )
    // возможность, которой нет на площадке, не рисуется вовсе
    this.scanRow.style.display = data.rewardedSupported && !data.scanActive ? '' : 'none'
    if (data.scanActive) {
      this.statusLine.textContent = t('brief.scan')
      this.statusLine.className = 'status-line ok'
    }
  }

  private row(key: string, value: string): HTMLElement {
    const row = el('div', 'stat-row')
    row.appendChild(el('span', 'k', key))
    row.appendChild(el('span', 'v hud-num', value))
    return row
  }
}
