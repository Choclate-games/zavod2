import type { BlobEntity } from './EntityManager'

export class Player {
  selected: BlobEntity | null = null
  score = 0
  ringouts = 0
  combo = 0
  maxTier = 1

  reset(): void {
    this.selected = null
    this.score = 0
    this.ringouts = 0
    this.combo = 0
    this.maxTier = 1
  }

  registerMerge(tier: number): void {
    this.maxTier = Math.max(this.maxTier, tier)
    this.combo += 1
    this.score += tier * tier * 80
  }

  registerRingout(tier: number): void {
    this.ringouts += 1
    this.combo = Math.min(9, this.combo + 1)
    this.score += tier * 100
  }
}
