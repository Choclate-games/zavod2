import * as THREE from 'three'

/**
 * GPU-пул частиц на InstancedMesh: четыре вида эффектов, по одному мешу на
 * вид — 4 draw call на весь VFX-слой. Матрицы переиспользуются, мёртвые
 * инстансы схлопываются в нулевой масштаб.
 */
export enum ParticleKind {
  Snow = 0,
  Ice = 1,
  Milk = 2,
  Steam = 3,
}

const CAPACITY_PER_KIND = 120
const GRAVITY = -6.5

interface Slot {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number
  maxLife: number
}

export class ParticleSystem {
  private readonly meshes: THREE.InstancedMesh[] = []
  private readonly slots: Slot[][] = []
  private readonly cursors: number[] = [0, 0, 0, 0]
  private readonly dummy = new THREE.Object3D()
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)

  constructor(scene: THREE.Scene) {
    const configs: { color: string; size: number }[] = [
      { color: '#eaf4fb', size: 0.22 },
      { color: '#7fd4ff', size: 0.16 },
      { color: '#fdf6ec', size: 0.26 },
      { color: '#9fb2c2', size: 0.3 },
    ]
    const geometry = new THREE.IcosahedronGeometry(1, 0)
    for (const config of configs) {
      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.85,
      })
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY_PER_KIND)
      mesh.frustumCulled = false
      for (let i = 0; i < CAPACITY_PER_KIND; i++) mesh.setMatrixAt(i, this.zeroMatrix)
      scene.add(mesh)
      this.meshes.push(mesh)
      const slots: Slot[] = []
      for (let i = 0; i < CAPACITY_PER_KIND; i++) {
        slots.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 })
      }
      this.slots.push(slots)
    }
  }

  spawn(kind: ParticleKind, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const slots = this.slots[kind]
    const cursor = this.cursors[kind]
    const slot = slots[cursor]
    slot.x = x; slot.y = y; slot.z = z
    slot.vx = vx; slot.vy = vy; slot.vz = vz
    slot.maxLife = kind === ParticleKind.Steam ? 1.6 : 0.9 + Math.random() * 0.5
    slot.life = slot.maxLife
    this.cursors[kind] = (cursor + 1) % CAPACITY_PER_KIND
  }

  update(dt: number): void {
    for (let kind = 0; kind < this.meshes.length; kind++) {
      const slots = this.slots[kind]
      const mesh = this.meshes[kind]
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        if (slot.life <= 0) continue
        slot.life -= dt
        if (slot.life <= 0) {
          mesh.setMatrixAt(i, this.zeroMatrix)
          continue
        }
        slot.vy += GRAVITY * dt * (kind === ParticleKind.Steam ? -0.15 : 1)
        slot.x += slot.vx * dt
        slot.y += slot.vy * dt
        slot.z += slot.vz * dt
        const scale = (slot.life / slot.maxLife) * 0.9 + 0.1
        this.dummy.position.set(slot.x, slot.y, slot.z)
        this.dummy.scale.setScalar(scale)
        this.dummy.updateMatrix()
        mesh.setMatrixAt(i, this.dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  }
}
