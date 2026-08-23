import { icon } from '../icons'
import { t } from '../locales'
import type { ScreenActions } from '../ScreenRouter'

export class MainMenuScreen {
  readonly root: HTMLElement
  private readonly best: HTMLParagraphElement

  constructor(private readonly actions: ScreenActions) {
    this.root = document.createElement('section')
    this.root.className = 'screen'
    this.root.dataset.screen = 'main_menu'
    this.root.hidden = true
    const identity = document.createElement('header')
    identity.className = 'screen__identity'
    identity.innerHTML = `<h1 class="screen__title">${t('title')}</h1><p class="screen__subtitle">${t('subtitle')}</p>`
    const content = document.createElement('div')
    content.className = 'screen__content'
    const hint = document.createElement('p')
    hint.className = 'hint'
    hint.textContent = t('menuHint')
    const play = this.button(t('fight'), 'btn btn--primary screen__action', actions.onStart)
    this.best = document.createElement('p')
    this.best.className = 'stat'
    content.append(play, this.best, hint)
    const secondary = document.createElement('div')
    secondary.className = 'screen__secondary'
    const sound = this.button(`${icon('sound')} ${t('soundOn')}`, 'btn', actions.onToggleSound)
    secondary.append(sound)
    if (actions.leaderboardSupported) secondary.append(this.button(`${icon('trophy')} ${t('leaderboard')}`, 'btn', actions.onLeaderboard))
    content.append(secondary)
    this.root.append(identity, content)
    this.setBest(0)
  }

  setBest(score: number): void { this.best.textContent = `${t('best')}: ${Math.round(score).toLocaleString('ru-RU')}` }

  private button(label: string, className: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.innerHTML = label
    button.addEventListener('click', action)
    return button
  }
}
