import { Barrel } from '../entities/Barrel';
import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { EntityManager } from '../entities/EntityManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { AudioManager } from '../audio/AudioManager';
import { SceneManager } from '../rendering/SceneManager';
import { GameRunModifiers } from '../types';

export class CombatSystem {
  private static instance: CombatSystem;
  private bus: EventBus;
  private entityMgr: EntityManager;
  private particleMgr: ParticleSystem;
  private audioMgr: AudioManager;
  private sceneMgr: SceneManager;

  // Combo system
  public comboStreak = 0;
  public comboTimer = 0;
  public readonly MAX_COMBO_TIME = 3.0;

  // Run modifiers
  public modifiers: GameRunModifiers = {
    kickLaunchBonus: 0,
    ricochetCount: 0,
    ricochetDamageRatio: 0.6,
    gunpowderCatchExplosion: false,
    sonicSlideKick: false,
    kineticCollapseExplosion: false,
    ammoScavengeBonus: 0,
    extraPerkCount: 0,
  };

  private constructor() {
    this.bus = EventBus.getInstance();
    this.entityMgr = EntityManager.getInstance();
    this.particleMgr = ParticleSystem.getInstance();
    this.audioMgr = AudioManager.getInstance();
    this.sceneMgr = SceneManager.getInstance();

    this.bus.on('enemy:killed', ({ position, byKick, isWallSplat }) => {
      this.handleEnemyKilled(position, byKick, isWallSplat);
    });
  }

  public static getInstance(): CombatSystem {
    if (!CombatSystem.instance) {
      CombatSystem.instance = new CombatSystem();
    }
    return CombatSystem.instance;
  }

  public reset(): void {
    this.comboStreak = 0;
    this.comboTimer = 0;
    this.modifiers = {
      kickLaunchBonus: 0,
      ricochetCount: 0,
      ricochetDamageRatio: 0.6,
      gunpowderCatchExplosion: false,
      sonicSlideKick: false,
      kineticCollapseExplosion: false,
      ammoScavengeBonus: 0,
      extraPerkCount: 0,
    };
  }

  public update(dt: number): void {
    // 1. Update Combo decay
    if (this.comboStreak > 0) {
      this.comboTimer -= dt;
      const ratio = Math.max(0, this.comboTimer / this.MAX_COMBO_TIME);
      const mult = 1 + this.comboStreak * 0.25;

      this.bus.emit('combo:updated', {
        streak: this.comboStreak,
        multiplier: mult,
        timeLeftRatio: ratio,
      });

      if (this.comboTimer <= 0) {
        this.comboStreak = 0;
      }
    }

    // 2. Projectile Collisions
    this.checkProjectileCollisions();

    // 3. Barrel Collisions & Explosions
    this.checkBarrelCollisions();
  }

  private checkProjectileCollisions(): void {
    const projectiles = this.entityMgr.projectiles;
    const player = this.entityMgr.player;
    const enemies = this.entityMgr.enemies;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.isDead) continue;

      if (p.team === 'ENEMY') {
        // Check Player Hit
        if (p.position.distanceTo(player.position) < player.body.radius + p.radius) {
          player.takeDamage(p.damage * p.damageMultiplier);
          this.particleMgr.spawnSparks(p.position, 6, 0xff0000);
          p.isDead = true;
          continue;
        }
      } else {
        // Check Enemies Hit
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (e.isDead) continue;

          if (p.position.distanceTo(e.position) < e.body.radius + p.radius) {
            const finalDmg = p.damage * p.damageMultiplier;
            e.takeDamage(finalDmg, p.damageMultiplier > 1.5);
            this.particleMgr.spawnSparks(p.position, 8, 0xffcc00);
            this.audioMgr.playKickHit(false);
            p.isDead = true;
            break;
          }
        }
      }
    }
  }

  private checkBarrelCollisions(): void {
    const barrels = this.entityMgr.barrels;
    const enemies = this.entityMgr.enemies;
    const player = this.entityMgr.player;

    for (let i = 0; i < barrels.length; i++) {
      const b = barrels[i];
      if (b.isDead) continue;

      const speed = b.velocity.length();
      if (speed > 8.0) {
        // Check collision with enemies
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (e.isDead) continue;

          if (b.position.distanceTo(e.position) < 1.4) {
            this.detonateBarrel(b);
            break;
          }
        }
      }
    }
  }

  public detonateBarrel(barrel: Barrel): void {
    if (barrel.isDead) return;
    barrel.destroy(this.entityMgr.scene!);

    const pos = barrel.position;
    const blastRadius = 4.6; // deflected_blast_radius = 4.6m
    const baseDamage = 180 * barrel.damageMultiplier;

    this.particleMgr.spawnExplosion(pos, blastRadius);
    this.audioMgr.playExplosion();
    this.bus.emit('camera:shake', { intensity: 0.8, durationSec: 0.35 });
    this.bus.emit('hitstop:trigger', { durationSec: 0.06 });

    // Damage enemies in blast radius
    for (const enemy of this.entityMgr.enemies) {
      const dist = enemy.position.distanceTo(pos);
      if (dist <= blastRadius) {
        const falloff = 1 - dist / blastRadius;
        enemy.takeDamage(baseDamage * falloff, true);
        const knockDir = enemy.position.clone().sub(pos).normalize().setY(0.4);
        enemy.launchRagdoll(knockDir.multiplyScalar(20.0 * falloff));
      }
    }

    // Damage player if in blast radius (unless invulnerable)
    const pDist = this.entityMgr.player.position.distanceTo(pos);
    if (pDist <= blastRadius && this.entityMgr.player.invulnerabilityTimer <= 0) {
      const falloff = 1 - pDist / blastRadius;
      this.entityMgr.player.takeDamage(45 * falloff);
    }
  }

  private handleEnemyKilled(position: [number, number, number], byKick: boolean, isWallSplat: boolean): void {
    // 1. Combo streak increment
    this.comboStreak++;
    this.comboTimer = this.MAX_COMBO_TIME;
    const multiplier = 1 + this.comboStreak * 0.25;

    // 2. Score & Scrap calculation
    const baseScore = isWallSplat ? 250 : byKick ? 150 : 100;
    const totalScoreAdd = Math.round(baseScore * multiplier);
    const scrapAdd = isWallSplat ? 5 : byKick ? 3 : 2;

    this.bus.emit('score:added', {
      amount: totalScoreAdd,
      scrapAdded: scrapAdd,
      totalScore: 0, // Handled in GameStore
    });

    // 3. Ammo Scavenge Chance: clamp(0.20 + streak * 0.08, 0.20, 0.85)
    const scavengeChance = Math.min(0.85, Math.max(0.2, 0.2 + this.comboStreak * 0.08 + this.modifiers.ammoScavengeBonus));
    if (Math.random() < scavengeChance) {
      const posVec = new THREE.Vector3(position[0], position[1] + 0.5, position[2]);
      const player = this.entityMgr.player;
      player.currentAmmo = Math.min(player.currentAmmo + 4, 30);
      this.bus.emit('ui:floatingText', {
        text: '+AMMO',
        color: '#00ffcc',
        scale: 1.2,
        worldPos: [posVec.x, posVec.y + 0.8, posVec.z],
        duration: 0.9,
      });
    }

    // 4. Kinetic collapse perk explosion
    if (isWallSplat && this.modifiers.kineticCollapseExplosion) {
      const posVec = new THREE.Vector3(position[0], position[1], position[2]);
      this.particleMgr.spawnExplosion(posVec, 3.5);
      this.audioMgr.playExplosion();
      for (const nearby of this.entityMgr.enemies) {
        if (!nearby.isDead && nearby.position.distanceTo(posVec) <= 3.5) {
          nearby.takeDamage(150, true);
        }
      }
    }
  }
}
