import { ScreenView } from '../ScreenRouter'
import { getIconSvg } from '../icons'
import { storageService } from '../../platform/StorageService'
import { playgamaService } from '../../platform/PlaygamaService'
import { audioManager } from '../../audio/AudioManager'
import { BALANCE } from '../../config/Balance'

export class WorkbenchScreen implements ScreenView {
  public root: HTMLElement
  private onNextWave: (earlyBonus: boolean) => void
  private onUpgradeBought: (type: 'kick' | 'bowling' | 'heal' | 'hammer') => void

  constructor(
    onNextWave: (earlyBonus: boolean) => void,
    onUpgradeBought: (type: 'kick' | 'bowling' | 'heal' | 'hammer') => void,
  ) {
    this.onNextWave = onNextWave
    this.onUpgradeBought = onUpgradeBought
    this.root = document.createElement('div')
    this.root.className = 'screen workbench-screen'

    this.root.innerHTML = `
      <!-- Zone 1: Identity & Title -->
      <div style="text-align: center; margin-top: calc(var(--space-3) * var(--ui-scale));">
        <h2 style="font-family: var(--font-display); font-size: clamp(22px, calc(32px * var(--ui-scale)), 40px); color: var(--color-success); letter-spacing: 2px;">
          ОРУЖЕЙНЫЙ ВЕРСТАК
        </h2>
        <div style="display: flex; justify-content: center; align-items: center; gap: var(--space-2); margin-top: 4px; color: var(--color-gold);">
          <span>${getIconSvg('cash', 20)}</span>
          <span id="wb-cash-amount" class="tabular-nums" style="font-family: var(--font-display); font-size: 20px;">$0</span>
        </div>
      </div>

      <!-- Zone 2: 4 Interactive Upgrade Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: calc(var(--space-3) * var(--ui-scale)); max-width: 900px; margin: 0 auto; width: 100%;">
        
        <div class="panel" style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; gap: var(--space-2);">
          <div style="color: var(--color-primary);">${getIconSvg('kick', 36)}</div>
          <div>
            <div style="font-family: var(--font-display); font-size: 15px;">ИМПУЛЬС ПИНКА</div>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">+15% силы запуска</div>
          </div>
          <button id="btn-up-kick" class="btn btn--gold" style="width: 100%; min-height: 64px;">
            <span>$${BALANCE.pit_workbench_economy.kickUpgradeCostBase}</span>
          </button>
        </div>

        <div class="panel" style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; gap: var(--space-2);">
          <div style="color: var(--color-success);">${getIconSvg('fist', 36)}</div>
          <div>
            <div style="font-family: var(--font-display); font-size: 15px;">КЕГЕЛЬБАН</div>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">+20% цепной урон</div>
          </div>
          <button id="btn-up-bowling" class="btn btn--gold" style="width: 100%; min-height: 64px;">
            <span>$${BALANCE.pit_workbench_economy.kickUpgradeCostBase}</span>
          </button>
        </div>

        <div class="panel" style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; gap: var(--space-2);">
          <div style="color: var(--color-danger);">${getIconSvg('health', 36)}</div>
          <div>
            <div style="font-family: var(--font-display); font-size: 15px;">АПТЕЧКА</div>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">+${BALANCE.pit_workbench_economy.medkitHealAmount} HP</div>
          </div>
          <button id="btn-up-heal" class="btn btn--gold" style="width: 100%; min-height: 64px;">
            <span>$${BALANCE.pit_workbench_economy.medkitCost}</span>
          </button>
        </div>

        <div class="panel" style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; gap: var(--space-2);">
          <div style="color: var(--color-primary);">${getIconSvg('anvil', 36)}</div>
          <div>
            <div style="font-family: var(--font-display); font-size: 15px;">КУВАЛДА</div>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">Тяжелый молот</div>
          </div>
          <button id="btn-up-hammer" class="btn btn--gold" style="width: 100%; min-height: 64px;">
            <span>$${BALANCE.pit_workbench_economy.sledgehammerWeaponCost}</span>
          </button>
        </div>

      </div>

      <!-- Zone 3: Primary Next Wave Action -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: calc(var(--space-2) * var(--ui-scale)); margin-bottom: calc(var(--space-3) * var(--ui-scale));">
        <button id="btn-next-wave" class="btn btn--primary" style="width: min(440px, 92vw);">
          <span>${getIconSvg('play', 28)}</span>
          <span>В БОЙ! (+ $${BALANCE.pit_workbench_economy.earlyStartCashBonus})</span>
        </button>
      </div>
    `

    this.setupHandlers()
  }

  private setupHandlers(): void {
    const nextBtn = this.root.querySelector('#btn-next-wave')
    nextBtn?.addEventListener('click', () => {
      this.onNextWave(true)
    })

    const tryBuy = (type: 'kick' | 'bowling' | 'heal' | 'hammer', cost: number) => {
      const data = storageService.getData()
      if (data.cash >= cost) {
        data.cash -= cost
        if (type === 'kick') data.kickLevel++
        if (type === 'bowling') data.bowlingLevel++
        if (type === 'hammer') data.weaponLevel++
        storageService.save({
          cash: data.cash,
          kickLevel: data.kickLevel,
          bowlingLevel: data.bowlingLevel,
          weaponLevel: data.weaponLevel,
        })
        audioManager.play('workbench_buy')
        this.onUpgradeBought(type)
        this.updateCashDisplay()
      } else {
        audioManager.play('whoosh')
      }
    }

    this.root.querySelector('#btn-up-kick')?.addEventListener('click', () => {
      tryBuy('kick', BALANCE.pit_workbench_economy.kickUpgradeCostBase)
    })

    this.root.querySelector('#btn-up-bowling')?.addEventListener('click', () => {
      tryBuy('bowling', BALANCE.pit_workbench_economy.kickUpgradeCostBase)
    })

    this.root.querySelector('#btn-up-heal')?.addEventListener('click', () => {
      tryBuy('heal', BALANCE.pit_workbench_economy.medkitCost)
    })

    this.root.querySelector('#btn-up-hammer')?.addEventListener('click', () => {
      tryBuy('hammer', BALANCE.pit_workbench_economy.sledgehammerWeaponCost)
    })
  }

  public updateCashDisplay(): void {
    const data = storageService.getData()
    const cashEl = this.root.querySelector('#wb-cash-amount')
    if (cashEl) {
      cashEl.textContent = `$${data.cash}`
    }
  }

  public show(): void {
    this.updateCashDisplay()
  }

  public hide(): void {}
}
