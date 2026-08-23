import * as THREE from 'three'
import { ProceduralModels } from '../rendering/ProceduralModels'
import { Player } from './Player'

export class EntityManager {
  public player: Player
  private airship: THREE.Group
  private scene: THREE.Scene

  constructor(scene: THREE.Scene, player: Player) {
    this.scene = scene
    this.player = player

    this.airship = ProceduralModels.createBackgroundAirship()
    this.scene.add(this.airship)
  }

  public reset(): void {
    this.player.reset()
    this.airship.position.set(45, 35, 120)
  }

  public update(dt: number): void {
    this.player.update(dt)

    // Slow drifting background airship
    this.airship.position.z += dt * 1.5
    this.airship.position.x += Math.sin(this.player.position.z * 0.01) * dt * 0.5
  }
}
