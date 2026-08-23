import { events } from '../../core/EventBus'
import { ICONS } from '../icons'

export class ScreenBattleHUD {
  private element: HTMLElement

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'ui-screen'
    this.element.id = 'screen-battle-hud'

    this.element.innerHTML = `
      <!-- Zone 1: Header / Quick Pause -->
      <div class="screen-header" style="justify-content: flex-end;">
        <button class="btn" id="btn-battle-pause" style="min-width: 64px; min-height: 64px;" title="Пауза">
          ${ICONS.pause}
        </button>
      </div>

      <!-- Zone 2: Empty transparent body (HUD and canvas visible) -->
      <div class="screen-body" style="pointer-events: none;"></div>

      <!-- Zone 3: Actions row placeholder -->
      <div class="screen-actions" style="pointer-events: none;"></div>
    `

    const pauseBtn = this.element.querySelector('#btn-battle-pause') as HTMLButtonElement
    pauseBtn.addEventListener('click', () => {
      events.emit('INPUT_TOGGLE_PAUSE', true)
    })

    parent.appendChild(this.element)
  }

  public show(): void {
    this.element.classList.add('active')
  }

  public hide(): void {
    this.element.classList.remove('active')
  }

  public getElement(): HTMLElement {
    return this.element
  }
}
