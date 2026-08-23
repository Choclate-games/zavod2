// DEFEAT_MODAL: причина, счёт и возрождение за rewarded-ролик,
// если площадка его поддерживает. Возможности нет — кнопки нет в DOM.

import { createButton, el } from '../components'
import { t } from '../../i18n/messages'
import type { DefeatReason, RunResultState } from '../../core/state'

export class DefeatModal {
  readonly root: HTMLElement

  constructor(callbacks: {
    onRevive: () => void
    onRestart: () => void
    onToMenu: () => void
  }) {
    this.root = el('div')

    const panel = el('div', 'panel')
    const title = el('div', 'title')
    title.style.color = 'var(--c-danger)'
    title.textContent = t('defeatTitle')
    this.reason = el('div', 'hint')

    const row = el('div', 'stat-row')
    this.scoreValue = this.stat(row, t('score'))
    this.killsValue = this.stat(row, t('kills'))
    panel.append(title, this.reason, row)

    // Revive рисуется только когда мост подтвердил rewarded
    this.reviveButton = createButton(t('revive'), callbacks.onRevive)
    this.reviveHint = el('div', 'hint')
    this.reviveHint.textContent = t('reviveHint')

    const actions = el('div')
    actions.style.display = 'flex'
    actions.style.gap = 'var(--gap)'
    this.restartButton = createButton(t('restart'), callbacks.onRestart, undefined, true)
    const menu = createButton(t('toMenu'), callbacks.onToMenu)
    actions.append(this.restartButton.root, menu.root)

    this.root.append(panel, this.reviveButton.root, this.reviveHint, actions)
  }

  private readonly reason: HTMLElement
  private readonly scoreValue: HTMLElement
  private readonly killsValue: HTMLElement
  private readonly reviveButton: ReturnType<typeof createButton>
  private readonly reviveHint: HTMLElement
  private readonly restartButton: ReturnType<typeof createButton>

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

  show(result: RunResultState, reason: DefeatReason, reviveAvailable: boolean): void {
    this.reason.textContent =
      reason === 'shield'
        ? t('defeatShield')
        : reason === 'fall'
          ? t('defeatFall')
          : t('defeatTimeout')
    this.scoreValue.textContent = `${Math.round(result.score)}`
    this.killsValue.textContent = `${result.kills}`
    if (reviveAvailable) {
      this.reviveButton.root.classList.remove('hidden')
      this.reviveHint.classList.remove('hidden')
      this.restartButton.setDisabled(false)
    } else {
      // возможности нет — элемент не существует для игрока вовсе
      this.reviveButton.root.classList.add('hidden')
      this.reviveHint.classList.add('hidden')
    }
  }
}
