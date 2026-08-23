import * as THREE from 'three'

interface Particle {
  active: boolean
  position: THREE.Vector3
  velocity: THREE.Vector3
  scale: number
  color: THREE.Color
  life: number
  maxLife: number
}

export class ParticleSystem {
  private static instance: ParticleSystem
  private maxParticles = 300
  private particles: Particle[] = []
  private instancedMesh: THREE.InstancedMesh
  private dummy = new THREE.Object3D()

  public static getInstance(): ParticleSystem {
    if (!ParticleSystem.instance) {
      ParticleSystem.instance = new ParticleSystem()
    }
    return ParticleSystem.instance
  }

  constructor() {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles)
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        scale: 1,
        color: new THREE.Color(0xff6b00),
        life: 0,
        maxLife: 1,
      })
      this.dummy.position.set(0, -999, 0)
      this.dummy.updateMatrix()
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix)
      this.instancedMesh.setColorAt(i, new THREE.Color(0xff6b00))
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true
    }
  }

  public getMesh(): THREE.InstancedMesh {
    return this.instancedMesh
  }

  public emitSparks(origin: THREE.Vector3, count = 12, colorHex = 0xff6b00): void {
    let spawned = 0
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i]
      if (!p.active) {
        p.active = true
        p.position.copy(origin)
        p.velocity.set(
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 2,
          (Math.random() - 0.5) * 8,
        )
        p.scale = Math.random() * 0.8 + 0.4
        p.color.setHex(colorHex)
        p.life = 0
        p.maxLife = Math.random() * 0.4 + 0.3
        spawned++
      }
    }
  }

  public emitDebris(origin: THREE.Vector3, count = 8): void {
    this.emitSparks(origin, count, 0x9c6b3f)
  }

  public update(dt: number): void {
    let updatedAny = false

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i]
      if (p.active) {
        p.life += dt
        if (p.life >= p.maxLife) {
          p.active = false
          this.dummy.position.set(0, -999, 0)
          this.dummy.scale.set(0, 0, 0)
          this.dummy.updateMatrix()
          this.instancedMesh.setMatrixAt(i, this.dummy.matrix)
          updatedAny = true
          continue
        }

        // Gravity & Velocity
        p.velocity.y -= 18.0 * dt
        p.position.addScaledVector(p.velocity, dt)

        // Floor bounce
        if (p.position.y < 0.06) {
          p.position.y = 0.06
          p.velocity.y *= -0.4
        }

        const progress = p.life / p.maxLife
        const currentScale = p.scale * (1.0 - progress)

        this.dummy.position.copy(p.position)
        this.dummy.scale.set(currentScale, currentScale, currentScale)
        this.dummy.rotation.x += dt * 5
        this.dummy.rotation.y += dt * 7
        this.dummy.updateMatrix()

        this.instancedMesh.setMatrixAt(i, this.dummy.matrix)
        this.instancedMesh.setColorAt(i, p.color)
        updatedAny = true
      }
    }

    if (updatedAny) {
      this.instancedMesh.instanceMatrix.needsUpdate = true
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true
      }
    }
  }
}

export const particleSystem = ParticleSystem.getInstance()
