import { BALANCE } from '../generated/balanceValues'
import { GameTopic, bus } from '../core/Game'

/**
 * HUD: пять якорей (таймер, пакет, заряды, прицел, схема). Пишет в
 * закэшированные узлы и только при изменении значения; слой не кликается.
 */
export class Hud {
  readonly root: HTMLElement
  private readonly timerNode: HTMLElement
  private readonly chargesNode: HTMLElement
  private lastTimerText = ''
  private lastCharges = -1

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'hud'

    const timer = document.createElement('div')
    timer.className = 'hud__timer'
    this.timerNode = document.createElement('span')
    this.timerNode.textContent = '—'
    timer.appendChild(this.timerNode)

    const packageBlock = document.createElement('div')
    packageBlock.className = 'hud__package'
    packageBlock.textContent = 'Пакет: цел'
    const charges = document.createElement('div')
    charges.className = 'hud__charges'
    this.chargesNode = charges
    packageBlock.appendChild(charges)

    const reticle = document.createElement('div')
    reticle.className = 'hud__reticle'

    const scheme = document.createElement('div')
    scheme.className = 'hud__scheme'
    scheme.textContent = 'Район 1 / 4'

    this.root.append(timer, packageBlock, reticle, scheme)

    const chargesMax = BALANCE.mechanics.paket_mayak_i_hrupkiy_gruz.parameters.zapas_vynoslivosti.value
    this.chargesNode.textContent = 'Заряды: ' + '/'.repeat(chargesMax)

    bus.on(GameTopic.contractTick, ({ waveTimeLeft }) => {
      const text = `${Math.max(0, Math.ceil(waveTimeLeft))}`
      if (text !== this.lastTimerText) {
        this.lastTimerText = text
        this.timerNode.textContent = text
      }
    })
  }

  show(): void {
    this.root.classList.add('is-visible')
  }

  hide(): void {
    this.root.classList.remove('is-visible')
  }

  setCharges(left: number): void {
    if (left === this.lastCharges) return
    this.lastCharges = left
    this.chargesNode.textContent = `Заряды: ${'/'.repeat(Math.max(0, left))}`
  }
}
