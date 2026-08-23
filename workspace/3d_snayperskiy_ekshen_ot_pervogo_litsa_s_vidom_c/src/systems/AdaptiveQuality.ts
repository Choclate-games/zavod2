import { bus } from '../core/eventBus.js'

const LEVELS = 3
const DWELL_SECONDS = 2.5
const DOWN_MS = 24
const UP_MS = 14

/** Адаптивное качество сходится: при просадке уровень падает, с запасом —
 * поднимается; гистерезис и выдержка не дают качелям. */
export class AdaptiveQuality {
  private level = 2
  private emaMs = 16.6
  private dwell = DWELL_SECONDS
  private enabledState = true

  get currentLevel(): number {
    return this.level
  }

  setEnabled(enabled: boolean): void {
    this.enabledState = enabled
  }

  /** dt в миллисекундах реального кадра. */
  sample(frameMs: number, dtSeconds: number): void {
    if (!this.enabledState) return
    this.emaMs += (frameMs - this.emaMs) * 0.06
    this.dwell -= dtSeconds
    if (this.dwell > 0) return
    if (this.emaMs > DOWN_MS && this.level > 0) {
      this.level--
      this.dwell = DWELL_SECONDS
      bus.emit('quality:changed', { level: this.level })
    } else if (this.emaMs < UP_MS && this.level < LEVELS - 1) {
      this.level++
      this.dwell = DWELL_SECONDS * 1.5
      bus.emit('quality:changed', { level: this.level })
    }
  }
}
