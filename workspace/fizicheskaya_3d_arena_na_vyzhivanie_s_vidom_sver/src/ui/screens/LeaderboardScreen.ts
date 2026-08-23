import { createButton } from '../components/Widgets'
import { iconSvg } from '../icons'
import type { I18n } from '../I18n'
import type { UiActions, UiState } from '../types'
import type { Screen } from '../ScreenRouter'

/**
 * Лига Айсбергов: таблица рекордов. Есть состояния загрузки, пустоты и ошибки.
 * Если у площадки нет лидербордов — показываются локальные рекорды из сейва.
 */
export class LeaderboardScreen implements Screen {
  readonly name = 'leaderboard_screen'
  readonly root: HTMLElement
  private readonly rows: HTMLElement
  private readonly statusLine: HTMLElement

  constructor(
    private readonly i18n: I18n,
    actions: UiActions,
    private readonly getState: () => UiState,
    private readonly loadRemoteScores: () => Promise<number[] | null>,
  ) {
    this.root = document.createElement('div')

    const header = document.createElement('div')
    header.style.position = 'absolute'
    header.style.left = 'calc(24px + env(safe-area-inset-left))'
    header.style.top = 'calc(16px + env(safe-area-inset-top))'
    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = i18n.t('leaderboard_title')
    this.statusLine = document.createElement('div')
    this.statusLine.className = 'subtitle'
    header.append(title, this.statusLine)

    const backButton = createButton(i18n.t('back'), { small: true, iconName: 'back' })
    backButton.root.addEventListener('click', () => actions.backToMenu())
    backButton.root.style.position = 'absolute'
    backButton.root.style.right = 'calc(24px + env(safe-area-inset-right))'
    backButton.root.style.top = 'calc(16px + env(safe-area-inset-top))'

    this.rows = document.createElement('div')
    this.rows.style.position = 'absolute'
    this.rows.style.inset = 'calc(88px + env(safe-area-inset-top)) calc(24px) calc(24px + var(--banner-height)) calc(24px)'
    this.rows.style.display = 'flex'
    this.rows.style.flexDirection = 'column'
    this.rows.style.gap = 'var(--space-2)'
    this.rows.style.overflowY = 'auto'

    this.root.append(header, backButton.root, this.rows)
  }

  onShow(): void {
    // Загрузка: честное состояние, а не пустая рамка.
    this.statusLine.textContent = '...'
    this.rows.replaceChildren()
    void this.loadRemoteScores()
      .then((remote) => {
        const local = this.getState().bestScores
        const scores = remote && remote.length > 0 ? remote : local
        if (scores.length === 0) {
          this.showEmpty()
          return
        }
        if (remote === null) {
          this.statusLine.textContent = `${this.i18n.t('leaderboard_error')}`
        } else {
          this.statusLine.textContent = ''
        }
        this.renderRows(scores)
      })
      .catch(() => {
        this.showEmpty()
      })
  }

  private showEmpty(): void {
    this.statusLine.textContent = ''
    const empty = document.createElement('div')
    empty.className = 'subtitle'
    empty.textContent = this.i18n.t('leaderboard_empty')
    this.rows.appendChild(empty)
  }

  private renderRows(scores: readonly number[]): void {
    const sorted = [...scores].sort((a, b) => b - a).slice(0, 10)
    for (let i = 0; i < sorted.length; i++) {
      const row = document.createElement('div')
      row.className = 'list-row'
      const place = document.createElement('span')
      place.textContent = `${i + 1}`
      const nameSpan = document.createElement('span')
      nameSpan.className = 'stat-value'
      nameSpan.textContent = String(sorted[i])
      const trophyIcon = document.createElement('span')
      trophyIcon.innerHTML = iconSvg('trophy')
      row.append(place, nameSpan, trophyIcon)
      this.rows.appendChild(row)
    }
  }
}
