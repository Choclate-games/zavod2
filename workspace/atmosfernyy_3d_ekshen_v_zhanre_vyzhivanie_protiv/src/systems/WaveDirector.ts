import { DERIVED } from '../config/Balance.js'
import type { EventBus } from '../core/EventBus.js'
import { ENEMY_CAPACITY, EnemyType, type EnemyManager } from '../entities/EnemyManager.js'

const SECTOR_COUNT_MAX = 4
const TAU = Math.PI * 2

export const PHASE_TITLES = [
  'ФАЗА I — ПЕРВЫЙ ПРИЛИВ',
  'ФАЗА II — ДВОЙНОЙ ФРОНТ',
  'ФАЗА III — ШТОРМОВОЙ ШКВАЛ',
  'ФАЗА IV — РАССВЕТНЫЙ НАТИСК',
] as const

/**
 * Процедурный спавн орды по формулам спецификации: интервал сжимается от 2.4 с
 * до 0.6 с, активные сектора расширяются с одного до всех четырёх.
 */
export class WaveDirector {
  private spawnTimer = 0
  private phaseIndex = -1
  private leviathanSpawned = false

  constructor(
    private readonly enemies: EnemyManager,
    private readonly events: EventBus,
  ) {}

  reset(): void {
    this.spawnTimer = 0
    this.phaseIndex = -1
    this.leviathanSpawned = false
  }

  update(dt: number, elapsedSec: number): void {
    const nightDuration = DERIVED.nightDurationSec
    const progress = Math.min(1, elapsedSec / nightDuration)

    const phase = this.phaseFor(elapsedSec)
    if (phase !== this.phaseIndex) {
      this.phaseIndex = phase
      this.events.emit('world:phase', { index: phase, title: PHASE_TITLES[phase] })
    }

    if (!this.leviathanSpawned && elapsedSec >= DERIVED.phaseBoundariesSec[3] + 5) {
      this.leviathanSpawned = true
      const angle = Math.random() * TAU
      this.enemies.spawn(EnemyType.Leviathan, angle, 25)
      this.events.emit('fx:shake', { power: 0.8 })
    }

    const interval =
      DERIVED.spawnIntervalStartSec -
      (DERIVED.spawnIntervalStartSec - DERIVED.spawnIntervalEndSec) * Math.pow(progress, 1.4)
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.enemies.aliveCount < ENEMY_CAPACITY - 12) {
      this.spawnTimer = interval * (0.75 + Math.random() * 0.5)
      const sectors = Math.min(SECTOR_COUNT_MAX, 1 + Math.floor(3 * progress))
      this.spawnPack(sectors, phase)
    }
  }

  private phaseFor(elapsedSec: number): number {
    let phase = 0
    for (let i = 0; i < DERIVED.phaseBoundariesSec.length; i++) {
      if (elapsedSec >= DERIVED.phaseBoundariesSec[i]) phase = i
    }
    return phase
  }

  private spawnPack(sectors: number, phase: number): void {
    const packSize = 2 + Math.floor(Math.random() * (2 + phase))
    for (let n = 0; n < packSize; n++) {
      const sectorAngle = (Math.floor(Math.random() * sectors) / sectors) * TAU
      const jitter = (Math.random() - 0.5) * (TAU / sectors) * 0.7
      this.spawnByPhase(sectorAngle + jitter, phase)
    }
  }

  private spawnByPhase(angle: number, phase: number): void {
    const roll = Math.random()
    if (phase === 0) {
      this.enemies.spawn(EnemyType.Crawler, angle, 24 + Math.random() * 2)
      return
    }
    if (phase === 1) {
      this.enemies.spawn(roll < 0.75 ? EnemyType.Crawler : EnemyType.Carapace, angle, 24 + Math.random() * 2)
      return
    }
    if (phase === 2) {
      const type = roll < 0.55 ? EnemyType.Crawler : roll < 0.8 ? EnemyType.BioMine : EnemyType.Carapace
      this.enemies.spawn(type, angle, 24 + Math.random() * 2)
      return
    }
    const type = roll < 0.45 ? EnemyType.Crawler : roll < 0.7 ? EnemyType.BioMine : EnemyType.Carapace
    this.enemies.spawn(type, angle, 23 + Math.random() * 3)
  }
}
