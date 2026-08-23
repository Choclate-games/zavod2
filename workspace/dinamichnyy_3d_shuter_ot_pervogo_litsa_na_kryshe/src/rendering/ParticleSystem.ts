// Пул частиц на одном THREE.Points: ноль аллокаций в игровом цикле.
// Мёртвые частицы уводятся за сцену, буфер переиспользуется по кольцу.

import * as THREE from 'three'

const MAX_PARTICLES = 512

export class ParticleSystem {
  readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly velocities: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private cursor = 0

  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.velocities = new Float32Array(MAX_PARTICLES * 3)
    this.life = new Float32Array(MAX_PARTICLES)
    this.maxLife = new Float32Array(MAX_PARTICLES)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -1000
    const material = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
  }

  spawn(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    r: number, g: number, b: number,
    lifeS: number,
  ): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % MAX_PARTICLES
    const i3 = i * 3
    this.positions[i3] = x
    this.positions[i3 + 1] = y
    this.positions[i3 + 2] = z
    this.velocities[i3] = vx
    this.velocities[i3 + 1] = vy
    this.velocities[i3 + 2] = vz
    this.colors[i3] = r
    this.colors[i3 + 1] = g
    this.colors[i3 + 2] = b
    this.life[i] = lifeS
    this.maxLife[i] = lifeS
  }

  burst(x: number, y: number, z: number, count: number, r: number, g: number, b: number): void {
    for (let n = 0; n < count; n++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 3 + Math.random() * 9
      this.spawn(
        x, y, z,
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed * 0.8 + 2,
        Math.sin(phi) * Math.sin(theta) * speed,
        r * (0.7 + Math.random() * 0.5),
        g * (0.7 + Math.random() * 0.4),
        b,
        0.5 + Math.random() * 0.6,
      )
    }
  }

  update(dt: number, windX: number): void {
    let dirty = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue
      dirty = true
      this.life[i] -= dt
      const i3 = i * 3
      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -1000
        continue
      }
      this.velocities[i3 + 1] -= 9 * dt
      this.positions[i3] += (this.velocities[i3] + windX * 0.35) * dt
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt
      const fade = this.life[i] / this.maxLife[i]
      // затухание яркостью: аддитивный блендинг гасит цвет к нулю
      this.colors[i3] *= 1 - (1 - fade) * 0.04
      this.colors[i3 + 1] *= 1 - (1 - fade) * 0.04
      this.colors[i3 + 2] *= 1 - (1 - fade) * 0.04
    }
    if (dirty) {
      ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    }
  }
}
