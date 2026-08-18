// src/entities/Grain.ts
import * as THREE from 'three';
import { ProceduralModels } from '@/rendering/ProceduralModels';
import { particleSystem } from '@/rendering/ParticleSystem';
import { eventBus } from '@/core/EventBus';

export class Grain {
  public id: string;
  public mesh: THREE.Group;
  public isCollected: boolean = false;
  private animPhase: number;
  private initialY: number = 0.35;

  constructor(id: string, x: number, z: number) {
    this.id = id;
    this.mesh = ProceduralModels.createGrain();
    this.mesh.position.set(x, 0, z);
    this.animPhase = Math.random() * Math.PI * 2;
  }

  public update(dt: number, playerX: number, playerZ: number): boolean {
    if (this.isCollected) return false;

    // Bobbing & Floating Rotation
    this.animPhase += dt * 3.5;
    this.mesh.rotation.y += dt * 2.5;

    const kernel = this.mesh.children[0];
    if (kernel) {
      kernel.position.y = this.initialY + Math.sin(this.animPhase) * 0.08;
    }

    // Trigger collection check
    const dist = Math.hypot(this.mesh.position.x - playerX, this.mesh.position.z - playerZ);
    if (dist < 0.8) {
      this.collect();
      return true;
    }

    return false;
  }

  public collect(): void {
    if (this.isCollected) return;
    this.isCollected = true;
    this.mesh.visible = false;

    eventBus.emit('audio:playSfx', { name: 'grain', volume: 0.85 });
    particleSystem.spawnGrainSparkles(this.mesh.position.x, 0.4, this.mesh.position.z);
  }

  public reset(): void {
    this.isCollected = false;
    this.mesh.visible = true;
  }
}
