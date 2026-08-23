import * as THREE from 'three'

/**
 * Пул частиц на InstancedMesh: один меш на аддитивные искры/пламя,
 * второй на полупрозрачные брызги и снежную пыль. Ноль аллокаций в кадре:
 * параметры частицы живут в предвыделенных Float32Array, активные пишутся
 * в буфер подряд, mesh.count выставляется в конце.
 */
const MAX_PARTICLES = 320

export class ParticleSystem {
  private readonly solidMesh: THREE.InstancedMesh
  private readonly softMesh: THREE.InstancedMesh
  private readonly solidState: Float32Array
  private readonly softState: Float32Array
  private solidCount = 0
  private softCount = 0
  private readonly matrix: THREE.Matrix4
  private readonly color: THREE.Color
  private readonly position: THREE.Vector3
  private readonly quaternion: THREE.Quaternion
  private readonly scale: THREE.Vector3

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.IcosahedronGeometry(0.09, 0)
    const solidMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const softMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.solidMesh = new THREE.InstancedMesh(geometry, solidMaterial, MAX_PARTICLES)
    this.softMesh = new THREE.InstancedMesh(geometry, softMaterial, MAX_PARTICLES)
    this.solidMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3)
    this.softMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3)
    this.solidMesh.frustumCulled = false
    this.softMesh.frustumCulled = false
    this.solidMesh.count = 0
    this.softMesh.count = 0
    scene.add(this.solidMesh)
    scene.add(this.softMesh)

    // state на частицу: x,y,z,vx,vy,vz,life,maxLife,size,gravity,r,g,b (13 floats)
    this.solidState = new Float32Array(MAX_PARTICLES * 13)
    this.softState = new Float32Array(MAX_PARTICLES * 13)
    this.matrix = new THREE.Matrix4()
    this.color = new THREE.Color()
    this.position = new THREE.Vector3()
    this.quaternion = new THREE.Quaternion()
    this.scale = new THREE.Vector3()
  }

  /**
   * Конус частиц вдоль направления: брызги из-под канта, искры форсажа,
   * всплеск при падении в воду.
   */
  spawnCone(
    soft: boolean,
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    count: number,
    speed: number,
    spread: number,
    life: number,
    size: number,
    gravity: number,
    r: number,
    g: number,
    b: number,
  ): void {
    for (let i = 0; i < count; i++) {
      let state: Float32Array
      let index: number
      if (soft) {
        if (this.softCount >= MAX_PARTICLES) continue
        index = this.softCount
        this.softCount++
        state = this.softState
      } else {
        if (this.solidCount >= MAX_PARTICLES) continue
        index = this.solidCount
        this.solidCount++
        state = this.solidState
      }
      const base = index * 13
      const jitterX = (Math.random() - 0.5) * spread
      const jitterY = Math.random() * spread * 0.8 + 0.2
      const jitterZ = (Math.random() - 0.5) * spread
      const vel = speed * (0.6 + Math.random() * 0.7)
      state[base] = x
      state[base + 1] = y
      state[base + 2] = z
      state[base + 3] = (dirX + jitterX) * vel
      state[base + 4] = (dirY + jitterY) * vel
      state[base + 5] = (dirZ + jitterZ) * vel
      state[base + 6] = life * (0.7 + Math.random() * 0.5)
      state[base + 7] = life
      state[base + 8] = size * (0.7 + Math.random() * 0.6)
      state[base + 9] = gravity
      state[base + 10] = r
      state[base + 11] = g
      state[base + 12] = b
    }
  }

  update(dt: number): void {
    this.integrate(this.solidState, this.solidMesh, dt, true)
    this.integrate(this.softState, this.softMesh, dt, false)
  }

  private integrate(state: Float32Array, mesh: THREE.InstancedMesh, dt: number, isSolid: boolean): void {
    // Инвариант пула: активные частицы занимают слоты [0, count).
    // Мёртвая частица заменяется последней активной, счётчик уменьшается.
    let count = isSolid ? this.solidCount : this.softCount
    let i = 0
    while (i < count) {
      const base = i * 13
      const life = state[base + 6] - dt
      if (life <= 0) {
        const lastBase = (count - 1) * 13
        if (i !== count - 1) {
          for (let k = 0; k < 13; k++) state[base + k] = state[lastBase + k]
        }
        count--
        continue
      }
      state[base + 6] = life
      state[base + 3] *= 1 - dt * 1.4
      state[base + 5] *= 1 - dt * 1.4
      state[base + 4] -= state[base + 9] * dt
      state[base] += state[base + 3] * dt
      state[base + 1] += state[base + 4] * dt
      state[base + 2] += state[base + 5] * dt

      const fade = life / state[base + 7]
      const size = state[base + 8] * (0.5 + fade * 0.5)
      this.position.set(state[base], state[base + 1], state[base + 2])
      this.scale.setScalar(size)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(i, this.matrix)
      this.color.setRGB(state[base + 10], state[base + 11], state[base + 12])
      mesh.setColorAt(i, this.color)
      i++
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (isSolid) this.solidCount = count
    else this.softCount = count
  }
}
