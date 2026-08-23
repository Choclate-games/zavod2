import { ScreenView } from '../ScreenRouter'
import { getIconSvg } from '../icons'
import { storageService } from '../../platform/StorageService'
import { audioManager } from '../../audio/AudioManager'

export class PauseModal implements ScreenView {
  public root: HTMLElement
  private onResume: () => void
  private onQuit: () => void

  constructor(onResume: () => void, onQuit: () => void) {
    this.onResume = onResume
    this.onQuit = onQuit
    this.root = document.createElement('div')
    this.root.className = 'screen pause-modal-screen'
    this.root.style.display = 'flex'
    this.root.style.justifyContent = 'center'
    this.root.style.alignItems = 'center'

    const data = storageService.getData()

    this.root.innerHTML = `
      <div class="panel" style="width: min(440px, 90vw); display: flex; flex-direction: column; align-items: center; gap: calc(var(--space-4) * var(--ui-scale));">
        
        <h2 style="font-family: var(--font-display); font-size: clamp(24px, calc(30px * var(--ui-scale)), 36px); color: var(--color-primary); letter-spacing: 2px;">
          ПАУЗА МАТЧА
        </h2>

        <div style="font-size: 13px; color: var(--color-text-muted); text-align: center; line-height: 1.6;">
          WASD / Стик — движение<br>
          Пробел / Кнопка Kick — спартанский пинок<br>
          Shift / Кнопка Dash — рывок уклонения<br>
          E / Кнопка Grab — подбор и бросок
        </div>

        <div style="display: flex; flex-direction: column; gap: calc(var(--space-3) * var(--ui-scale)); width: 100%;">
          <button id="btn-pause-resume" class="btn btn--primary" style="width: 100%;">
            <span>${getIconSvg('play', 28)}</span>
            <span>ПРОДОЛЖИТЬ</span>
          </button>

          <div style="display: flex; gap: var(--space-2);">
            <button id="btn-pause-sound" class="btn" style="flex: 1;">
              <span id="pause-sound-icon">${getIconSvg(data.soundMuted ? 'volume_mute' : 'volume', 24)}</span>
              <span>ЗВУК</span>
            </button>

            <button id="btn-pause-quit" class="btn btn--danger" style="flex: 1;">
              <span>В МЕНЮ</span>
            </button>
          </div>
        </div>

      </div>
    `

    this.setupHandlers()
  }

  private setupHandlers(): void {
    this.root.querySelector('#btn-pause-resume')?.addEventListener('click', () => {
      this.onResume()
    })

    this.root.querySelector('#btn-pause-quit')?.addEventListener('click', () => {
      this.onQuit()
    })

    this.root.querySelector('#btn-pause-sound')?.addEventListener('click', () => {
      const data = storageService.getData()
      const newMute = !data.soundMuted
      storageService.save({ soundMuted: newMute })
      audioManager.setMuted(newMute)
      const icon = this.root.querySelector('#pause-sound-icon')
      if (icon) {
        icon.innerHTML = getIconSvg(newMute ? 'volume_mute' : 'volume', 24)
      }
    })
  }

  public show(): void {}
  public hide(): void {}
}
