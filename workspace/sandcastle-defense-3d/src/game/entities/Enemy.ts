import * as THREE from 'three';
import { GridManager } from '../grid/GridManager.ts';

export type EnemyType = 'crab' | 'hermit' | 'starfish' | 'mini_starfish' | 'seagull' | 'boss_kraken';

export interface EnemyConfig {
  type: EnemyType;
  maxHp: number;
  speed: number;
  bounty: number;
  castleDamage: number;
  isFlying: boolean;
  armorPercent: number; // 0..1 reduction to physical hits
  scale: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  crab: {
    type: 'crab',
    maxHp: 80,
    speed: 1.6,
    bounty: 10,
    castleDamage: 5,
    isFlying: false,
    armorPercent: 0,
    scale: 1.0,
  },
  hermit: {
    type: 'hermit',
    maxHp: 240,
    speed: 1.0,
    bounty: 25,
    castleDamage: 12,
    isFlying: false,
    armorPercent: 0.35,
    scale: 1.15,
  },
  starfish: {
    type: 'starfish',
    maxHp: 65,
    speed: 2.1,
    bounty: 12,
    castleDamage: 4,
    isFlying: false,
    armorPercent: 0,
    scale: 0.9,
  },
  mini_starfish: {
    type: 'mini_starfish',
    maxHp: 35,
    speed: 2.4,
    bounty: 5,
    castleDamage: 2,
    isFlying: false,
    armorPercent: 0,
    scale: 0.6,
  },
  seagull: {
    type: 'seagull',
    maxHp: 75,
    speed: 2.0,
    bounty: 15,
    castleDamage: 8,
    isFlying: true,
    armorPercent: 0,
    scale: 1.0,
  },
  boss_kraken: {
    type: 'boss_kraken',
    maxHp: 1200,
    speed: 0.75,
    bounty: 100,
    castleDamage: 30,
    isFlying: false,
    armorPercent: 0.2,
    scale: 1.8,
  },
};

export class Enemy {
  public id: number;
  public type: EnemyType;
  public config: EnemyConfig;

  public hp: number;
  public maxHp: number;
  public isAlive: boolean = true;
  public hasReachedCastle: boolean = false;

  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public targetCastlePos: THREE.Vector3 = new THREE.Vector3();

  // Status effects
  public slowTimer: number = 0;
  public slowMultiplier: number = 1.0;
  public hitFlashTimer: number = 0;

  // Animation time
  public animTime: number = 0;

  // Three.js visual
  public mesh: THREE.Group | null = null;
  public leftWingOrClaw: THREE.Object3D | null = null;
  public rightWingOrClaw: THREE.Object3D | null = null;
  public hpBarMesh: THREE.Mesh | null = null;

  // Reusable flow query vector
  private flowTemp: { x: number; z: number } = { x: 0, z: 0 };

  constructor(id: number, type: EnemyType, startX: number, startZ: number, targetCastle: THREE.Vector3, hpMultiplier: number = 1.0) {
    this.id = id;
    this.type = type;
    this.config = ENEMY_CONFIGS[type];
    this.maxHp = Math.round(this.config.maxHp * hpMultiplier);
    this.hp = this.maxHp;
    this.targetCastlePos.copy(targetCastle);

    const startY = this.config.isFlying ? 2.2 : 0;
    this.position.set(startX, startY, startZ);
    this.animTime = Math.random() * 10;
  }

  public takeDamage(amount: number, isPhysical: boolean = true): boolean {
    if (!this.isAlive) return false;

    let effectiveDamage = amount;
    if (isPhysical && this.config.armorPercent > 0) {
      effectiveDamage = Math.max(1, amount * (1.0 - this.config.armorPercent));
    }

    this.hp -= effectiveDamage;
    this.hitFlashTimer = 0.08;

    this.updateHpBar();

    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
      return true; // Died on this hit
    }
    return false;
  }

  public applySlow(duration: number, multiplier: number = 0.5): void {
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowMultiplier = multiplier;
  }

  public update(dt: number, gridManager: GridManager): void {
    if (!this.isAlive) return;

    this.animTime += dt;

    // Handle Slow decay
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowMultiplier = 1.0;
      }
    }

    // Handle Hit Flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    const currentSpeed = this.config.speed * this.slowMultiplier;

    if (this.config.isFlying) {
      // Seagull flies directly to castle target
      const dx = this.targetCastlePos.x - this.position.x;
      const dz = this.targetCastlePos.z - this.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.8) {
        this.hasReachedCastle = true;
        this.isAlive = false;
        return;
      }

      this.velocity.set((dx / dist) * currentSpeed, 0, (dz / dist) * currentSpeed);
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      // Gentle hovering wave
      this.position.y = 2.2 + Math.sin(this.animTime * 6.0) * 0.15;

      // Rotate towards flight direction
      if (this.mesh) {
        this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
      }

      // Wing flapping animation
      if (this.leftWingOrClaw && this.rightWingOrClaw) {
        const flap = Math.sin(this.animTime * 14.0) * 0.45;
        this.leftWingOrClaw.rotation.z = flap;
        this.rightWingOrClaw.rotation.z = -flap;
      }
    } else {
      // Ground units: sample flow field from GridManager
      const cell = gridManager.worldToCell(this.position.x, this.position.z);
      gridManager.flowSolver.getFlowVector(cell.x, cell.z, this.flowTemp);

      // Check if at castle cell
      if (gridManager.isInBounds(cell.x, cell.z)) {
        const cellIdx = gridManager.getIndex(cell.x, cell.z);
        if (gridManager.grid[cellIdx] === 3) { // CASTLE
          this.hasReachedCastle = true;
          this.isAlive = false;
          return;
        }
      }

      // Fallback towards target castle if flow is 0 (e.g. inside castle vicinity)
      if (this.flowTemp.x === 0 && this.flowTemp.z === 0) {
        const dx = this.targetCastlePos.x - this.position.x;
        const dz = this.targetCastlePos.z - this.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.6) {
          this.hasReachedCastle = true;
          this.isAlive = false;
          return;
        }
        if (dist > 0.001) {
          this.flowTemp.x = dx / dist;
          this.flowTemp.z = dz / dist;
        }
      }

      // Smooth movement along flow vector
      const targetVx = this.flowTemp.x * currentSpeed;
      const targetVz = this.flowTemp.z * currentSpeed;

      this.velocity.x += (targetVx - this.velocity.x) * Math.min(1.0, dt * 8.0);
      this.velocity.z += (targetVz - this.velocity.z) * Math.min(1.0, dt * 8.0);

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y = Math.abs(Math.sin(this.animTime * 8.0)) * 0.08;

      if (this.mesh) {
        const moveAngle = Math.atan2(this.velocity.x, this.velocity.z);
        this.mesh.rotation.y = moveAngle;

        // Claw wiggling / Starfish crawling animation
        if (this.leftWingOrClaw && this.rightWingOrClaw) {
          const clawAnim = Math.sin(this.animTime * 10.0) * 0.25;
          this.leftWingOrClaw.rotation.y = clawAnim;
          this.rightWingOrClaw.rotation.y = -clawAnim;
        }
      }
    }

    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
  }

  private updateHpBar(): void {
    if (this.hpBarMesh) {
      const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
      this.hpBarMesh.scale.x = hpRatio;
      this.hpBarMesh.position.x = (hpRatio - 1.0) * 0.3;
    }
  }
}
