import { BALANCE } from '../core/balance'
import { events } from '../core/EventBus'
import type { ParcelState } from '../core/types'
import { storageService } from '../platform/StorageService'

export class ParcelIntegritySystem {
  private maxIntegrity = BALANCE.parcelIntegrity.maxIntegrity
  private currentIntegrity = BALANCE.parcelIntegrity.maxIntegrity
  private turbulence = 0
  private stabilizationRate = BALANCE.parcelIntegrity.fluidStabilizationRate
  private cavitationThreshold = BALANCE.parcelIntegrity.cavitationGForceThreshold

  constructor() {
    this.reset()

    events.on('REVIVE_TRIGGERED', () => {
      this.revive()
    })
  }

  public reset(): void {
    this.currentIntegrity = this.maxIntegrity
    this.turbulence = 0
    this.broadcast()
  }

  public revive(): void {
    this.currentIntegrity = this.maxIntegrity
    this.turbulence = 0
    this.broadcast()
  }

  public getIntegrity(): number {
    return this.currentIntegrity
  }

  public getIntegrityPercent(): number {
    return Math.max(0, Math.min(100, Math.round((this.currentIntegrity / this.maxIntegrity) * 100)))
  }

  public isDestroyed(): boolean {
    return this.currentIntegrity <= 0
  }

  public applyHardImpact(verticalVelocity: number): number {
    const gear = storageService.getSave().gear
    // Gear damping reduces damage by 10% per level up to 50%
    const bagDamping = Math.min(0.5, (gear.bagSuspensionLevel - 1) * 0.1)

    const excessSpeed = Math.max(0, Math.abs(verticalVelocity) - BALANCE.cushionRoll.safeFallVelocityCap)
    let damage = BALANCE.cushionRoll.hardImpactDamage
    if (excessSpeed > 0) {
      damage = Math.max(damage, excessSpeed * 4.5)
    }
    damage *= (1.0 - bagDamping)

    this.currentIntegrity = Math.max(0, this.currentIntegrity - damage)
    this.turbulence = Math.min(100, this.turbulence + 45)
    this.broadcast()
    return damage
  }

  public applyObstacleDamage(): number {
    const gear = storageService.getSave().gear
    const bagDamping = Math.min(0.5, (gear.bagSuspensionLevel - 1) * 0.1)
    const damage = BALANCE.parcelIntegrity.obstacleImpactDamage * (1.0 - bagDamping)

    this.currentIntegrity = Math.max(0, this.currentIntegrity - damage)
    this.turbulence = Math.min(100, this.turbulence + 35)
    this.broadcast()
    return damage
  }

  public update(dt: number, currentGForce = 1.0): void {
    if (currentGForce > this.cavitationThreshold) {
      this.turbulence = Math.min(100, this.turbulence + (currentGForce - this.cavitationThreshold) * 25.0 * dt)
    } else {
      this.turbulence = Math.max(0, this.turbulence - this.stabilizationRate * dt)
    }

    if (this.turbulence > 75.0) {
      this.currentIntegrity = Math.max(0, this.currentIntegrity - 2.0 * dt)
      this.broadcast()
    }
  }

  private broadcast(): void {
    const state: ParcelState = {
      current: Math.round(this.currentIntegrity),
      max: this.maxIntegrity,
      percent: this.getIntegrityPercent(),
      isCritical: this.currentIntegrity < 35,
      turbulence: Math.round(this.turbulence),
    }
    events.emit('PARCEL_INTEGRITY_UPDATED', state)
  }
}
