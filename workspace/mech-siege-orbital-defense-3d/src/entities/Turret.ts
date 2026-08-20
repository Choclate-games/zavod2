// src/entities/Turret.ts
// Defense Turret structures (Gatling, Tesla, Shield Barrier, Repair Station)

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { projectilePool } from './ProjectilePool';
import { Enemy } from './Enemy';
import { baseCore } from './BaseCore';
import { player } from './Player';
import { audioManager } from '../audio/AudioManager';

export interface TurretSpec {
  type: 'gatling' | 'tesla' | 'shield' | 'repair';
  name: string;
  cost: number;
  range: number;
  damage: number;
  fireRate: number;
}

export const TURRET_SPECS: Record<string, TurretSpec> = {
  gatling: {
    type: 'gatling',
    name: 'Гатлинг-Турель',
    cost: 25,
    range: 14,
    damage: 22,
    fireRate: 0.2,
  },
  tesla: {
    type: 'tesla',
    name: 'Тесла-Вышка',
    cost: 40,
    range: 11,
    damage: 55,
    fireRate: 0.75,
  },
  shield: {
    type: 'shield',
    name: 'Генератор Барьера',
    cost: 35,
    range: 7,
    damage: 15,
    fireRate: 0.5,
  },
  repair: {
    type: 'repair',
    name: 'Дрон-Ремонтник',
    cost: 50,
    range: 10,
    damage: 0,
    fireRate: 2.0,
  },
};

export class Turret {
  public type: 'gatling' | 'tesla' | 'shield' | 'repair';
  public x: number;
  public z: number;
  public spec: TurretSpec;
  public hp = 200;
  public maxHp = 200;
  public active = true;

  private root: THREE.Group;
  private head: THREE.Group;
  private cooldown = 0;

  constructor(type: 'gatling' | 'tesla' | 'shield' | 'repair', x: number, z: number) {
    this.type = type;
    this.x = x;
    this.z = z;
    this.spec = TURRET_SPECS[type];

    const turretRig = MeshFactory.createTurretMesh(type);
    this.root = turretRig.root;
    this.head = turretRig.head;
    this.root.position.set(x, 0, z);

    sceneManager.getScene().add(this.root);
    audioManager.playBuild();
    sceneManager.getParticles().emitSparks(x, 0.8, z, 12, 0x00d4ff);
  }

  public update(dt: number, enemies: Enemy[], buffMultiplier: number = 1.0): void {
    if (!this.active) return;
    this.cooldown -= dt;

    if (this.type === 'gatling') {
      this.updateGatling(enemies, buffMultiplier);
    } else if (this.type === 'tesla') {
      this.updateTesla(enemies, buffMultiplier);
    } else if (this.type === 'shield') {
      this.updateShield(enemies, buffMultiplier);
    } else if (this.type === 'repair') {
      this.updateRepair();
    }
  }

  private updateGatling(enemies: Enemy[], buffMultiplier: number): void {
    const target = this.findNearestEnemy(enemies, this.spec.range);
    if (!target) return;

    // Aim head
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    this.head.rotation.y = Math.atan2(dx, dz);

    if (this.cooldown <= 0) {
      this.cooldown = this.spec.fireRate;
      const dmg = Math.round(this.spec.damage * buffMultiplier);
      projectilePool.spawn(this.x, 1.0, this.z, dx, dz, dmg, false, true, 'bullet');
      audioManager.playAutocannon();
      sceneManager.getParticles().emitSparks(this.x, 1.0, this.z, 3, 0xffaa00);
    }
  }

  private updateTesla(enemies: Enemy[], buffMultiplier: number): void {
    this.head.rotation.y += 2.0 * 0.016;
    if (this.cooldown > 0) return;

    const nearby = enemies
      .filter((e) => e.active && Math.hypot(e.x - this.x, e.z - this.z) <= this.spec.range)
      .slice(0, 3);

    if (nearby.length > 0) {
      this.cooldown = this.spec.fireRate;
      const dmg = Math.round(this.spec.damage * buffMultiplier);
      nearby.forEach((enemy) => {
        enemy.takeDamage(dmg, false, 0.5);
        sceneManager.getParticles().emitSparks(enemy.x, 0.8, enemy.z, 8, 0x00e5ff);
      });
      audioManager.playLaser();
    }
  }

  private updateShield(enemies: Enemy[], buffMultiplier: number): void {
    this.head.rotation.y -= 1.5 * 0.016;
    if (this.cooldown > 0) return;

    const nearby = enemies.filter(
      (e) => e.active && Math.hypot(e.x - this.x, e.z - this.z) <= this.spec.range
    );

    if (nearby.length > 0) {
      this.cooldown = this.spec.fireRate;
      const dmg = Math.round(this.spec.damage * buffMultiplier);
      nearby.forEach((e) => {
        e.takeDamage(dmg, false, 1.5);
        sceneManager.getParticles().emitSparks(e.x, 0.5, e.z, 4, 0x00b4d8);
      });
    }
  }

  private updateRepair(): void {
    this.head.rotation.y += 1.0 * 0.016;
    if (this.cooldown <= 0) {
      this.cooldown = this.spec.fireRate;
      // Heal player if in range
      const pDist = Math.hypot(player.x - this.x, player.z - this.z);
      if (pDist <= this.spec.range) {
        player.heal(18);
        sceneManager.getParticles().emitSparks(player.x, 1.2, player.z, 6, 0x00ff66);
      }
      // Heal base core if in range
      const baseDist = Math.hypot(this.x, this.z);
      if (baseDist <= this.spec.range + 4) {
        baseCore.repair(30);
        sceneManager.getParticles().emitSparks(0, 1.5, 0, 8, 0x00ff66);
      }
    }
  }

  private findNearestEnemy(enemies: Enemy[], maxRange: number): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = maxRange;

    for (const e of enemies) {
      if (e.active) {
        const dist = Math.hypot(e.x - this.x, e.z - this.z);
        if (dist < minDist) {
          minDist = dist;
          nearest = e;
        }
      }
    }
    return nearest;
  }

  public takeDamage(dmg: number): void {
    this.hp -= dmg;
    sceneManager.getParticles().emitSparks(this.x, 0.6, this.z, 6, 0xff3300);
    if (this.hp <= 0) {
      this.destroy();
    }
  }

  public destroy(): void {
    this.active = false;
    sceneManager.getParticles().emitExplosion(this.x, 0.8, this.z, 16);
    sceneManager.getScene().remove(this.root);
  }
}
