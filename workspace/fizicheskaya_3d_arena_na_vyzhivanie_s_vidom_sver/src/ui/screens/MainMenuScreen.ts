import { createButton } from '../components/Widgets'
import { iconSvg } from '../icons'
import type { I18n } from '../I18n'
import type { UiActions, UiState } from '../types'
import type { Screen } from '../ScreenRouter'

/**
 * Главное меню: три зоны — заголовок игры с кубками, главное действие
 * «В БОЙ НА ЛЁД», второстепенный ряд одним весом. Поверх живой сцены.
 */
export class MainMenuScreen implements Screen {
  readonly name = 'main_menu'
  readonly root: HTMLElement
  private readonly trophyValue: HTMLElement

  constructor(
    private readonly i18n: I18n,
    private readonly actions: UiActions,
    private readonly getState: () => UiState,
  ) {
    this.root = document.createElement('div')

    const header = document.createElement('div')
    header.style.position = 'absolute'
    header.style.left = 'calc(24px + env(safe-area-inset-left))'
    header.style.top = 'calc(20px + env(safe-area-inset-top))'
    header.style.display = 'flex'
    header.style.flexDirection = 'column'
    header.style.gap = 'var(--space-1)'
    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = i18n.t('title')
    const subtitle = document.createElement('div')
    subtitle.className = 'subtitle'
    subtitle.textContent = i18n.t('subtitle')
    header.append(title, subtitle)

    const trophyChip = document.createElement('div')
    trophyChip.className = 'hud-chip'
    trophyChip.style.position = 'absolute'
    trophyChip.style.right = 'calc(24px + env(safe-area-inset-right))'
    trophyChip.style.top = 'calc(20px + env(safe-area-inset-top))'
    const trophyIcon = document.createElement('span')
    trophyIcon.innerHTML = iconSvg('trophy')
    this.trophyValue = document.createElement('span')
    this.trophyValue.className = 'stat-value'
    trophyChip.append(trophyIcon, this.trophyValue)

    const bottom = document.createElement('div')
    bottom.style.position = 'absolute'
    bottom.style.bottom = 'calc(32px + env(safe-area-inset-bottom) + var(--banner-height))'
    bottom.style.left = '50%'
    bottom.style.transform = 'translateX(-50%)'
    bottom.style.display = 'flex'
    bottom.style.flexDirection = 'column'
    bottom.style.alignItems = 'center'
    bottom.style.gap = 'var(--space-3)'
    const play = createButton(i18n.t('play'), { primary: true, iconName: 'play' })
    play.root.addEventListener('click', () => this.actions.startMatch())
    const secondaryRow = document.createElement('div')
    secondaryRow.style.display = 'flex'
    secondaryRow.style.gap = 'var(--space-3)'
    const garageButton = createButton(i18n.t('garage'), { small: true, iconName: 'wrench' })
    garageButton.root.addEventListener('click', () => this.actions.openGarage())
    const boardButton = createButton(i18n.t('leaderboard'), { small: true, iconName: 'trophy' })
    boardButton.root.addEventListener('click', () => this.actions.openLeaderboard())
    secondaryRow.append(garageButton.root, boardButton.root)
    bottom.append(play.root, secondaryRow)

    this.root.append(header, trophyChip, bottom)
  }

  /** Обновление кубков перед каждым показом. */
  refresh(): void {
    this.trophyValue.textContent = String(this.getState().trophies)
    void this.i18n
  }

  onShow(): void {
    this.refresh()
  }
}
