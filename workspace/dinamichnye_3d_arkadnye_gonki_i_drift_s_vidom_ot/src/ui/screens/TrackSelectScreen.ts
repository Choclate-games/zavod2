import { t } from '../../data/i18n'
import { TRACKS } from '../../data/tracks'
import type { UiController, ScreenCaps } from './controller'
import { createButton } from '../components/Button'
import { icon } from '../icons'
import type { StorageService } from '../../platform/StorageService'

/**
 * TrackSelectScreen: список 12 перевалов во внутреннем скролле, звёзды,
 * рекорды и норматив времени. Главное действие — «Спуск».
 */
export function buildTrackSelectScreen(
  controller: UiController,
  storage: StorageService,
  _caps: ScreenCaps,
): HTMLElement {
  void _caps
  const root = document.createElement('div')
  root.className = 'menu-layout'

  const titleBlock = document.createElement('div')
  titleBlock.className = 'menu-title-block safe-inset'
  const title = document.createElement('h2')
  title.className = 'game-title'
  title.textContent = t('tracks.title')
  titleBlock.appendChild(title)

  const listPanel = document.createElement('div')
  listPanel.className = 'panel panel-solid'
  listPanel.style.gridArea = '1 / 1 / 3 / 3'
  listPanel.style.margin = 'auto'
  listPanel.style.maxWidth = '560px'
  listPanel.style.width = 'min(86vw, 560px)'
  listPanel.style.maxHeight = '72vh'
  const scroller = document.createElement('div')
  scroller.className = 'list-scroller'
  listPanel.appendChild(scroller)

  const mask = storage.get().unlockedMask
  let selected = -1
  const rows: HTMLDivElement[] = []
  for (const track of TRACKS) {
    const unlocked = (mask & (1 << track.index)) !== 0
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'track-row'
    row.style.textAlign = 'left'
    row.style.background = 'transparent'
    row.style.border = 'none'
    row.style.width = '100%'
    if (!unlocked) row.setAttribute('disabled', '')

    const nameCol = document.createElement('div')
    nameCol.style.gridColumn = '1'
    const name = document.createElement('div')
    name.className = 'track-name'
    name.textContent = t('track.countdown', { n: track.index + 1 }) + '. ' + tierName(track.index)
    const meta = document.createElement('div')
    meta.className = 'track-meta'
    const bestTime = storage.get().bestTimes[track.id]
    meta.textContent = bestTime
      ? `${t('tracks.best')}: ${bestTime.toFixed(1)} с`
      : t('tracks.stars3', { time: track.goldTimeS })
    nameCol.append(name, meta)

    const stars = document.createElement('span')
    stars.className = 'stars'
    stars.innerHTML = icon('star').repeat(3)
    stars.style.opacity = unlocked ? '0.35' : '0.12'

    row.append(nameCol, stars)
    row.addEventListener('click', () => {
      for (const other of rows) other.classList.remove('selected')
      row.classList.add('selected')
      selected = track.index
    })
    rows.push(row)
    scroller.appendChild(row)
  }
  if (!scroller.querySelector('.track-row.selected')) {
    rows[firstUnlockedIndex(mask)]?.classList.add('selected')
    selected = firstUnlockedIndex(mask)
  }

  const actionsRow = document.createElement('div')
  actionsRow.className = 'menu-side-row'
  actionsRow.appendChild(
    createButton({ labelKey: 'tracks.back', iconName: 'back', onClick: () => controller.toMenu() }),
  )
  const startWrap = document.createElement('div')
  startWrap.className = 'menu-main-action'
  startWrap.appendChild(
    createButton({
      labelKey: 'tracks.start',
      primaryAction: true,
      onClick: () => controller.startTrack(Math.max(0, selected)),
    }),
  )

  root.append(titleBlock, listPanel, startWrap, actionsRow)
  return root
}

function firstUnlockedIndex(mask: number): number {
  for (let i = 0; i < TRACKS.length; i++) {
    if (mask & (1 << i)) return i
  }
  return 0
}

function tierName(index: number): string {
  const tier = index < 3 ? 0 : index < 7 ? 1 : 2
  return ['Ущелье Новичков', 'Синий Карниз', 'Чертов Хребет'][tier] + ` · ${index + 1}`
}
