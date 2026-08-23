import * as THREE from 'three'
import { BALANCE } from './balanceConfig'
import { DestructibleObject } from '../types'
import { events } from '../core/EventBus'
import { sound } from '../audio/SoundManager'
import { physics } from '../physics/PhysicsWorld'

export class DestructionSystem {
  private static instance: DestructionSystem
  private destructibles: DestructibleObject[] = []
  private objectGroup = new THREE.Group()
  private objectMeshes: Map<number, THREE.Group> = new Map()
  private nextObjId = 1
  private pendingChainDetonations: Array<{ obj: DestructibleObject; delay: number }> = []

  // Debris instanced mesh pool (18 chunks)
  private debrisMesh: THREE.InstancedMesh | null = null
  private debrisDummy = new THREE.Object3D()
  private activeDebris: Array<{
    pos: THREE.Vector3
    velocity: THREE.Vector3
    rot: THREE.Vector3
    rotSpeed: THREE.Vector3
    life: number
    maxLife: number
  }> = []

  public static getInstance(): DestructionSystem {
    if (!DestructionSystem.instance) {
      DestructionSystem.instance = new DestructionSystem()
    }
    return DestructionSystem.instance
  }

  public init(parent: THREE.Object3D): void {
    parent.add(this.objectGroup)
    this.setupDebrisPool(parent)
    this.reset()

    events.on('EXPLOSION_DETONATED', (data: { impact: { x: number; y: number; z: number }; radius: number; damage: number }) => {
      this.checkExplosionOnObjects(data.impact, data.radius, data.damage)
    })
  }

  private setupDebrisPool(parent: THREE.Object3D): void {
    const chunkGeo = new THREE.BoxGeometry(1.2, 0.8, 1.4)
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.8
    })
    this.debrisMesh = new THREE.InstancedMesh(chunkGeo, chunkMat, BALANCE.physics.debrisCount)
    this.debrisMesh.count = 0
    parent.add(this.debrisMesh)
  }

  public reset(): void {
    for (const [, mesh] of this.objectMeshes) {
      this.objectGroup.remove(mesh)
    }
    this.objectMeshes.clear()
    this.destructibles = []
    this.pendingChainDetonations = []
    this.activeDebris = []
    if (this.debrisMesh) this.debrisMesh.count = 0

    // Spawn fuel tanks and explosive ammo depots along the road
    this.spawnFuelTank(-90, -35)
    this.spawnFuelTank(-15, 35)
    this.spawnFuelTank(45, -40)
    this.spawnFuelTank(110, 45)

    this.spawnAmmoDepot(-110, 20)
    this.spawnAmmoDepot(20, -50)
    this.spawnAmmoDepot(95, -20)
  }

  private spawnFuelTank(x: number, z: number): void {
    const id = this.nextObjId++
    const obj: DestructibleObject = {
      id,
      type: 'fuel_tank',
      position: { x, y: 2.5, z },
      health: 200,
      maxHealth: 200,
      isDestroyed: 0,
      isExplosive: true
    }
    this.destructibles.push(obj)

    const group = new THREE.Group()
    const tankGeo = new THREE.CylinderGeometry(2.5, 2.5, 6, 12)
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x444d56,
      roughness: 0.5,
      metalness: 0.3
    })
    const tank = new THREE.Mesh(tankGeo, tankMat)
    tank.position.y = 3
    group.add(tank)

    // Glowing thermal warning ring (White-Hot)
    const ringGeo = new THREE.TorusGeometry(2.6, 0.2, 8, 16)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.4
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotateX(Math.PI / 2)
    ring.position.y = 3
    group.add(ring)

    group.position.set(x, 0, z)
    this.objectGroup.add(group)
    this.objectMeshes.set(id, group)
  }

  private spawnAmmoDepot(x: number, z: number): void {
    const id = this.nextObjId++
    const obj: DestructibleObject = {
      id,
      type: 'ammo_crate',
      position: { x, y: 1.5, z },
      health: 150,
      maxHealth: 150,
      isDestroyed: 0,
      isExplosive: true
    }
    this.destructibles.push(obj)

    const group = new THREE.Group()
    const crateGeo = new THREE.BoxGeometry(3.5, 2.5, 3.5)
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x3a424a,
      roughness: 0.8
    })
    const crate = new THREE.Mesh(crateGeo, crateMat)
    crate.position.y = 1.25
    group.add(crate)

    group.position.set(x, 0, z)
    this.objectGroup.add(group)
    this.objectMeshes.set(id, group)
  }

  public update(dt: number): void {
    // 1. Process delayed chain detonations (0.12s - 0.25s)
    for (let i = this.pendingChainDetonations.length - 1; i >= 0; i--) {
      const item = this.pendingChainDetonations[i]
      item.delay -= dt
      if (item.delay <= 0) {
        this.detonateObject(item.obj)
        this.pendingChainDetonations.splice(i, 1)
      }
    }

    // 2. Update debris physics pool
    if (this.debrisMesh && this.activeDebris.length > 0) {
      let activeCount = 0
      for (let i = this.activeDebris.length - 1; i >= 0; i--) {
        const d = this.activeDebris[i]
        d.life += dt
        if (d.life >= d.maxLife) {
          this.activeDebris.splice(i, 1)
          continue
        }

        d.velocity.y -= 25.0 * dt
        d.pos.addScaledVector(d.velocity, dt)
        if (d.pos.y < 0.4) {
          d.pos.y = 0.4
          d.velocity.y = -d.velocity.y * 0.3
          d.velocity.x *= 0.7
          d.velocity.z *= 0.7
        }

        d.rot.addScaledVector(d.rotSpeed, dt)
        this.debrisDummy.position.copy(d.pos)
        this.debrisDummy.rotation.set(d.rot.x, d.rot.y, d.rot.z)
        this.debrisDummy.updateMatrix()
        this.debrisMesh.setMatrixAt(activeCount, this.debrisDummy.matrix)
        activeCount++
      }

      this.debrisMesh.count = activeCount
      this.debrisMesh.instanceMatrix.needsUpdate = true
    }
  }

  private checkExplosionOnObjects(
    impact: { x: number; y: number; z: number },
    radius: number,
    damage: number
  ): void {
    for (const obj of this.destructibles) {
      if (obj.isDestroyed) continue

      const dx = obj.position.x - impact.x
      const dz = obj.position.z - impact.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist <= radius) {
        obj.health -= damage
        if (obj.health <= 0) {
          obj.isDestroyed = 1
          this.pendingChainDetonations.push({
            obj,
            delay: 0.12 + Math.random() * 0.12 // 0.12-0.24s wave cascade
          })
        }
      }
    }
  }

  private detonateObject(obj: DestructibleObject): void {
    sound.playExplosionImpact()
    const radius = BALANCE.physics.fuelTankRadius
    const damage = BALANCE.physics.fuelTankDamage

    physics.applyExplosionImpulse(obj.position, radius, 140000)
    this.spawnDebris(obj.position, 6)

    const mesh = this.objectMeshes.get(obj.id)
    if (mesh) {
      mesh.visible = false
    }

    events.emit('CHAIN_DETONATION_OCCURRED', {
      position: obj.position,
      radius,
      damage,
      type: obj.type
    })

    // Cause damage to nearby enemies, squad, and objects
    events.emit('EXPLOSION_DETONATED', {
      caliber: '40mm',
      impact: obj.position,
      radius,
      damage
    })
  }

  private spawnDebris(pos: { x: number; y: number; z: number }, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.activeDebris.length >= BALANCE.physics.debrisCount) {
        this.activeDebris.shift()
      }
      this.activeDebris.push({
        pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 2, pos.y + 1, pos.z + (Math.random() - 0.5) * 2),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 25, 12 + Math.random() * 15, (Math.random() - 0.5) * 25),
        rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
        rotSpeed: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        life: 0,
        maxLife: 3.5
      })
    }
  }
}

export const destruction = DestructionSystem.getInstance()
