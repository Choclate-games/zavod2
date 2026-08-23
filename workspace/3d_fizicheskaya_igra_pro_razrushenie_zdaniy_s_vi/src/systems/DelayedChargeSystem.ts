import { DELAYED_CHARGE } from '../core/balance'
import type { EventBus } from '../core/EventBus'
import type { Building } from '../entities/Building'

export type ChargeMarker = {
  building: Building
  timer: number
  armed: boolean
}

/**
 * Сейсмический Клин Задержки: надпил опоры удалённой башни с таймером.
 * Порог излома снижается в момент установки; детонация запускается, когда
 * каскад уже пошёл (первый срез совершен) и таймер истёк.
 */
export class DelayedChargeSystem {
  private marker: ChargeMarker | null = null
  timerS: number = DELAYED_CHARGE.TIMER_DEFAULT_S

  constructor(private readonly events: EventBus) {}

  get hasCharge(): boolean {
    return this.marker !== null
  }

  get markerBuilding(): Building | null {
    return this.marker?.building ?? null
  }

  place(building: Building): boolean {
    if (this.marker || building.state !== 'standing') return false
    building.chargeArmed = true
    this.marker = { building, timer: this.timerS, armed: false }
    this.events.emit('delay:adjust', { delta: 0 })
    return true
  }

  adjust(delta: number): void {
    if (!this.marker) return
    this.timerS = Math.min(
      DELAYED_CHARGE.TIMER_MAX_S,
      Math.max(DELAYED_CHARGE.TIMER_MIN_S, this.timerS + delta),
    )
    this.marker.timer = this.timerS
  }

  clear(): void {
    if (this.marker) this.marker.building.chargeArmed = false
    this.marker = null
  }

  /** true — когда заряд сработал и башню пора валить. */
  update(cascadeActive: boolean, dt: number): boolean {
    if (!this.marker) return false
    if (!cascadeActive) return false
    this.marker.timer -= dt
    if (this.marker.timer <= 0 && !this.marker.armed) {
      this.marker.armed = true
      const target = this.marker.building
      this.clear()
      return target.state === 'standing'
    }
    return false
  }
}
