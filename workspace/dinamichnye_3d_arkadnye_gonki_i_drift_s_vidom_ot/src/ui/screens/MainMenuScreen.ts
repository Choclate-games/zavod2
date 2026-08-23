import { t } from '../../data/i18n'
import { TRACKS } from '../../data/tracks'
import type { UiController, ScreenCaps } from './controller'
import { createButton } from '../components/Button'
import { icon } from '../icons'
import type { StorageService } from '../../platform/StorageService'

/**
 * MainMenuScreen: заголовок, единственное главное действие «В Заезд»,
 * второстепенный ряд одним весом. Живая сцена тягача видна за экраном —
 * корень прозрачен, заливки нет.
 */
export function buildMainMenuScreen(
  controller: UiController,
  storage: StorageService,
  caps: ScreenCaps,
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'menu-layout'

  const titleBlock = document.createElement('div')
  titleBlock.className = 'menu-title-block safe-inset'
  const title = document.createElement('h1')
  title.className = 'game-title'
  title.textContent = t('title')
  const subtitle = document.createElement('p')
  subtitle.className = 'game-subtitle'
  subtitle.textContent = t('menu.subtitle')
  titleBlock.append(title, subtitle)

  const mainAction = document.createElement('div')
  mainAction.className = 'menu-main-action'
  const nextTrack = firstUnlocked(storage)
  mainAction.appendChild(
    createButton({
      labelKey: 'menu.play',
      primaryAction: true,
      onClick: () => controller.startTrack(nextTrack),
    }),
  )

  const sideRow = document.createElement('div')
  sideRow.className = 'menu-side-row'
  sideRow.appendChild(
    createButton({ labelKey: 'menu.tracks', iconName: 'map', onClick: () => controller.openTrackSelect() }),
  )
  if (caps.leaderboardsSupported) {
    sideRow.appendChild(
      createButton({ labelKey: 'menu.leaderboard', iconName: 'trophy', onClick: () => controller.openLeaderboard() }),
    )
  }
  const soundBtn = createButton({
    labelKey: 'menu.sound',
    iconName: storage.get().settingsMuted ? 'mute' : 'sound',
    onClick: () => {
      const muted = controller.toggleSound()
      soundBtn.innerHTML =
        `<span>${t('menu.sound')}</span>` +
        (muted ? iconSvg('mute') : iconSvg('sound'))
    },
  })
  sideRow.appendChild(soundBtn)

  root.append(titleBlock, mainAction, sideRow)
  return root
}

function firstUnlocked(storage: StorageService): number {
  const mask = storage.get().unlockedMask
  for (let i = TRACKS.length - 1; i >= 0; i--) {
    if (mask & (1 << i)) return i
  }
  return 0
}

function iconSvg(name: string): string {
  return `<span>${icon(name)}</span>`
}
