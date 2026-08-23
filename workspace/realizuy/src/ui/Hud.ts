import { eventBus } from '../core/EventBus'
import { getIconSvg } from './icons'

export class Hud {
  public root: HTMLElement
  private hpBarFill: HTMLElement
  private hpText: HTMLElement
  private cashText: HTMLElement
  private waveText: HTMLElement
  private comboContainer: HTMLElement
  private comboText: HTMLElement

  private lastHp = -1
  private lastCash = -1
  private lastWave = -1
  private lastCombo = -1

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'hud-container'
    this.root.style.position = 'absolute'
    this.root.style.inset = '0'
    this.root.style.pointerEvents = 'none'

    this.root.innerHTML = `
      <div style="position: absolute; top: calc(var(--space-4) * var(--ui-scale) + var(--safe-t)); left: calc(var(--space-4) * var(--ui-scale) + var(--safe-l)); display: flex; align-items: center; gap: calc(var(--space-3) * var(--ui-scale));" class="panel">
        <div style="color: var(--color-danger); display: flex; align-items: center;">${getIconSvg('health', 24)}</div>
        <div style="width: 140px; height: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden;">
          <div id="hud-hp-fill" style="width: 100%; height: 100%; background: var(--color-danger); transition: width 0.15s ease;"></div>
        </div>
        <span id="hud-hp-text" class="tabular-nums" style="font-family: var(--font-display); font-size: 16px; min-width: 60px;">100 HP</span>
      </div>

      <div style="position: absolute; top: calc(var(--space-4) * var(--ui-scale) + var(--safe-t)); right: calc(var(--space-4) * var(--ui-scale) + var(--safe-r)); display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2);" class="panel">
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-gold);">
          <span>${getIconSvg('cash', 20)}</span>
          <span id="hud-cash-text" class="tabular-nums" style="font-family: var(--font-display); font-size: 20px;">$0</span>
        </div>
        <div id="hud-wave-text" style="font-size: 13px; color: var(--color-text-muted);">РАУНД 1 / 4</div>
      </div>

      <div id="hud-combo-banner" style="position: absolute; top: calc(var(--space-5) * var(--ui-scale) + var(--safe-t)); left: 50%; transform: translateX(-50%) scale(0); transition: transform 0.2s var(--ease-bounce); text-align: center; pointer-events: none;">
        <div class="panel" style="border-color: var(--color-primary); box-shadow: 0 0 20px var(--color-primary-glow);">
          <span id="hud-combo-text" style="font-family: var(--font-display); font-size: 24px; color: var(--color-primary);">RICOCHET x1.3!</span>
        </div>
      </div>
    `

    this.hpBarFill = this.root.querySelector('#hud-hp-fill') as HTMLElement
    this.hpText = this.root.querySelector('#hud-hp-text') as HTMLElement
    this.cashText = this.root.querySelector('#hud-cash-text') as HTMLElement
    this.waveText = this.root.querySelector('#hud-wave-text') as HTMLElement
    this.comboContainer = this.root.querySelector('#hud-combo-banner') as HTMLElement
    this.comboText = this.root.querySelector('#hud-combo-text') as HTMLElement

    this.setupListeners()
    eventBus.on('INPUT_SCHEME_CHANGED', (scheme: 'desktop' | 'touch') => {
      // Adaptive hint visibility if needed
      if (this.root) {
        this.root.dataset.inputScheme = scheme
      }
    })
  }

  private setupListeners(): void {
    eventBus.on('HP_CHANGED', (current: number, max: number) => {
      if (current === this.lastHp) return
      this.lastHp = current
      const pct = Math.max(0, Math.min(100, (current / max) * 100))
      this.hpBarFill.style.width = `${pct}%`
      this.hpText.textContent = `${Math.round(current)} HP`
    })

    eventBus.on('CASH_CHANGED', (cash: number) => {
      if (cash === this.lastCash) return
      this.lastCash = cash
      this.cashText.textContent = `$${cash}`
    })

    eventBus.on('WAVE_CHANGED', (current: number, total: number) => {
      if (current === this.lastWave) return
      this.lastWave = current
      this.waveText.textContent = `РАУНД ${current} / ${total}`
    })

    eventBus.on('COMBO_CHANGED', (mult: number, count: number) => {
      if (count <= 1) {
        this.comboContainer.style.transform = 'translateX(-50%) scale(0)'
        return
      }
      this.lastCombo = mult
      this.comboText.textContent = `RICOCHET x${mult.toFixed(1)}!`
      this.comboContainer.style.transform = 'translateX(-50%) scale(1.15)'
      setTimeout(() => {
        if (this.comboContainer) {
          this.comboContainer.style.transform = 'translateX(-50%) scale(1.0)'
        }
      }, 150)
    })
  }

  public setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none'
  }
}
