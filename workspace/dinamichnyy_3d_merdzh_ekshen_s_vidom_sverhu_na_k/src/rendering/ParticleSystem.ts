import * as THREE from 'three'

type Particle = { mesh: THREE.Mesh; active: boolean; life: number; vx: number; vy: number; vz: number }

export class ParticleSystem {
  private readonly particles: Particle[] = []
  private readonly material: THREE.MeshBasicMaterial

  constructor(private readonly scene: THREE.Scene) {
    this.material = new THREE.MeshBasicMaterial({ color: 0xffb84a, transparent: true, opacity: 0.9 })
    const geometry = new THREE.SphereGeometry(0.07, 6, 4)
    for (let index = 0; index < 72; index += 1) {
      const mesh = new THREE.Mesh(geometry, this.material)
      mesh.visible = false
      scene.add(mesh)
      this.particles.push({ mesh, active: false, life: 0, vx: 0, vy: 0, vz: 0 })
    }
  }

  burst(x: number, z: number, strength: number): void {
    let launched = 0
    for (const particle of this.particles) {
      if (particle.active) continue
      const angle = launched * 2.41
      const speed = strength * (0.35 + (launched % 5) * 0.11)
      particle.active = true
      particle.life = 0.55 + (launched % 4) * 0.09
      particle.vx = Math.cos(angle) * speed
      particle.vy = 1.2 + (launched % 3) * 0.35
      particle.vz = Math.sin(angle) * speed
      particle.mesh.position.set(x, 0.35, z)
      particle.mesh.scale.setScalar(0.7 + (launched % 3) * 0.2)
      particle.mesh.visible = true
      launched += 1
      if (launched >= 18) break
    }
  }

  update(dt: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue
      particle.life -= dt
      if (particle.life <= 0) {
        particle.active = false
        particle.mesh.visible = false
        continue
      }
      particle.mesh.position.x += particle.vx * dt
      particle.mesh.position.y += particle.vy * dt
      particle.mesh.position.z += particle.vz * dt
      particle.vy -= 2.8 * dt
      particle.mesh.scale.multiplyScalar(0.988)
    }
  }
}
