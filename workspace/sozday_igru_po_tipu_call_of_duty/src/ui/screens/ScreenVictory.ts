import { events } from '../../core/EventBus'
import { ICONS } from '../icons'
import { playgama } from '../../platform/PlaygamaService'
import { game } from '../../game/GameManager'

export class ScreenVictory {
  private element: HTMLElement
  private scoreEl: HTMLElement
  private creditsEl: HTMLElement
  private survivorsEl: HTMLElement
  private armorEl: HTMLElement
  private chainEl: HTMLElement
  private doubleBtn: HTMLButtonElement

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'ui-screen'
    this.element.id = 'screen-victory'

    this.element.innerHTML = `
      <!-- Zone 1: Header -->
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-subtitle" style="color: var(--color-success-green);">DEBRIEFING // ALL OBJECTIVES COMPLETED</div>
          <div class="screen-title" style="color: var(--color-success-green); text-shadow: 0 0 12px var(--color-success-green);">МИССИЯ ВЫПОЛНЕНА // ЭВАКУАЦИЯ УСПЕШНА</div>
        </div>
        <div class="ui-panel" style="font-size: calc(18px * var(--ui-scale)); font-weight: bold; color: var(--color-primary-hud);">
          РЕЙТИНГ: <span class="tabular-nums" id="vic-score">0</span> PTS
        </div>
      </div>

      <!-- Zone 2: Mission Telemetry Body -->
      <div class="screen-body">
        <div class="ui-panel" style="width: calc(640px * var(--ui-scale)); max-width: 85vw; display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="font-weight: bold; border-bottom: 1px solid var(--color-hud-border); padding-bottom: var(--space-2); color: var(--color-primary-hud);">
            СВОДКА БОЕВОЙ ЭФФЕКТИВНОСТИ SPECTRE
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); font-size: calc(14px * var(--ui-scale));">
            <div>ВЫЖИВШИЕ СПЕЦНАЗА: <span class="tabular-nums" id="vic-surv" style="font-weight: bold; color: var(--color-success-green);">4/4</span></div>
            <div>УНИЧТОЖЕНО БРОНЕТЕХНИКИ: <span class="tabular-nums" id="vic-armor" style="font-weight: bold;">0</span></div>
            <div>ЦЕПНЫХ ДЕТОНАЦИЙ: <span class="tabular-nums" id="vic-chain" style="font-weight: bold;">0</span></div>
            <div>НАЧИСЛЕНО КРЕДИТОВ: <span class="tabular-nums" id="vic-credits" style="font-weight: bold; color: var(--color-accent-gold);">+0</span></div>
          </div>
        </div>
      </div>

      <!-- Zone 3: Actions (Primary button >= 96px, secondary >= 64px) -->
      <div class="screen-actions">
        <button class="btn btn-primary btn-gold" id="btn-double-reward">
          ${ICONS.video} УДВОИТЬ НАГРАДУ (РЕКЛАМА)
        </button>
        <button class="btn" id="btn-vic-continue">
          ПРОДОЛЖИТЬ
        </button>
      </div>
    `

    this.scoreEl = this.element.querySelector('#vic-score')!
    this.creditsEl = this.element.querySelector('#vic-credits')!
    this.survivorsEl = this.element.querySelector('#vic-surv')!
    this.armorEl = this.element.querySelector('#vic-armor')!
    this.chainEl = this.element.querySelector('#vic-chain')!
    this.doubleBtn = this.element.querySelector('#btn-double-reward') as HTMLButtonElement

    this.setupListeners()
    parent.appendChild(this.element)
  }

  private setupListeners(): void {
    this.doubleBtn.addEventListener('click', async () => {
      this.doubleBtn.disabled = true
      const success = await playgama.showRewardedAd('double_credits')
      if (success) {
        game.doubleCreditsReward()
        const stats = game.getStats()
        this.creditsEl.textContent = `+${stats.creditsEarned}`
        this.doubleBtn.textContent = 'НАГРАДА УДВОЕНА'
      } else {
        this.doubleBtn.disabled = false
      }
    })

    const continueBtn = this.element.querySelector('#btn-vic-continue') as HTMLButtonElement
    continueBtn.addEventListener('click', () => {
      playgama.showInterstitialAd()
      events.emit('NAVIGATE_SCREEN', 'ScreenMainMenu')
    })
  }

  public show(): void {
    const stats = game.getStats()
    this.scoreEl.textContent = stats.totalScore.toString()
    this.creditsEl.textContent = `+${stats.creditsEarned}`
    this.survivorsEl.textContent = `${stats.survivors}/4`
    this.armorEl.textContent = stats.armorDestroyed.toString()
    this.chainEl.textContent = stats.chainExplosions.toString()
    this.doubleBtn.disabled = false
    this.doubleBtn.innerHTML = `${ICONS.video} УДВОИТЬ НАГРАДУ (РЕКЛАМА)`

    this.element.classList.add('active')
  }

  public hide(): void {
    this.element.classList.remove('active')
  }

  public getElement(): HTMLElement {
    return this.element
  }
}
