// src/entities/ProjectilePool.ts
// High performance pooled projectiles for player autocannons, turrets, missiles and enemy spit

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { MeshFactory } from '../rendering/MeshFactory';

export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  speed: number;
  damage: number;
  isCrit: boolean;
  isPlayer: boolean;
  type: 'bullet' | 'laser' | 'missile' | 'plasma' | 'enemy_spit';
  rangeLeft: number;
  mesh: THREE.Mesh;
}

export class ProjectilePool {
  private static instance: ProjectilePool;
  private pool: Projectile[] = [];
  private readonly POOL_SIZE = 120;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ProjectilePool {
    if (!ProjectilePool.instance) {
      ProjectilePool.instance = new ProjectilePool();
    }
    return ProjectilePool.instance;
  }

  public init(): void {
    if (this.isInitialized) return;
    const scene = sceneManager.getScene();
    const bulletGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
    bulletGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(bulletGeo, MeshFactory.materials.glowOrange);
      mesh.visible = false;
      scene.add(mesh);

      this.pool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vz: 0,
        speed: 30,
        damage: 20,
        isCrit: false,
        isPlayer: true,
        type: 'bullet',
        rangeLeft: 30,
        mesh,
      });
    }
    this.isInitialized = true;
  }

  public spawn(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    damage: number,
    isCrit: boolean = false,
    isPlayer: boolean = true,
    type: 'bullet' | 'laser' | 'missile' | 'plasma' | 'enemy_spit' = 'bullet'
  ): Projectile | null {
    if (!this.isInitialized) return null;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.damage = damage;
        p.isCrit = isCrit;
        p.isPlayer = isPlayer;
        p.type = type;

        if (type === 'laser') {
          p.speed = 45;
          p.rangeLeft = 32;
          p.mesh.material = MeshFactory.materials.glowCyan;
          p.mesh.scale.set(1.2, 1.2, 2.0);
        } else if (type === 'missile') {
          p.speed = 22;
          p.rangeLeft = 35;
          p.mesh.material = MeshFactory.materials.glowOrange;
          p.mesh.scale.set(1.8, 1.8, 1.8);
        } else if (type === 'enemy_spit') {
          p.speed = 18;
          p.rangeLeft = 28;
          p.mesh.material = MeshFactory.materials.glowGreen;
          p.mesh.scale.set(1.4, 1.4, 1.4);
        } else {
          p.speed = 36;
          p.rangeLeft = 28;
          p.mesh.material = isCrit ? MeshFactory.materials.glowRed : MeshFactory.materials.glowOrange;
          p.mesh.scale.set(1.0, 1.0, 1.0);
        }

        p.vx = nx * p.speed;
        p.vz = nz * p.speed;

        p.mesh.position.set(x, y, z);
        p.mesh.rotation.y = Math.atan2(nx, nz);
        p.mesh.visible = true;

        return p;
      }
    }
    return null;
  }

  public update(dt: number): void {
    if (!this.isInitialized) return;
    const particles = sceneManager.getParticles();

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.pool[i];
      if (p.active) {
        const moveDist = p.speed * dt;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.rangeLeft -= moveDist;

        p.mesh.position.set(p.x, p.y, p.z);

        // Trail particle
        if (p.type === 'missile' && Math.random() < 0.4) {
          particles.emitTrail(p.x, p.y, p.z, 0xff6600);
        }

        if (p.rangeLeft <= 0 || Math.abs(p.x) > 40 || Math.abs(p.z) > 40) {
          this.despawn(p);
        }
      }
    }
  }

  public despawn(p: Projectile): void {
    p.active = false;
    p.mesh.visible = false;
    p.mesh.position.set(0, -50, 0);
  }

  public getActiveProjectiles(): Projectile[] {
    return this.pool.filter((p) => p.active);
  }

  public clear(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.despawn(this.pool[i]);
    }
  }
}

export const projectilePool = ProjectilePool.getInstance();
