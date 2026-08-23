import { t } from '../../data/i18n'
import type { UiController, ScreenCaps } from './controller'
import { createButton } from '../components/Button'
import { createPanel } from '../components/Meter'

/**
 * CrashScreen: разбитое стекло по краю кадра, причина падения и два пути —
 * возродиться на чекпоинте за рекламу (один раз за заезд) или быстрый рестарт.
 */
export class CrashScreen {
  readonly rootElement: HTMLElement
  private reasonText: HTMLParagraphElement

  constructor(
    private readonly controller: UiController,
    private readonly caps: ScreenCaps,
    private readonly reviveAvailable: () => boolean,
  ) {
    const root = document.createElement('div')
    root.className = 'modal-dim'

    const frame = document.createElement('div')
    frame.className = 'crash-frame'
    root.appendChild(frame)

    const panel = createPanel(true)
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.alignItems = 'center'
    panel.style.gap = '16px'

    const title = document.createElement('h2')
    title.className = 'game-title'
    title.textContent = t('crash.title')
    this.reasonText = document.createElement('p')
    this.reasonText.style.color = 'var(--color-muted)'
    panel.append(title, this.reasonText)

    this.reviveBtnHolder = document.createElement('div')
    this.reviveBtnHolder.style.display = 'contents'
    panel.appendChild(this.reviveBtnHolder)
    panel.appendChild(
      createButton({
        labelKey: 'crash.retry',
        iconName: 'restart',
        primaryAction: true,
        onClick: () => this.controller.restartRun(),
      }),
    )
    panel.appendChild(
      createButton({ labelKey: 'pause.menu', iconName: 'home', onClick: () => this.controller.toMenu() }),
    )

    root.appendChild(panel)
    this.rootElement = root
  }

  private readonly reviveBtnHolder: HTMLElement

  show(reason: 'fall' | 'rollover'): void {
    this.reasonText.textContent = t(reason === 'fall' ? 'crash.fall' : 'crash.rollover')
    this.reviveBtnHolder.replaceChildren()
    // возможность, которой нет на площадке, не рисуется вовсе
    if (this.caps.rewardedSupported && this.reviveAvailable()) {
      this.reviveBtnHolder.appendChild(
        createButton({
          labelKey: 'crash.revive',
          iconName: 'play',
          onClick: () => this.controller.reviveForAd(),
        }),
      )
    }
  }
}
