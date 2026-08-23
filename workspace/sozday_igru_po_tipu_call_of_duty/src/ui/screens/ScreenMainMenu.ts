import { events } from '../../core/EventBus'
import { ICONS } from '../icons'
import { playgama } from '../../platform/PlaygamaService'

export class ScreenMainMenu {
  private element: HTMLElement
  private creditsEl: HTMLElement

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'ui-screen active'
    this.element.id = 'screen-main-menu'

    this.element.innerHTML = `
      <!-- Zone 1: Header / Status -->
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-subtitle">TACTICAL AIR COMMAND // CALLSIGN: SPECTRE 2-0</div>
          <div class="screen-title">AC-130: НОЧНОЙ ТЕПЛОВИЗОР</div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <div class="ui-panel" style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-accent-gold);">
            ${ICONS.credits}
            <span style="font-weight: bold;">КРЕДИТЫ: <span class="tabular-nums" id="menu-credits">500</span></span>
          </div>
          <button class="btn" id="btn-sound-toggle" style="min-width: 64px; min-height: 64px;" title="Звук">
            ${ICONS.soundOn}
          </button>
        </div>
      </div>

      <!-- Zone 2: Mission Briefing Body -->
      <div class="screen-body">
        <div class="ui-panel" style="width: calc(640px * var(--ui-scale)); max-width: 85vw; display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--color-hud-border); padding-bottom: var(--space-2);">
            <span style="font-weight: bold; color: var(--color-primary-hud);">СПЕЦОПЕРАЦИЯ: НОЧНОЙ ЭСКОРТ</span>
            <span style="color: var(--color-accent-gold); font-weight: bold;">СЕКТОР 17</span>
          </div>
          <div style="font-size: calc(13px * var(--ui-scale)); line-height: 1.5; color: var(--color-thermal-hot);">
            Отряд специального назначения <b>«Браво-6»</b> (4 бойца с ИК-стробоскопами) пробивается через вражеский город к точке вертолетной эвакуации. Обеспечьте подавление огневых точек 25мм пулеметом, уничтожайте пикапы 40мм автопушкой и применяйте 105мм гаубицу по танкам с соблюдением протокола <b>Danger Close</b>.
          </div>
          <div style="display: flex; gap: var(--space-3); font-size: calc(11px * var(--ui-scale)); color: var(--color-text-dim);">
            <div>ЦЕЛЬ: ЭВАКУАЦИЯ СПЕЦНАЗА</div>
            <div>ВРЕМЯ: 90 СЕКУНД</div>
            <div>ВЫСОТА ОРБИТЫ: 1000 М</div>
          </div>
        </div>
      </div>

      <!-- Zone 3: Actions (Primary button >= 96px, secondary >= 64px) -->
      <div class="screen-actions">
        <button class="btn btn-primary" id="btn-start-mission">
          ${ICONS.play} В БОЙ / СТАРТ
        </button>
        <button class="btn btn-gold" id="btn-open-armory">
          ${ICONS.armory} АРСЕНАЛ
        </button>
      </div>
    `

    this.creditsEl = this.element.querySelector('#menu-credits')!
    this.setupListeners()
    parent.appendChild(this.element)
  }

  private setupListeners(): void {
    const startBtn = this.element.querySelector('#btn-start-mission') as HTMLButtonElement
    startBtn.addEventListener('click', () => {
      events.emit('NAVIGATE_SCREEN', 'ScreenBattleHUD')
    })

    const armoryBtn = this.element.querySelector('#btn-open-armory') as HTMLButtonElement
    armoryBtn.addEventListener('click', () => {
      events.emit('NAVIGATE_SCREEN', 'ScreenArmory')
    })

    const soundBtn = this.element.querySelector('#btn-sound-toggle') as HTMLButtonElement
    soundBtn.addEventListener('click', () => {
      const save = playgama.getSaveData()
      const newSound = !save.soundEnabled
      playgama.updateSaveData({ soundEnabled: newSound })
      soundBtn.innerHTML = newSound ? ICONS.soundOn : ICONS.soundOff
      events.emit('SOUND_TOGGLED', newSound)
    })
  }

  public show(): void {
    const save = playgama.getSaveData()
    this.creditsEl.textContent = save.credits.toString()
    this.element.classList.add('active')
  }

  public hide(): void {
    this.element.classList.remove('active')
  }

  public getElement(): HTMLElement {
    return this.element
  }
}
