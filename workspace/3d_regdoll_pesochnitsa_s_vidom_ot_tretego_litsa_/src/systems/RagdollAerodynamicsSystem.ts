import { BALANCE } from '../config/balance.ts'
import type { Stuntman } from '../entities/Stuntman.ts'

export interface SteerInput {
  pitch: number
  roll: number
}

/**
 * Аэродинамическое пилотирование рэгдоллом. Тело — аэродинамическая поверхность:
 * F_lift = 0.5*rho*V^2*S*Cl(alpha), F_drag = 0.5*rho*V^2*S*Cd(alpha),
 * Cl(alpha) = maxGlideLiftCoeff * sin(2*alpha), Cd(alpha) = 0.3 + 0.9*sin^2(alpha).
 * Угол атаки ведётся за вводом с откликом steerResponsiveness; выше
 * criticalStallAngle — сваливание (подъёмная сила исчезает).
 */
export class RagdollAerodynamicsSystem {
  private smoothedPitch = 0
  private smoothedRoll = 0

  fixedUpdate(stuntman: Stuntman, input: SteerInput): void {
    const responsiveness = BALANCE.aero.steerResponsivenessSec * 60
    this.smoothedPitch += (input.pitch - this.smoothedPitch) / responsiveness
    this.smoothedRoll += (input.roll - this.smoothedRoll) / responsiveness

    const torso = stuntman.torso()
    if (!torso) return
    const v = torso.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)
    if (speed < 1) return

    // Угол атаки: пике до -45°, планирование до +35°.
    const alphaDeg = this.smoothedPitch * 35 + (this.smoothedPitch < -1 ? -10 : 0)
    const alpha = Math.max(-45, Math.min(35, alphaDeg)) * (Math.PI / 180)

    const stall = Math.abs(alphaDeg) > BALANCE.aero.criticalStallAngleDeg
    const rho = BALANCE.launch.airDensity
    const area = BALANCE.launch.bodyArea

    const cl = stall ? 0 : BALANCE.aero.maxGlideLiftCoeff * Math.sin(2 * alpha)
    const cd = 0.3 + 0.9 * Math.sin(alpha) * Math.sin(alpha)

    const liftMag = 0.5 * rho * speed * speed * area * cl * 0.02
    const dragMag = 0.5 * rho * speed * speed * area * cd * 0.004

    // Направление полёта и вертикаль подъёмной силы с креном.
    const invSpeed = 1 / speed
    const dirX = v.x * invSpeed
    const dirY = v.y * invSpeed
    const dirZ = v.z * invSpeed
    let upX = -dirZ * this.smoothedRoll
    let upY = 1
    let upZ = dirX * this.smoothedRoll
    const upLen = Math.hypot(upX, upY, upZ)
    upX /= upLen
    upY /= upLen
    upZ /= upLen

    const diveLimit = BALANCE.aero.diveMaxSpeed
    if (speed > diveLimit && this.smoothedPitch < 0) {
      // Пике упирается в предел скорости — рост лобового сопротивления.
      return
    }

    torso.applyImpulse(
      { x: upX * liftMag - dirX * dragMag, y: upY * liftMag - dirY * dragMag, z: upZ * liftMag - dirZ * dragMag },
      true,
    )
    // Ветровое демпфирование конечностей — сглаживание джиттера рэгдолла.
    const damp = BALANCE.aero.airResistanceSmoothing
    for (const part of stuntman.parts.values()) {
      part.body.setAngularDamping(damp)
    }
  }

  reset(): void {
    this.smoothedPitch = 0
    this.smoothedRoll = 0
  }
}
