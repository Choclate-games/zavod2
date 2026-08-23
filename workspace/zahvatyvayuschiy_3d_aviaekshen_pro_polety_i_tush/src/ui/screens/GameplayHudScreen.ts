import { el } from '../components/dom'
import { createScreen, SCREEN_IDS, type Screen } from '../ScreenRouter'

export interface HudSnapshotView {
  timeLeft: number
  waterPercent: number
  altitudeM: number
  score: number
  firesOut: number
  fireTotal: number
}

/** HUD пишет только в закэшированные узлы и только при смене значения. */
export class GameplayHudScreen {
  readonly screen: Screen & { root: HTMLDivElement }
  private readonly timeNode: HTMLElement
  private readonly waterNode: HTMLElement
  private readonly altNode: HTMLElement
  private readonly firesNode: HTMLElement
  private lastTime = ''
  private lastWater = ''
  private lastAlt = ''
  private lastFires = ''

  constructor(onPauseToggle: () => void) {
    this.timeNode = el('div', 'stat__value stat__value--danger', '60.0')
    const time = this.stat('Таймер', this.timeNode)

    this.waterNode = el('div', 'stat__value stat__value--water', '0%')
    const water = this.stat('Бак', this.waterNode)

    this.altNode = el('div', 'stat__value', '28 м')
    const alt = this.stat('Высота', this.altNode)

    this.firesNode = el('div', 'stat__value', '0/3')
    const fires = this.stat('Очаги', this.firesNode)

    const topbar = el('div', 'hud__topbar')
    for (const node of [time, water, alt, fires]) topbar.appendChild(node)

    const pauseButton = el('button', 'btn hud__pause')
    pauseButton.type = 'button'
    pauseButton.dataset.action = 'pause'
    pauseButton.textContent = 'ПАУЗА'
    pauseButton.addEventListener('click', onPauseToggle)

    const hud = el('div', 'hud')
    hud.appendChild(topbar)
    hud.appendChild(pauseButton)

    this.screen = createScreen(SCREEN_IDS.gameplayHud, hud)
  }

  update(snapshot: HudSnapshotView): void {
    const timeText = Math.max(0, snapshot.timeLeft).toFixed(1)
    if (timeText !== this.lastTime) {
      this.lastTime = timeText
      this.timeNode.textContent = timeText
    }

    const waterText = `${Math.round(snapshot.waterPercent)}%`
    if (waterText !== this.lastWater) {
      this.lastWater = waterText
      this.waterNode.textContent = waterText
    }

    const altText = `${Math.max(0, Math.round(snapshot.altitudeM))} м`
    if (altText !== this.lastAlt) {
      this.lastAlt = altText
      this.altNode.textContent = altText
    }

    const firesText = `${snapshot.firesOut}/${snapshot.fireTotal}`
    if (firesText !== this.lastFires) {
      this.lastFires = firesText
      this.firesNode.textContent = firesText
    }
  }

  private stat(label: string, valueNode: HTMLElement): HTMLElement {
    const wrap = el('div', 'stat')
    wrap.appendChild(el('div', 'stat__label', label))
    wrap.appendChild(valueNode)
    return wrap
  }
}
