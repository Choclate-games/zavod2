import { ScreenView } from '../ScreenRouter'
import { getIconSvg } from '../icons'
import { storageService } from '../../platform/StorageService'
import { playgamaService } from '../../platform/PlaygamaService'
import { audioManager } from '../../audio/AudioManager'

export class MainMenuScreen implements ScreenView {
  public root: HTMLElement
  private onStartGame: () => void

  constructor(onStartGame: () => void) {
    this.onStartGame = onStartGame
    this.root = document.createElement('div')
    this.root.className = 'screen main-menu-screen'

    const data = storageService.getData()

    this.root.innerHTML = `
      <!-- Zone 1: Identity & Title -->
      <div style="text-align: center; margin-top: calc(var(--space-4) * var(--ui-scale));">
        <h1 style="font-family: var(--font-display); font-size: clamp(28px, calc(42px * var(--ui-scale)), 56px); color: var(--color-primary); text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 24px var(--color-primary-glow);">
          KICK ARENA
        </h1>
        <div style="font-size: clamp(14px, calc(16px * var(--ui-scale)), 20px); color: var(--color-success); font-family: var(--font-display); letter-spacing: 4px; margin-top: 4px;">
          КИНЕТИЧЕСКИЙ РИКОШЕТ
        </div>
      </div>

      <!-- Zone 2: Content & Badges -->
      <div style="display: flex; justify-content: center; gap: calc(var(--space-4) * var(--ui-scale));">
        <div class="panel" style="display: flex; align-items: center; gap: calc(var(--space-3) * var(--ui-scale));">
          <div style="color: var(--color-gold);">${getIconSvg('cup', 32)}</div>
          <div>
            <div style="font-size: 12px; color: var(--color-text-muted);">КУБКИ ОКТАГОНА</div>
            <div id="menu-cups" class="tabular-nums" style="font-family: var(--font-display); font-size: 22px; color: var(--color-gold);">${data.cups}</div>
          </div>
        </div>

        <div class="panel" style="display: flex; align-items: center; gap: calc(var(--space-3) * var(--ui-scale));">
          <div style="color: var(--color-gold);">${getIconSvg('cash', 32)}</div>
          <div>
            <div style="font-size: 12px; color: var(--color-text-muted);">УЛИЧНЫЙ КЭШ</div>
            <div id="menu-cash" class="tabular-nums" style="font-family: var(--font-display); font-size: 22px; color: var(--color-text);">$${data.cash}</div>
          </div>
        </div>
      </div>

      <!-- Zone 3: Primary Action + Secondary Row -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: calc(var(--space-3) * var(--ui-scale)); margin-bottom: calc(var(--space-4) * var(--ui-scale));">
        <button id="btn-start-fight" class="btn btn--primary" style="width: min(420px, 90vw);">
          <span>${getIconSvg('fist', 32)}</span>
          <span>В ОКТАГОН!</span>
        </button>

        <div style="display: flex; gap: calc(var(--space-3) * var(--ui-scale));">
          <button id="btn-toggle-sound" class="btn" style="min-width: 64px; min-height: 64px;">
            <span id="sound-icon">${getIconSvg(data.soundMuted ? 'volume_mute' : 'volume', 24)}</span>
          </button>
        </div>
      </div>
    `

    this.setupHandlers()
  }

  private setupHandlers(): void {
    const startBtn = this.root.querySelector('#btn-start-fight') as HTMLElement
    startBtn?.addEventListener('click', () => {
      this.onStartGame()
    })

    const soundBtn = this.root.querySelector('#btn-toggle-sound') as HTMLElement
    soundBtn?.addEventListener('click', () => {
      const data = storageService.getData()
      const newMute = !data.soundMuted
      storageService.save({ soundMuted: newMute })
      audioManager.setMuted(newMute)
      const iconContainer = this.root.querySelector('#sound-icon')
      if (iconContainer) {
        iconContainer.innerHTML = getIconSvg(newMute ? 'volume_mute' : 'volume', 24)
      }
    })
  }

  public show(): void {
    const data = storageService.getData()
    const cupsEl = this.root.querySelector('#menu-cups')
    if (cupsEl) cupsEl.textContent = `${data.cups}`
    const cashEl = this.root.querySelector('#menu-cash')
    if (cashEl) cashEl.textContent = `$${data.cash}`
  }

  public hide(): void {}
}
