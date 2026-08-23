import { ARC_PREDICTOR, SHEAR_CUT } from '../core/balance'
import type { AimPlan } from './CuttingImpulseSystem'

/**
 * Пассивный расчёт дуги падения верхушки при прицеливании: физический маятник
 * кренится вокруг ребра основания, траектория центра масс пишется в готовый
 * буфер из ARC_PREDICTOR.SAMPLES точек — без аллокаций в кадре.
 */
export class CenterOfMassArcPredictorSystem {
  readonly positions = new Float32Array(ARC_PREDICTOR.SAMPLES * 3)
  landingX = 0
  landingZ = 0
  valid = false

  private alpha = 0
  private omega = 0

  predict(plan: AimPlan, cameraYawRad: number): void {
    const spec = plan.building.spec
    const h = spec.h
    // Ребро опрокидывания: грань основания по направлению падения.
    const halfSpan = Math.abs(plan.fallDirX) * spec.w / 2 + Math.abs(plan.fallDirZ) * spec.d / 2
    const critical = Math.atan2(halfSpan * 2, h)
    this.alpha = critical * 0.15 + (plan.angleDeg / 90) * 0.1
    this.omega = 0.05 + plan.angleDeg / SHEAR_CUT.ANGLE_MAX_DEG * 0.25

    // Вращение направления падения в локальные оси здания для проекции дуги.
    const yaw = cameraYawRad
    const dirX = plan.fallDirX
    const dirZ = plan.fallDirZ

    let t = 0
    const dt = ARC_PREDICTOR.HORIZON_S / ARC_PREDICTOR.SAMPLES
    for (let i = 0; i < ARC_PREDICTOR.SAMPLES; i++) {
      // α'' = 1.5·g·sin(α) / H — физический маятник с осью на ребре опрокидывания.
      const angAccel = (1.5 * SHEAR_CUT.GRAVITY * Math.sin(this.alpha)) / h
      this.omega += angAccel * dt
      this.alpha += this.omega * dt
      t += dt
      const comHeight = Math.max(0.5, (h / 2) * Math.cos(this.alpha))
      const comOffset = (h / 2) * Math.sin(this.alpha)
      const jitter = 1 + ((i % 3) - 1) * ARC_PREDICTOR.NOISE_FRACTION * 0.4
      const idx = i * 3
      this.positions[idx] = spec.x + dirX * comOffset * jitter
      this.positions[idx + 1] = comHeight + Math.min(t, dt) * 0.5
      this.positions[idx + 2] = spec.z + dirZ * comOffset * jitter
    }
    const lastIdx = (ARC_PREDICTOR.SAMPLES - 1) * 3
    this.landingX = this.positions[lastIdx]!
    this.landingZ = this.positions[lastIdx] + 2!
    this.landingZ = this.positions[lastIdx + 2]!
    void yaw
    this.valid = true
  }

  clear(): void {
    this.valid = false
    this.alpha = 0
    this.omega = 0
  }
}
