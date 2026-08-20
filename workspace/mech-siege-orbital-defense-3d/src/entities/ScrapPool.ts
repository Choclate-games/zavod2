// src/entities/ScrapPool.ts
// Object pool for dropped scrap gears and magnet collection mechanics

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';

export interface ScrapItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  value: number;
  mesh: THREE.Mesh;
  spinSpeed: number;
}

export class ScrapPool {
  private static instance: ScrapPool;
  private pool: ScrapItem[] = [];
  private readonly POOL_SIZE = 80;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ScrapPool {
    if (!ScrapPool.instance) {
      ScrapPool.instance = new ScrapPool();
    }
    return ScrapPool.instance;
  }

  public init(): void {
    if (this.isInitialized) return;
    const scene = sceneManager.getScene();
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const mesh = MeshFactory.createScrapMesh();
      mesh.visible = false;
      scene.add(mesh);

      this.pool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        value: 1,
        mesh,
        spinSpeed: 2.0 + Math.random() * 2.0,
      });
    }
    this.isInitialized = true;
  }

  public spawn(x: number, z: number, value: number = 1): void {
    if (!this.isInitialized) return;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const item = this.pool[i];
      if (!item.active) {
        item.active = true;
        item.x = x + (Math.random() - 0.5) * 0.6;
        item.y = 0.3;
        item.z = z + (Math.random() - 0.5) * 0.6;
        item.value = value;
        item.mesh.position.set(item.x, item.y, item.z);
        item.mesh.visible = true;
        return;
      }
    }
  }

  public update(dt: number, playerX: number, playerZ: number, magnetRadius: number): void {
    if (!this.isInitialized) return;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const item = this.pool[i];
      if (item.active) {
        // Spin animation
        item.mesh.rotation.y += item.spinSpeed * dt;
        item.mesh.rotation.z += item.spinSpeed * 0.5 * dt;

        // Magnet attraction
        const dx = playerX - item.x;
        const dz = playerZ - item.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 1.2) {
          // Collect
          audioManager.playPickup();
          eventBus.emit('scrap:collected', { amount: item.value, total: 0 });
          this.despawn(item);
        } else if (dist < magnetRadius) {
          const pullSpeed = 16.0 / Math.max(0.5, dist);
          item.x += (dx / dist) * pullSpeed * dt;
          item.z += (dz / dist) * pullSpeed * dt;
          item.mesh.position.set(item.x, item.y, item.z);
        }
      }
    }
  }

  public despawn(item: ScrapItem): void {
    item.active = false;
    item.mesh.visible = false;
    item.mesh.position.set(0, -50, 0);
  }

  public clear(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.despawn(this.pool[i]);
    }
  }
}

export const scrapPool = ScrapPool.getInstance();
