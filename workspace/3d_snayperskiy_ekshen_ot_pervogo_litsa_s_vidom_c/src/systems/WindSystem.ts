import { BALANCE } from '../core/balance.js'

/** Ветер: пульсирующие порывы по синусоиде 0.28 Гц плюс медленный дрейф
 * направления. lateral — компонента поперёк линии огня (ось -Z), м/с. */
export class WindSystem {
  private phase = Math.random() * Math.PI * 2
  private driftPhase = Math.random() * Math.PI * 2
  private elapsed = 0

  speed = 0
  lateral = 0
  /** Угол стрелки флажка/анемометра в градусах: 0 — ветер в спину, 90 — слева. */
  directionDeg = 0

  constructor(private baseSpeed: number, private gustAmplitude: number) {}

  reconfigure(baseSpeed: number, gustAmplitude: number): void {
    this.baseSpeed = baseSpeed
    this.gustAmplitude = gustAmplitude
  }

  update(dt: number): void {
    this.elapsed += dt
    this.phase += dt * BALANCE.ballistics.windFluctuationHz * Math.PI * 2
    this.driftPhase += dt * 0.11
    const envelope = 0.55 + 0.45 * Math.sin(this.phase)
    const micro = 0.12 * Math.sin(this.phase * 3.7 + 1.3)
    this.speed = Math.min(
      BALANCE.ballistics.maxWindSpeed,
      Math.max(0, this.baseSpeed + this.gustAmplitude * (envelope + micro)),
    )
    const angleRad = (Math.PI / 3) * (0.6 + 0.4 * Math.sin(this.driftPhase))
    this.directionDeg = (angleRad * 180) / Math.PI
    this.lateral = this.speed * Math.sin(angleRad)
  }
}
