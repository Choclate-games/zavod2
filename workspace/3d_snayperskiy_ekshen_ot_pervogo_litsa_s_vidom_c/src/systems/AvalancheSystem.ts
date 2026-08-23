import { BALANCE } from '../core/balance.js'
import type { PhysicsWorld } from '../physics/PhysicsWorld.js'

export interface AvalancheOutcome {
  factor: number
  buriedTitan: boolean
  massPct: number
}

/** Кинетический раскол ледника: 48 физических глыб Rapier, сход по склону,
 * оценка погребения титана. Тела удаляются явно после эпизода. */
export class AvalancheSystem {
  private activeState = false
  private elapsed = 0
  private evaluated = false
  private outcome: AvalancheOutcome | null = null

  onImpactGround: ((x: number, z: number) => void) | null = null
  private groundImpactTimer = 0

  constructor(private physics: PhysicsWorld) {}

  get isActive(): boolean {
    return this.activeState
  }

  get result(): AvalancheOutcome | null {
    return this.outcome
  }

  /** factor — доля обрушенной массы по формуле попадания (0..1]. */
  trigger(factor: number, centerX: number, centerY: number, centerZ: number): void {
    this.activeState = true
    this.elapsed = 0
    this.evaluated = false
    this.outcome = null
    this.factorAtTrigger = Math.min(1, Math.max(0, factor))
    const count = BALANCE.glacier.avalancheBodies
    for (let i = 0; i < count; i++) {
      const rx = Math.sin(i * 127.1 + centerY) * 0.5
      const ry = Math.sin(i * 311.7 + centerX) * 0.5
      const rz = Math.cos(i * 74.7) * 0.5
      const px = centerX + rx * BALANCE.glacier.coreRadiusMeters * 40 + (i % 2 === 0 ? 6 : -6)
      const py = centerY + ry * 12
      const pz = centerZ + rz * 4
      const half = 1.1 + ((i * 37) % 19) / 9 // полуразмеры 1.1..3.2
      this.physics.spawnChunk(
        i,
        half, half * 0.8, half,
        px, py, pz,
        rx * 6,
        -2 - ry * 4,
        11 + rz * 6 + ((i % 5) * 0.8),
      )
    }
    this.groundImpactTimer = BALANCE.titan.avalancheFallSeconds
  }

  /** Вызывается после world.step(): синхронизация инстансов и оценка исхода. */
  update(dt: number, titanX: number): void {
    if (!this.activeState) return
    this.elapsed += dt
    this.groundImpactTimer -= dt
    if (this.groundImpactTimer <= 0 && this.groundImpactTimer > -dt * 2 && this.onImpactGround) {
      this.onImpactGround(titanX, -470)
    }
    if (!this.evaluated && this.elapsed >= BALANCE.titan.avalancheFallSeconds + 2.6) {
      this.evaluated = true
      this.outcome = this.evaluate(titanX)
    }
  }

  private evaluate(titanX: number): AvalancheOutcome {
    const count = BALANCE.glacier.avalancheBodies
    let covered = 0
    for (let i = 0; i < count; i++) {
      const chunk = this.physics.getChunk(i)
      if (!chunk) continue
      const p = chunk.body.translation()
      const nearPathZ = p.z > -505 && p.z < -430
      const nearTitan = Math.abs(p.x - titanX) < BALANCE.titan.killzoneLengthMeters / 2 + 10
      if (nearPathZ && nearTitan && p.y < 14) covered++
    }
    const coverageRatio = covered / count
    return {
      factor: this.factorAtTrigger,
      buriedTitan: coverageRatio > 0.22,
      massPct: Math.round(this.factorAtTrigger * 100),
    }
  }

  factorAtTrigger = 0

  finish(): void {
    this.physics.removeChunks()
    this.activeState = false
  }

  get secondsElapsed(): number {
    return this.elapsed
  }
}
