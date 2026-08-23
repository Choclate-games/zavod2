import * as THREE from 'three'

interface DustSpec {
  count: number
}

/** Частицы без аллокаций в кадре: снежная буря и пылевые всплески — два пула
 * точек, позиции пишутся в заранее выделенные буферы. */
export class ParticleSystem {
  private snow: THREE.Points
  private snowPositions: Float32Array
  private snowCount: number
  private readonly snowCapacity: number

  private dust: THREE.Points
  private dustPositions: Float32Array
  private dustVelocities: Float32Array
  private dustLife: Float32Array
  private readonly dustCapacity = 320
  private dustCursor = 0

  constructor(snowCount: number) {
    this.snowCapacity = snowCount
    this.snowCount = snowCount
    this.snowPositions = new Float32Array(this.snowCapacity * 3)
    for (let i = 0; i < this.snowCapacity; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 220
      this.snowPositions[i * 3 + 1] = Math.random() * 90
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 260 - 40
    }
    const snowGeo = new THREE.BufferGeometry()
    this.snowGeoAttribute = new THREE.BufferAttribute(this.snowPositions, 3)
    snowGeo.setAttribute('position', this.snowGeoAttribute)
    const snowMat = new THREE.PointsMaterial({
      color: 0xdde8f2,
      size: 1.5,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: true,
    })
    this.snowMatRef = snowMat
    this.snow = new THREE.Points(snowGeo, snowMat)
    this.snow.frustumCulled = false

    this.dustPositions = new Float32Array(this.dustCapacity * 3)
    this.dustVelocities = new Float32Array(this.dustCapacity * 3)
    this.dustLife = new Float32Array(this.dustCapacity)
    const dustGeo = new THREE.BufferGeometry()
    this.dustGeoAttribute = new THREE.BufferAttribute(this.dustPositions, 3)
    dustGeo.setAttribute('position', this.dustGeoAttribute)
    const dustMat = new THREE.PointsMaterial({
      color: 0xcfd9e4,
      size: 3.2,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: true,
    })
    this.dustMatRef = dustMat
    this.dust = new THREE.Points(dustGeo, dustMat)
    this.dust.frustumCulled = false
    for (let i = 0; i < this.dustCapacity; i++) this.dustPositions[i * 3 + 1] = -1000
  }

  private snowGeoAttribute: THREE.BufferAttribute
  private dustGeoAttribute: THREE.BufferAttribute
  private snowMatRef: THREE.PointsMaterial
  private dustMatRef: THREE.PointsMaterial

  get objects(): THREE.Object3D[] {
    return [this.snow, this.dust]
  }

  /** dt — масштабированное время; ветер сносит снег по X и чуть по Z. */
  updateSnow(dt: number, camX: number, camY: number, camZ: number, windX: number): void {
    const halfSpan = 110
    for (let i = 0; i < this.snowCapacity; i++) {
      const o = i * 3
      this.snowPositions[o] += (windX * 1.6 + Math.sin(i + camY) * 0.6) * dt
      this.snowPositions[o + 1] -= (7 + (i % 5)) * dt
      if (this.snowPositions[o + 1] < camY - 60) this.snowPositions[o + 1] += 90
      const dx = this.snowPositions[o] - camX
      if (dx > halfSpan) this.snowPositions[o] -= halfSpan * 2
      else if (dx < -halfSpan) this.snowPositions[o] += halfSpan * 2
      const dz = this.snowPositions[o + 2] - camZ
      if (dz > 140) this.snowPositions[o + 2] -= 280
      else if (dz < -140) this.snowPositions[o + 2] += 280
    }
    this.snowGeoAttribute.needsUpdate = true
  }

  setSnowDensity(fraction: number): void {
    this.snowCount = Math.max(200, Math.floor(this.snowCapacity * fraction))
    this.snow.geometry.setDrawRange(0, this.snowCount)
  }

  spawnDust(x: number, y: number, z: number, spec: DustSpec, power = 1): void {
    const n = Math.min(spec.count, this.dustCapacity)
    for ( let k = 0; k < n; k++) {
      const i = this.dustCursor
      this.dustCursor = (this.dustCursor + 1) % this.dustCapacity
      const o = i * 3
      this.dustPositions[o] = x + (Math.random() - 0.5) * 6
      this.dustPositions[o + 1] = y + (Math.random() - 0.5) * 4
      this.dustPositions[o + 2] = z + (Math.random() - 0.5) * 6
      this.dustVelocities[o] = (Math.random() - 0.5) * 14 * power
      this.dustVelocities[o + 1] = (2 + Math.random() * 10) * power
      this.dustVelocities[o + 2] = (Math.random() - 0.5) * 14 * power
      this.dustLife[i] = 1.4 + Math.random() * 1.6
    }
  }

  updateDust(dt: number): void {
    for (let i = 0; i < this.dustCapacity; i++) {
      if (this.dustLife[i] <= 0) continue
      this.dustLife[i] -= dt
      const o = i * 3
      if (this.dustLife[i] <= 0) {
        this.dustPositions[o + 1] = -1000
        continue
      }
      this.dustVelocities[o] *= 0.985
      this.dustVelocities[o + 2] *= 0.985
      this.dustVelocities[o + 1] -= 2.5 * dt
      this.dustPositions[o] += this.dustVelocities[o] * dt
      this.dustPositions[o + 1] += this.dustVelocities[o + 1] * dt
      this.dustPositions[o + 2] += this.dustVelocities[o + 2] * dt
    }
    this.dustGeoAttribute.needsUpdate = true
  }

  dispose(): void {
    this.snow.geometry.dispose()
    this.snowMatRef.dispose()
    this.dust.geometry.dispose()
    this.dustMatRef.dispose()
  }
}
