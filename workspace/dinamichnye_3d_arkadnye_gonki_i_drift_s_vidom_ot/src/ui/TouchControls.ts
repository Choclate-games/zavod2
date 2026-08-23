import type { PlayerVehicle } from '../entities/Player'
import { icon } from './icons'
import { t } from '../data/i18n'

/**
 * Слой тач-управления: две полузоны руления и три кнопки (ручник, турбо,
 * клапан). Только Pointer Events с setPointerCapture и учётом pointerId:
 * второй палец не сбрасывает первый, палец за границей зоны не теряется.
 * Создаётся и вставляется в DOM только в тач-схеме.
 */
export class TouchControls {
  readonly root: HTMLElement
  private steerValue = 0
  private readonly steerPointers = new Map<number, number>()
  private readonly buttonPointers = new Map<number, HTMLElement>()

  constructor(
    private readonly input: {
      setSteerAxis(value: number): void
      setHandbrake(pressed: boolean): void
      pressTurbo(): void
      pressValve(): void
    },
    private vehicleRef: { current: PlayerVehicle | null },
  ) {
    this.root = document.createElement('div')
    this.root.className = 'touch-layer'

    for (const side of ['left', 'right'] as const) {
      const zone = document.createElement('div')
      zone.className = `touch-steer-zone ${side}`
      zone.addEventListener('pointerdown', (e) => this.onSteerDown(e))
      zone.addEventListener('pointermove', (e) => this.onSteerMove(e))
      zone.addEventListener('pointerup', (e) => this.onSteerEnd(e))
      zone.addEventListener('pointercancel', (e) => this.onSteerEnd(e))
      this.root.appendChild(zone)
    }

    this.makeTapButton('touch-turbo', 'turbo', () => {
      this.input.pressTurbo()
    })
    this.makeTapButton('touch-valve', 'valve', () => {
      if (this.vehicleRef.current) this.input.pressValve()
    })
    // ручник — отдельная логика удержания
    const handbrake = this.makeHoldButton('touch-handbrake', 'handbrake', (pressed) => {
      this.input.setHandbrake(pressed)
    })
    void handbrake
  }

  /** Кнопка клапана гаснет на кулдауне: состояние приходит от машины. */
  setValveEnabled(enabled: boolean): void {
    const valve = this.root.querySelector<HTMLElement>('.touch-valve')
    if (!valve) return
    if (enabled) valve.removeAttribute('disabled')
    else valve.setAttribute('disabled', '')
  }

  mountTo(parent: HTMLElement): void {
    parent.appendChild(this.root)
  }

  unmount(): void {
    this.reset()
    this.root.remove()
  }

  reset(): void {
    this.steerPointers.clear()
    this.buttonPointers.clear()
    this.steerValue = 0
    this.input.setSteerAxis(0)
    this.input.setHandbrake(false)
  }

  private onSteerDown(e: PointerEvent): void {
    const zone = e.currentTarget as HTMLElement
    zone.setPointerCapture(e.pointerId)
    this.steerPointers.set(e.pointerId, e.clientX)
    this.recomputeSteer()
    e.preventDefault()
  }

  private onSteerMove(e: PointerEvent): void {
    if (!this.steerPointers.has(e.pointerId)) return
    this.steerPointers.set(e.pointerId, e.clientX)
    this.recomputeSteer()
    e.preventDefault()
  }

  private onSteerEnd(e: PointerEvent): void {
    if (!this.steerPointers.delete(e.pointerId)) return
    this.recomputeSteer()
  }

  private recomputeSteer(): void {
    const width = window.innerWidth
    const center = width / 2
    let sum = 0
    let count = 0
    for (const x of this.steerPointers.values()) {
      sum += Math.max(-1, Math.min(1, ((x - center) / center) * 1.35))
      count++
    }
    this.steerValue = count > 0 ? sum / count : 0
    this.input.setSteerAxis(this.steerValue)
  }

  private makeTapButton(className: string, iconName: string, onTap: () => void): void {
    const button = document.createElement('div')
    button.className = `touch-btn ${className}`
    button.innerHTML = icon(iconName)
    button.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      if (button.hasAttribute('disabled')) return
      button.setPointerCapture(e.pointerId)
      this.buttonPointers.set(e.pointerId, button)
      button.classList.add('pressed')
      onTap()
    })
    const release = (e: PointerEvent): void => {
      if (!this.buttonPointers.delete(e.pointerId)) return
      button.classList.remove('pressed')
    }
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('contextmenu', (e) => e.preventDefault())
    this.root.appendChild(button)
  }

  private makeHoldButton(
    className: string,
    iconName: string,
    onHold: (pressed: boolean) => void,
  ): HTMLElement {
    const button = document.createElement('div')
    button.className = `touch-btn ${className}`
    button.innerHTML = icon(iconName) + `<span>${t('touch.handbrake')}</span>`
    button.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      button.setPointerCapture(e.pointerId)
      this.buttonPointers.set(e.pointerId, button)
      button.classList.add('pressed')
      onHold(true)
    })
    const release = (e: PointerEvent): void => {
      if (!this.buttonPointers.delete(e.pointerId)) return
      button.classList.remove('pressed')
      onHold(false)
    }
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('contextmenu', (e) => e.preventDefault())
    this.root.appendChild(button)
    return button
  }
}
