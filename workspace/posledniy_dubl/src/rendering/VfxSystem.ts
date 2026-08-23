import * as THREE from 'three'

/**
 * Пул частиц и трассеров. Ноль аллокаций в игровом цикле:
 * буферы создаются один раз, кадр только пишет в них.
 */

interface ParticleState {
  active: boolean
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number
  maxLife: number
  size: number
  r: number; g: number; b: number
  gravity: number
  drag: number
}

const MAX_PARTICLES = 512
const MAX_TRACERS = 24

export class VfxSystem {
  readonly points: THREE.Points
  readonly flashLight: THREE.PointLight
  private readonly states: ParticleState[] = []
  private positions: Float32Array
  private colors: Float32Array
  private sizes: Float32Array
  private cursor = 0

  private readonly tracerGeometry: THREE.BufferGeometry
  private readonly tracerPositions: Float32Array
  private readonly tracerAlpha: Float32Array
  private readonly tracerMaterial: THREE.LineBasicMaterial
  readonly tracerLines: THREE.LineSegments
  private tracerCursor = 0

  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.sizes = new Float32Array(MAX_PARTICLES)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    const material = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.states.push({
        active: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1, r: 1, g: 1, b: 1, gravity: -9.8, drag: 1,
      })
      this.sizes[i] = 0
    }

    // Трассеры — пары вершин (от дула к точке попадания).
    this.tracerPositions = new Float32Array(MAX_TRACERS * 6)
    this.tracerAlpha = new Float32Array(MAX_TRACERS)
    this.tracerGeometry = new THREE.BufferGeometry()
    this.tracerGeometry.setAttribute('position', new THREE.BufferAttribute(this.tracerPositions, 3))
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: SCENE_COLOR_TRACER,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    })
    this.tracerLines = new THREE.LineSegments(this.tracerGeometry, this.tracerMaterial)
    this.tracerLines.frustumCulled = false
    for (let i = 0; i < MAX_TRACERS * 6; i++) this.tracerPositions[i] = 0

    // Вспышка выстрела: один переиспользуемый источник света с затуханием.
    this.flashLight = new THREE.PointLight(0xffc98a, 0, 9, 2)
    this.flashLight.visible = false
  }

  /** Короткая вспышка на дуле; гаснет за кадры, без аллокаций. */
  muzzleFlash(x: number, y: number, z: number): void {
    this.flashLight.position.set(x, y, z)
    this.flashLight.intensity = 26
    this.flashLight.visible = true
  }

  spawnBurst(
    x: number, y: number, z: number,
    dirX: number, dirY: number, dirZ: number,
    count: number, speed: number,
    color: number, lifeS: number, spread: number,
  ): void {
    const c = new THREE.Color(color)
    for (let n = 0; n < count; n++) {
      const p = this.states[this.cursor]
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * spread
      const cosPhi = Math.cos(phi)
      p.vx = (dirX * cosPhi + Math.cos(theta) * (1 - cosPhi)) * speed
      p.vy = (dirY * cosPhi + Math.sin(phi)) * speed
      p.vz = (dirZ * cosPhi + Math.sin(theta) * (1 - cosPhi)) * speed
      p.x = x; p.y = y; p.z = z
      p.life = 0
      p.maxLife = lifeS * (0.7 + Math.random() * 0.6)
      p.r = c.r; p.g = c.g; p.b = c.b
      p.gravity = -7
      p.drag = 2.2
      p.active = true
      this.cursor = (this.cursor + 1) % MAX_PARTICLES
    }
  }

  spawnTracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    const i = this.tracerCursor * 6
    this.tracerPositions[i] = ax; this.tracerPositions[i + 1] = ay; this.tracerPositions[i + 2] = az
    this.tracerPositions[i + 3] = bx; this.tracerPositions[i + 4] = by; this.tracerPositions[i + 5] = bz
    this.tracerAlpha[this.tracerCursor] = 1
    this.tracerCursor = (this.tracerCursor + 1) % MAX_TRACERS
  }

  update(dtS: number): void {
    if (this.flashLight.visible) {
      this.flashLight.intensity -= dtS * 220
      if (this.flashLight.intensity <= 0) {
        this.flashLight.intensity = 0
        this.flashLight.visible = false
      }
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.states[i]
      if (!p.active) continue
      p.life += dtS
      if (p.life >= p.maxLife) {
        p.active = false
        this.sizes[i] = 0
        continue
      }
      p.vy += p.gravity * dtS
      const keep = Math.max(0, 1 - p.drag * dtS)
      p.vx *= keep
      p.vz *= keep
      p.x += p.vx * dtS
      p.y += p.vy * dtS
      p.z += p.vz * dtS
      this.positions[i * 3] = p.x
      this.positions[i * 3 + 1] = p.y
      this.positions[i * 3 + 2] = p.z
      const fade = 1 - p.life / p.maxLife
      this.sizes[i] = fade
      this.colors[i * 3] = p.r
      this.colors[i * 3 + 1] = p.g
      this.colors[i * 3 + 2] = p.b
    }
    ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true

    let anyTracer = false
    for (let t = 0; t < MAX_TRACERS; t++) {
      if (this.tracerAlpha[t] > 0) {
        this.tracerAlpha[t] -= dtS * 6
        if (this.tracerAlpha[t] <= 0) {
          for (let k = 0; k < 6; k++) this.tracerPositions[t * 6 + k] = 0
        } else {
          anyTracer = true
        }
      }
    }
    if (anyTracer || this.tracerMaterial.opacity !== 0.8) {
      let minAlpha = 1
      for (const a of this.tracerAlpha) if (a > 0 && a < minAlpha) minAlpha = a
      this.tracerMaterial.opacity = Math.max(0, minAlpha)
    }
    ;(this.tracerGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }
}

// Цвет трассера — из палитры DESIGN.md (янтарный акцент).
const SCENE_COLOR_TRACER = 0xffb454
