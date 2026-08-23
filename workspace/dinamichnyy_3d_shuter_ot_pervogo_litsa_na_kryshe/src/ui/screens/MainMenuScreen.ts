// MAIN_MENU: заголовок, рекорд и подсказка, главное действие — «В рейд».
// За меню видна живая сцена: непрозрачных заливок нет.

import { createButton, el } from '../components'
import { t } from '../../i18n/messages'

export class MainMenuScreen {
  readonly root: HTMLElement

  constructor(onStart: () => void) {
    this.root = el('div')

    const panel = el('div', 'panel')
    const title = el('div', 'title')
    title.textContent = t('title')
    const subtitle = el('div', 'subtitle')
    subtitle.textContent = t('subtitle')
    const bestRow = el('div', 'stat-row')
    const bestStat = el('div', 'stat')
    const bestLabel = el('span', 'stat-label')
    bestLabel.textContent = t('bestScore')
    this.bestValue = el('span', 'stat-value')
    this.bestValue.textContent = '0'
    bestStat.append(bestLabel, this.bestValue)
    bestRow.appendChild(bestStat)
    const hint = el('div', 'hint')
    hint.textContent = t('menuHint')
    panel.append(title, subtitle, bestRow, hint)

    this.startButton = createButton(t('startRaid'), onStart, undefined, true)

    this.root.appendChild(panel)
    this.root.appendChild(this.startButton.root)
  }

  private readonly startButton: ReturnType<typeof createButton>
  private readonly bestValue: HTMLElement

  setBest(score: number): void {
    this.bestValue.textContent = `${Math.round(score)}`
  }
}
