import * as THREE from 'three'
import { BAL } from '../config/balance.js'

/**
 * Пул частиц на InstancedMesh: конфетти-завеса и хлопушки. Частицы живут в
 * предвыделенном массиве, активные пишутся в буфер подряд, mesh.count выставляется
 * в конце; гравитация, время жизни и размер — параметры частицы. Аллокаций в кадре нет.
 */

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rot: number
  spin: number
  life: number
  maxLife: number
  size: number
}

const MAX_PARTICLES = 320

export class VfxPool {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.InstancedMesh
  private readonly particles: Particle[] = []
  private active = 0
  private readonly dummy = new THREE.Object3D()
  private readonly color = new THREE.Color()

  constructor() {
    const geo = new THREE.PlaneGeometry(0.22, 0.34)
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3)
    this.mesh.frustumCulled = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, life: 0, maxLife: 1, size: 1 })
    }
    this.mesh.count = 0
    this.group.add(this.mesh)
  }

  /** Выброс конфетти направленным куполом вверх (хлопушка или завеса под себя). */
  spawnCloud(x: number, z: number, radius: number): void {
    const palette = [0xff5f9e, 0x5ad7e8, 0xf5c542, 0x8cff6b, 0xc98bff]
    let count = Math.min(90, MAX_PARTICLES - this.active)
    while (count-- > 0) {
      const p = this.particles[this.active++]
      const angle = Math.random() * Math.PI * 2
      const speed = (2.4 + Math.random() * 4) * (radius / BAL.confettiRadius + 0.4)
      p.x = x + Math.cos(angle) * Math.random() * 0.6
      p.y = 0.4
      p.z = z + Math.sin(angle) * Math.random() * 0.6
      p.vx = Math.cos(angle) * speed * 0.55
      p.vy = 3.4 + Math.random() * 3.2
      p.vz = Math.sin(angle) * speed * 0.55
      p.rot = Math.random() * Math.PI
      p.spin = (Math.random() - 0.5) * 14
      p.maxLife = BAL.smokeDuration + Math.random()
      p.life = p.maxLife
      p.size = 0.7 + Math.random() * 0.8
      this.color.setHex(palette[(this.active + count) % palette.length])
      this.mesh.setColorAt(this.active - 1, this.color)
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  update(dt: number): void {
    let i = 0
    while (i < this.active) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        const last = this.particles[--this.active]
        this.particles[this.active] = p
        this.particles[i] = last
        continue
      }
      p.vy -= 5.6 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.vx *= 1 - 1.6 * dt
      p.vz *= 1 - 1.6 * dt
      if (p.y < 0.12 && p.vy < 0) {
        p.y = 0.12
        p.vy = 0
        p.vx *= 0.7
        p.vz *= 0.7
        p.spin *= 0.7
      }
      p.rot += p.spin * dt
      i++
    }
    for (let k = 0; k < this.active; k++) {
      const p = this.particles[k]
      this.dummy.position.set(p.x, p.y, p.z)
      this.dummy.rotation.set(p.rot, p.rot * 0.7, p.rot * 1.3)
      const fade = Math.min(1, p.life / 0.8)
      this.dummy.scale.setScalar(p.size * fade)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(k, this.dummy.matrix)
    }
    this.mesh.count = this.active
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
