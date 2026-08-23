import { t } from '../../data/i18n'
import type { UiController, ScreenCaps } from './controller'
import { createButton } from '../components/Button'
import { createPanel } from '../components/Meter'

/**
 * PauseModal: затемнение сцены (полупрозрачное, кадр живёт за ним),
 * панель матового стекла. Главное действие — «Продолжить».
 */
export function buildPauseModal(controller: UiController, _caps: ScreenCaps): HTMLElement {
  void _caps
  const root = document.createElement('div')
  root.className = 'modal-dim'

  const panel = createPanel(true)
  panel.style.display = 'flex'
  panel.style.flexDirection = 'column'
  panel.style.gap = '12px'
  panel.style.minWidth = 'min(86vw, 360px)'

  const title = document.createElement('h2')
  title.className = 'game-title'
  title.style.fontSize = 'calc(28px * var(--ui-scale))'
  title.textContent = t('pause.title')
  panel.appendChild(title)

  const resumeBtn = createButton({ labelKey: 'pause.resume', primaryAction: true, onClick: () => controller.resume() })
  panel.appendChild(resumeBtn)
  panel.appendChild(createButton({ labelKey: 'pause.restart', iconName: 'restart', onClick: () => controller.restartRun() }))
  panel.appendChild(createButton({ labelKey: 'pause.menu', iconName: 'home', onClick: () => controller.toMenu() }))
  panel.appendChild(
    createButton({
      labelKey: 'menu.sound',
      iconName: 'sound',
      onClick: () => controller.toggleSound(),
    }),
  )

  root.appendChild(panel)
  return root
}
