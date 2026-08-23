import type { EventBus } from '../core/EventBus'
import { createChip, createIconButton } from './components/Widgets'
import { iconSvg } from './icons'
import type { I18n, LocaleKey } from './I18n'

/**
 * HUD: запись только в закэшированные узлы и только при изменении значения.
 * Пять якорей: top_left радар+масса, top_center выжившие+таймер,
 * top_right пауза, bottom_left подсказка/зона стика, bottom_right ТУРБО.
 */
export class Hud {
  readonly root: HTMLElement
  private readonly survivorsChip: ReturnType<typeof createChip>
  private readonly timerChip: ReturnType<typeof createChip>
  private readonly massChip: ReturnType<typeof createChip>
  private readonly countdownLabel: HTMLElement
  private readonly killfeed: HTMLElement
  private readonly radarSegments: HTMLElement[] = []
  private readonly nitroFill: HTMLElement
  private readonly hint: HTMLElement

  onPauseRequested: (() => void) | null = null

  constructor(bus: EventBus, i18n: I18n) {
    void bus
    this.root = document.createElement('div')
    this.root.className = 'ui-layer layer-hud'

    // top_left: радар арены + масса игрока.
    const topLeft = document.createElement('div')
    topLeft.style.position = 'absolute'
    topLeft.style.left = 'calc(16px + env(safe-area-inset-left))'
    topLeft.style.top = 'calc(16px + env(safe-area-inset-top))'
    topLeft.style.display = 'flex'
    topLeft.style.flexDirection = 'column'
    const radar = document.createElement('div')
    radar.className = 'panel'
    radar.style.padding = '6px'
    radar.style.borderRadius = 'var(--radius-round)'
    const radarGrid = document.createElement('div')
    for (let i = 0; i < 16; i++) {
      const seg = document.createElement('span')
      seg.style.width = '10px'
      seg.style.height = '10px'
      seg.style.display = 'inline-block'
      seg.style.margin = '1px'
      seg.style.borderRadius = '2px'
      seg.style.background = 'var(--safe-status)'
      radarGrid.appendChild(seg)
      this.radarSegments.push(seg)
    }
    radar.appendChild(radarGrid)
    topLeft.appendChild(radar)
    this.massChip = createChip(null, '80')
    const massLabel = document.createElement('span')
    massLabel.textContent = i18n.t('mass')
    massLabel.className = 'subtitle'
    this.massChip.root.prepend(massLabel)
    topLeft.appendChild(this.massChip.root)

    // top_center: выжившие и таймер.
    const topCenter = document.createElement('div')
    topCenter.style.position = 'absolute'
    topCenter.style.left = '50%'
    topCenter.style.transform = 'translateX(-50%)'
    topCenter.style.top = 'calc(12px + env(safe-area-inset-top))'
    topCenter.style.display = 'flex'
    topCenter.style.gap = 'var(--space-3)'
    this.survivorsChip = createChip(null, '8')
    const survivorsLabel = document.createElement('span')
    survivorsLabel.textContent = i18n.t('survivors')
    survivorsLabel.className = 'subtitle'
    this.survivorsChip.root.prepend(survivorsLabel)
    this.timerChip = createChip(null, '0')
    topCenter.appendChild(this.survivorsChip.root)
    topCenter.appendChild(this.timerChip.root)

    // top_right: пауза.
    const topRight = document.createElement('div')
    topRight.style.position = 'absolute'
    topRight.style.right = 'calc(16px + env(safe-area-inset-right))'
    topRight.style.top = 'calc(12px + env(safe-area-inset-top))'
    const pauseButton = createIconButton('pause', i18n.t('pause'))
    pauseButton.root.addEventListener('click', () => {
      if (this.onPauseRequested) this.onPauseRequested()
    })
    topRight.appendChild(pauseButton.root)

    // bottom_left: подсказка десктопной раскладки (тач-слой живёт отдельно).
    this.hint = document.createElement('div')
    this.hint.className = 'subtitle hud-chip'
    this.hint.textContent = i18n.t('desktop_hint')

    // bottom_right: кольцевой индикатор форсажа.
    const bottomRight = document.createElement('div')
    bottomRight.style.position = 'absolute'
    bottomRight.style.right = 'calc(24px + env(safe-area-inset-right))'
    bottomRight.style.bottom = 'calc(28px + env(safe-area-inset-bottom) + var(--banner-height))'
    bottomRight.style.width = '140px'
    const boostRow = document.createElement('div')
    boostRow.style.display = 'flex'
    boostRow.style.alignItems = 'center'
    boostRow.style.gap = 'var(--space-2)'
    const boltIcon = document.createElement('span')
    boltIcon.innerHTML = iconSvg('bolt')
    boostRow.appendChild(boltIcon)
    const track = document.createElement('div')
    track.className = 'meter-track'
    this.nitroFill = document.createElement('div')
    this.nitroFill.className = 'meter-fill'
    track.appendChild(this.nitroFill)
    boostRow.appendChild(track)
    bottomRight.appendChild(boostRow)

    // Центральный обратный отсчёт.
    this.countdownLabel = document.createElement('div')
    this.countdownLabel.className = 'countdown-label'
    this.countdownLabel.style.opacity = '0'

    // Killfeed.
    this.killfeed = document.createElement('div')
    this.killfeed.className = 'killfeed'
    this.killfeed.style.position = 'absolute'
    this.killfeed.style.left = '50%'
    this.killfeed.style.transform = 'translateX(-50%)'
    this.killfeed.style.top = '20%'

    this.root.append(topLeft, topCenter, topRight, this.hint, bottomRight, this.countdownLabel, this.killfeed)

    bus.on('hud:survivors', ({ count }) => {
      this.survivorsChip.setText(String(count))
    })
    bus.on('hud:timer', ({ seconds }) => {
      this.timerChip.setText(String(seconds))
    })
    bus.on('hud:mass', ({ kilograms }) => {
      this.massChip.setText(kilograms.toFixed(0))
    })
    bus.on('hud:nitro', ({ ratio }) => {
      this.nitroFill.style.transform = `scaleX(${ratio.toFixed(3)})`
    })
    bus.on('hud:radar', ({ mask }) => {
      for (let i = 0; i < this.radarSegments.length; i++) {
        const alive = (mask & (1 << i)) !== 0
        this.radarSegments[i].style.background = alive ? 'var(--safe-status)' : 'var(--danger-warning)'
      }
    })
    bus.on('hud:countdown', ({ label }) => {
      this.showCountdown(label)
    })
    bus.on('tube:killed', (payload) => {
      this.pushKillfeed(`${payload.victim} ${i18n.t('killed_by')} ${payload.killer}`)
    })
  }

  setHintVisible(visible: boolean): void {
    this.hint.style.display = visible ? '' : 'none'
  }

  showCountdown(label: string): void {
    this.countdownLabel.textContent = label
    this.countdownLabel.style.opacity = '1'
    window.setTimeout(() => {
      this.countdownLabel.style.opacity = '0'
    }, 700)
  }

  pushKillfeed(text: string): void {
    const item = document.createElement('div')
    item.className = 'killfeed-item'
    item.textContent = text
    this.killfeed.appendChild(item)
    while (this.killfeed.children.length > 3) {
      this.killfeed.firstChild?.remove()
    }
    window.setTimeout(() => item.remove(), 2600)
  }

  clear(): void {
    this.killfeed.replaceChildren()
    this.timerChip.setText('0')
    this.survivorsChip.setText('8')
  }
}

export type { LocaleKey }
