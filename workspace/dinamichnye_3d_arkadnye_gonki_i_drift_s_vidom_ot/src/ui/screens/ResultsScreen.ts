import { t } from '../../data/i18n'
import type { UiController, ScreenCaps } from './controller'
import { createButton } from '../components/Button'
import { createPanel, createStat } from '../components/Meter'

export interface RunResult {
  time: number
  volumeRatio: number
  score: number
  stars: number
  win: boolean
}

/**
 * ResultsScreen: анимация взвешивания цистерны (объём тикает до финального),
 * звёзды, время и очки. Главное действие — следующий перевал или ещё раз.
 */
export class ResultsScreen {
  readonly rootElement: HTMLElement
  private headline: HTMLHeadingElement
  private timeStat: HTMLDivElement
  private volumeStat: HTMLDivElement
  private scoreStat: HTMLDivElement
  private starsRow: HTMLSpanElement
  private actions: HTMLDivElement
  private doubleBtn: HTMLButtonElement | null = null

  constructor(
    private readonly controller: UiController,
    private readonly caps: ScreenCaps,
  ) {
    const root = document.createElement('div')
    root.className = 'modal-dim'

    const panel = createPanel(true)
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.alignItems = 'center'
    panel.style.gap = '16px'
    panel.style.minWidth = 'min(92vw, 520px)'

    this.headline = document.createElement('h2')
    this.headline.className = 'game-title'

    this.starsRow = document.createElement('span')
    this.starsRow.className = 'stars'

    const grid = document.createElement('div')
    grid.className = 'results-grid'
    const time = createStat('results.time')
    this.timeStat = time.value
    const volume = createStat('hud.volume')
    this.volumeStat = volume.value
    const score = createStat('results.score')
    this.scoreStat = score.value
    grid.append(time.root, volume.root, score.root)

    this.actions = document.createElement('div')
    this.actions.style.display = 'flex'
    this.actions.style.flexWrap = 'wrap'
    this.actions.style.gap = '12px'
    this.actions.style.justifyContent = 'center'

    panel.append(this.headline, this.starsRow, grid, this.actions)
    root.appendChild(panel)
    this.rootElement = root
  }

  show(result: RunResult, hasNextTrack: boolean): void {
    this.headline.textContent = t(result.win ? 'results.win' : 'results.lose')
    this.starsRow.innerHTML = ''
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span')
      star.innerHTML = starIcon()
      star.style.opacity = i < result.stars ? '1' : '0.18'
      this.starsRow.appendChild(star)
    }
    this.timeStat.textContent = `${result.time.toFixed(1)} с`
    this.scoreStat.textContent = String(result.score)
    animateVolume(this.volumeStat, result.volumeRatio)

    this.actions.replaceChildren()
    if (result.win && this.caps.rewardedSupported) {
      this.doubleBtn = createButton({
        labelKey: 'results.double',
        iconName: 'turbo',
        onClick: () => {
          this.controller.doubleReward()
          this.markDoubled()
        },
      })
      this.actions.appendChild(this.doubleBtn)
    }
    this.actions.appendChild(
      createButton({
        labelKey: hasNextTrack && result.win ? 'results.next' : 'results.retry',
        primaryAction: true,
        onClick: () => this.controller.resultsPrimary(),
      }),
    )
    this.actions.appendChild(
      createButton({ labelKey: 'pause.menu', iconName: 'home', onClick: () => this.controller.toMenu() }),
    )
  }

  markDoubled(): void {
    if (this.doubleBtn) this.doubleBtn.setAttribute('disabled', '')
  }
}

function starIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.9 6.26L21.5 9.27l-4.75 4.38 1.25 6.6L12 17.05l-5.99 3.2 1.24-6.6L2.5 9.27l6.6-1.01L12 2z" fill="currentColor"/></svg>'
}

function animateVolume(target: HTMLElement, ratio: number): void {
  let current = 0
  const step = (): void => {
    current += Math.max(0.02, ratio / 22)
    if (current >= ratio) {
      target.textContent = `${Math.round(ratio * 100)}%`
      return
    }
    target.textContent = `${Math.round(current * 100)}%`
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
