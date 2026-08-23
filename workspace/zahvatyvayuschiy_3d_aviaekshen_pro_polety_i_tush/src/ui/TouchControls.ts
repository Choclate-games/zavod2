import type { FlightInput } from '../input/InputHub'
import { el } from './components/dom'

/**
 * Тач-схема: левая половина экрана — виртуальный штурвал (плавающая база),
 * справа снизу крупная кнопка СБРОС, над ней ФОРСАЖ. Только Pointer Events
 * с setPointerCapture; оси сбрасываются при потере пальца и сворачивании.
 */
export class TouchControls {
  private readonly zone: HTMLDivElement
  private readonly dropButton: HTMLButtonElement
  private readonly boostButton: HTMLButtonElement
  private readonly pointers = new Map<number, { x: number; y: number }>()

  constructor(
    host: HTMLElement,
    input: FlightInput,
    onPauseToggle: () => void,
  ) {
    this.zone = el('div', 'touch-zone')
    this.dropButton = this.button('touch-btn touch-btn--drop', 'СБРОС', () => {
      input.dropQueued = true
    })
    this.boostButton = this.button('touch-btn touch-btn--boost', 'ФОРСАЖ')
    const pauseButton = this.button('btn hud__pause', 'ПАУЗА', onPauseToggle)

    this.zone.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return
      this.zone.setPointerCapture(event.pointerId)
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    })
    this.zone.addEventListener('pointermove', (event) => {
      const start = this.pointers.get(event.pointerId)
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      input.roll = clamp(dx / 90)
      input.pitch = clamp(dy / 90)
    })
    const release = (event: PointerEvent) => {
      if (!this.pointers.delete(event.pointerId)) return
      if (this.pointers.size === 0) {
        input.roll = 0
        input.pitch = 0
      }
    }
    this.zone.addEventListener('pointerup', release)
    this.zone.addEventListener('pointercancel', release)

    // Кнопка форсажа держится пальцем: набор удерживающих её pointerId.
    let boostPointers = 0
    this.boostButton.addEventListener('pointerdown', (event) => {
      this.boostButton.setPointerCapture(event.pointerId)
      boostPointers += 1
      input.boost = true
    })
    const boostRelease = (event: PointerEvent) => {
      if (!this.boostButton.hasPointerCapture(event.pointerId)) return
      this.boostButton.releasePointerCapture(event.pointerId)
      boostPointers = Math.max(0, boostPointers - 1)
      if (boostPointers === 0) input.boost = false
    }
    this.boostButton.addEventListener('pointerup', boostRelease)
    this.boostButton.addEventListener('pointercancel', boostRelease)

    host.appendChild(this.zone)
    host.appendChild(this.dropButton)
    host.appendChild(this.boostButton)
    host.appendChild(pauseButton)

    window.addEventListener('blur', () => this.resetAxes(input))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAxes(input)
    })
    this.hide()
  }

  show(): void {
    this.setDisplayed(true)
  }

  hide(): void {
    this.setDisplayed(false)
  }

  private setDisplayed(displayed: boolean): void {
    for (const node of [this.zone, this.dropButton, this.boostButton]) {
      node.style.display = displayed ? '' : 'none'
    }
  }

  resetAxes(input: FlightInput): void {
    this.pointers.clear()
    input.roll = 0
    input.pitch = 0
    input.boost = false
  }

  private button(className: string, label: string, onClick?: () => void): HTMLButtonElement {
    const node = el('button', className)
    node.type = 'button'
    node.textContent = label
    if (onClick) node.addEventListener('click', onClick)
    node.addEventListener('contextmenu', (event) => event.preventDefault())
    return node
  }
}

function clamp(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value
}
