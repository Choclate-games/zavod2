import { ScreenView } from '../ScreenRouter'
import { getIconSvg } from '../icons'
import { eventBus } from '../../core/EventBus'

export class HudOverlayScreen implements ScreenView {
  public root: HTMLElement

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'screen hud-overlay-screen'
    this.root.style.pointerEvents = 'none'

    this.root.innerHTML = `
      <div style="position: absolute; top: calc(var(--space-4) * var(--ui-scale) + var(--safe-t)); left: 50%; transform: translateX(-50%);">
        <!-- Center top empty placeholder or alerts -->
      </div>
      <div style="position: absolute; top: calc(var(--space-4) * var(--ui-scale) + var(--safe-t)); right: calc(180px * var(--ui-scale) + var(--safe-r)); pointer-events: auto;">
        <button id="btn-pause" class="btn" style="min-width: 64px; min-height: 64px; border-radius: 50%;">
          ${getIconSvg('pause', 24)}
        </button>
      </div>
    `

    const pauseBtn = this.root.querySelector('#btn-pause')
    pauseBtn?.addEventListener('click', () => {
      eventBus.emit('GAME_STATE_CHANGED', 'PAUSED')
    })
  }

  public show(): void {}
  public hide(): void {}
}
