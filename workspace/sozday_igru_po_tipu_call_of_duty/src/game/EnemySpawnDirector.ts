import * as THREE from 'three'
import { EnemyEntity } from '../types'
import { events } from '../core/EventBus'

export class EnemySpawnDirector {
  private static instance: EnemySpawnDirector
  private enemies: EnemyEntity[] = []
  private enemyGroup = new THREE.Group()
  private nextEnemyId = 1
  private elapsedTime = 0

  // 3D Shared Geometries & Materials
  private infantryMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.9
  })
  private vehicleMat = new THREE.MeshStandardMaterial({
    color: 0x333a42,
    roughness: 0.7
  })
  private hotEngineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.5
  })

  private enemyMeshes: Map<number, THREE.Group> = new Map()

  public static getInstance(): EnemySpawnDirector {
    if (!EnemySpawnDirector.instance) {
      EnemySpawnDirector.instance = new EnemySpawnDirector()
    }
    return EnemySpawnDirector.instance
  }

  public init(parent: THREE.Object3D): void {
    parent.add(this.enemyGroup)
    this.reset()

    events.on('EXPLOSION_DETONATED', (data: { impact: { x: number; y: number; z: number }; radius: number; damage: number; caliber: string }) => {
      this.applyExplosionToEnemies(data.impact, data.radius, data.damage, data.caliber)
    })
  }

  public reset(): void {
    for (const [, mesh] of this.enemyMeshes) {
      this.enemyGroup.remove(mesh)
    }
    this.enemyMeshes.clear()
    this.enemies = []
    this.elapsedTime = 0
    this.nextEnemyId = 1

    // Initial Phase 1 infantry spawns
    this.spawnInfantryGroup(-130, -20, 4)
    this.spawnInfantryGroup(-90, 15, 3)
    this.spawnInfantryGroup(-50, -25, 4)
  }

  private spawnInfantry(x: number, z: number): void {
    const id = this.nextEnemyId++
    const entity: EnemyEntity = {
      id,
      type: 'infantry',
      position: { x, y: 0, z },
      health: 80,
      maxHealth: 80,
      isAlive: true,
      speed: 2.5,
      waypointIndex: 0,
      suppressionTimer: 0,
      fireCooldown: Math.random() * 2.0
    }
    this.enemies.push(entity)

    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.1, 4, 8), this.infantryMat)
    body.position.y = 1.0
    group.add(body)
    group.position.set(x, 0, z)

    this.enemyGroup.add(group)
    this.enemyMeshes.set(id, group)
  }

  public spawnInfantryGroup(centerX: number, centerZ: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 12
      const offsetZ = (Math.random() - 0.5) * 12
      this.spawnInfantry(centerX + offsetX, centerZ + offsetZ)
    }
  }

  public spawnTechnicalTruck(x: number, z: number): void {
    const id = this.nextEnemyId++
    const entity: EnemyEntity = {
      id,
      type: 'technical',
      position: { x, y: 0, z },
      health: 350,
      maxHealth: 350,
      isAlive: true,
      speed: 16.0,
      waypointIndex: 0,
      suppressionTimer: 0,
      fireCooldown: 1.0
    }
    this.enemies.push(entity)

    const group = new THREE.Group()
    // Truck Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 6.5), this.vehicleMat)
    body.position.y = 1.2
    group.add(body)

    // Glowing White-Hot Engine hood
    const engine = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 2.2), this.hotEngineMat)
    engine.position.set(0, 1.4, 2.2)
    group.add(engine)

    // DShK Gunner
    const gunner = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 6), this.infantryMat)
    gunner.position.set(0, 2.6, -1.5)
    group.add(gunner)

    group.position.set(x, 0, z)
    this.enemyGroup.add(group)
    this.enemyMeshes.set(id, group)
  }

  public spawnTank(x: number, z: number): void {
    const id = this.nextEnemyId++
    const entity: EnemyEntity = {
      id,
      type: 'tank',
      position: { x, y: 0, z },
      health: 1800,
      maxHealth: 1800,
      isAlive: true,
      speed: 7.0,
      waypointIndex: 0,
      suppressionTimer: 0,
      fireCooldown: 3.5
    }
    this.enemies.push(entity)

    const group = new THREE.Group()
    // Heavy Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.0, 9.0), this.vehicleMat)
    hull.position.y = 1.2
    group.add(hull)

    // Turret
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 1.5, 8), this.vehicleMat)
    turret.position.set(0, 2.5, -0.5)
    group.add(turret)

    // Cannon Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7.5, 6), this.vehicleMat)
    barrel.rotateX(Math.PI / 2)
    barrel.position.set(0, 2.5, 4.0)
    group.add(barrel)

    // Hot Exhaust Grill
    const exhaust = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 1.2), this.hotEngineMat)
    exhaust.position.set(0, 1.8, -4.2)
    group.add(exhaust)

    group.position.set(x, 0, z)
    this.enemyGroup.add(group)
    this.enemyMeshes.set(id, group)
  }

  public spawnBTR(x: number, z: number): void {
    const id = this.nextEnemyId++
    const entity: EnemyEntity = {
      id,
      type: 'btr',
      position: { x, y: 0, z },
      health: 900,
      maxHealth: 900,
      isAlive: true,
      speed: 10.0,
      waypointIndex: 0,
      suppressionTimer: 0,
      fireCooldown: 2.0
    }
    this.enemies.push(entity)

    const group = new THREE.Group()
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 8.0), this.vehicleMat)
    hull.position.y = 1.3
    group.add(hull)

    const engine = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 1.8), this.hotEngineMat)
    engine.position.set(0, 2.0, -2.8)
    group.add(engine)

    group.position.set(x, 0, z)
    this.enemyGroup.add(group)
    this.enemyMeshes.set(id, group)
  }

  public getEnemies(): EnemyEntity[] {
    return this.enemies
  }

  public getHeavyArmorRemaining(): number {
    return this.enemies.filter((e) => e.isAlive && (e.type === 'tank' || e.type === 'btr' || e.type === 'technical')).length
  }

  public update(dt: number, squadPos: THREE.Vector3): void {
    this.elapsedTime += dt

    // Scripted wave Director triggers
    if (this.elapsedTime >= 20 && this.elapsedTime - dt < 20) {
      this.spawnTechnicalTruck(40, -120)
      this.spawnTechnicalTruck(-20, 120)
    }
    if (this.elapsedTime >= 40 && this.elapsedTime - dt < 40) {
      this.spawnTechnicalTruck(80, -90)
      this.spawnInfantryGroup(30, 40, 5)
    }
    if (this.elapsedTime >= 55 && this.elapsedTime - dt < 55) {
      this.spawnTank(90, 60)
      this.spawnBTR(60, -70)
      this.spawnInfantryGroup(100, 30, 6)
    }
    if (this.elapsedTime >= 72 && this.elapsedTime - dt < 72) {
      this.spawnBTR(140, 40)
      this.spawnTechnicalTruck(160, -30)
    }

    // Update enemy AI logic
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue

      if (enemy.suppressionTimer > 0) {
        enemy.suppressionTimer -= dt
      }

      // Move toward squad position
      const dx = squadPos.x - enemy.position.x
      const dz = squadPos.z - enemy.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > 15 && enemy.suppressionTimer <= 0) {
        const moveDist = enemy.speed * dt
        enemy.position.x += (dx / dist) * moveDist
        enemy.position.z += (dz / dist) * moveDist
      }

      // Fire at squad if in range and not suppressed
      if (dist < 45 && enemy.suppressionTimer <= 0) {
        enemy.fireCooldown -= dt
        if (enemy.fireCooldown <= 0) {
          enemy.fireCooldown = enemy.type === 'infantry' ? 1.8 : 2.5
          events.emit('ENEMY_FIRED_AT_SQUAD', {
            type: enemy.type,
            damage: enemy.type === 'infantry' ? 15 : 35
          })
        }
      }

      // Sync 3D Mesh
      const mesh = this.enemyMeshes.get(enemy.id)
      if (mesh) {
        mesh.position.set(enemy.position.x, 0, enemy.position.z)
        if (dist > 0.1) {
          mesh.rotation.y = Math.atan2(dx, dz)
        }
      }
    }
  }

  private applyExplosionToEnemies(
    impact: { x: number; y: number; z: number },
    radius: number,
    damage: number,
    caliber: string
  ): void {
    let killedCount = 0
    let armorKilled = 0

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue

      const dx = enemy.position.x - impact.x
      const dz = enemy.position.z - impact.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist <= radius) {
        const falloff = Math.max(0, 1 - Math.pow(dist / radius, 1.5))
        const actualDmg = damage * falloff
        enemy.health -= actualDmg

        // Apply suppression from 25mm or blast radius
        if (dist <= 8.0) {
          enemy.suppressionTimer = 2.8
        }

        if (enemy.health <= 0) {
          enemy.isAlive = false
          killedCount++
          if (enemy.type === 'tank' || enemy.type === 'btr' || enemy.type === 'technical') {
            armorKilled++
          }

          const mesh = this.enemyMeshes.get(enemy.id)
          if (mesh) {
            mesh.visible = false
          }
        }
      }
    }

    if (killedCount > 0 || armorKilled > 0) {
      events.emit('ENEMIES_ELIMINATED', {
        killed: killedCount,
        armor: armorKilled,
        caliber
      })
    }
  }
}

export const enemyDirector = EnemySpawnDirector.getInstance()
