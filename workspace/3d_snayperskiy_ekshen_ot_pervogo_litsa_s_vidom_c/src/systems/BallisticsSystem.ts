import { BALANCE } from '../core/balance.js'

const G_BULLET = 9.81

/** Честная баллистика по формулам спецификации:
 * Drift_X = K_wind * Wind_Speed * (Distance/100)^1.35 * sin(Wind_Angle)
 * Drop_Y  = 0.5 * g * (Distance / V_muzzle)^2 */
export const BallisticsSystem = {
  muzzleVelocity: BALANCE.ballistics.muzzleVelocity,

  dropMeters(distance: number): number {
    return 0.5 * G_BULLET * Math.pow(distance / BALANCE.ballistics.muzzleVelocity, 2)
  },

  driftMeters(distance: number, lateralWind: number): number {
    if (lateralWind === 0) return 0
    const magnitude =
      BALANCE.ballistics.windCoefficient *
      Math.abs(lateralWind) *
      Math.pow(Math.max(1, distance) / 100, 1.35)
    return magnitude * Math.sign(lateralWind)
  },

  /** Поправка в Mil-Dot (тысячных дистанции) для дальномерной шкалы. */
  dropMil(distance: number): number {
    return distance > 0 ? (this.dropMeters(distance) / distance) * 1000 : 0
  },

  driftMil(distance: number, lateralWind: number): number {
    return distance > 0 ? (this.driftMeters(distance, lateralWind) / distance) * 1000 : 0
  },

  flightSeconds(distance: number): number {
    return Math.max(0.05, distance / BALANCE.ballistics.muzzleVelocity)
  },
}
