// src/entities/Player.ts
// Combat Mech player controller with independent torso aiming, dual autocannons, dash and shield

import * as THREE from 'three';
import { sceneManager } from '../rendering/SceneManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { projectilePool } from './ProjectilePool';
import { scrapPool } from './ScrapPool';
import { Enemy } from './Enemy';
import { PlayerStats } from '../core/GameState';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';
import { storageService } from '../platform/StorageService';

export class Player {
  private static instance: Player;

  public root!: THREE.Group;
  public torso!: THREE.Group;
  public leftGun!: THREE.Mesh;
  public rightGun!: THREE.Mesh;
  public thrusterGlow!: THREE.Mesh;

  public x = 0;
  public y = 0;
  public z = 6;
  public vx = 0;
  public vz = 0;
  public isDead = false;

  public stats: PlayerStats = {
    maxHp: 100,
    currentHp: 100,
    maxShield: 50,
    currentShield: 50,
    shieldRechargeRate: 15,
    shieldRechargeDelay: 3.0,
    speed: 8.5,
    damageMultiplier: 1.0,
    attackSpeedMultiplier: 1.0,
    critChance: 0.15,
    critMultiplier: 2.0,
    dashCooldown: 2.0,
    dashDuration: 0.25,
    dashSpeed: 24.0,
    magnetRadius: 5.5,
    armorReduction: 0.1,
    turretBuffMultiplier: 1.0,
    hasPlasmaRounds: false,
    hasTeslaArcOnHit: false,
    hasShockwaveDash: false,
    hasVampiricNanites: false,
  };

  private moveInput = new THREE.Vector2(0, 0);
  private isAttacking = false;
  private attackCooldown = 0;
  private readonly BASE_FIRE_INTERVAL = 0.16;
  private gunAlternate = false;

  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private dashDir = new THREE.Vector2(0, -1);

  private shieldRechargeTimer = 0;
  private invulnerableTimer = 0;

  private constructor() {}

  public static getInstance(): Player {
    if (!Player.instance) {
      Player.instance = new Player();
    }
    return Player.instance;
  }

  public init(): void {
    const scene = sceneManager.getScene();
    const mechRig = MeshFactory.createPlayerMech();
    this.root = mechRig.root;
    this.torso = mechRig.torso;
    this.leftGun = mechRig.leftGun;
    this.rightGun = mechRig.rightGun;
    this.thrusterGlow = mechRig.thrusterGlow;

    scene.add(this.root);
    this.reset();
  }

  public applyMetaUpgrades(): void {
    const armory = storageService.getData().armoryUpgrades;

    // Reset base stats
    this.stats.maxHp = 100 + (armory.vitality || 0) * 20;
    this.stats.currentHp = this.stats.maxHp;
    this.stats.maxShield = 50 + (armory.shield_capacity || 0) * 15;
    this.stats.currentShield = this.stats.maxShield;
    this.stats.damageMultiplier = 1.0 + (armory.firepower || 0) * 0.1;
    this.stats.magnetRadius = 5.5 + (armory.scrap_magnet || 0) * 1.5;
    this.stats.turretBuffMultiplier = 1.0 + (armory.turret_engineering || 0) * 0.15;
  }

  public reset(): void {
    this.x = 0;
    this.y = 0;
    this.z = 6;
    this.vx = 0;
    this.vz = 0;
    this.isDead = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.invulnerableTimer = 0;

    this.applyMetaUpgrades();
    this.root.position.set(this.x, this.y, this.z);
    this.root.visible = true;
    this.emitStatus();
  }

  public setMoveInput(x: number, y: number): void {
    this.moveInput.set(x, y);
  }

  public setAttackInput(attacking: boolean): void {
    this.isAttacking = attacking;
  }

  public triggerDash(): void {
    if (this.dashCooldownTimer > 0 || this.dashTimer > 0 || this.isDead) return;

    this.dashCooldownTimer = this.stats.dashCooldown;
    this.dashTimer = this.stats.dashDuration;

    if (this.moveInput.lengthSq() > 0.05) {
      this.dashDir.copy(this.moveInput).normalize();
    } else {
      this.dashDir.set(0, -1);
    }

    audioManager.playDash();
    sceneManager.getParticles().emitExplosion(this.x, 0.5, this.z, 12);
    eventBus.emit('player:dash', { x: this.x, z: this.z });

    if (this.stats.hasShockwaveDash) {
      sceneManager.triggerScreenShake(0.4, 0.2);
    }
  }

  public triggerShieldBarrier(): void {
    if (this.stats.currentShield < 20 || this.isDead) return;
    this.stats.currentShield -= 20;
    this.invulnerableTimer = 2.0;
    audioManager.playShieldHit();
    sceneManager.getParticles().emitSparks(this.x, 1.2, this.z, 16, 0x00d4ff);
    this.emitStatus();
  }

  public takeDamage(amount: number): void {
    if (this.isDead || this.invulnerableTimer > 0) return;

    const actualDamage = Math.max(1, Math.round(amount * (1 - this.stats.armorReduction)));
    this.shieldRechargeTimer = this.stats.shieldRechargeDelay;

    if (this.stats.currentShield > 0) {
      this.stats.currentShield = Math.max(0, this.stats.currentShield - actualDamage);
      audioManager.playShieldHit();
      sceneManager.getParticles().emitSparks(this.x, 1.2, this.z, 8, 0x00d4ff);
    } else {
      this.stats.currentHp = Math.max(0, this.stats.currentHp - actualDamage);
      audioManager.playExplosion(false);
      sceneManager.getParticles().emitSparks(this.x, 1.0, this.z, 12, 0xff2200);
      sceneManager.triggerScreenShake(0.4, 0.2);

      if (this.stats.currentHp <= 0) {
        this.die();
      }
    }

    this.emitStatus();
  }

  public heal(amount: number): void {
    if (this.isDead) return;
    this.stats.currentHp = Math.min(this.stats.maxHp, this.stats.currentHp + amount);
    this.emitStatus();
  }

  public revive(): void {
    this.isDead = false;
    this.stats.currentHp = Math.round(this.stats.maxHp * 0.5);
    this.stats.currentShield = this.stats.maxShield;
    this.invulnerableTimer = 3.0;
    this.root.visible = true;

    audioManager.playExplosion(true);
    sceneManager.getParticles().emitExplosion(this.x, 1.0, this.z, 30);
    sceneManager.triggerScreenShake(0.6, 0.4);
    eventBus.emit('player:revived', undefined);
    this.emitStatus();
  }

  private die(): void {
    this.isDead = true;
    this.root.visible = false;
    audioManager.playExplosion(true);
    sceneManager.getParticles().emitExplosion(this.x, 1.0, this.z, 32, true);
    eventBus.emit('player:died', undefined);
  }

  private emitStatus(): void {
    eventBus.emit('player:damaged', {
      currentHp: this.stats.currentHp,
      maxHp: this.stats.maxHp,
      currentShield: this.stats.currentShield,
      maxShield: this.stats.maxShield,
    });
  }

  public update(dt: number, enemies: Enemy[]): void {
    if (this.isDead) return;

    // Timers
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // Shield Recharge
    if (this.stats.currentShield < this.stats.maxShield) {
      if (this.shieldRechargeTimer > 0) {
        this.shieldRechargeTimer -= dt;
      } else {
        this.stats.currentShield = Math.min(
          this.stats.maxShield,
          this.stats.currentShield + this.stats.shieldRechargeRate * dt
        );
        this.emitStatus();
      }
    }

    // Movement & Dash
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDir.x * this.stats.dashSpeed;
      this.vz = this.dashDir.y * this.stats.dashSpeed;
      this.thrusterGlow.scale.set(2.5, 2.5, 2.5);
      sceneManager.getParticles().emitTrail(this.x, 0.4, this.z, 0x00d4ff);
    } else {
      const targetVx = this.moveInput.x * this.stats.speed;
      const targetVz = this.moveInput.y * this.stats.speed;
      this.vx = THREE.MathUtils.lerp(this.vx, targetVx, 0.25);
      this.vz = THREE.MathUtils.lerp(this.vz, targetVz, 0.25);
      this.thrusterGlow.scale.set(1.0, 1.0, 1.0);
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Arena boundary clamp
    this.x = Math.max(-28, Math.min(28, this.x));
    this.z = Math.max(-28, Math.min(28, this.z));

    this.root.position.set(this.x, this.y, this.z);

    // Chassis Rotation (facing movement)
    if (this.moveInput.lengthSq() > 0.05) {
      const moveAngle = Math.atan2(this.moveInput.x, this.moveInput.y);
      this.root.rotation.y = THREE.MathUtils.lerp(this.root.rotation.y, moveAngle, 0.15);
    }

    // Torso Aiming: automatically targets nearest active enemy
    const nearestEnemy = this.findNearestEnemy(enemies, 22.0);
    let aimAngle = this.root.rotation.y;

    if (nearestEnemy) {
      const dx = nearestEnemy.x - this.x;
      const dz = nearestEnemy.z - this.z;
      aimAngle = Math.atan2(dx, dz) - this.root.rotation.y;
    } else if (this.moveInput.lengthSq() > 0.05) {
      aimAngle = 0; // Aligns with legs
    }
    this.torso.rotation.y = THREE.MathUtils.lerp(this.torso.rotation.y, aimAngle, 0.25);

    // Firing autocannons / lasers
    const shouldFire = this.isAttacking || (nearestEnemy !== null && this.moveInput.lengthSq() > 0);
    if (shouldFire && this.attackCooldown <= 0) {
      this.fireWeapon(nearestEnemy);
    }

    // Magnet scrap pickup
    scrapPool.update(dt, this.x, this.z, this.stats.magnetRadius);
  }

  private fireWeapon(target: Enemy | null): void {
    const fireRate = this.BASE_FIRE_INTERVAL / this.stats.attackSpeedMultiplier;
    this.attackCooldown = fireRate;

    // Calculate bullet trajectory
    let dirX = 0;
    let dirZ = -1;

    if (target) {
      dirX = target.x - this.x;
      dirZ = target.z - this.z;
    } else {
      const totalAngle = this.root.rotation.y + this.torso.rotation.y;
      dirX = Math.sin(totalAngle);
      dirZ = Math.cos(totalAngle);
    }

    const isCrit = Math.random() < this.stats.critChance;
    const baseDamage = 25 * this.stats.damageMultiplier;
    const damage = Math.round(isCrit ? baseDamage * this.stats.critMultiplier : baseDamage);

    // Alternate left/right gun muzzle
    this.gunAlternate = !this.gunAlternate;
    const muzzleOffset = this.gunAlternate ? -0.7 : 0.7;
    const gunAngle = this.root.rotation.y + this.torso.rotation.y;
    const perpX = Math.cos(gunAngle) * muzzleOffset;
    const perpZ = -Math.sin(gunAngle) * muzzleOffset;

    const spawnX = this.x + perpX;
    const spawnY = 1.3;
    const spawnZ = this.z + perpZ;

    if (this.stats.hasPlasmaRounds) {
      projectilePool.spawn(spawnX, spawnY, spawnZ, dirX, dirZ, damage, isCrit, true, 'laser');
      audioManager.playLaser();
    } else {
      projectilePool.spawn(spawnX, spawnY, spawnZ, dirX, dirZ, damage, isCrit, true, 'bullet');
      audioManager.playAutocannon();
    }

    sceneManager.getParticles().emitSparks(spawnX, spawnY, spawnZ, 3, isCrit ? 0xff3300 : 0xffaa00);
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
}

export const player = Player.getInstance();
