import { events } from '../../core/EventBus'
import { ICONS } from '../icons'
import { playgama } from '../../platform/PlaygamaService'
import { game } from '../../game/GameManager'
import { DefeatReason } from '../../types'

export class ScreenDefeat {
  private element: HTMLElement
  private reasonTitleEl: HTMLElement
  private reasonDescEl: HTMLElement
  private reviveBtn: HTMLButtonElement

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'ui-screen'
    this.element.id = 'screen-defeat'

    this.element.innerHTML = `
      <!-- Zone 1: Header -->
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-subtitle" style="color: var(--color-danger-alert);">CRITICAL CASUALTY // PROTOCOL FAILURE</div>
          <div class="screen-title" style="color: var(--color-danger-alert); text-shadow: 0 0 12px var(--color-danger-alert);" id="defeat-title">
            ОПЕРАТИВНЫЙ ПРОВАЛ
          </div>
        </div>
      </div>

      <!-- Zone 2: Failure Analysis Body -->
      <div class="screen-body">
        <div class="ui-panel" style="width: calc(640px * var(--ui-scale)); max-width: 85vw; display: flex; flex-direction: column; gap: var(--space-3); border-color: var(--color-danger-border);">
          <div style="font-weight: bold; color: var(--color-danger-alert); border-bottom: 1px solid var(--color-danger-border); padding-bottom: var(--space-2);">
            РАССЛЕДОВАНИЕ ИНЦИДЕНТА ШТАБОМ
          </div>
          
          <div style="font-size: calc(14px * var(--ui-scale)); line-height: 1.5; color: var(--color-thermal-hot);" id="defeat-desc">
            Операция сорвана из-за гибели союзного отряда спецназа Bravo-6.
          </div>

          <div style="font-size: calc(11px * var(--ui-scale)); color: var(--color-text-dim);">
            СОВЕТ: Следите за мерцанием ИК-стробоскопов союзников на 2.0 Гц. Не стреляйте 105мм гаубицей в радиусе ближе 14.5м от спецназа.
          </div>
        </div>
      </div>

      <!-- Zone 3: Actions (Primary button >= 96px, secondary >= 64px) -->
      <div class="screen-actions">
        <button class="btn btn-primary" id="btn-revive-squad">
          ${ICONS.shield} ЭКСТРЕННАЯ РЕАНИМАЦИЯ (РЕКЛАМА)
        </button>
        <button class="btn" id="btn-defeat-retry">
          ВЕРНУТЬСЯ В ШТАБ
        </button>
      </div>
    `

    this.reasonTitleEl = this.element.querySelector('#defeat-title')!
    this.reasonDescEl = this.element.querySelector('#defeat-desc')!
    this.reviveBtn = this.element.querySelector('#btn-revive-squad') as HTMLButtonElement

    this.setupListeners()
    parent.appendChild(this.element)
  }

  private setupListeners(): void {
    events.on('DEFEAT_REASON_SET', (reason: DefeatReason) => {
      this.setReason(reason)
    })

    this.reviveBtn.addEventListener('click', async () => {
      this.reviveBtn.disabled = true
      const success = await playgama.showRewardedAd('revive_squad')
      if (success) {
        game.reviveSquadReward()
        events.emit('NAVIGATE_SCREEN', 'ScreenBattleHUD')
      } else {
        this.reviveBtn.disabled = false
      }
    })

    const retryBtn = this.element.querySelector('#btn-defeat-retry') as HTMLButtonElement
    retryBtn.addEventListener('click', () => {
      playgama.showInterstitialAd()
      events.emit('NAVIGATE_SCREEN', 'ScreenMainMenu')
    })
  }

  public setReason(reason: DefeatReason): void {
    if (reason === 'FRIENDLY_FIRE') {
      this.reasonTitleEl.textContent = 'ПРОВАЛ // ДРУЖЕСТВЕННЫЙ ОГОНЬ'
      this.reasonDescEl.textContent = 'Попадание тяжелого снаряда 105мм/40мм в радиус отряда «Браво-6». Грубое нарушение протокола Danger Close.'
    } else if (reason === 'SQUAD_KIA') {
      this.reasonTitleEl.textContent = 'ПРОВАЛ // ГИБЕЛЬ ОТРИДА BRAVO-6'
      this.reasonDescEl.textContent = 'Все бойцы союзного отряда погибли под огнем противника. Огневая поддержка не справилась с подавлением угроз.'
    } else {
      this.reasonTitleEl.textContent = 'ПРОВАЛ // ИСТЕКЛО ВРЕМЯ МИССИИ'
      this.reasonDescEl.textContent = 'Превышен лимит времени спецоперации (100 секунд). Эвакуационный борт был вынужден покинуть зону.'
    }
  }

  public show(): void {
    this.reviveBtn.disabled = false
    this.element.classList.add('active')
  }

  public hide(): void {
    this.element.classList.remove('active')
  }

  public getElement(): HTMLElement {
    return this.element
  }
}
