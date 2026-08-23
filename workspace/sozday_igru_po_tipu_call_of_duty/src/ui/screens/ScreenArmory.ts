import { events } from '../../core/EventBus'
import { ICONS } from '../icons'
import { playgama } from '../../platform/PlaygamaService'

export class ScreenArmory {
  private element: HTMLElement
  private creditsEl: HTMLElement
  private selectedUpgrade: string = 'gyroStabilizer'
  private upgradeCards: Map<string, HTMLElement> = new Map()

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'ui-screen'
    this.element.id = 'screen-armory'

    this.element.innerHTML = `
      <!-- Zone 1: Header -->
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-subtitle">GUNSHIP UPGRADE MATRIX // SPECTRE WEAPONS SYSTEMS</div>
          <div class="screen-title">ОРУЖЕЙНЫЙ АРСЕНАЛ AC-130</div>
        </div>
        <div class="ui-panel" style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-accent-gold);">
          ${ICONS.credits}
          <span style="font-weight: bold;">ДОСТУПНО: <span class="tabular-nums" id="armory-credits">500</span> КР</span>
        </div>
      </div>

      <!-- Zone 2: Upgrades Grid Body -->
      <div class="screen-body">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: calc(var(--space-3) * var(--ui-scale)); width: calc(720px * var(--ui-scale)); max-width: 90vw;">
          
          <div class="ui-panel upgrade-card selected" data-upgrade="gyroStabilizer" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
              <span>ГИРОСТАБИЛИЗАТОР FLIR</span>
              <span class="tabular-nums" id="lvl-gyro">LVL 1</span>
            </div>
            <div style="font-size: 11px; color: var(--color-text-dim);">Устраняет дрожание прицела при зуме 4x и ускоряет наведение турели.</div>
            <div style="font-size: 12px; color: var(--color-accent-gold); margin-top: 6px; font-weight: bold;" id="cost-gyro">500 КРЕДИТОВ</div>
          </div>

          <div class="ui-panel upgrade-card" data-upgrade="howitzerAutoloader" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
              <span>АВТОМАТ ЗАРЯЖАНИЯ 105ММ</span>
              <span class="tabular-nums" id="lvl-howitzer">LVL 1</span>
            </div>
            <div style="font-size: 11px; color: var(--color-text-dim);">Сокращает время перезарядки 105мм гаубицы с 4.5с до 3.2с.</div>
            <div style="font-size: 12px; color: var(--color-accent-gold); margin-top: 6px; font-weight: bold;" id="cost-howitzer">750 КРЕДИТОВ</div>
          </div>

          <div class="ui-panel upgrade-card" data-upgrade="gatlingCooling" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
              <span>КРИООХЛАЖДЕНИЕ GAU-12</span>
              <span class="tabular-nums" id="lvl-gatling">LVL 1</span>
            </div>
            <div style="font-size: 11px; color: var(--color-text-dim);">Увеличивает непрерывную очередь 25мм пулемета до перегрева в 2 раза.</div>
            <div style="font-size: 12px; color: var(--color-accent-gold); margin-top: 6px; font-weight: bold;" id="cost-gatling">600 КРЕДИТОВ</div>
          </div>

          <div class="ui-panel upgrade-card" data-upgrade="flirGen4" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
              <span>МАТРИЦА FLIR GEN-4</span>
              <span class="tabular-nums" id="lvl-flir">LVL 1</span>
            </div>
            <div style="font-size: 11px; color: var(--color-text-dim);">Усиливает тепловой контраст White-Hot и подсвечивает двигатели техники.</div>
            <div style="font-size: 12px; color: var(--color-accent-gold); margin-top: 6px; font-weight: bold;" id="cost-flir">800 КРЕДИТОВ</div>
          </div>

        </div>
      </div>

      <!-- Zone 3: Actions -->
      <div class="screen-actions">
        <button class="btn btn-primary" id="btn-buy-upgrade">
          ${ICONS.upgrade} УЛУЧШИТЬ СИСТЕМУ
        </button>
        <button class="btn" id="btn-armory-back">
          НАЗАД В МЕНЮ
        </button>
      </div>
    `

    this.creditsEl = this.element.querySelector('#armory-credits')!
    this.setupListeners()
    parent.appendChild(this.element)
  }

  private setupListeners(): void {
    const cards = this.element.querySelectorAll('.upgrade-card')
    cards.forEach((c) => {
      const cardEl = c as HTMLElement
      const key = cardEl.dataset.upgrade!
      this.upgradeCards.set(key, cardEl)

      cardEl.addEventListener('click', () => {
        this.selectedUpgrade = key
        this.updateCardSelection()
      })
    })

    const buyBtn = this.element.querySelector('#btn-buy-upgrade') as HTMLButtonElement
    buyBtn.addEventListener('click', () => this.purchaseSelectedUpgrade())

    const backBtn = this.element.querySelector('#btn-armory-back') as HTMLButtonElement
    backBtn.addEventListener('click', () => {
      events.emit('NAVIGATE_SCREEN', 'ScreenMainMenu')
    })
  }

  private updateCardSelection(): void {
    this.upgradeCards.forEach((card, key) => {
      if (key === this.selectedUpgrade) {
        card.style.borderColor = 'var(--color-primary-hud)'
        card.style.boxShadow = '0 0 16px var(--color-primary-hud)'
      } else {
        card.style.borderColor = 'var(--color-hud-border)'
        card.style.boxShadow = 'none'
      }
    })
  }

  private getUpgradeCost(key: string, level: number): number {
    const baseCostMap: Record<string, number> = {
      gyroStabilizer: 500,
      howitzerAutoloader: 750,
      gatlingCooling: 600,
      flirGen4: 800
    }
    return (baseCostMap[key] || 500) * level
  }

  private purchaseSelectedUpgrade(): void {
    const save = playgama.getSaveData()
    const currentLevel = (save.upgrades as any)[this.selectedUpgrade] || 1
    const cost = this.getUpgradeCost(this.selectedUpgrade, currentLevel)

    if (save.credits >= cost) {
      save.credits -= cost
      ;(save.upgrades as any)[this.selectedUpgrade] = currentLevel + 1
      playgama.updateSaveData(save)
      this.refreshData()
    }
  }

  public show(): void {
    this.refreshData()
    this.element.classList.add('active')
  }

  public hide(): void {
    this.element.classList.remove('active')
  }

  private refreshData(): void {
    const save = playgama.getSaveData()
    this.creditsEl.textContent = save.credits.toString()

    const upgrades = save.upgrades
    const setLvl = (id: string, lvl: number, key: string) => {
      const el = this.element.querySelector(`#lvl-${id}`)
      const costEl = this.element.querySelector(`#cost-${id}`)
      if (el) el.textContent = `LVL ${lvl}`
      if (costEl) costEl.textContent = `${this.getUpgradeCost(key, lvl)} КРЕДИТОВ`
    }

    setLvl('gyro', upgrades.gyroStabilizer, 'gyroStabilizer')
    setLvl('howitzer', upgrades.howitzerAutoloader, 'howitzerAutoloader')
    setLvl('gatling', upgrades.gatlingCooling, 'gatlingCooling')
    setLvl('flir', upgrades.flirGen4, 'flirGen4')

    this.updateCardSelection()
  }

  public getElement(): HTMLElement {
    return this.element
  }
}
