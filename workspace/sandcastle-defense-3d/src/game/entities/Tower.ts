import * as THREE from 'three';
import { Enemy } from './Enemy.ts';

export type TowerType = 'cannon' | 'splasher' | 'wall';
export type TargetPriority = 'first' | 'strongest' | 'closest';

export interface TowerConfig {
  nameKey: string;
  baseCost: number;
  baseDamage: number;
  baseRange: number;
  baseFireInterval: number;
  isAttacking: boolean;
}

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  cannon: {
    nameKey: 'cannon_name',
    baseCost: 100,
    baseDamage: 35,
    baseRange: 4.6,
    baseFireInterval: 1.0,
    isAttacking: true,
  },
  splasher: {
    nameKey: 'splasher_name',
    baseCost: 150,
    baseDamage: 4,
    baseRange: 3.2,
    baseFireInterval: 0.25,
    isAttacking: true,
  },
  wall: {
    nameKey: 'wall_name',
    baseCost: 20,
    baseDamage: 0,
    baseRange: 0,
    baseFireInterval: 999,
    isAttacking: false,
  },
};

export class Tower {
  public id: number;
  public type: TowerType;
  public level: number = 1;
  public cellX: number;
  public cellZ: number;
  public worldPosition: THREE.Vector3 = new THREE.Vector3();

  public damage: number;
  public range: number;
  public fireInterval: number;
  public cooldown: number = 0;
  public targetPriority: TargetPriority = 'first';
  public targetEnemy: Enemy | null = null;

  public mesh: THREE.Group | null = null;
  public pivotGroup: THREE.Group | null = null; // Barrel or sprinkler head for yaw rotation

  public totalInvestedCost: number;

  constructor(id: number, type: TowerType, cellX: number, cellZ: number, worldX: number, worldZ: number) {
    this.id = id;
    this.type = type;
    this.cellX = cellX;
    this.cellZ = cellZ;
    this.worldPosition.set(worldX, 0, worldZ);

    const cfg = TOWER_CONFIGS[type];
    this.damage = cfg.baseDamage;
    this.range = cfg.baseRange;
    this.fireInterval = cfg.baseFireInterval;
    this.totalInvestedCost = cfg.baseCost;
  }

  public getUpgradeCost(): number {
    if (this.level >= 3) return 0;
    if (this.type === 'cannon') return Math.round(100 * (1 + this.level * 0.4));
    if (this.type === 'splasher') return Math.round(140 * (1 + this.level * 0.4));
    if (this.type === 'wall') return 30;
    return 100;
  }

  public getSellRefund(): number {
    return Math.floor(this.totalInvestedCost * 0.75);
  }

  public canUpgrade(): boolean {
    return this.level < 3;
  }

  public upgrade(): boolean {
    if (this.level >= 3) return false;
    const cost = this.getUpgradeCost();
    this.totalInvestedCost += cost;
    this.level++;

    if (this.type === 'cannon') {
      this.damage = Math.round(this.damage * 1.45);
      this.range += 0.4;
      this.fireInterval = Math.max(0.6, this.fireInterval - 0.1);
    } else if (this.type === 'splasher') {
      this.damage = Math.round(this.damage * 1.5);
      this.range += 0.35;
    }

    if (this.mesh) {
      // Visual scale pop on upgrade
      this.mesh.scale.set(1.15, 1.15, 1.15);
      setTimeout(() => {
        if (this.mesh) this.mesh.scale.set(1.0, 1.0, 1.0);
      }, 150);
    }

    return true;
  }

  public update(dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    // Splasher continuous rotation
    if (this.type === 'splasher' && this.pivotGroup) {
      this.pivotGroup.rotation.y += dt * 5.0;
    }

    // Cannon aim rotation
    if (this.type === 'cannon' && this.pivotGroup && this.targetEnemy && this.targetEnemy.isAlive) {
      const targetPos = this.targetEnemy.position;
      const dx = targetPos.x - this.worldPosition.x;
      const dz = targetPos.z - this.worldPosition.z;
      const angle = Math.atan2(dx, dz);
      // Smooth yaw slerp/lerp
      let diff = angle - this.pivotGroup.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.pivotGroup.rotation.y += diff * Math.min(1.0, dt * 10.0);
    }
  }

  public canFire(): boolean {
    return this.cooldown <= 0 && TOWER_CONFIGS[this.type].isAttacking;
  }

  public resetCooldown(): void {
    this.cooldown = this.fireInterval;
  }
}
