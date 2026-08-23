import { events } from '../../core/EventBus'
import { storageService } from '../../platform/StorageService'
import { createButton, type ButtonHandle } from '../components/Button'
import { createPanel } from '../components/Panel'
import { createIcon } from '../icons'

export class WorkshopScreen {
  public root: HTMLElement
  private shillingsText: HTMLElement
  private onBackToMenu: () => void

  private bagLevelText!: HTMLElement
  private bagBuyBtn!: ButtonHandle
  private bootsLevelText!: HTMLElement
  private bootsBuyBtn!: ButtonHandle

  constructor(onBackToMenu: () => void) {
    this.onBackToMenu = onBackToMenu

    this.root = document.createElement('div')
    this.root.id = 'screen-workshop'
    this.root.className = 'screen screen--blocking screen--hidden'

    // Header Zone
    const header = document.createElement('div')
    header.style.width = '100%'
    header.style.maxWidth = '420px'
    header.style.display = 'flex'
    header.style.alignItems = 'center'
    header.style.justifyContent = 'space-between'
    header.style.marginTop = 'calc(var(--space-2) * var(--ui-scale))'

    const title = document.createElement('h2')
    title.textContent = 'МАСТЕРСКАЯ СНАРЯЖЕНИЯ'
    title.style.fontFamily = 'var(--font-display)'
    title.style.color = 'var(--color-primary)'
    title.style.fontSize = 'clamp(16px, calc(20px * var(--ui-scale)), 24px)'
    header.appendChild(title)

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
    header.appendChild(coinPill)

    this.root.appendChild(header)

    // Content Zone: Upgrade Cards
    const content = document.createElement('div')
    content.style.width = '100%'
    content.style.maxWidth = '420px'
    content.style.display = 'flex'
    content.style.flexDirection = 'column'
    content.style.gap = 'calc(var(--space-4) * var(--ui-scale))'

    // Upgrade 1: Bag Suspension
    const bagCard = createPanel({ className: 'upgrade-card' })
    bagCard.style.padding = 'calc(var(--space-4) * var(--ui-scale))'
    bagCard.style.display = 'flex'
    bagCard.style.flexDirection = 'column'
    bagCard.style.gap = 'calc(var(--space-2) * var(--ui-scale))'

    const bagTitle = document.createElement('h3')
    bagTitle.textContent = 'ПНЕВМО-ПОДВЕСКА СУМКИ'
    bagTitle.style.fontFamily = 'var(--font-display)'
    bagTitle.style.color = 'var(--color-safe)'
    bagTitle.style.fontSize = '16px'
    bagCard.appendChild(bagTitle)

    const bagDesc = document.createElement('p')
    bagDesc.textContent = 'Снижает урон целостности алхимической колбы при жестких ударах на 10%–50%.'
    bagDesc.style.color = 'var(--color-text-secondary)'
    bagDesc.style.fontSize = '13px'
    bagCard.appendChild(bagDesc)

    this.bagLevelText = document.createElement('div')
    this.bagLevelText.className = 'num'
    this.bagLevelText.style.color = 'var(--color-text-primary)'
    this.bagLevelText.style.fontWeight = '700'
    bagCard.appendChild(this.bagLevelText)

    this.bagBuyBtn = createButton({
      text: 'УЛУЧШИТЬ (100 шилл.)',
      variant: 'primary',
      onClick: () => this.buyBagUpgrade(),
    })
    bagCard.appendChild(this.bagBuyBtn.element)
    content.appendChild(bagCard)

    // Upgrade 2: Roofer Boots
    const bootsCard = createPanel({ className: 'upgrade-card' })
    bootsCard.style.padding = 'calc(var(--space-4) * var(--ui-scale))'
    bootsCard.style.display = 'flex'
    bootsCard.style.flexDirection = 'column'
    bootsCard.style.gap = 'calc(var(--space-2) * var(--ui-scale))'

    const bootsTitle = document.createElement('h3')
    bootsTitle.textContent = 'СВИНЦОВО-ЛАТУННЫЕ САПОГИ'
    bootsTitle.style.fontFamily = 'var(--font-display)'
    bootsTitle.style.color = 'var(--color-safe)'
    bootsTitle.style.fontSize = '16px'
    bootsCard.appendChild(bootsTitle)

    const bootsDesc = document.createElement('p')
    bootsDesc.textContent = 'Улучшает сцепление на мокрой черепице и расширяет окно зацепа за карниз.'
    bootsDesc.style.color = 'var(--color-text-secondary)'
    bootsDesc.style.fontSize = '13px'
    bootsCard.appendChild(bootsDesc)

    this.bootsLevelText = document.createElement('div')
    this.bootsLevelText.className = 'num'
    this.bootsLevelText.style.color = 'var(--color-text-primary)'
    this.bootsLevelText.style.fontWeight = '700'
    bootsCard.appendChild(this.bootsLevelText)

    this.bootsBuyBtn = createButton({
      text: 'УЛУЧШИТЬ (120 шилл.)',
      variant: 'primary',
      onClick: () => this.buyBootsUpgrade(),
    })
    bootsCard.appendChild(this.bootsBuyBtn.element)
    content.appendChild(bootsCard)

    this.root.appendChild(content)

    // Action Zone: Back Button
    const actions = document.createElement('div')
    actions.style.width = '100%'
    actions.style.maxWidth = '420px'
    actions.style.marginBottom = 'calc(var(--space-4) * var(--ui-scale))'

    const backBtn = createButton({
      text: 'НАЗАД В ГИЛЬДИЮ',
      variant: 'secondary',
      onClick: () => {
        this.onBackToMenu()
      },
    })
    actions.appendChild(backBtn.element)
    this.root.appendChild(actions)

    this.refreshUI()
  }

  private buyBagUpgrade(): void {
    const save = storageService.getSave()
    const curLevel = save.gear.bagSuspensionLevel
    if (curLevel >= 5) return

    const price = curLevel * 100
    if (save.shillings >= price) {
      storageService.updateSave((s) => {
        s.shillings -= price
        s.gear.bagSuspensionLevel++
        events.emit('CURRENCY_UPDATED', { shillings: s.shillings })
      })
      this.refreshUI()
    }
  }

  private buyBootsUpgrade(): void {
    const save = storageService.getSave()
    const curLevel = save.gear.brassBootsLevel
    if (curLevel >= 5) return

    const price = curLevel * 120
    if (save.shillings >= price) {
      storageService.updateSave((s) => {
        s.shillings -= price
        s.gear.brassBootsLevel++
        events.emit('CURRENCY_UPDATED', { shillings: s.shillings })
      })
      this.refreshUI()
    }
  }

  public refreshUI(): void {
    const save = storageService.getSave()
    this.shillingsText.textContent = `${save.shillings}`

    // Bag
    const bagLvl = save.gear.bagSuspensionLevel
    this.bagLevelText.textContent = `УРОВЕНЬ: ${bagLvl} / 5`
    if (bagLvl >= 5) {
      this.bagBuyBtn.setText('МАКСИМАЛЬНЫЙ УРОВЕНЬ')
      this.bagBuyBtn.setDisabled(true)
    } else {
      const price = bagLvl * 100
      this.bagBuyBtn.setText(`УЛУЧШИТЬ (${price} шилл.)`)
      this.bagBuyBtn.setDisabled(save.shillings < price)
    }

    // Boots
    const bootsLvl = save.gear.brassBootsLevel
    this.bootsLevelText.textContent = `УРОВЕНЬ: ${bootsLvl} / 5`
    if (bootsLvl >= 5) {
      this.bootsBuyBtn.setText('МАКСИМАЛЬНЫЙ УРОВЕНЬ')
      this.bootsBuyBtn.setDisabled(true)
    } else {
      const price = bootsLvl * 120
      this.bootsBuyBtn.setText(`УЛУЧШИТЬ (${price} шилл.)`)
      this.bootsBuyBtn.setDisabled(save.shillings < price)
    }
  }

  public show(): void {
    this.refreshUI()
    this.root.classList.remove('screen--hidden')
  }

  public hide(): void {
    this.root.classList.add('screen--hidden')
  }
}
