// VICTORY_SCREEN: время, счёт, убийства, ранг. Главное действие — ещё рейд.

import { createButton, el } from '../components'
import { t } from '../../i18n/messages'
import type { RunResultState } from '../../core/state'

export class VictoryScreen {
  readonly root: HTMLElement

  constructor(onAgain: () => void, onToMenu: () => void) {
    this.root = el('div')

    const panel = el('div', 'panel')
    const title = el('div', 'title')
    title.style.color = 'var(--c-success)'
    title.textContent = t('victoryTitle')
    this.newRecord = el('div', 'subtitle hidden')
    this.newRecord.textContent = t('newRecord')

    const row = el('div', 'stat-row')
    this.scoreValue = this.stat(row, t('score'))
    this.killsValue = this.stat(row, t('kills'))
    this.timeValue = this.stat(row, t('timeLeft'))
    this.rankValue = this.stat(row, t('rank'))
    panel.append(title, this.newRecord, row)

    this.againButton = createButton(t('raidAgain'), onAgain, undefined, true)
    const menuButton = createButton(t('toMenu'), onToMenu)

    this.root.append(panel, this.againButton.root, menuButton.root)
  }

  private readonly againButton: ReturnType<typeof createButton>
  private readonly scoreValue: HTMLElement
  private readonly killsValue: HTMLElement
  private readonly timeValue: HTMLElement
  private readonly rankValue: HTMLElement
  private readonly newRecord: HTMLElement

  private stat(parent: HTMLElement, label: string): HTMLElement {
    const wrap = el('div', 'stat')
    const caption = el('span', 'stat-label')
    caption.textContent = label
    const value = el('span', 'stat-value')
    value.textContent = '0'
    wrap.append(caption, value)
    parent.appendChild(wrap)
    return value
  }

  show(result: RunResultState, isRecord: boolean): void {
    this.scoreValue.textContent = `${Math.round(result.score)}`
    this.killsValue.textContent = `${result.kills}`
    this.timeValue.textContent = `${Math.ceil(result.timeLeftS)}s`
    this.rankValue.textContent = result.rank
    this.rankValue.style.color = result.rank === 'S' ? 'var(--c-success)' : ''
    this.newRecord.classList.toggle('hidden', !isRecord)
  }
}
