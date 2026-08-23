import { audioManager } from '../../audio/AudioManager'
import { events } from '../../core/EventBus'
import type { ContractInfo } from '../../core/types'
import { storageService } from '../../platform/StorageService'
import { GuildContractDispatchSystem } from '../../systems/GuildContractDispatchSystem'
import { createButton, type ButtonHandle } from '../components/Button'
import { createPanel } from '../components/Panel'
import { createIcon } from '../icons'

export class MainMenuScreen {
  public root: HTMLElement
  private shillingsText: HTMLElement
  private contractTitleEl: HTMLElement
  private contractDistEl: HTMLElement
  private contractRewardEl: HTMLElement
  private contractFragEl: HTMLElement
  private soundBtn: ButtonHandle
  private onStartGame: () => void
  private onOpenWorkshop: () => void

  constructor(
    dispatchSystem: GuildContractDispatchSystem,
    onStartGame: () => void,
    onOpenWorkshop: () => void
  ) {
    this.onStartGame = onStartGame
    this.onOpenWorkshop = onOpenWorkshop

    this.root = document.createElement('div')
    this.root.id = 'screen-main-menu'
    this.root.className = 'screen screen--blocking screen--hidden'

    // 1. Header Zone: Title & Status Bar
    const header = document.createElement('div')
    header.style.width = '100%'
    header.style.maxWidth = '420px'
    header.style.display = 'flex'
    header.style.alignItems = 'center'
    header.style.justifyContent = 'space-between'
    header.style.marginTop = 'calc(var(--space-2) * var(--ui-scale))'

    const titleGroup = document.createElement('div')
    const logoTitle = document.createElement('h2')
    logoTitle.textContent = 'ЧЕРЕПИЧНЫЙ СПРИНТ'
    logoTitle.style.fontFamily = 'var(--font-display)'
    logoTitle.style.color = 'var(--color-primary)'
    logoTitle.style.fontSize = 'clamp(18px, calc(22px * var(--ui-scale)), 26px)'
    titleGroup.appendChild(logoTitle)

    const badgeContainer = document.createElement('div')
    badgeContainer.style.display = 'flex'
    badgeContainer.style.alignItems = 'center'
    badgeContainer.style.gap = 'calc(var(--space-2) * var(--ui-scale))'

    // Currency Pill
    const coinPill = document.createElement('div')
    coinPill.className = 'panel'
    coinPill.style.display = 'inline-flex'
    coinPill.style.alignItems = 'center'
    coinPill.style.gap = '6px'
    coinPill.style.padding = '6px 12px'
    coinPill.appendChild(createIcon('coin'))

    this.shillingsText = document.createElement('span')
    this.shillingsText.className = 'num'
    this.shillingsText.style.color = 'var(--color-primary)'
    this.shillingsText.style.fontWeight = '700'
    this.shillingsText.textContent = `${storageService.getSave().shillings}`
    coinPill.appendChild(this.shillingsText)
    badgeContainer.appendChild(coinPill)

    // Sound Toggle Button
    this.soundBtn = createButton({
      text: '',
      icon: audioManager.isSoundMuted() ? 'soundOff' : 'soundOn',
      variant: 'secondary',
      onClick: () => {
        const muted = audioManager.toggleMute()
        this.soundBtn.element.querySelector('.btn__icon')!.replaceChildren(
          createIcon(muted ? 'soundOff' : 'soundOn')
        )
      },
    })
    this.soundBtn.element.style.minWidth = '48px'
    this.soundBtn.element.style.minHeight = '48px'
    this.soundBtn.element.style.padding = '8px'
    badgeContainer.appendChild(this.soundBtn.element)

    header.appendChild(titleGroup)
    header.appendChild(badgeContainer)
    this.root.appendChild(header)

    // 2. Content Zone: Victorian Contract Parchment
    const content = document.createElement('div')
    content.style.width = '100%'
    content.style.maxWidth = '420px'
    content.style.display = 'flex'
    content.style.flexDirection = 'column'
    content.style.gap = 'calc(var(--space-3) * var(--ui-scale))'

    const contractPanel = createPanel({ className: 'contract-card' })
    contractPanel.style.padding = 'calc(var(--space-4) * var(--ui-scale))'

    const contractHead = document.createElement('div')
    contractHead.style.color = 'var(--color-safe)'
    contractHead.style.fontFamily = 'var(--font-display)'
    contractHead.style.fontSize = 'clamp(12px, calc(13px * var(--ui-scale)), 15px)'
    contractHead.style.letterSpacing = '1px'
    contractHead.textContent = 'АКТИВНЫЙ КУРЬЕРСКИЙ КОНТРАКТ'
    contractPanel.appendChild(contractHead)

    this.contractTitleEl = document.createElement('h3')
    this.contractTitleEl.style.fontFamily = 'var(--font-display)'
    this.contractTitleEl.style.color = 'var(--color-text-primary)'
    this.contractTitleEl.style.fontSize = 'clamp(16px, calc(19px * var(--ui-scale)), 22px)'
    this.contractTitleEl.style.margin = 'calc(var(--space-2) * var(--ui-scale)) 0'
    this.contractTitleEl.textContent = dispatchSystem.getActiveContract().name
    contractPanel.appendChild(this.contractTitleEl)

    const statsGrid = document.createElement('div')
    statsGrid.style.display = 'grid'
    statsGrid.style.gridTemplateColumns = '1fr 1fr'
    statsGrid.style.gap = 'calc(var(--space-2) * var(--ui-scale))'
    statsGrid.style.marginTop = 'calc(var(--space-2) * var(--ui-scale))'

    // Distance
    const distBox = document.createElement('div')
    distBox.innerHTML = `<span style="color:var(--color-text-muted);font-size:12px;">ДИСТАНЦИЯ:</span><br>`
    this.contractDistEl = document.createElement('span')
    this.contractDistEl.className = 'num'
    this.contractDistEl.style.color = 'var(--color-text-primary)'
    this.contractDistEl.style.fontSize = '16px'
    this.contractDistEl.textContent = `${dispatchSystem.getActiveContract().distance} м`
    distBox.appendChild(this.contractDistEl)
    statsGrid.appendChild(distBox)

    // Reward
    const rewardBox = document.createElement('div')
    rewardBox.innerHTML = `<span style="color:var(--color-text-muted);font-size:12px;">ГОНОРАР:</span><br>`
    this.contractRewardEl = document.createElement('span')
    this.contractRewardEl.className = 'num'
    this.contractRewardEl.style.color = 'var(--color-primary)'
    this.contractRewardEl.style.fontSize = '16px'
    this.contractRewardEl.textContent = `${dispatchSystem.getActiveContract().reward} шилл.`
    rewardBox.appendChild(this.contractRewardEl)
    statsGrid.appendChild(rewardBox)

    contractPanel.appendChild(statsGrid)

    // Fragility Note
    this.contractFragEl = document.createElement('div')
    this.contractFragEl.style.marginTop = 'calc(var(--space-3) * var(--ui-scale))'
    this.contractFragEl.style.fontSize = '12px'
    this.contractFragEl.style.color = 'var(--color-climb)'
    this.contractFragEl.textContent = `Груз: ${dispatchSystem.getActiveContract().fragility}`
    contractPanel.appendChild(this.contractFragEl)

    content.appendChild(contractPanel)
    this.root.appendChild(content)

    // 3. Action Zone: Primary & Secondary Buttons
    const actions = document.createElement('div')
    actions.style.width = '100%'
    actions.style.maxWidth = '420px'
    actions.style.display = 'flex'
    actions.style.flexDirection = 'column'
    actions.style.gap = 'calc(var(--space-3) * var(--ui-scale))'
    actions.style.marginBottom = 'calc(var(--space-4) * var(--ui-scale))'

    const playBtn = createButton({
      text: 'ВЗЯТЬ ЗАКАЗ',
      variant: 'primary',
      icon: 'play',
      onClick: () => {
        this.onStartGame()
      },
    })
    actions.appendChild(playBtn.element)

    const workshopBtn = createButton({
      text: 'МАСТЕРСКАЯ СНАРЯЖЕНИЯ',
      variant: 'secondary',
      icon: 'gear',
      onClick: () => {
        this.onOpenWorkshop()
      },
    })
    actions.appendChild(workshopBtn.element)

    this.root.appendChild(actions)

    // Listen to currency and contract changes
    events.on('CURRENCY_UPDATED', (payload: { shillings: number }) => {
      this.shillingsText.textContent = `${payload.shillings}`
    })

    events.on('CONTRACT_SELECTED', (contract: ContractInfo) => {
      this.updateContract(contract)
    })
  }

  public updateContract(contract: ContractInfo): void {
    this.contractTitleEl.textContent = contract.name
    this.contractDistEl.textContent = `${contract.distance} м`
    this.contractRewardEl.textContent = `${contract.reward} шилл.`
    this.contractFragEl.textContent = `Груз: ${contract.fragility}`
  }

  public show(): void {
    this.shillingsText.textContent = `${storageService.getSave().shillings}`
    this.root.classList.remove('screen--hidden')
  }

  public hide(): void {
    this.root.classList.add('screen--hidden')
  }
}
