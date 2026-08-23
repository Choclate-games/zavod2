import { createButton } from '../components/Widgets'
import { iconSvg } from '../icons'
import type { I18n } from '../I18n'
import type { UiActions, UiState } from '../types'
import type { Screen } from '../ScreenRouter'
import type { EventBus } from '../../core/EventBus'

/**
 * Экран итогов матча: место, кубки и монеты крупно; главное действие —
 * «СЛЕДУЮЩИЙ МАТЧ»; вторичный ряд — утроение награды и выход в меню.
 */
export class VictoryDefeatScreen implements Screen {
  readonly name = 'match_results'
  readonly root: HTMLElement
  private readonly headline: HTMLElement
  private readonly placeValue: HTMLElement
  private readonly trophiesValue: HTMLElement
  private readonly coinsValue: HTMLElement
  private lastResult = { place: 8, trophies: 0, coins: 0, survived: false }

  constructor(
    private readonly i18n: I18n,
    actions: UiActions,
    getState: () => UiState,
    bus: EventBus,
  ) {
    this.root = document.createElement('div')

    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.style.position = 'absolute'
    panel.style.left = '50%'
    panel.style.top = '50%'
    panel.style.transform = 'translate(-50%, -50%)'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.alignItems = 'center'
    panel.style.gap = 'var(--space-3)'
    panel.style.padding = 'calc(var(--space-6) * var(--ui-scale))'
    panel.style.minWidth = 'min(440px, 92vw)'

    this.headline = document.createElement('div')
    this.headline.className = 'title'

    const placeRow = document.createElement('div')
    placeRow.className = 'hud-chip'
    const placeLabel = document.createElement('span')
    placeLabel.textContent = i18n.t('place')
    placeLabel.className = 'subtitle'
    this.placeValue = document.createElement('span')
    this.placeValue.className = 'stat-value'
    this.placeValue.textContent = '8'
    placeRow.append(placeLabel, this.placeValue)

    const rewardsRow = document.createElement('div')
    rewardsRow.style.display = 'flex'
    rewardsRow.style.gap = 'var(--space-3)'
    const trophyChip = document.createElement('div')
    trophyChip.className = 'hud-chip'
    const trophyIcon = document.createElement('span')
    trophyIcon.innerHTML = iconSvg('trophy')
    this.trophiesValue = document.createElement('span')
    this.trophiesValue.className = 'stat-value'
    trophyChip.append(trophyIcon, this.trophiesValue)
    const coinChip = document.createElement('div')
    coinChip.className = 'hud-chip'
    const coinIcon = document.createElement('span')
    coinIcon.innerHTML = iconSvg('coin')
    this.coinsValue = document.createElement('span')
    this.coinsValue.className = 'stat-value'
    coinChip.append(coinIcon, this.coinsValue)
    rewardsRow.append(trophyChip, coinChip)

    const nextButton = createButton(i18n.t('next_match'), { primary: true })
    nextButton.root.addEventListener('click', () => actions.nextMatch())

    const secondaryRow = document.createElement('div')
    secondaryRow.style.display = 'flex'
    secondaryRow.style.gap = 'var(--space-3)'
    const multiplyButton = createButton(i18n.t('multiply_rewards'), { small: true })
    // Возможность, которой нет на площадке, не рисуется вовсе.
    if (getState().rewardedSupported) {
      multiplyButton.root.addEventListener('click', () => {
        multiplyButton.setLoading(true)
        void actions.claimTripleReward?.()
        window.setTimeout(() => multiplyButton.setLoading(false), 900)
      })
      secondaryRow.appendChild(multiplyButton.root)
    }
    const menuButton = createButton(i18n.t('main_menu'), { small: true })
    menuButton.root.addEventListener('click', () => actions.backToMenu())
    secondaryRow.appendChild(menuButton.root)

    panel.append(this.headline, placeRow, rewardsRow, nextButton.root, secondaryRow)
    this.root.appendChild(panel)

    bus.on('match:over', (payload) => {
      this.lastResult = payload
    })
  }

  onShow(): void {
    this.headline.textContent = this.lastResult.survived ? this.i18n.t('victory') : this.i18n.t('defeat')
    this.placeValue.textContent = String(this.lastResult.place)
    this.trophiesValue.textContent = String(this.lastResult.trophies)
    this.coinsValue.textContent = String(this.lastResult.coins)
  }
}
