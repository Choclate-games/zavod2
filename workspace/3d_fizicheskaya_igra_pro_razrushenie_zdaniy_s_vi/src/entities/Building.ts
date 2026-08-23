import { DOMINO_CHAIN, STRUCTURAL_INTEGRITY } from '../core/balance'
import type { BuildingSpec } from '../core/levels'

export type BuildingState = 'standing' | 'falling' | 'collapsed'

export class Building {
  state: BuildingState = 'standing'
  chainDepth = 0
  chargeArmed = false
  chargeTimer = -1

  constructor(
    readonly spec: BuildingSpec,
    readonly handle: number,
  ) {}

  get integrityJ(): number {
    const base = DOMINO_CHAIN.FRACTURE_ENERGY_MJ * 1e6
    const factor = STRUCTURAL_INTEGRITY[this.spec.material]
    return this.chargeArmed ? base * factor * (1 - 0.6) : base * factor
  }
}
