import type { Balance, BalanceKey } from '../config/Balance.js'
import { DERIVED } from '../config/Balance.js'
import type { EventBus } from '../core/EventBus.js'

const TAU = Math.PI * 2

export function wrapAngle(angle: number): number {
  let result = angle % TAU
  if (result > Math.PI) result -= TAU
  else if (result < -Math.PI) result += TAU
  return result
}

export interface LensInput {
  aimDelta: number
  focus: boolean
  steamPressed: boolean
}

/**
 * Термодинамика линзы Френеля: угол конуса, нагрев, перегрев-локаут,
 * паровой сброс. Все числа — из balance.yaml через Balance.
 */
export class LensSystem {
  yaw = -Math.PI / 2
  /** Текущий полный угол конуса, радианы. */
  angleRad: number = (60 * Math.PI) / 180
  isFocus = false
  overheated = false
  temperature: number = DERIVED.baseTempC
  focusHoldSec = 0
  overheatLockRemaining = 0
  overheatCount = 0
  steamProgress = 0
  steamReady = false

  private readonly heatRate: number
  private readonly coolRate: number
  private readonly lockDuration: number
  private readonly lerpTime: number
  private readonly baseDps: number
  private readonly wideAngle: number
  private readonly focusAngle: number
  private readonly maxRotationWide: number
  private readonly rotationFocusFactor: number
  private readonly steamTempReset: number
  private readonly steamChargeNeeded: number
  private angleVelocity = 0

  constructor(
    balance: Balance,
    private readonly events: EventBus,
  ) {
    const need = (key: BalanceKey): number => balance.get(key)
    this.heatRate = need('bazovyy_nagrev_linzy')
    this.coolRate = need('skorost_estestvennogo_ostyvaniya')
    this.lockDuration = need('dlitelnost_shtrafnoy_blokirovki_peregreva')
    this.lerpTime = Math.max(0.001, need('vremya_svedeniya_linzy_v_fokus'))
    this.baseDps = need('bazovyy_uron_kontsentrirovannogo_fokusa')
    this.wideAngle = ((need('sektor_rasseyannogo_osvescheniya') || 60) * Math.PI) / 180
    this.focusAngle = (DERIVED.focusBeamAngleDeg * Math.PI) / 180
    this.maxRotationWide = ((need('maksimalnaya_skorost_vrascheniya_prozhektora') || 240) * Math.PI) / 180
    this.rotationFocusFactor = 1 - (need('zamedlenie_povorota_v_rezhime_fokusa') || 62.5) / 100
    this.steamTempReset = need('snizhenie_temperatury_linzy_pri_sbrose') || DERIVED.baseTempC
    this.steamChargeNeeded = need('trebuemoe_chislo_tsepnyh_ubiystv_dlya_perezaryadki') || 15
    this.angleRad = this.wideAngle
  }

  get dps(): number {
    return this.baseDps * (1.0 + 0.5 * Math.min(this.focusHoldSec, 2.0))
  }

  get tempRatio(): number {
    return (this.temperature - DERIVED.baseTempC) / (DERIVED.overheatTempC - DERIVED.baseTempC)
  }

  reset(): void {
    this.temperature = DERIVED.baseTempC
    this.overheated = false
    this.overheatLockRemaining = 0
    this.overheatCount = 0
    this.focusHoldSec = 0
    this.steamProgress = 0
    this.steamReady = false
    this.isFocus = false
    this.angleRad = this.wideAngle
  }

  registerChainKill(): void {
    if (this.steamReady) return
    this.steamProgress += 1
    if (this.steamProgress >= this.steamChargeNeeded) {
      this.steamProgress = this.steamChargeNeeded
      this.steamReady = true
    }
  }

  update(dt: number, input: LensInput): void {
    // Вращение: массивная башенная установка имеет предел скорости,
    // в фокусе поворот замедлен по балансу.
    const maxRotation = this.isFocus ? this.maxRotationWide * this.rotationFocusFactor : this.maxRotationWide
    const desired = input.aimDelta / dt
    const clamped = Math.max(-maxRotation, Math.min(maxRotation, desired))
    this.angleVelocity += (clamped - this.angleVelocity) * Math.min(1, dt * 12)
    this.yaw = wrapAngle(this.yaw + this.angleVelocity * dt)

    // Фокус и перегрев-локаут.
    if (this.overheated) {
      this.overheatLockRemaining -= dt
      this.temperature -= DERIVED.overheatLockCoolRate * dt
      if (this.overheatLockRemaining <= 0) {
        this.overheated = false
        this.temperature = Math.max(this.temperature, DERIVED.baseTempC)
      }
    } else if (input.focus) {
      this.temperature += this.heatRate * dt
      this.focusHoldSec += dt
      if (this.temperature >= DERIVED.overheatTempC) {
        this.temperature = DERIVED.overheatTempC
        this.overheated = true
        this.overheatLockRemaining = this.lockDuration
        this.overheatCount += 1
        this.events.emit('world:beam', { focus: false, overheated: true })
      }
    } else {
      this.temperature -= this.coolRate * dt
      if (this.temperature < DERIVED.baseTempC) this.temperature = DERIVED.baseTempC
      this.focusHoldSec = 0
    }

    // Плавный переход конуса за vremya_svedeniya_linzy_v_fokus.
    this.isFocus = input.focus && !this.overheated
    const targetAngle = this.isFocus ? this.focusAngle : this.wideAngle
    const k = Math.min(1, dt / this.lerpTime)
    this.angleRad += (targetAngle - this.angleRad) * k

    if (this.steamReady && input.steamPressed) this.fireSteam()
    this.events.emit('hud:heat', { temp: this.tempRatio, locked: this.overheated })
    this.events.emit('hud:steam', { charged: this.steamReady, progress: this.steamProgress / this.steamChargeNeeded })
    this.events.emit('world:beam', { focus: this.isFocus, overheated: this.overheated })
  }

  private fireSteam(): void {
    this.steamReady = false
    this.steamProgress = 0
    this.temperature = this.steamTempReset < DERIVED.baseTempC ? DERIVED.baseTempC : this.steamTempReset
    this.overheated = false
    this.overheatLockRemaining = 0
    this.events.emit('fx:steam', {})
  }
}
