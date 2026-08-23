import * as THREE from 'three'
import { ProceduralModels } from '../rendering/ProceduralModels'

export interface RooftopChunkData {
  id: number
  startZ: number
  endZ: number
  group: THREE.Group
  walkableBoxes: {
    x: number
    y: number
    z: number
    halfW: number
    halfH: number
    halfD: number
    slopeDeg: number
    type: 'tile' | 'slate' | 'cable'
  }[]
  obstacles: {
    x: number
    y: number
    z: number
    width: number
    height: number
    depth: number
    type: 'pipe' | 'chimney'
  }[]
  hasLedge: boolean
  ledgeZ: number | null
}

export class RooftopProceduralGeneratorSystem {
  private scene: THREE.Scene
  private chunks: RooftopChunkData[] = []
  private nextChunkId = 0
  private currentSpawnZ = -5.0
  private targetFinishDistance = 400
  private finishSpawned = false
  private finishGroup: THREE.Group | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public reset(targetDistance = 400): void {
    this.targetFinishDistance = targetDistance
    this.finishSpawned = false

    for (const chunk of this.chunks) {
      this.scene.remove(chunk.group)
    }
    this.chunks = []

    if (this.finishGroup) {
      this.scene.remove(this.finishGroup)
      this.finishGroup = null
    }

    this.currentSpawnZ = -5.0
    this.nextChunkId = 0

    // Initial safe runway
    this.spawnChunk('flat', 25)
    while (this.currentSpawnZ < 120) {
      this.spawnNextProceduralChunk()
    }
  }

  public update(playerZ: number): void {
    // Spawn forward
    while (this.currentSpawnZ < playerZ + 120 && !this.finishSpawned) {
      this.spawnNextProceduralChunk()
    }

    // Clean up behind player
    const recycleThreshold = playerZ - 35
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const chunk = this.chunks[i]
      if (chunk.endZ < recycleThreshold) {
        this.scene.remove(chunk.group)
        this.chunks.splice(i, 1)
      }
    }
  }

  public getGroundHeightAt(x: number, z: number): {
    found: boolean
    y: number
    slopeDeg: number
    surfaceType: 'tile' | 'slate' | 'cable'
  } {
    for (const chunk of this.chunks) {
      if (z >= chunk.startZ && z <= chunk.endZ) {
        for (const box of chunk.walkableBoxes) {
          const worldBoxZ = chunk.startZ + box.z
          const minZ = worldBoxZ - box.halfD
          const maxZ = worldBoxZ + box.halfD
          const minX = box.x - box.halfW
          const maxX = box.x + box.halfW

          if (z >= minZ && z <= maxZ && x >= minX && x <= maxX) {
            // Calculate height along slope if any
            let slopeY = box.y
            if (box.slopeDeg !== 0) {
              const relZ = (z - minZ) / (maxZ - minZ)
              const rad = (box.slopeDeg * Math.PI) / 180
              slopeY = box.y - (relZ - 0.5) * (box.halfD * 2 * Math.sin(rad))
            }
            return {
              found: true,
              y: slopeY,
              slopeDeg: box.slopeDeg,
              surfaceType: box.type,
            }
          }
        }
      }
    }

    // Check finish balcony
    if (this.finishSpawned && z >= this.targetFinishDistance) {
      return {
        found: true,
        y: 0.3,
        slopeDeg: 0,
        surfaceType: 'slate',
      }
    }

    return {
      found: false,
      y: -50,
      slopeDeg: 0,
      surfaceType: 'tile',
    }
  }

  public checkObstacleCollision(playerPos: THREE.Vector3, playerHitboxHeight: number): boolean {
    for (const chunk of this.chunks) {
      if (playerPos.z >= chunk.startZ - 2 && playerPos.z <= chunk.endZ + 2) {
        for (const obs of chunk.obstacles) {
          const obsWorldZ = chunk.startZ + obs.z
          const minZ = obsWorldZ - obs.depth / 2
          const maxZ = obsWorldZ + obs.depth / 2
          const minX = obs.x - obs.width / 2
          const maxX = obs.x + obs.width / 2
          const minY = obs.y - obs.height / 2
          const maxY = obs.y + obs.height / 2

          if (
            playerPos.z >= minZ &&
            playerPos.z <= maxZ &&
            playerPos.x >= minX &&
            playerPos.x <= maxX
          ) {
            const playerTopY = playerPos.y + playerHitboxHeight
            if (playerTopY >= minY && playerPos.y <= maxY) {
              return true
            }
          }
        }
      }
    }
    return false
  }

  public checkLedgeProximity(playerPos: THREE.Vector3): { nearLedge: boolean; ledgeZ: number } {
    for (const chunk of this.chunks) {
      if (chunk.hasLedge && chunk.ledgeZ !== null) {
        const worldLedgeZ = chunk.startZ + chunk.ledgeZ
        const distZ = worldLedgeZ - playerPos.z
        if (distZ >= -0.3 && distZ <= 0.85) {
          return { nearLedge: true, ledgeZ: worldLedgeZ }
        }
      }
    }
    return { nearLedge: false, ledgeZ: 0 }
  }

  private spawnNextProceduralChunk(): void {
    if (this.currentSpawnZ >= this.targetFinishDistance) {
      if (!this.finishSpawned) {
        this.spawnFinishBalcony()
      }
      return
    }

    // Street Gap jump between buildings
    const gap = 4.0 + Math.random() * 5.0
    this.currentSpawnZ += gap

    const types: ('flat' | 'sloped_forward' | 'sloped_double' | 'cable_gap')[] = [
      'flat',
      'sloped_forward',
      'sloped_double',
      'cable_gap',
    ]
    const chosenType = types[Math.floor(Math.random() * types.length)]
    const length = 18 + Math.floor(Math.random() * 14)

    this.spawnChunk(chosenType, length)
  }

  private spawnChunk(
    type: 'flat' | 'sloped_forward' | 'sloped_double' | 'cable_gap',
    length: number
  ): void {
    const chunkObj = ProceduralModels.createRooftopChunk(type, length)
    chunkObj.group.position.set(0, 0, this.currentSpawnZ)
    this.scene.add(chunkObj.group)

    const data: RooftopChunkData = {
      id: this.nextChunkId++,
      startZ: this.currentSpawnZ,
      endZ: this.currentSpawnZ + length,
      group: chunkObj.group,
      walkableBoxes: chunkObj.walkableBoxes,
      obstacles: chunkObj.obstacles,
      hasLedge: chunkObj.ledgeZ !== null,
      ledgeZ: chunkObj.ledgeZ,
    }

    this.chunks.push(data)
    this.currentSpawnZ += length
  }

  private spawnFinishBalcony(): void {
    this.finishSpawned = true
    const finish = new THREE.Group()

    const balconyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10.0, 0.6, 20.0),
      ProceduralModels.goldBrassMat
    )
    balconyMesh.position.set(0, 0, 10)
    balconyMesh.receiveShadow = true
    finish.add(balconyMesh)

    // Red Carpet
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 18.0),
      new THREE.MeshStandardMaterial({ color: 0x8b1e1e, roughness: 0.9 })
    )
    carpet.rotation.x = -Math.PI / 2
    carpet.position.set(0, 0.32, 10)
    finish.add(carpet)

    // Golden finish arch & lanterns
    const archLeft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8),
      ProceduralModels.goldBrassMat
    )
    archLeft.position.set(-3.5, 2.0, 6.0)
    finish.add(archLeft)

    const archRight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8),
      ProceduralModels.goldBrassMat
    )
    archRight.position.set(3.5, 2.0, 6.0)
    finish.add(archRight)

    const archTop = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 0.3, 0.3),
      ProceduralModels.goldBrassMat
    )
    archTop.position.set(0, 4.0, 6.0)
    finish.add(archTop)

    finish.position.set(0, 0, this.targetFinishDistance)
    this.scene.add(finish)
    this.finishGroup = finish
  }
}
