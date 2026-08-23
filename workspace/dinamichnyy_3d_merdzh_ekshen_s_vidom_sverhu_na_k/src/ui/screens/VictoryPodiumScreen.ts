import { icon } from '../icons'
import { t } from '../locales'
import type { ScreenActions } from '../ScreenRouter'

export class VictoryPodiumScreen {
  readonly root: HTMLElement
  private readonly result: HTMLParagraphElement

  constructor(actions: ScreenActions) {
    this.root = document.createElement('section'); this.root.className = 'screen'; this.root.dataset.screen = 'victory_podium'; this.root.hidden = true
    const identity = document.createElement('header'); identity.className = 'screen__identity'; identity.innerHTML = `<h2 class="screen__title">${t('victory')}</h2>`
    const content = document.createElement('div'); content.className = 'screen__content'
    this.result = document.createElement('p'); this.result.className = 'stat'
    const again = document.createElement('button'); again.type = 'button'; again.className = 'btn btn--primary screen__action'; again.textContent = t('continue'); again.addEventListener('click', actions.onRestart)
    const row = document.createElement('div'); row.className = 'screen__secondary'; row.append(this.button(t('menu'), actions.onMenu))
    if (actions.leaderboardSupported) row.append(this.button(`${icon('trophy')} ${t('leaderboard')}`, actions.onLeaderboard))
    content.append(this.result, again, row); this.root.append(identity, content)
  }

  setResult(score: number, ringouts: number, tier: number): void { this.result.textContent = `${t('score')}: ${Math.round(score).toLocaleString('ru-RU')} · ${t('ringouts')}: ${ringouts} · T${tier}` }

  private button(label: string, action: () => void): HTMLButtonElement { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.innerHTML = label; button.addEventListener('click', action); return button }
}
