import { el } from './Button'

export class Meter {
  readonly root: HTMLElement
  private readonly fill: HTMLElement
  private lastRatio = -1

  constructor(labelText?: string) {
    this.root = el('div', 'meter-block')
    if (labelText) {
      const label = el('div', 'hud-label telemetry', labelText)
      this.root.appendChild(label)
    }
    const track = el('div', 'meter')
    this.fill = el('div', 'meter__fill')
    track.appendChild(this.fill)
    this.root.appendChild(track)
  }

  set(ratio: number): void {
    const clamped = Math.round(Math.min(1, Math.max(0, ratio)) * 100) / 100
    if (clamped === this.lastRatio) return
    this.lastRatio = clamped
    // Полоса анимируется transform'ом, не шириной — без reflow в кадре.
    this.fill.style.transform = `scaleX(${clamped})`
  }
}

export function numSlot(initial = '0'): HTMLElement {
  const span = el('span', 'num-slot', initial)
  return span
}
