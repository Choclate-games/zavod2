// src/entities/Enemy.ts
// Enemy entity implementation (Swarmers, Spitter Walkers, Armored Breachers, Titan Bosses)

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { projectilePool } from './ProjectilePool';
import { scrapPool } from './ScrapPool';
import { baseCore } from './BaseCore';
import { player } from './Player';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';

export type EnemyType = 'swarmer' | 'spitter' | 'breacher' | 'boss';

export class Enemy {
  public id: number;
  public type: EnemyType = 'swarmer';
  public active = false;
  public x = 0;
  public y = 0;
  public z = 0;
  public vx = 0;
  public vz = 0;

  public maxHp = 50;
  public currentHp = 50;
  public speed = 3.5;
  public damage = 10;
  public scrapValue = 2;
  public attackCooldown = 0;
  public attackInterval = 1.0;

  public mesh: THREE.Group;
  private hitFlashTimer = 0;

  constructor(id: number) {
    this.id = id;
    this.mesh = new THREE.Group();
    this.mesh.visible = false;
  }

  public initMesh(): void {
    sceneManager.getScene().add(this.mesh);
  }

  public setup(type: EnemyType, x: number, z: number, waveMultiplier: number = 1.0): void {
    this.type = type;
    this.x = x;
    this.y = 0;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.active = true;

    // Clear old children and re-create appropriate mesh
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }
    const newMesh = MeshFactory.createEnemyMesh(type);
    this.mesh.add(newMesh);

    if (type === 'swarmer') {
      this.maxHp = Math.round(45 * waveMultiplier);
      this.speed = 4.4 + Math.random() * 0.6;
      this.damage = Math.round(10 * waveMultiplier);
      this.scrapValue = 2;
      this.attackInterval = 0.8;
    } else if (type === 'spitter') {
      this.maxHp = Math.round(85 * waveMultiplier);
      this.speed = 2.6;
      this.damage = Math.round(18 * waveMultiplier);
      this.scrapValue = 4;
      this.attackInterval = 1.6;
    } else if (type === 'breacher') {
      this.maxHp = Math.round(260 * waveMultiplier);
      this.speed = 2.0;
      this.damage = Math.round(35 * waveMultiplier);
      this.scrapValue = 8;
      this.attackInterval = 1.4;
    } else if (type === 'boss') {
      this.maxHp = Math.round(2000 * waveMultiplier);
      this.speed = 1.6;
      this.damage = Math.round(60 * waveMultiplier);
      this.scrapValue = 35;
      this.attackInterval = 1.0;
      eventBus.emit('boss:spawned', { name: 'ГОЛИАФ: РАЗРУШИТЕЛЬ БАЗ', hp: this.maxHp });
    }

    this.currentHp = this.maxHp;
    this.attackCooldown = Math.random() * 0.5;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.visible = true;
  }

  public takeDamage(amount: number, isCrit: boolean = false, knockbackScale: number = 1.0): void {
    if (!this.active) return;

    this.currentHp -= amount;
    this.hitFlashTimer = 0.08;

    // Sensory hit-stop & sparks
    sceneManager.getParticles().emitSparks(this.x, 0.8, this.z, isCrit ? 12 : 6, isCrit ? 0xff1e1e : 0xffaa00);
    eventBus.emit('entity:hit', {
      target: 'enemy',
      damage: amount,
      isCrit,
      x: this.x,
      y: 1.0,
      z: this.z,
    });

    if (isCrit) {
      eventBus.emit('fx:hitstop', { durationMs: 40 });
      sceneManager.triggerScreenShake(0.3, 0.15);
    }

    if (this.currentHp <= 0) {
      this.die();
    }
  }

  public applyKnockback(dirX: number, dirZ: number, force: number): void {
    const len = Math.hypot(dirX, dirZ) || 1;
    this.vx += (dirX / len) * force;
    this.vz += (dirZ / len) * force;
  }

  public die(): void {
    this.active = false;
    this.mesh.visible = false;
    this.mesh.position.set(0, -50, 0);

    const isBoss = this.type === 'boss';
    audioManager.playExplosion(isBoss);
    sceneManager.getParticles().emitExplosion(this.x, 1.0, this.z, isBoss ? 40 : 16, isBoss);

    // Drop scrap gears
    scrapPool.spawn(this.x, this.z, this.scrapValue);
    if (isBoss) {
      for (let i = 0; i < 4; i++) {
        scrapPool.spawn(this.x + (Math.random() - 0.5) * 3, this.z + (Math.random() - 0.5) * 3, 5);
      }
      eventBus.emit('boss:defeated', undefined);
    }

    eventBus.emit('enemy:killed', {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      z: this.z,
      scrapValue: this.scrapValue,
    });
  }

  public update(dt: number): void {
    if (!this.active) return;

    this.attackCooldown -= dt;

    // Friction decay on velocity knockback
    this.vx *= 0.88;
    this.vz *= 0.88;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // AI targeting logic: choose closest between Player and BaseCore (0,0)
    const distToPlayer = Math.hypot(player.x - this.x, player.z - this.z);
    const distToBase = Math.hypot(this.x, this.z);

    let targetX = 0;
    let targetZ = 0;
    let targetIsPlayer = false;

    if (distToPlayer < distToBase && !player.isDead) {
      targetX = player.x;
      targetZ = player.z;
      targetIsPlayer = true;
    }

    const dx = targetX - this.x;
    const dz = targetZ - this.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;

    // Orientation
    this.mesh.rotation.y = Math.atan2(nx, nz);

    if (this.type === 'spitter') {
      // Keep distance ~10 units and fire mortars
      if (dist > 10) {
        this.x += nx * this.speed * dt;
        this.z += nz * this.speed * dt;
      } else if (dist < 6) {
        this.x -= nx * this.speed * 0.7 * dt;
        this.z -= nz * this.speed * 0.7 * dt;
      }

      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.attackInterval;
        projectilePool.spawn(this.x, 1.2, this.z, dx, dz, this.damage, false, false, 'enemy_spit');
      }
    } else if (this.type === 'boss') {
      // Boss advances steadily and alternates laser attacks & missile barrage
      if (dist > 4) {
        this.x += nx * this.speed * dt;
        this.z += nz * this.speed * dt;
      }

      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.attackInterval;
        // Fire dual laser/spit
        projectilePool.spawn(this.x - 1.5, 2.0, this.z, dx, dz, this.damage, false, false, 'enemy_spit');
        projectilePool.spawn(this.x + 1.5, 2.0, this.z, dx, dz, this.damage, false, false, 'enemy_spit');
      }
    } else {
      // Swarmer / Breacher: Melee rush
      this.x += nx * this.speed * dt;
      this.z += nz * this.speed * dt;

      // Check melee collision with target
      if (targetIsPlayer && dist < 1.4 && this.attackCooldown <= 0) {
        this.attackCooldown = this.attackInterval;
        player.takeDamage(this.damage);
        this.applyKnockback(-nx, -nz, 4.0);
      } else if (!targetIsPlayer && distToBase < 4.8 && this.attackCooldown <= 0) {
        this.attackCooldown = this.attackInterval;
        baseCore.takeDamage(this.damage);
        this.applyKnockback(-nx, -nz, 3.0);
      }
    }

    // Keep on arena boundary
    this.x = Math.max(-30, Math.min(30, this.x));
    this.z = Math.max(-30, Math.min(30, this.z));

    this.mesh.position.set(this.x, this.y, this.z);
  }
}
