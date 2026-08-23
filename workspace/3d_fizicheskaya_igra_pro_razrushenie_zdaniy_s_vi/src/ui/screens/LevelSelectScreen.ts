import { SESSION } from '../../core/balance'
import { createButton, el } from '../components/Button'
import { Stars } from '../components/Stars'
import type { I18n } from '../i18n'

export class LevelSelectScreen {
  readonly root: HTMLElement
  private readonly grid: HTMLElement
  private stars: Stars[] = []
  private cards: HTMLButtonElement[] = []

  constructor(
    i18n: I18n,
    layer: HTMLElement,
    onSelectLevel: (index: number) => void,
    onToggleSound: () => void,
    onOpenPause: () => void,
    private readonly getNextLevel: () => number,
  ) {
    this.root = el('div')

    const headerRow = el('div')
    headerRow.style.cssText =
      'display:flex;align-items:baseline;gap:var(--space-4);flex-wrap:wrap'
    headerRow.appendChild(el('h1', 'screen__title', i18n.t('sectors')))
    const subtitle = el('p', 'screen__subtitle', i18n.t('subtitle'))
    subtitle.style.marginInlineStart = 'auto'
    headerRow.appendChild(subtitle)
    this.root.appendChild(headerRow)

    this.grid = el('div', 'level-grid panel')
    this.grid.style.cssText = 'margin-top:var(--space-4);background:var(--panel-veil)'
    for (let i = 0; i < SESSION.TOTAL_LEVELS; i++) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'level-card'
      const name = el('span', undefined, `S-${String(i + 1).padStart(2, '0')}`)
      const stars = new Stars()
      card.appendChild(name)
      card.appendChild(stars.root)
      card.addEventListener('click', () => {
        if (!card.classList.contains('level-card--locked')) onSelectLevel(i)
      })
      this.grid.appendChild(card)
      this.cards.push(card)
      this.stars.push(stars)
    }
    this.root.appendChild(this.grid)

    const footer = el('div')
    footer.style.cssText =
      'display:flex;justify-content:center;gap:var(--space-3);margin-top:var(--space-4)'
    footer.appendChild(
      createButton({
        label: i18n.t('sound'),
        iconName: 'soundOn',
        variant: 'ghost',
        onClick: onToggleSound,
      }),
    )
    footer.appendChild(
      createButton({
        label: i18n.t('play'),
        iconName: 'play',
        variant: 'primary',
        onClick: () => onSelectLevel(this.getNextLevel()),
      }),
    )
    footer.appendChild(
      createButton({
        label: i18n.t('paused'),
        iconName: 'pause',
        variant: 'ghost',
        onClick: onOpenPause,
      }),
    )
    this.root.appendChild(footer)
    layer.appendChild(this.root)
  }

  /** Прогресс: звёзды и замки перерисовываются без пересборки сетки. */
  refresh(unlocked: number, starsPerLevel: number[]): void {
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]!
      const locked = i >= unlocked
      card.classList.toggle('level-card--locked', locked)
      const lockIcon = card.querySelector('.lock-slot')
      if (locked && !lockIcon) {
        const holder = el('span', 'lock-slot')
        holder.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-lock"></use></svg>'
        card.appendChild(holder)
      } else if (!locked && lockIcon) {
        lockIcon.remove()
      }
      this.stars[i]?.setStatic(starsPerLevel[i] ?? 0)
    }
  }
}
