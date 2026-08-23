import { ScreenView } from '../ScreenRouter'
import { getIconSvg } from '../icons'
import { storageService } from '../../platform/StorageService'
import { playgamaService } from '../../platform/PlaygamaService'

export class VictoryDefeatScreen implements ScreenView {
  public root: HTMLElement
  private isVictory = false
  private onRestart: () => void
  private onRevive?: () => void
  private onMenu: () => void

  constructor(
    onRestart: () => void,
    onMenu: () => void,
    onRevive?: () => void,
  ) {
    this.onRestart = onRestart
    this.onMenu = onMenu
    this.onRevive = onRevive
    this.root = document.createElement('div')
    this.root.className = 'screen victory-defeat-screen'
    this.root.style.display = 'flex'
    this.root.style.justifyContent = 'center'
    this.root.style.alignItems = 'center'

    this.render()
  }

  public setMode(isVictory: boolean): void {
    this.isVictory = isVictory
    this.render()
  }

  private render(): void {
    const title = this.isVictory ? 'ПОБЕДА В ТУРНИРЕ!' : 'НОКАУТ!'
    const titleColor = this.isVictory ? 'var(--color-success)' : 'var(--color-danger)'
    const subTitle = this.isVictory ? 'ЧЕМПИОН ПОДПОЛЬНОГО ОКТАГОНА' : 'БОЕЦ ПОВЕРЖЕН'
    const data = storageService.getData()

    const hasRewarded = playgamaService.isRewardedSupported()

    this.root.innerHTML = `
      <div class="panel" style="width: min(480px, 92vw); display: flex; flex-direction: column; align-items: center; gap: calc(var(--space-4) * var(--ui-scale)); text-align: center;">
        
        <div>
          <h2 style="font-family: var(--font-display); font-size: clamp(26px, calc(34px * var(--ui-scale)), 44px); color: ${titleColor}; letter-spacing: 2px;">
            ${title}
          </h2>
          <div style="font-size: 13px; color: var(--color-text-muted); margin-top: 4px; letter-spacing: 1px;">
            ${subTitle}
          </div>
        </div>

        <div style="display: flex; gap: calc(var(--space-3) * var(--ui-scale)); justify-content: center; width: 100%;">
          <div class="panel" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="color: var(--color-gold);">${getIconSvg('cup', 28)}</div>
            <div style="font-size: 11px; color: var(--color-text-muted);">КУБКИ</div>
            <div class="tabular-nums" style="font-family: var(--font-display); font-size: 18px; color: var(--color-gold);">${data.cups}</div>
          </div>
          <div class="panel" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="color: var(--color-gold);">${getIconSvg('cash', 28)}</div>
            <div style="font-size: 11px; color: var(--color-text-muted);">КЭШ</div>
            <div class="tabular-nums" style="font-family: var(--font-display); font-size: 18px;">$${data.cash}</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: calc(var(--space-2) * var(--ui-scale)); width: 100%;">
          ${
            !this.isVictory && this.onRevive && hasRewarded
              ? `<button id="btn-revive-reward" class="btn btn--gold" style="width: 100%; min-height: 64px;">
                  <span>${getIconSvg('health', 24)}</span>
                  <span>ВТОРОЕ ДЫХАНИЕ (REVIVE)</span>
                </button>`
              : ''
          }

          <button id="btn-result-restart" class="btn btn--primary" style="width: 100%;">
            <span>${getIconSvg('restart', 28)}</span>
            <span>${this.isVictory ? 'НОВЫЙ ТУРНИР' : 'РЕВАНШ'}</span>
          </button>

          <button id="btn-result-menu" class="btn" style="width: 100%;">
            <span>ГЛАВНОЕ МЕНЮ</span>
          </button>
        </div>

      </div>
    `

    this.setupHandlers()
  }

  private setupHandlers(): void {
    this.root.querySelector('#btn-result-restart')?.addEventListener('click', () => {
      playgamaService.showInterstitial().finally(() => {
        this.onRestart()
      })
    })

    this.root.querySelector('#btn-result-menu')?.addEventListener('click', () => {
      playgamaService.showInterstitial().finally(() => {
        this.onMenu()
      })
    })

    this.root.querySelector('#btn-revive-reward')?.addEventListener('click', () => {
      playgamaService.showRewarded(() => {
        if (this.onRevive) {
          this.onRevive()
        }
      })
    })
  }

  public show(): void {
    this.render()
  }

  public hide(): void {}
}
