import { createButton, createPanel, createRow, createSubtitle, createTitle } from './components.ts'
import type { Screen } from '../ui/ScreenRouter.ts'

export interface MainMenuCallbacks {
  onPlay: () => void
  onWardrobe: () => void
  onCatapults: () => void
  leaderboardSupported: boolean
  onLeaderboard?: () => void
}

/** Главное меню поверх живой сцены: три зоны, главное действие одно. */
export function createMainMenuScreen(callbacks: MainMenuCallbacks): Screen {
  const root = document.createElement('div')
  root.className = 'screen screens-anchor'

  const panel = createPanel()
  panel.appendChild(createTitle('Банкетный Краш'))
  panel.appendChild(createSubtitle('Свадебный Саботаж — превратите пафосный банкет в погром'))

  const play = createButton('В БОЙ!', {
    variant: 'primary',
    iconName: 'play',
    onClick: callbacks.onPlay,
  })
  panel.appendChild(play)

  const row = createRow()
  row.appendChild(createButton('Гардероб', { iconName: 'shirt', onClick: callbacks.onWardrobe }))
  row.appendChild(createButton('Катапульты', { iconName: 'catapult', onClick: callbacks.onCatapults }))
  if (callbacks.leaderboardSupported && callbacks.onLeaderboard) {
    row.appendChild(createButton('Лидерборд', { iconName: 'trophy', onClick: callbacks.onLeaderboard }))
  }
  // Возможность, которой нет на площадке, не рисуется вовсе.
  panel.appendChild(row)

  root.appendChild(panel)
  return { root, name: 'main_menu' }
}

export interface VictoryData {
  totalDamage: number
  stars: number
  formatMoney: (value: number) => string
}

export interface VictoryCallbacks {
  onNextHall: () => void
  onRestart: () => void
  onMenu: () => void
  rewardedSupported: boolean
  onDoubleCash?: (button: HTMLButtonElement, data: VictoryData) => Promise<void>
}

/** Экран итогов саботажа: чек ущерба, звёзды, удвоение через rewarded. */
export function createVictoryScreen(callbacks: VictoryCallbacks): Screen & { update: (data: VictoryData) => void } {
  const root = document.createElement('div')
  root.className = 'screen'

  const panel = createPanel()
  panel.appendChild(createTitle('Чек саботажа'))

  const damageNode = document.createElement('div')
  damageNode.className = 'numeral'
  damageNode.style.fontSize = 'calc(30px * var(--ui-scale))'
  damageNode.style.color = 'var(--damage-counter)'
  panel.appendChild(damageNode)

  const starsNode = document.createElement('div')
  starsNode.textContent = ''
  starsNode.style.marginBottom = 'var(--space-4)'
  panel.appendChild(starsNode)

  const stamp = document.createElement('div')
  stamp.textContent = 'APPROVED VANDALISM'
  stamp.style.color = 'var(--color-accent)'
  stamp.style.letterSpacing = '0.2em'
  stamp.style.fontSize = 'calc(12px * var(--ui-scale))'
  stamp.style.marginBottom = 'var(--space-5)'
  panel.appendChild(stamp)

  let currentData: VictoryData | null = null

  const update = (data: VictoryData): void => {
    currentData = data
    damageNode.textContent = `$${data.formatMoney(data.totalDamage)}`
    starsNode.textContent =
      data.stars > 0 ? `${data.stars} из 3 звёзд саботажа` : 'Ущерб меньше $20,000 — попытка провалена'
  }

  const primary = createButton('СЛЕДУЮЩИЙ ЗАЛ', {
    variant: 'primary',
    onClick: callbacks.onNextHall,
  })
  panel.appendChild(primary)

  const row = createRow()
  if (callbacks.rewardedSupported && callbacks.onDoubleCash) {
    const doubleButton = createButton('Удвоить награду', {
      iconName: 'star',
      onClick: () => {
        if (!currentData) return
        doubleButton.disabled = true
        void callbacks.onDoubleCash?.(doubleButton, currentData).finally(() => {
          doubleButton.disabled = false
        })
      },
    })
    row.appendChild(doubleButton)
  }
  row.appendChild(
    createButton('Рестарт', { iconName: 'restart', variant: 'retry', onClick: callbacks.onRestart }),
  )
  row.appendChild(createButton('В меню', { onClick: callbacks.onMenu }))
  panel.appendChild(row)

  root.appendChild(panel)
  return { root, name: 'victory_screen', update }
}
