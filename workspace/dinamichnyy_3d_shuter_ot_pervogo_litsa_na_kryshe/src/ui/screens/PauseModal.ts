// PAUSE_MODAL: пауза, звук, чувствительность. Главное действие — продолжить.

import { createButton, el } from '../components'
import { t } from '../../i18n/messages'

export class PauseModal {
  readonly root: HTMLElement

  constructor(callbacks: {
    onResume: () => void
    onRestart: () => void
    onToMenu: () => void
    onToggleSound: () => boolean
    onChangeSensitivity: (value: number) => void
    getSensitivity: () => number
  }) {
    this.root = el('div')

    const panel = el('div', 'panel')
    const title = el('div', 'title')
    title.textContent = t('pause')
    panel.appendChild(title)

    this.soundButton = createButton(t('soundOn'), () => {
      const muted = callbacks.onToggleSound()
      this.soundButton.root.querySelector('span:last-child')!.textContent = muted ? t('soundOff') : t('soundOn')
    })
    panel.appendChild(this.soundButton.root)

    const sensRow = el('div', 'stat-row')
    const sensStat = el('div', 'stat')
    const sensLabel = el('span', 'stat-label')
    sensLabel.textContent = t('sensitivity')
    this.sensValue = el('span', 'stat-value')
    this.sensValue.textContent = callbacks.getSensitivity().toFixed(1)
    const minus = createButton('-', () => this.stepSens(-0.1, callbacks))
    const plus = createButton('+', () => this.stepSens(0.1, callbacks))
    minus.root.style.minHeight = '48px'
    plus.root.style.minHeight = '48px'
    sensRow.append(minus.root, sensStat, plus.root)
    sensStat.append(sensLabel, this.sensValue)
    panel.appendChild(sensRow)

    this.resumeButton = createButton(t('resume'), callbacks.onResume, undefined, true)
    const row = el('div')
    row.style.display = 'flex'
    row.style.gap = 'var(--gap)'
    const restart = createButton(t('restart'), callbacks.onRestart)
    const toMenu = createButton(t('toMenu'), callbacks.onToMenu)
    row.append(restart.root, toMenu.root)

    this.root.append(panel, this.resumeButton.root, row)
  }

  private readonly resumeButton: ReturnType<typeof createButton>
  private readonly soundButton: ReturnType<typeof createButton>
  private readonly sensValue: HTMLElement

  private stepSens(delta: number, callbacks: { onChangeSensitivity: (v: number) => void; getSensitivity: () => number }): void {
    const next = Math.min(3, Math.max(0.2, Math.round((callbacks.getSensitivity() + delta) * 10) / 10))
    callbacks.onChangeSensitivity(next)
    this.sensValue.textContent = next.toFixed(1)
  }
}
