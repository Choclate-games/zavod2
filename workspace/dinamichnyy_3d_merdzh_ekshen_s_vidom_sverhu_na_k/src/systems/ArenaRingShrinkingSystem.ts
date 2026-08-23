import { BALANCE } from '../balance'

export class ArenaRingShrinkingSystem {
  radius = BALANCE.initialArenaDiameter / 2
  private elapsed = 0
  private nextCollapse = BALANCE.sectorCollapseInterval
  warning = false

  reset(): void {
    this.radius = BALANCE.initialArenaDiameter / 2
    this.elapsed = 0
    this.nextCollapse = BALANCE.sectorCollapseInterval
    this.warning = false
  }

  update(dt: number, onWarning: () => void, onCollapse: (radius: number) => void): void {
    this.elapsed += dt
    if (!this.warning && this.elapsed >= this.nextCollapse - BALANCE.warningFractureTime && this.radius > BALANCE.finalCoreDiameter / 2) {
      this.warning = true
      onWarning()
    }
    if (this.warning && this.elapsed >= this.nextCollapse) {
      this.warning = false
      this.radius = Math.max(BALANCE.finalCoreDiameter / 2, this.radius - 2.625)
      this.nextCollapse += BALANCE.sectorCollapseInterval
      onCollapse(this.radius)
    }
  }
}
