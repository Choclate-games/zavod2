import * as THREE from 'three';
import { DestructibleProp } from '../entities/DestructibleProp';
import { BiomassOrb } from '../entities/BiomassOrb';
import { PlayerSlime } from '../entities/PlayerSlime';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SceneManager } from '../rendering/SceneManager';
import { AudioManager } from '../audio/AudioManager';
import { GameConfig } from '../config/GameConfig';

export class DestructionManager {
  public props: DestructibleProp[] = [];
  private nextPropId = 1;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.populateArena();
  }

  public populateArena(totalProps = 60): void {
    const propTypes = ['barrel', 'crate', 'fence', 'stall'];

    for (let i = 0; i < totalProps; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * (GameConfig.ARENA_RADIUS - 16);
      const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

      const type = propTypes[Math.floor(Math.random() * propTypes.length)];
      const prop = new DestructibleProp(this.nextPropId++, type, pos);
      this.props.push(prop);
      this.scene.add(prop.group);
    }
  }

  public checkPlayerCollisions(
    player: PlayerSlime,
    particles: ParticleSystem,
    sceneManager: SceneManager,
    orbs: BiomassOrb[]
  ): void {
    const audio = AudioManager.getInstance();

    for (let i = this.props.length - 1; i >= 0; i--) {
      const prop = this.props[i];
      const dx = player.position.x - prop.position.x;
      const dz = player.position.z - prop.position.z;
      const distSq = dx * dx + dz * dz;
      const minDist = player.stats.radius + prop.config.radius;

      if (distSq < minDist * minDist) {
        // Check absorption / ramming condition
        if (player.stats.mass > prop.config.mass * GameConfig.PLAYER.MASS_ABSORB_RATIO || player.isDashing) {
          // Smash prop!
          particles.emitWoodDebris(prop.position, prop.config.debrisCount);
          audio.playWoodCrack();
          sceneManager.addTrauma(0.2);

          // Drop biomass and DNA
          const orbPos = prop.position.clone();
          orbs.push(new BiomassOrb(Date.now() + Math.random(), 'biomass', prop.config.biomassValue, orbPos));
          if (prop.config.dnaValue > 0) {
            orbs.push(new BiomassOrb(Date.now() + Math.random() + 1, 'dna', prop.config.dnaValue, orbPos));
          }

          // Clean up
          this.scene.remove(prop.group);
          prop.dispose();
          this.props.splice(i, 1);

        } else {
          // Push player out
          const dist = Math.sqrt(distSq);
          if (dist > 0.001) {
            const overlap = minDist - dist;
            player.position.x += (dx / dist) * overlap * 0.5;
            player.position.z += (dz / dist) * overlap * 0.5;
          }
        }
      }
    }

    // Slowly respawn props if too few remain
    if (this.props.length < 25) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * (GameConfig.ARENA_RADIUS - 20);
      const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      const propTypes = ['barrel', 'crate', 'fence', 'stall'];
      const type = propTypes[Math.floor(Math.random() * propTypes.length)];
      const prop = new DestructibleProp(this.nextPropId++, type, pos);
      this.props.push(prop);
      this.scene.add(prop.group);
    }
  }

  public reset(): void {
    for (const prop of this.props) {
      this.scene.remove(prop.group);
      prop.dispose();
    }
    this.props = [];
    this.populateArena();
  }
}
