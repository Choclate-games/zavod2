import { createButton } from '../components/Widgets'
import { TUBES, PILOTS, TRAILS, type CatalogItem } from '../../core/Catalog'
import type { I18n, LocaleKey } from '../I18n'
import type { UiActions, UiState, BuyResult } from '../types'
import type { Screen } from '../ScreenRouter'

/**
 * Ангар: три раздела каталога — тюбинги, пилоты, следы. Карточка с ценой
 * и кнопкой выбора. Покупка за кубки внутри игры.
 */
export class GarageScreen implements Screen {
  readonly name = 'customization_hangar'
  readonly root: HTMLElement
  private readonly grids = new Map<string, HTMLElement>()

  constructor(
    private readonly i18n: I18n,
    private readonly actions: UiActions,
    private readonly getState: () => UiState,
  ) {
    this.root = document.createElement('div')

    const header = document.createElement('div')
    header.style.position = 'absolute'
    header.style.left = 'calc(24px + env(safe-area-inset-left))'
    header.style.top = 'calc(16px + env(safe-area-inset-top))'
    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = i18n.t('garage')
    header.appendChild(title)

    const backButton = createButton(i18n.t('back'), { small: true, iconName: 'back' })
    backButton.root.addEventListener('click', () => actions.backToMenu())
    backButton.root.style.position = 'absolute'
    backButton.root.style.right = 'calc(24px + env(safe-area-inset-right))'
    backButton.root.style.top = 'calc(16px + env(safe-area-inset-top))'

    const scroller = document.createElement('div')
    scroller.className = 'card-grid'
    scroller.style.position = 'absolute'
    scroller.style.inset = 'calc(72px + env(safe-area-inset-top)) calc(24px) calc(24px + var(--banner-height)) calc(24px)'
    scroller.appendChild(this.buildSection('tube', i18n.t('tubes_section'), TUBES))
    scroller.appendChild(this.buildSection('pilot', i18n.t('pilots_section'), PILOTS))
    scroller.appendChild(this.buildSection('trail', i18n.t('trails_section'), TRAILS))

    this.root.append(header, backButton.root, scroller)
  }

  private buildSection(kind: 'tube' | 'pilot' | 'trail', heading: string, items: ReadonlyArray<CatalogItem>): HTMLElement {
    const sectionTitle = document.createElement('div')
    sectionTitle.className = 'subtitle'
    sectionTitle.textContent = heading
    sectionTitle.style.gridColumn = '1 / -1'
    const grid = document.createElement('div')
    grid.style.display = 'contents'
    for (const item of items) {
      grid.appendChild(this.createCard(kind, item))
    }
    const wrapper = document.createElement('div')
    wrapper.style.display = 'contents'
    wrapper.append(sectionTitle, grid)
    this.grids.set(kind, grid)
    return wrapper
  }

  private createCard(kind: 'tube' | 'pilot' | 'trail', item: CatalogItem): HTMLElement {
    const card = document.createElement('div')
    card.className = 'tube-card'
    card.dataset.kind = kind
    card.dataset.id = item.id
    const swatch = document.createElement('div')
    swatch.style.height = '10px'
    swatch.style.borderRadius = 'var(--radius-s)'
    swatch.style.background = 'var(--safe-status)'
    card.appendChild(swatch)
    const name = document.createElement('div')
    name.textContent = item.label
    name.style.fontWeight = 'bold'
    card.appendChild(name)
    const buttonHolder = document.createElement('div')
    buttonHolder.style.display = 'flex'
    buttonHolder.style.justifyContent = 'center'
    card.appendChild(buttonHolder)
    return card
  }

  /** Перерисовка кнопок карточек под текущее состояние сохранения. */
  refresh(): void {
    const state = this.getState()
    this.renderKind('tube', state.selectedTube, state.unlockedTubes, TUBES)
    this.renderKind('pilot', state.selectedPilot, state.unlockedPilots, PILOTS)
    this.renderKind('trail', state.selectedTrail, state.unlockedTrails, TRAILS)
  }

  private renderKind(kind: 'tube' | 'pilot' | 'trail', selected: string, unlocked: string[], items: ReadonlyArray<CatalogItem>): void {
    const cards = this.root.querySelectorAll<HTMLElement>(`.tube-card[data-kind="${kind}"]`)
    cards.forEach((card, index) => {
      const item = items[index]
      if (!item) return
      const holder = card.lastElementChild as HTMLElement
      holder.replaceChildren()
      const isOwned = unlocked.includes(item.id)
      const isSelected = selected === item.id
      const label = isSelected
        ? this.i18n.t('selected')
        : isOwned
          ? this.i18n.t('select')
          : `${this.i18n.t(item.price === 0 ? ('select') as LocaleKey : ('buy' as LocaleKey))} · ${item.price}`
      const button = createButton(label, { small: isSelected })
      if (isSelected) button.setDisabled(true)
      button.root.addEventListener('click', () => {
        if (isOwned) {
          this.actions.selectItem(kind, item.id)
          this.refresh()
          return
        }
        const result: BuyResult = this.actions.buyItem(kind, item.id)
        if (result === 'poor') {
          const span = document.createElement('span')
          span.className = 'subtitle'
          span.textContent = this.i18n.t('not_enough')
          card.appendChild(span)
          window.setTimeout(() => span.remove(), 1600)
        }
        this.refresh()
      })
      holder.appendChild(button.root)
    })
  }

  onShow(): void {
    this.refresh()
  }
}
