import * as THREE from 'three'
import type { ParticleSystem, ParticleKind } from '../rendering/ParticleSystem'

/**
 * Пул игровых эффектов поверх системы частиц: снежный шлейф из-под колёс,
 * осколки синего льда, брызги молока при сбросе давления и пар выхлопа
 * в сцене за меню. Всё через переиспользуемые пулы — в кадре ни одной
 * аллокации.
 */
export class EntityManager {
  private exhaustTimer = 0

  constructor(private readonly particles: ParticleSystem) {}

  snowSpray(pos: THREE.Vector3, intensity: number): void {
    const count = Math.min(6, Math.floor(intensity * 7))
    for (let i = 0; i < count; i++) {
      this.particles.spawn(
        ParticleKind.Snow,
        pos.x + (Math.random() - 0.5) * 1.6,
        pos.y + 0.2,
        pos.z + (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.5) * 3.2,
        1.8 + Math.random() * 2.4,
        (Math.random() - 0.5) * 3.2,
      )
    }
  }

  iceShards(pos: THREE.Vector3, intensity: number): void {
    const count = Math.min(5, Math.floor(intensity * 6))
    for (let i = 0; i < count; i++) {
      this.particles.spawn(
        ParticleKind.Ice,
        pos.x + (Math.random() - 0.5) * 1.2,
        pos.y + 0.15,
        pos.z + (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 5,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 5,
      )
    }
  }

  milkSplash(pos: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      this.particles.spawn(
        ParticleKind.Milk,
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + 1.2,
        pos.z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 2.4,
        2.5 + Math.random() * 2,
        (Math.random() - 0.5) * 2.4,
      )
    }
  }

  /** Пар из выхлопных труб в меню: медленный, полупрозрачный. */
  menuExhaust(tailPipeA: THREE.Vector3, tailPipeB: THREE.Vector3, dt: number): void {
    this.exhaustTimer += dt
    if (this.exhaustTimer < 0.18) return
    this.exhaustTimer = 0
    for (const pipe of [tailPipeA, tailPipeB]) {
      this.particles.spawn(ParticleKind.Steam, pipe.x, pipe.y, pipe.z, 0, 0.9, 0)
    }
  }
}
