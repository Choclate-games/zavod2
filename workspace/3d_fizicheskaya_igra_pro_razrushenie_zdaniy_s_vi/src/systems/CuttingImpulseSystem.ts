import { SHEAR_CUT } from '../core/balance'
import type { Building } from '../entities/Building'

export type AimPlan = {
  building: Building
  fallDirX: number
  fallDirZ: number
  angleDeg: number
  cutHeightM: number
}

/**
 * Преобразует жест протяжки в вектор среза: направление падения берётся из
 * экранного смещения, спроецированного на плоскость земли относительно камеры,
 * угол скоса клина — из длины и крутизны свайпа.
 */
export class CuttingImpulseSystem {
  plan: AimPlan = {
    building: null as unknown as Building,
    fallDirX: 1,
    fallDirZ: 0,
    angleDeg: SHEAR_CUT.ANGLE_DEFAULT_DEG,
    cutHeightM: SHEAR_CUT.HEIGHT_DEFAULT_M,
  }
  active = false

  beginAim(building: Building): void {
    this.active = true
    this.plan.building = building
    this.plan.angleDeg = SHEAR_CUT.ANGLE_DEFAULT_DEG
    this.plan.cutHeightM = Math.min(
      SHEAR_CUT.HEIGHT_MAX_M,
      Math.max(SHEAR_CUT.HEIGHT_MIN_M, building.spec.h * 0.06),
    )
  }

  updateAim(dxScreen: number, dyScreen: number, cameraYawRad: number): void {
    if (!this.active) return
    const length = Math.hypot(dxScreen, dyScreen)
    if (length > 4) {
      const screenAngle = Math.atan2(dyScreen, dxScreen)
      // Экранная ось X смотрит вправо от камеры; переводим вектор в мир по рысканью.
      const worldYaw = -screenAngle + cameraYawRad
      this.plan.fallDirX = Math.sin(worldYaw)
      this.plan.fallDirZ = Math.cos(worldYaw)
      const slope = Math.abs(dyScreen) / length
      const mapped = SHEAR_CUT.ANGLE_MIN_DEG +
        (1 - slope) * (SHEAR_CUT.ANGLE_MAX_DEG - SHEAR_CUT.ANGLE_MIN_DEG) * Math.min(1, length / 220)
      this.plan.angleDeg = Math.min(SHEAR_CUT.ANGLE_MAX_DEG, Math.max(SHEAR_CUT.ANGLE_MIN_DEG, mapped))
    }
  }

  endAim(): AimPlan | null {
    if (!this.active || !this.plan.building) {
      this.cancelAim()
      return null
    }
    this.active = false
    const fired: AimPlan = { ...this.plan, building: this.plan.building }
    this.plan.building = null as unknown as Building
    return fired
  }

  cancelAim(): void {
    this.active = false
    this.plan.building = null as unknown as Building
  }
}
