import * as THREE from 'three'
import { Enemy, EnemyType } from './Enemy'
import { Prop } from './Prop'
import { Player } from './Player'
import { BALANCE } from '../config/Balance'

export class EntityManager {
  public enemies: Enemy[] = []
  public props: Prop[] = []
  private scene: THREE.Scene
  public currentWave = 1
  public readonly totalWaves = 4

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public clearAll(): void {
    for (const e of this.enemies) {
      e.destroy()
    }
    this.enemies = []

    for (const p of this.props) {
      p.destroyProp()
    }
    this.props = []
  }

  public spawnWave(wave: number): void {
    this.clearAll()
    this.currentWave = wave

    // Spawn props around arena
    this.spawnDefaultProps(wave)

    // Spawn wave enemies in circle
    if (wave === 1) {
      this.spawnEnemiesCircle('hooligan', 5, 8)
    } else if (wave === 2) {
      this.spawnEnemiesCircle('hooligan', 4, 8)
      this.spawnEnemiesCircle('flanker', 3, 9)
    } else if (wave === 3) {
      this.spawnEnemiesCircle('flanker', 4, 8)
      this.spawnEnemiesCircle('heavy', 3, 9.5)
    } else if (wave === 4) {
      this.spawnEnemiesCircle('boss', 1, 8.5)
      this.spawnEnemiesCircle('hooligan', 4, 9.5)
    }
  }

  private spawnDefaultProps(wave: number): void {
    const crateCount = wave >= 3 ? 6 : 4
    for (let i = 0; i < crateCount; i++) {
      const angle = (i / crateCount) * Math.PI * 2 + 0.3
      const dist = 6.5
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      this.props.push(new Prop(this.scene, 'crate', x, z))
    }

    const barrelCount = wave >= 2 ? (wave >= 3 ? 3 : 2) : 1
    for (let i = 0; i < barrelCount; i++) {
      const angle = (i / barrelCount) * Math.PI * 2 + 1.2
      const dist = 7.5
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      this.props.push(new Prop(this.scene, 'barrel', x, z))
    }
  }

  private spawnEnemiesCircle(type: EnemyType, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      this.enemies.push(new Enemy(this.scene, type, x, z))
    }
  }

  public update(dt: number, player: Player): void {
    // 1. Update Props
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i]
      if (!p.active) {
        this.props.splice(i, 1)
      } else {
        p.update()
      }
    }

    // 2. Update Enemies & Check Body Bowling Collisions
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (!enemy.active || enemy.state === 'DEAD') {
        player.addCash(enemy.bounty)
        enemy.destroy()
        this.enemies.splice(i, 1)
        continue
      }

      enemy.update(dt, player.position, (dmg) => {
        player.takeDamage(dmg)
      })

      // If enemy is FLYING_RAGDOLL: perform body bowling vs other enemies & props
      if (enemy.state === 'FLYING_RAGDOLL' && enemy.body) {
        const flyingPos = enemy.body.translation()
        const flyingVel = enemy.body.linvel()
        const speed = Math.hypot(flyingVel.x, flyingVel.z)

        if (speed >= BALANCE.kinetic_body_bowling.minLethalSpeed) {
          // Check collision with other alive enemies
          for (const other of this.enemies) {
            if (other === enemy || other.state === 'DEAD' || !other.body) continue
            const otherPos = other.body.translation()
            const dist = Math.hypot(flyingPos.x - otherPos.x, flyingPos.z - otherPos.z)

            if (dist < 1.4) {
              // Body bowling hit!
              const transferRatio = BALANCE.kinetic_body_bowling.chainEnergyTransfer
              const impactImpulseX = flyingVel.x * transferRatio
              const impactImpulseZ = flyingVel.z * transferRatio
              const impactDamage =
                BALANCE.spartan_launch_kick.baseKickDamage +
                BALANCE.kinetic_body_bowling.kineticDamageConstant * 0.5 * enemy.mass * (speed * speed)

              other.takeDamage(impactDamage)
              other.launchRagdoll(impactImpulseX, 3.5, impactImpulseZ)
              player.registerHit()
            }
          }

          // Check collision with props
          for (const prop of this.props) {
            if (!prop.active || !prop.body) continue
            const propPos = prop.body.translation()
            const dist = Math.hypot(flyingPos.x - propPos.x, flyingPos.z - propPos.z)
            if (dist < 1.3) {
              const impactForce = (enemy.mass * speed) / 0.08
              prop.takeImpact(impactForce, (origin, radius, dmg) => {
                this.explodeArea(origin, radius, dmg, player)
              })
            }
          }
        }
      }
    }
  }

  public explodeArea(origin: THREE.Vector3, radius: number, dmg: number, player: Player): void {
    // Damage player if in blast radius
    const distToPlayer = player.position.distanceTo(origin)
    if (distToPlayer <= radius) {
      player.takeDamage(dmg * 0.5)
    }

    // Damage and launch all nearby enemies
    for (const enemy of this.enemies) {
      if (!enemy.body || !enemy.active) continue
      const t = enemy.body.translation()
      const enemyPos = new THREE.Vector3(t.x, t.y, t.z)
      const dist = enemyPos.distanceTo(origin)

      if (dist <= radius) {
        const falloff = 1.0 - dist / radius
        const blastDmg = dmg * falloff
        enemy.takeDamage(blastDmg)

        const dir = enemyPos.clone().sub(origin).normalize()
        const launchSpeed = 16.0 * falloff
        enemy.launchRagdoll(dir.x * launchSpeed, 5.0, dir.z * launchSpeed)
        player.registerHit()
      }
    }
  }

  public executeSpartanKick(
    player: Player,
    kickData: { isCharged: boolean; impulse: number; reach: number },
  ): void {
    const px = player.position.x
    const pz = player.position.z
    const heading = player.heading

    const kickDirX = Math.sin(heading)
    const kickDirZ = Math.cos(heading)

    let hitAny = false

    for (const enemy of this.enemies) {
      if (!enemy.body || !enemy.active) continue
      const t = enemy.body.translation()
      const dx = t.x - px
      const dz = t.z - pz
      const dist = Math.hypot(dx, dz)

      if (dist <= kickData.reach) {
        // Dot product to check if enemy is in front of player
        const dot = (dx * kickDirX + dz * kickDirZ) / (dist || 1)
        if (dot > 0.3) {
          // Valid Spartan Kick Hit!
          const launchSpeed = kickData.impulse / enemy.mass
          const launchVy = kickData.isCharged ? 5.5 : 3.5

          enemy.takeDamage(BALANCE.spartan_launch_kick.baseKickDamage)
          enemy.launchRagdoll(kickDirX * launchSpeed, launchVy, kickDirZ * launchSpeed)
          player.registerHit()
          hitAny = true
        }
      }
    }

    // Also check props in kick path
    for (const prop of this.props) {
      if (!prop.body || !prop.active) continue
      const t = prop.body.translation()
      const dx = t.x - px
      const dz = t.z - pz
      const dist = Math.hypot(dx, dz)
      if (dist <= kickData.reach) {
        const dot = (dx * kickDirX + dz * kickDirZ) / (dist || 1)
        if (dot > 0.3) {
          prop.takeImpact(kickData.impulse * 3, (origin, radius, dmg) => {
            this.explodeArea(origin, radius, dmg, player)
          })
          hitAny = true
        }
      }
    }
  }

  public isWaveCleared(): boolean {
    return this.enemies.length === 0
  }
}
