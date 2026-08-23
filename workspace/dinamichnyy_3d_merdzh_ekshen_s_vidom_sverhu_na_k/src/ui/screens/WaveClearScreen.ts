import { t } from '../locales'
import type { ScreenActions } from '../ScreenRouter'

export class WaveClearScreen {
  readonly root: HTMLElement
  private readonly stats: HTMLParagraphElement

  constructor(actions: ScreenActions) {
    this.root = document.createElement('section')
    this.root.className = 'screen'
    this.root.dataset.screen = 'wave_clear'
    this.root.hidden = true
    const identity = document.createElement('header'); identity.className = 'screen__identity'; identity.innerHTML = `<h2 class="screen__title">${t('clear')}</h2>`
    const content = document.createElement('div'); content.className = 'screen__content'
    this.stats = document.createElement('p'); this.stats.className = 'stat'
    const next = document.createElement('button'); next.type = 'button'; next.className = 'btn btn--primary screen__action'; next.textContent = t('next'); next.addEventListener('click', actions.onNextWave)
    content.append(this.stats, next)
    this.root.append(identity, content)
  }

  setStats(ringouts: number, score: number): void { this.stats.textContent = `${t('ringouts')}: ${ringouts} · ${t('score')}: ${Math.round(score).toLocaleString('ru-RU')}` }
}
