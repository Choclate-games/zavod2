import { createButton, createPanel, createRow, createSubtitle, createTitle } from './components.ts'
import type { Screen } from '../ui/ScreenRouter.ts'

/** Пауза: модал поверх живой сцены, звук переключается здесь же. */
export function createPauseScreen(callbacks: {
  onResume: () => void
  onMenu: () => void
  onToggleMute: (muted: boolean) => void
  initialMuted: boolean
}): Screen & { setMuted: (muted: boolean) => void } {
  const root = document.createElement('div')
  root.className = 'screen'

  const panel = createPanel()
  panel.appendChild(createTitle('Пауза'))
  panel.appendChild(createSubtitle('Банкет подождёт — но недолго'))

  let muted = callbacks.initialMuted
  const muteButton = createButton(muted ? 'Включить звук' : 'Выключить звук', {
    onClick: () => {
      muted = !muted
      muteButton.textContent = muted ? 'Включить звук' : 'Выключить звук'
      callbacks.onToggleMute(muted)
    },
  })
  panel.appendChild(muteButton)

  const row = createRow()
  row.appendChild(
    createButton('Продолжить', { variant: 'primary', iconName: 'play', onClick: callbacks.onResume }),
  )
  row.appendChild(createButton('В меню', { onClick: callbacks.onMenu }))
  panel.appendChild(row)

  root.appendChild(panel)

  return {
    root,
    name: 'pause',
    setMuted: (value: boolean): void => {
      muted = value
      muteButton.textContent = value ? 'Включить звук' : 'Выключить звук'
    },
  }
}
