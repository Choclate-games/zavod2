import * as THREE from 'three'

const DEBRIS_BUDGET = 96
const DUST_BUDGET = 160
const DEBRIS_LIFETIME = 5.5
const DUST_LIFETIME = 3.2

/**
 * Пул частиц на InstancedMesh: обломки и пыль рисуются двумя вызовами отрисовки,
 * кадр не создаёт ни векторов, ни матриц — только пишет в готовые временные.
 */
export class ParticleSystem {
  private readonly debris: THREE.InstancedMesh
  private readonly dust: THREE.InstancedMesh
  private readonly debrisData: Float32Array
  private readonly dustData: Float32Array
  private debrisCursor = 0
  private dustCursor = 0
  private readonly matrix = new THREE.Matrix4()
  private readonly quat = new THREE.Quaternion()
  private readonly scaleVec = new THREE.Vector3()
  private readonly posVec = new THREE.Vector3()
  private readonly axisVec = new THREE.Vector3()

  constructor(scene: THREE.Scene) {
    const debrisGeo = new THREE.BoxGeometry(1, 1, 1)
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x8a8074, roughness: 0.9 })
    this.debris = new THREE.InstancedMesh(debrisGeo, debrisMat, DEBRIS_BUDGET)
    this.debris.frustumCulled = false
    this.debris.castShadow = false
    scene.add(this.debris)

    const dustGeo = new THREE.OctahedronGeometry(1, 0)
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xcbb9a2, transparent: true, opacity: 0.32 })
    this.dust = new THREE.InstancedMesh(dustGeo, dustMat, DUST_BUDGET)
    this.dust.frustumCulled = false
    scene.add(this.dust)

    this.debrisData = new Float32Array(DEBRIS_BUDGET * 9)
    this.dustData = new Float32Array(DUST_BUDGET * 7)
    for (let i = 0; i < DEBRIS_BUDGET; i++) {
      this.matrix.makeScale(0, 0, 0)
      this.debris.setMatrixAt(i, this.matrix)
    }
    for (let i = 0; i < DUST_BUDGET; i++) {
      this.matrix.makeScale(0, 0, 0)
      this.dust.setMatrixAt(i, this.matrix)
    }
  }

  spawnDebris(x: number, y: number, z: number, power: number): void {
    const i = this.debrisCursor % DEBRIS_BUDGET
    this.debrisCursor++
    const o = i * 9
    this.debrisData[o] = x + (Math.random() - 0.5) * 6
    this.debrisData[o + 1] = y + Math.random() * 4
    this.debrisData[o + 2] = z + (Math.random() - 0.5) * 6
    this.debrisData[o + 3] = (Math.random() - 0.5) * power * 14
    this.debrisData[o + 4] = Math.random() * power * 12 + 2
    this.debrisData[o + 5] = (Math.random() - 0.5) * power * 14
    this.debrisData[o + 6] = 0.6 + Math.random() * 1.8
    this.debrisData[o + 7] = 0.6 + Math.random() * 1.8
    this.debrisData[o + 8] = 0
  }

  spawnDustRing(x: number, y: number, z: number, power: number): void {
    const count = Math.min(DUST_BUDGET / 2, Math.floor(14 * power) + 6)
    for (let n = 0; n < count; n++) {
      const i = this.dustCursor % DUST_BUDGET
      this.dustCursor++
      const o = i * 7
      const angle = Math.random() * Math.PI * 2
      const speed = (2 + Math.random() * 5) * power
      this.dustData[o] = x
      this.dustData[o + 1] = y + 0.5
      this.dustData[o + 2] = z
      this.dustData[o + 3] = Math.cos(angle) * speed
      this.dustData[o + 4] = 1.5 + Math.random() * 2
      this.dustData[o + 5] = Math.sin(angle) * speed
      this.dustData[o + 6] = 0
    }
  }

  update(dt: number): void {
    let dirtyDebris = false
    for (let i = 0; i < DEBRIS_BUDGET; i++) {
      const o = i * 9
      if ((this.debrisData[o + 8] ?? 0) >= DEBRIS_LIFETIME) continue
      dirtyDebris = true
      this.debrisData[o + 8] = (this.debrisData[o + 8] ?? 0) + dt
      this.debrisData[o + 4] = (this.debrisData[o + 4] ?? 0) - 22 * dt
      this.debrisData[o + 1] = (this.debrisData[o + 1] ?? 0) + (this.debrisData[o + 4] ?? 0) * dt
      if ((this.debrisData[o + 1] ?? 0) < 0.4) {
        this.debrisData[o + 1] = 0.4
        this.debrisData[o + 4] = -(this.debrisData[o + 4] ?? 0) * 0.35
        this.debrisData[o + 3] = (this.debrisData[o + 3] ?? 0) * 0.8
        this.debrisData[o + 5] = (this.debrisData[o + 5] ?? 0) * 0.8
      }
      this.debrisData[o] = (this.debrisData[o] ?? 0) + (this.debrisData[o + 3] ?? 0) * dt
      this.debrisData[o + 2] = (this.debrisData[o + 2] ?? 0) + (this.debrisData[o + 5] ?? 0) * dt
      const age = (this.debrisData[o + 8] ?? 0) / DEBRIS_LIFETIME
      const fade = age > 0.85 ? (1 - age) / 0.15 : 1
      const s = (this.debrisData[o + 6] ?? 1) * Math.max(0, fade)
      this.posVec.set(this.debrisData[o] ?? 0, this.debrisData[o + 1] ?? 0, this.debrisData[o + 2] ?? 0)
      this.axisVec.set((i % 3) - 1, i % 5 === 0 ? 1 : 0, (i % 7) - 3).normalize()
      this.quat.setFromAxisAngle(this.axisVec, age * 9)
      this.scaleVec.set(s, s, s)
      this.matrix.compose(this.posVec, this.quat, this.scaleVec)
      this.debris.setMatrixAt(i, this.matrix)
    }
    if (dirtyDebris) this.debris.instanceMatrix.needsUpdate = true

    let dirtyDust = false
    for (let i = 0; i < DUST_BUDGET; i++) {
      const o = i * 7
      if ((this.dustData[o + 6] ?? 0) >= DUST_LIFETIME) continue
      dirtyDust = true
      this.dustData[o + 6] = (this.dustData[o + 6] ?? 0) + dt
      this.dustData[o] = (this.dustData[o] ?? 0) + (this.dustData[o + 3] ?? 0) * dt
      this.dustData[o + 1] = (this.dustData[o + 1] ?? 0) + (this.dustData[o + 4] ?? 0) * dt
      this.dustData[o + 3] = (this.dustData[o + 3] ?? 0) * (1 - dt * 0.8)
      this.dustData[o + 5] = (this.dustData[o + 5] ?? 0) * (1 - dt * 0.8)
      const age = (this.dustData[o + 6] ?? 0) / DUST_LIFETIME
      const grow = 1.5 + age * 7
      const s = Math.max(0, (1 - age)) * grow
      this.posVec.set(this.dustData[o] ?? 0, this.dustData[o + 1] ?? 0, this.dustData[o + 2] ?? 0)
      this.quat.identity()
      this.scaleVec.set(s, s * 0.5, s)
      this.matrix.compose(this.posVec, this.quat, this.scaleVec)
      this.dust.setMatrixAt(i, this.matrix)
    }
    if (dirtyDust) this.dust.instanceMatrix.needsUpdate = true
  }
}
