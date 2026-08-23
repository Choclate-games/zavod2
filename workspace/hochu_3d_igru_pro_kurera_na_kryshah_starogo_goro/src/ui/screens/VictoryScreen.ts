import { audioManager } from '../../audio/AudioManager'
import { playgamaService } from '../../platform/PlaygamaService'
import { storageService } from '../../platform/StorageService'
import { createButton, type ButtonHandle } from '../components/Button'
import { createPanel } from '../components/Panel'
import { createIcon } from '../icons'

export interface VictoryData {
  shillings: number
  base: number
  timeBonus: number
  integrityBonus: number
  flowBonus: number
  timeRemainingSec: number
}

export class VictoryScreen {
  public root: HTMLElement
  private totalPayoutText: HTMLElement
  private baseRewardText: HTMLElement
  private timeBonusText: HTMLElement
  private integrityText: HTMLElement
  private flowText: HTMLElement
  private doubleBtn: ButtonHandle
  private onReturnToMenu: () => void
  private currentData: VictoryData | null = null
  private doubled = false

  constructor(onReturnToMenu: () => void) {
    this.onReturnToMenu = onReturnToMenu

    this.root = document.createElement('div')
    this.root.id = 'screen-victory'
    this.root.className = 'screen screen--blocking screen--hidden'

    // Header Zone
    const header = document.createElement('div')
    header.style.textAlign = 'center'
    header.style.marginTop = 'calc(var(--space-4) * var(--ui-scale))'

    const title = document.createElement('h1')
    title.textContent = 'ЗАКАЗ ДОСТАВЛЕН!'
    title.style.fontFamily = 'var(--font-display)'
    title.style.color = 'var(--color-primary)'
    title.style.fontSize = 'clamp(22px, calc(28px * var(--ui-scale)), 36px)'
    title.style.letterSpacing = '2px'
    header.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.textContent = 'ГРАМОТА ГИЛЬДИИ КУРЬЕРОВ'
    subtitle.style.color = 'var(--color-safe)'
    subtitle.style.fontSize = '13px'
    subtitle.style.letterSpacing = '3px'
    subtitle.style.fontWeight = '700'
    header.appendChild(subtitle)

    this.root.appendChild(header)

    // Content Zone: Delivery Bill Parchment
    const content = document.createElement('div')
    content.style.width = '100%'
    content.style.maxWidth = '420px'

    const billPanel = createPanel({ className: 'delivery-bill' })
    billPanel.style.padding = 'calc(var(--space-6) * var(--ui-scale))'
    billPanel.style.display = 'flex'
    billPanel.style.flexDirection = 'column'
    billPanel.style.gap = 'calc(var(--space-3) * var(--ui-scale))'

    const billHeader = document.createElement('div')
    billHeader.style.borderBottom = '1px solid var(--color-panel-border)'
    billHeader.style.paddingBottom = 'calc(var(--space-2) * var(--ui-scale))'
    billHeader.style.color = 'var(--color-text-secondary)'
    billHeader.style.fontSize = '12px'
    billHeader.style.letterSpacing = '1px'
    billHeader.textContent = 'РАСЧЕТ ГОНОРАРА И ЧАЕВЫХ'
    billPanel.appendChild(billHeader)

    // Rows
    const createRow = (label: string, valueEl: HTMLElement) => {
      const row = document.createElement('div')
      row.style.display = 'flex'
      row.style.justifyContent = 'space-between'
      row.style.alignItems = 'center'
      row.style.fontSize = '14px'

      const lbl = document.createElement('span')
      lbl.style.color = 'var(--color-text-secondary)'
      lbl.textContent = label
      row.appendChild(lbl)
      row.appendChild(valueEl)
      return row
    }

    this.baseRewardText = document.createElement('span')
    this.baseRewardText.className = 'num'
    this.baseRewardText.style.color = 'var(--color-text-primary)'
    billPanel.appendChild(createRow('Базовый тариф:', this.baseRewardText))

    this.timeBonusText = document.createElement('span')
    this.timeBonusText.className = 'num'
    this.timeBonusText.style.color = 'var(--color-primary)'
    billPanel.appendChild(createRow('Бонус за скорость:', this.timeBonusText))

    this.integrityText = document.createElement('span')
    this.integrityText.className = 'num'
    this.integrityText.style.color = 'var(--color-safe)'
    billPanel.appendChild(createRow('Сохранность груза:', this.integrityText))

    this.flowText = document.createElement('span')
    this.flowText.className = 'num'
    this.flowText.style.color = 'var(--color-primary)'
    billPanel.appendChild(createRow('Множитель Флоу:', this.flowText))

    // Total Row
    const totalRow = document.createElement('div')
    totalRow.style.borderTop = '1px solid var(--color-panel-border)'
    totalRow.style.paddingTop = 'calc(var(--space-3) * var(--ui-scale))'
    totalRow.style.marginTop = 'calc(var(--space-2) * var(--ui-scale))'
    totalRow.style.display = 'flex'
    totalRow.style.justifyContent = 'space-between'
    totalRow.style.alignItems = 'center'

    const totalLbl = document.createElement('span')
    totalLbl.style.fontFamily = 'var(--font-display)'
    totalLbl.style.fontSize = '18px'
    totalLbl.style.color = 'var(--color-text-primary)'
    totalLbl.textContent = 'ИТОГО К ВЫПЛАТЕ:'
    totalRow.appendChild(totalLbl)

    const totalRight = document.createElement('div')
    totalRight.style.display = 'inline-flex'
    totalRight.style.alignItems = 'center'
    totalRight.style.gap = '6px'
    totalRight.appendChild(createIcon('coin'))

    this.totalPayoutText = document.createElement('span')
    this.totalPayoutText.className = 'num'
    this.totalPayoutText.style.fontFamily = 'var(--font-display)'
    this.totalPayoutText.style.fontSize = '24px'
    this.totalPayoutText.style.color = 'var(--color-primary)'
    this.totalPayoutText.style.fontWeight = '700'
    totalRight.appendChild(this.totalPayoutText)
    totalRow.appendChild(totalRight)

    billPanel.appendChild(totalRow)
    content.appendChild(billPanel)
    this.root.appendChild(content)

    // Action Zone
    const actions = document.createElement('div')
    actions.style.width = '100%'
    actions.style.maxWidth = '420px'
    actions.style.display = 'flex'
    actions.style.flexDirection = 'column'
    actions.style.gap = 'calc(var(--space-3) * var(--ui-scale))'
    actions.style.marginBottom = 'calc(var(--space-4) * var(--ui-scale))'

    this.doubleBtn = createButton({
      text: 'УДВОИТЬ НАГРАДУ x2',
      variant: 'primary',
      icon: 'video',
      onClick: async () => {
        if (this.doubled || !this.currentData) return
        this.doubleBtn.setLoading(true)
        const rewarded = await playgamaService.showRewarded('double_tips')
        this.doubleBtn.setLoading(false)

        if (rewarded) {
          this.doubled = true
          const extra = this.currentData.shillings
          storageService.updateSave((s) => {
            s.shillings += extra
          })
          this.totalPayoutText.textContent = `${this.currentData.shillings * 2}`
          this.doubleBtn.setText('НАГРАДА УДВОЕНА!')
          this.doubleBtn.setDisabled(true)
          audioManager.playCoins()
        }
      },
    })
    actions.appendChild(this.doubleBtn.element)

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

  public setData(data: VictoryData): void {
    this.currentData = data
    this.doubled = false
    this.doubleBtn.setText('УДВОИТЬ НАГРАДУ x2')
    this.doubleBtn.setDisabled(false)

    this.baseRewardText.textContent = `${data.base} шилл.`
    this.timeBonusText.textContent = `+${data.timeBonus} шилл.`
    this.integrityText.textContent = `${data.integrityBonus}%`
    this.flowText.textContent = `+${data.flowBonus}%`
    this.totalPayoutText.textContent = `${data.shillings}`

    audioManager.playVictoryFanfare()
  }

  public show(): void {
    this.root.classList.remove('screen--hidden')
  }

  public hide(): void {
    this.root.classList.add('screen--hidden')
  }
}
