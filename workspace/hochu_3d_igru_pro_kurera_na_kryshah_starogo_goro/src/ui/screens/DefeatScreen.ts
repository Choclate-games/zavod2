import { audioManager } from '../../audio/AudioManager'
import { events } from '../../core/EventBus'
import { playgamaService } from '../../platform/PlaygamaService'
import { createButton, type ButtonHandle } from '../components/Button'
import { createPanel } from '../components/Panel'

export interface DefeatData {
  reason: 'PARCEL_DESTROYED' | 'FALL_TO_STREET' | 'TIME_EXPIRED'
  distanceCovered: number
  targetDistance: number
}

export class DefeatScreen {
  public root: HTMLElement
  private reasonTitleEl: HTMLElement
  private reasonDescEl: HTMLElement
  private distanceText: HTMLElement
  private reviveBtn: ButtonHandle
  private onRestart: () => void
  private onReturnToMenu: () => void
  private reviveUsed = false

  constructor(onRestart: () => void, onReturnToMenu: () => void) {
    this.onRestart = onRestart
    this.onReturnToMenu = onReturnToMenu

    this.root = document.createElement('div')
    this.root.id = 'screen-defeat'
    this.root.className = 'screen screen--blocking screen--hidden'

    // Header Zone
    const header = document.createElement('div')
    header.style.textAlign = 'center'
    header.style.marginTop = 'calc(var(--space-4) * var(--ui-scale))'

    this.reasonTitleEl = document.createElement('h1')
    this.reasonTitleEl.textContent = 'ДОСТАВКА СОРВАНА'
    this.reasonTitleEl.style.fontFamily = 'var(--font-display)'
    this.reasonTitleEl.style.color = 'var(--color-danger)'
    this.reasonTitleEl.style.fontSize = 'clamp(22px, calc(28px * var(--ui-scale)), 36px)'
    this.reasonTitleEl.style.letterSpacing = '2px'
    header.appendChild(this.reasonTitleEl)

    this.reasonDescEl = document.createElement('div')
    this.reasonDescEl.style.color = 'var(--color-text-secondary)'
    this.reasonDescEl.style.fontSize = '14px'
    this.reasonDescEl.style.marginTop = 'calc(var(--space-1) * var(--ui-scale))'
    header.appendChild(this.reasonDescEl)

    this.root.appendChild(header)

    // Content Zone
    const content = document.createElement('div')
    content.style.width = '100%'
    content.style.maxWidth = '420px'

    const panel = createPanel({ className: 'defeat-panel' })
    panel.style.padding = 'calc(var(--space-4) * var(--ui-scale))'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.gap = 'calc(var(--space-2) * var(--ui-scale))'

    const distHeader = document.createElement('div')
    distHeader.style.color = 'var(--color-text-muted)'
    distHeader.style.fontSize = '12px'
    distHeader.textContent = 'ПРОЙДЕННЫЙ МАРШРУТ:'
    panel.appendChild(distHeader)

    this.distanceText = document.createElement('div')
    this.distanceText.className = 'num'
    this.distanceText.style.fontFamily = 'var(--font-display)'
    this.distanceText.style.fontSize = '20px'
    this.distanceText.style.color = 'var(--color-text-primary)'
    this.distanceText.textContent = '0 / 400 м'
    panel.appendChild(this.distanceText)

    content.appendChild(panel)
    this.root.appendChild(content)

    // Action Zone
    const actions = document.createElement('div')
    actions.style.width = '100%'
    actions.style.maxWidth = '420px'
    actions.style.display = 'flex'
    actions.style.flexDirection = 'column'
    actions.style.gap = 'calc(var(--space-3) * var(--ui-scale))'
    actions.style.marginBottom = 'calc(var(--space-4) * var(--ui-scale))'

    this.reviveBtn = createButton({
      text: 'СТРАХОВКА ГИЛЬДИИ',
      variant: 'safe',
      icon: 'video',
      onClick: async () => {
        if (this.reviveUsed) return
        this.reviveBtn.setLoading(true)
        const rewarded = await playgamaService.showRewarded('courier_insurance')
        this.reviveBtn.setLoading(false)

        if (rewarded) {
          this.reviveUsed = true
          events.emit('REVIVE_TRIGGERED')
          this.hide()
        }
      },
    })
    actions.appendChild(this.reviveBtn.element)

    const restartBtn = createButton({
      text: 'НАЧАТЬ ЗАНОВО',
      variant: 'primary',
      icon: 'restart',
      onClick: () => {
        this.onRestart()
      },
    })
    actions.appendChild(restartBtn.element)

    const menuBtn = createButton({
      text: 'В ГИЛЬДИЮ',
      variant: 'secondary',
      onClick: () => {
        this.onReturnToMenu()
      },
    })
    actions.appendChild(menuBtn.element)

    this.root.appendChild(actions)
  }

  public setData(data: DefeatData): void {
    this.reviveUsed = false
    this.reviveBtn.setDisabled(false)

    if (data.reason === 'PARCEL_DESTROYED') {
      this.reasonTitleEl.textContent = 'ГРУЗ УНИЧТОЖЕН!'
      this.reasonDescEl.textContent = 'Алхимическая колба разбилась от критических ударов.'
    } else if (data.reason === 'FALL_TO_STREET') {
      this.reasonTitleEl.textContent = 'СРЫВ В ПЕРЕУЛОК!'
      this.reasonDescEl.textContent = 'Курьер сорвался с карниза на мостовую города.'
    } else {
      this.reasonTitleEl.textContent = 'ВРЕМЯ ИСТЕКЛО!'
      this.reasonDescEl.textContent = 'Срок курьерского контракта подошел к концу.'
    }

    this.distanceText.textContent = `${Math.round(data.distanceCovered)} / ${Math.round(data.targetDistance)} м`
    audioManager.playGlassCrack()
  }

  public show(): void {
    this.root.classList.remove('screen--hidden')
  }

  public hide(): void {
    this.root.classList.add('screen--hidden')
  }
}
