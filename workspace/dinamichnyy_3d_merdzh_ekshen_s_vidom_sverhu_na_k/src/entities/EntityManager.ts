import { BALANCE, TIER_MASS, TIER_RADIUS } from '../balance'

export type EnemyKind = 'skirmisher' | 'leaper' | 'rammer' | 'void_titan'

export type BlobEntity = {
  active: boolean
  slot: number
  tier: number
  x: number
  z: number
  vx: number
  vz: number
  drag: number
  ramTime: number
  chompCooldown: number
  selected: boolean
}

export type EnemyEntity = {
  active: boolean
  slot: number
  kind: EnemyKind
  x: number
  z: number
  vx: number
  vz: number
  hp: number
  stunTime: number
  phase: number
  target: number
}

export class EntityManager {
  readonly blobs: BlobEntity[] = []
  readonly enemies: EnemyEntity[] = []
  private activeBlobs = 0
  private activeEnemies = 0

  constructor() {
    for (let index = 0; index < 12; index += 1) {
      this.blobs.push({ active: false, slot: index, tier: 1, x: 0, z: 0, vx: 0, vz: 0, drag: BALANCE.linearDrag, ramTime: 0, chompCooldown: 0, selected: false })
    }
    for (let index = 0; index < BALANCE.maxEnemies; index += 1) {
      this.enemies.push({ active: false, slot: 12 + index, kind: 'skirmisher', x: 0, z: 0, vx: 0, vz: 0, hp: 1, stunTime: 0, phase: index * 0.7, target: 0 })
    }
  }

  spawnBlob(tier: number, x: number, z: number): BlobEntity | null {
    for (const blob of this.blobs) {
      if (blob.active) continue
      blob.active = true
      blob.tier = Math.min(BALANCE.maxTier, Math.max(1, tier))
      blob.x = x
      blob.z = z
      blob.vx = 0
      blob.vz = 0
      blob.ramTime = 0
      blob.chompCooldown = 0
      blob.selected = false
      this.activeBlobs += 1
      return blob
    }
    return null
  }

  spawnEnemy(kind: EnemyKind, x: number, z: number): EnemyEntity | null {
    if (this.activeEnemies >= BALANCE.maxEnemies) return null
    for (const enemy of this.enemies) {
      if (enemy.active) continue
      enemy.active = true
      enemy.kind = kind
      enemy.x = x
      enemy.z = z
      enemy.vx = 0
      enemy.vz = 0
      enemy.hp = kind === 'void_titan' ? 4 : kind === 'rammer' ? 2 : 1
      enemy.stunTime = 0
      enemy.target = 0
      this.activeEnemies += 1
      return enemy
    }
    return null
  }

  deactivateBlob(blob: BlobEntity): void {
    if (!blob.active) return
    blob.active = false
    blob.selected = false
    this.activeBlobs -= 1
  }

  deactivateEnemy(enemy: EnemyEntity): void {
    if (!enemy.active) return
    enemy.active = false
    this.activeEnemies -= 1
  }

  radius(blob: BlobEntity): number { return TIER_RADIUS[blob.tier - 1] }
  mass(blob: BlobEntity): number { return TIER_MASS[blob.tier - 1] }
  countBlobs(): number { return this.activeBlobs }
  countEnemies(): number { return this.activeEnemies }
}
