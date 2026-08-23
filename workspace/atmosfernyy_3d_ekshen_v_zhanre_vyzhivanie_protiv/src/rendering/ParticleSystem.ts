import * as THREE from 'three'

const SPARK_CAPACITY = 420
const SMOKE_CAPACITY = 180

interface ParticleFields {
  x: Float32Array; y: Float32Array; z: Float32Array
  vx: Float32Array; vy: Float32Array; vz: Float32Array
  life: Float32Array; maxLife: Float32Array
  size: Float32Array; growth: Float32Array
  gravity: Float32Array; drag: Float32Array
  r: Float32Array; g: Float32Array; b: Float32Array
}

function makeFields(capacity: number): ParticleFields {
  return {
    x: new Float32Array(capacity), y: new Float32Array(capacity), z: new Float32Array(capacity),
    vx: new Float32Array(capacity), vy: new Float32Array(capacity), vz: new Float32Array(capacity),
    life: new Float32Array(capacity), maxLife: new Float32Array(capacity),
    size: new Float32Array(capacity), growth: new Float32Array(capacity),
    gravity: new Float32Array(capacity), drag: new Float32Array(capacity),
    r: new Float32Array(capacity), g: new Float32Array(capacity), b: new Float32Array(capacity),
  }
}

/**
 * Два инстанс-пула: аддитивные искры и полупрозрачный дым. Гравитация, время
 * жизни и размер — параметры частицы, а не константы пула. Активные частицы
 * пишутся в буфер подряд, mesh.count выставляется в конце.
 */
export class ParticleSystem {
  private readonly sparks: Pool
  private readonly smoke: Pool
  private readonly matrix = new THREE.Matrix4()
  private readonly quaternion = new THREE.Quaternion()
  private readonly position = new THREE.Vector3()
  private readonly scaleVec = new THREE.Vector3()
  private readonly color = new THREE.Color()

  constructor(private readonly parent: THREE.Object3D) {
    this.sparks = this.createPool(SPARK_CAPACITY, true)
    this.smoke = this.createPool(SMOKE_CAPACITY, false)
  }

  private createPool(capacity: number, additive: boolean): Pool {
    const geometry = new THREE.OctahedronGeometry(0.5, 0)
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: additive ? 0.9 : 0.34,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
    mesh.frustumCulled = false
    mesh.count = 0
    this.parent.add(mesh)
    return { mesh, fields: makeFields(capacity), capacity, active: 0 }
  }

  burst(
    x: number, y: number, z: number,
    count: number,
    speed: number,
    colorR: number, colorG: number, colorB: number,
    gravity: number, size: number, lifeSec: number, smoke: boolean,
  ): void {
    const pool = smoke ? this.smoke : this.sparks
    for (let n = 0; n < count; n++) {
      if (pool.active >= pool.capacity) return
      const i = pool.active++
      const angle = Math.random() * Math.PI * 2
      const elevation = (Math.random() - 0.25) * 1.4
      const velocity = speed * (0.4 + Math.random() * 0.6)
      pool.fields.x[i] = x
      pool.fields.y[i] = y
      pool.fields.z[i] = z
      pool.fields.vx[i] = Math.cos(angle) * velocity
      pool.fields.vy[i] = Math.abs(elevation) * velocity + (smoke ? 1.6 : 0.8)
      pool.fields.vz[i] = Math.sin(angle) * velocity
      pool.fields.maxLife[i] = lifeSec * (0.7 + Math.random() * 0.6)
      pool.fields.life[i] = pool.fields.maxLife[i]
      pool.fields.size[i] = size * (0.6 + Math.random() * 0.8)
      pool.fields.growth[i] = smoke ? 1.5 : -0.2
      pool.fields.gravity[i] = gravity
      pool.fields.drag[i] = smoke ? 2.2 : 1.1
      pool.fields.r[i] = colorR
      pool.fields.g[i] = colorG
      pool.fields.b[i] = colorB
    }
  }

  update(dt: number): void {
    this.stepPool(this.sparks, dt)
    this.stepPool(this.smoke, dt)
  }

  private stepPool(pool: Pool, dt: number): void {
    let i = 0
    while (i < pool.active) {
      const f = pool.fields
      f.life[i] -= dt
      if (f.life[i] <= 0) {
        const last = pool.active - 1
        if (i !== last) this.copyParticle(f, last, i)
        pool.active--
        continue
      }
      const dampen = Math.max(0, 1 - f.drag[i] * dt)
      f.vx[i] *= dampen
      f.vz[i] *= dampen
      f.vy[i] = f.vy[i] * dampen - f.gravity[i] * dt
      f.x[i] += f.vx[i] * dt
      f.y[i] += f.vy[i] * dt
      f.z[i] += f.vz[i] * dt
      if (f.y[i] < 0.1) f.y[i] = 0.1
      f.size[i] = Math.max(0.05, f.size[i] + f.growth[i] * dt)
      i++
    }

    const { mesh, fields } = pool
    for (let n = 0; n < pool.active; n++) {
      const fade = fields.life[n] / fields.maxLife[n]
      this.position.set(fields.x[n], fields.y[n], fields.z[n])
      this.scaleVec.setScalar(fields.size[n])
      this.matrix.compose(this.position, this.quaternion, this.scaleVec)
      mesh.setMatrixAt(n, this.matrix)
      this.color.setRGB(fields.r[n], fields.g[n], fields.b[n]).multiplyScalar(0.35 + fade * 0.65)
      mesh.setColorAt(n, this.color)
    }
    mesh.count = pool.active
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  private copyParticle(f: ParticleFields, from: number, to: number): void {
    f.x[to] = f.x[from]; f.y[to] = f.y[from]; f.z[to] = f.z[from]
    f.vx[to] = f.vx[from]; f.vy[to] = f.vy[from]; f.vz[to] = f.vz[from]
    f.life[to] = f.life[from]; f.maxLife[to] = f.maxLife[from]
    f.size[to] = f.size[from]; f.growth[to] = f.growth[from]
    f.gravity[to] = f.gravity[from]; f.drag[to] = f.drag[from]
    f.r[to] = f.r[from]; f.g[to] = f.g[from]; f.b[to] = f.b[from]
  }
}

interface Pool {
  mesh: THREE.InstancedMesh
  fields: ParticleFields
  capacity: number
  active: number
}
