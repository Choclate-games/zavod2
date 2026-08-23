import * as THREE from 'three'

type ParticleKind = 'spark' | 'cream' | 'shard' | 'confetti'

interface Pool {
  mesh: THREE.InstancedMesh
  positions: Float32Array
  velocities: Float32Array
  life: Float32Array
  size: Float32Array
  count: number
  cursor: number
  gravity: number
}

interface SpawnPoint {
  x: number
  y: number
  z: number
}

/**
 * Инстанс-партиклы сочности: один InstancedMesh на тип эффекта — один draw call.
 * Пулы выделяются заранее; в кадре только запись матриц, без аллокаций.
 */
export class ParticleSystem {
  private readonly pools = new Map<ParticleKind, Pool>()
  private readonly dummy = new THREE.Object3D()

  constructor(scene: THREE.Scene) {
    this.addPool('spark', scene, new THREE.TetrahedronGeometry(0.06), 0xffd700, 240, 0.6)
    this.addPool('cream', scene, new THREE.SphereGeometry(0.09, 6, 5), 0xff9ec7, 300, 0.6)
    this.addPool('shard', scene, new THREE.TetrahedronGeometry(0.05), 0xa4d8e8, 400, 0.7)
    this.addPool('confetti', scene, new THREE.PlaneGeometry(0.08, 0.08), 0xff4081, 200, 0.15)
  }

  private addPool(kind: ParticleKind, scene: THREE.Scene, geometry: THREE.BufferGeometry,
                  color: number, count: number, gravity: number): void {
    const material = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    // Пока все частицы мертвы, пул не участвует в отрисовке вовсе.
    mesh.count = 0
    scene.add(mesh)
    const pool: Pool = {
      mesh,
      positions: new Float32Array(count * 3),
      velocities: new Float32Array(count * 3),
      life: new Float32Array(count),
      size: new Float32Array(count),
      count,
      cursor: 0,
      gravity,
    }
    // Все частицы стартуют «мёртвыми» под полом.
    for (let i = 0; i < count; i++) {
      pool.positions[i * 3] = 0
      pool.positions[i * 3 + 1] = -100
      pool.positions[i * 3 + 2] = 0
    }
    this.pools.set(kind, pool)
  }

  spawn(kind: ParticleKind, at: SpawnPoint, count: number, spread: number): void {
    const pool = this.pools.get(kind)
    if (!pool) return
    for (let n = 0; n < count; n++) {
      const i = pool.cursor
      pool.cursor = (pool.cursor + 1) % pool.count
      pool.positions[i * 3] = at.x
      pool.positions[i * 3 + 1] = at.y
      pool.positions[i * 3 + 2] = at.z
      const dirX = Math.random() - 0.5
      const dirY = Math.random() * 0.8 + 0.2
      const dirZ = Math.random() - 0.5
      const len = Math.max(Math.hypot(dirX, dirY, dirZ), 0.001)
      const speed = spread * (0.4 + Math.random() * 0.6)
      pool.velocities[i * 3] = (dirX / len) * speed
      pool.velocities[i * 3 + 1] = (dirY / len) * speed
      pool.velocities[i * 3 + 2] = (dirZ / len) * speed
      pool.life[i] = 1
      pool.size[i] = 0.7 + Math.random() * 0.6
    }
  }

  update(dt: number): void {
    for (const pool of this.pools.values()) {
      let anyAlive = false
      for (let i = 0; i < pool.count; i++) {
        if (pool.life[i] <= 0) continue
        pool.life[i] -= dt * 0.8
        pool.velocities[i * 3 + 1] -= 9.81 * dt * pool.gravity
        pool.positions[i * 3] += pool.velocities[i * 3] * dt
        pool.positions[i * 3 + 1] += pool.velocities[i * 3 + 1] * dt
        pool.positions[i * 3 + 2] += pool.velocities[i * 3 + 2] * dt
        const alive = pool.life[i] > 0
        anyAlive = anyAlive || alive
        const scale = alive ? pool.size[i] * pool.life[i] : 0
        this.dummy.position.set(
          pool.positions[i * 3],
          alive ? pool.positions[i * 3 + 1] : -100,
          pool.positions[i * 3 + 2],
        )
        this.dummy.scale.setScalar(scale)
        this.dummy.rotation.set(i, i * 1.3, i * 0.7)
        this.dummy.updateMatrix()
        pool.mesh.setMatrixAt(i, this.dummy.matrix)
      }
      if (anyAlive) {
        pool.mesh.count = pool.count
        pool.mesh.instanceMatrix.needsUpdate = true
      }
    }
  }
}
