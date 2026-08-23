// Векторная динамика шторма: базовый ветер фазы + турбулентные порывы.
// Из этого вектора считаются снос пули и деформация прицела.

import { phaseFor } from '../config/rules'

export interface WindSample {
  ms: number
  dirRad: number
}

export class StormWindSystem {
  private gustPhase = 0
  private gustPeriodS = 3
  readonly sample: WindSample = { ms: 15, dirRad: Math.PI / 2 }

  reset(): void {
    this.gustPhase = 0
  }

  update(timeS: number, dt: number): void {
    const phase = phaseFor(timeS)
    this.gustPhase += (dt * Math.PI * 2) / this.gustPeriodS
    // порывы: во второй фазе каждые ~3 с, в третьей — почти постоянный шквал
    const gust = phase.windMs >= 35 ? Math.sin(this.gustPhase) * 8 + Math.sin(this.gustPhase * 2.7) * 4 : Math.sin(this.gustPhase) * 3
    let windMs = phase.windMs + Math.max(0, gust)
    if (windMs > 50) windMs = 50
    // ветер дует сбоку с небольшим рысканием; знак меняется плавно
    const dirRad = Math.PI / 2 + Math.sin(timeS * 0.23) * 0.5
    this.sample.ms = windMs
    this.sample.dirRad = dirRad
  }

  /** Горизонтальная составляющая ветра поперёк поезда (для сноса пуль). */
  lateralMs(): number {
    return this.sample.ms * Math.sin(this.sample.dirRad)
  }
}
