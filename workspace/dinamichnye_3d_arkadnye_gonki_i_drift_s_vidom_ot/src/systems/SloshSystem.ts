import { balance } from '../data/balance'
import type { EventBus } from '../core/EventBus'

/**
 * Гидродинамический маятник: 8 тонн молока в цистерне как физический
 * маятник с фазовым запаздыванием. Реакция волны давит на кузов над
 * центром масс и кренит его — гидроудар опрокидывает так же честно,
 * как центробежная сила.
 */
export class SloshSystem {
  theta = 0
  private omega = 0
  private prevOmega = 0
  private lastLatAccel = 0
  private smoothedAccel = 0

  constructor(private readonly bus: EventBus) {}

  reset(): void {
    this.theta = 0
    this.omega = 0
    this.prevOmega = 0
    this.smoothedAccel = 0
  }

  /**
   * Полушаг: интегрируем волну до step(), применяем силу реакции после.
   * latAccel — боковое ускорение кузова в локальной системе (м/с²).
   */
  integrate(latAccel: number, dt: number): void {
    const g = 9.81
    const pendulumLength = 2.0
    const omegaN = Math.sqrt(g / pendulumLength)
    const baffleFraction = Math.min(1, balance.bafflesAbsorbPct / 100)
    const zeta = 0.12 + (0.58 - 0.12) * baffleFraction

    // сглаживание входа даёт жидкости фазовое запаздывание относительно руля
    this.smoothedAccel += (latAccel - this.smoothedAccel) * Math.min(1, dt / Math.max(balance.waveLagS, 0.05))

    const thetaDotDot =
      -(g / pendulumLength) * Math.sin(this.theta) -
      2 * zeta * omegaN * this.omega -
      (this.lastLatAccel / pendulumLength) * Math.cos(this.theta)
    this.prevOmega = this.omega
    this.omega += thetaDotDot * dt
    this.theta += this.omega * dt
    this.theta = Math.max(-1.1, Math.min(1.1, this.theta))
    this.lastLatAccel = this.smoothedAccel
  }

  /** Сила реакции молока на кузов, Н·с; вызывается между integrate и step(). */
  applyReaction(applyFn: (forceX: number, forceZ: number, pointY: number) => void, massMilkKg: number): void {
    const angularAccel = (this.omega - this.prevOmega) / (1 / 60)
    const reaction = massMilkKg * 2.0 * angularAccel * 0.02
    const sinT = Math.sin(this.theta)
    const cosT = Math.cos(this.theta)
    applyFn(reaction * cosT, -reaction * sinT, 1.15)
  }

  /** Гидроудар: пик скорости волны отдаётся в звук, тряску камеры и HUD. */
  detectImpact(): number {
    const spike = Math.abs(this.omega) - Math.abs(this.prevOmega)
    if (spike > 0.35 && Math.abs(this.theta) > 0.18) {
      const strength = Math.min(1, Math.abs(this.theta))
      this.bus.emit('slosh:impact', { strength })
      return strength
    }
    return 0
  }
}
