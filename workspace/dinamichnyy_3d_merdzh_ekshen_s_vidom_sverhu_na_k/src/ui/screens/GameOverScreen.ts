import { t } from '../locales'
import type { ScreenActions } from '../ScreenRouter'

export class GameOverScreen {
  readonly root: HTMLElement
  private readonly stats: HTMLParagraphElement

  constructor(private readonly actions: ScreenActions) {
    this.root = document.createElement('section'); this.root.className = 'screen'; this.root.dataset.screen = 'game_over'; this.root.hidden = true
    const identity = document.createElement('header'); identity.className = 'screen__identity'; identity.innerHTML = `<h2 class="screen__title">${t('defeat')}</h2>`
    const content = document.createElement('div'); content.className = 'screen__content'
    this.stats = document.createElement('p'); this.stats.className = 'stat'
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--primary screen__action'; retry.textContent = t('retry'); retry.addEventListener('click', actions.onRestart)
    const row = document.createElement('div'); row.className = 'screen__secondary'
    row.append(this.button(t('menu'), actions.onMenu))
    if (actions.rewardedSupported) row.append(this.button(t('reward'), actions.onReward))
    content.append(this.stats, retry, row); this.root.append(identity, content)
  }

  setStats(score: number, ringouts: number): void { this.stats.textContent = `${t('score')}: ${Math.round(score).toLocaleString('ru-RU')} · ${t('ringouts')}: ${ringouts}` }

  private button(label: string, action: () => void): HTMLButtonElement { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = label; button.addEventListener('click', action); return button }
}
