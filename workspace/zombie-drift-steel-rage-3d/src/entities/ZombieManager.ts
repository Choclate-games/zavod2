import * as THREE from 'three';
import { Zombie } from './Zombie';
import { BossZombie } from './BossZombie';
import { ZombieType } from '../types/zombie';
import { PlayerCar } from './PlayerCar';
import { ProjectileManager } from './Projectile';
import { ScrapManager } from './ScrapDrop';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { CameraController } from '../graphics/CameraController';
import { DynamicLightManager } from '../graphics/DynamicLightManager';
import { gameStore } from '../core/Store';
import { audioManager } from '../core/AudioManager';
import { eventBus } from '../core/EventBus';
import { ARENA_HALF } from '../core/Constants';

export class ZombieManager {
  public group = new THREE.Group();
  public zombies: Zombie[] = [];
  public boss: BossZombie | null = null;

  public maxConcurrentZombies = 80;

  public spawnZombie(type: ZombieType, playerPos: THREE.Vector3): void {
    if (this.zombies.length >= this.maxConcurrentZombies) return;

    // Spawn at arena edge or off-screen radius
    const angle = Math.random() * Math.PI * 2;
    const distance = 35 + Math.random() * 25;
    const sx = Math.max(-ARENA_HALF + 5, Math.min(ARENA_HALF - 5, playerPos.x + Math.sin(angle) * distance));
    const sz = Math.max(-ARENA_HALF + 5, Math.min(ARENA_HALF - 5, playerPos.z + Math.cos(angle) * distance));

    const spawnPos = new THREE.Vector3(sx, 0, sz);
    const zombie = new Zombie(type, spawnPos);
    this.zombies.push(zombie);
    this.group.add(zombie.meshResult.root);
  }

  public spawnBoss(playerPos: THREE.Vector3): void {
    if (this.boss && !this.boss.isDead) return;

    const angle = Math.random() * Math.PI * 2;
    const spawnPos = new THREE.Vector3(
      playerPos.x + Math.sin(angle) * 35,
      0,
      playerPos.z + Math.cos(angle) * 35
    );

    this.boss = new BossZombie(spawnPos);
    this.group.add(this.boss.meshResult.root);
  }

  public update(
    dt: number,
    playerCar: PlayerCar,
    projectileManager: ProjectileManager,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem,
    cameraController: CameraController,
    dynamicLights?: DynamicLightManager
  ): void {
    const playerPos = playerCar.physics.position;
    const playerVel = playerCar.physics.velocity;
    const carSpeed = playerCar.physics.speed;
    const isDrifting = playerCar.physics.isDrifting;
    const isNitro = playerCar.physics.isNitroActive;
    const rageMult = playerCar.physics.driftMultiplier;
    const stats = gameStore.getEffectiveVehicleStats();

    // 1. Update Projectiles & Check Collisions with Zombies
    projectileManager.update(dt, (proj) => {
      // Area of effect explosion
      particleSystem.emitExplosion(proj.position.x, proj.position.y, proj.position.z, 20);
      dynamicLights?.flash(proj.position.x, proj.position.y + 0.8, proj.position.z, 0xff7700, 3.8, 18, 5.5);
      audioManager.playExplosion();
      cameraController.addTrauma(0.25);

      // Damage all zombies in explosion radius
      this.damageInRadius(proj.position, proj.areaRadius, proj.damage, scrapManager, particleSystem);
      if (this.boss && !this.boss.isDead) {
        if (this.boss.position.distanceTo(proj.position) <= proj.areaRadius + 2.0) {
          this.damageBoss(proj.damage, scrapManager, particleSystem, cameraController, dynamicLights);
        }
      }
    });

    // Check direct bullet hits on zombies
    for (let pi = projectileManager.projectiles.length - 1; pi >= 0; pi--) {
      const proj = projectileManager.projectiles[pi];
      if (!proj.fromPlayer || proj.isExplosive) continue;

      let hit = false;
      for (const z of this.zombies) {
        if (z.isDead) continue;
        if (z.position.distanceTo(proj.position) < 1.4 * z.config.scale) {
          const died = z.takeDamage(proj.damage);
          particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 6);
          if (died) {
            this.handleZombieDeath(z, scrapManager, particleSystem);
          }
          hit = true;
          break;
        }
      }

      if (!hit && this.boss && !this.boss.isDead) {
        if (this.boss.position.distanceTo(proj.position) < 2.5) {
          this.damageBoss(proj.damage, scrapManager, particleSystem, cameraController, dynamicLights);
          hit = true;
        }
      }

      if (hit) {
        projectileManager.removeProjectile(pi);
      }
    }

    // 2. Update Weapons
    const activeEnemies: { position: THREE.Vector3; health: number; takeDamage: (dmg: number) => void }[] = [];
    this.zombies.forEach((z) => {
      if (!z.isDead) {
        activeEnemies.push({
          position: z.position,
          health: z.health,
          takeDamage: (dmg) => {
            if (z.takeDamage(dmg)) {
              this.handleZombieDeath(z, scrapManager, particleSystem);
            }
          },
        });
      }
    });

    if (this.boss && !this.boss.isDead) {
      activeEnemies.push({
        position: this.boss.position,
        health: this.boss.health,
        takeDamage: (dmg) => {
          this.damageBoss(dmg, scrapManager, particleSystem, cameraController, dynamicLights);
        },
      });
    }

    const forward = new THREE.Vector3(
      Math.sin(playerCar.physics.headingAngle),
      0,
      Math.cos(playerCar.physics.headingAngle)
    );

    playerCar.weapons.update(
      dt,
      playerPos,
      forward,
      isDrifting,
      rageMult,
      activeEnemies,
      projectileManager,
      particleSystem,
      dynamicLights
    );

    // 3. Update Zombies & Car Ramming Collisions
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.isDead) {
        this.group.remove(z.meshResult.root);
        this.zombies.splice(i, 1);
        continue;
      }

      // Update AI
      z.update(dt, playerPos, (origin, target, dmg) => {
        projectileManager.spawnAcidGlob(origin, target, dmg);
      });

      // Collision with Player Car
      const distToCar = z.position.distanceTo(playerPos);
      const hitThreshold = 1.8 * z.config.scale;

      if (distToCar < hitThreshold) {
        if (carSpeed > 5.5 || isNitro) {
          // Ramming Impact!
          const speedFactor = carSpeed / stats.topSpeed;
          const driftBonus = isDrifting ? rageMult : 1.0;
          const nitroBonus = isNitro ? 2.2 : 1.0;
          const ramDmg = Math.floor(stats.ramDamage * (0.6 + speedFactor * 0.9) * driftBonus * nitroBonus);

          // Knockback vector
          const knockback = playerVel.clone().normalize().multiplyScalar(15 + carSpeed * 0.5);
          knockback.y = 4.0;

          const died = z.takeDamage(ramDmg, knockback);
          particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 14);
          particleSystem.emitSparks(z.position.x, z.position.y + 0.3, z.position.z, 6);
          dynamicLights?.flash(z.position.x, z.position.y + 0.4, z.position.z, 0xffa500, 1.8, 9, 16.0);
          audioManager.playRamImpact(Math.min(2.0, speedFactor * 1.5));
          cameraController.addTrauma(0.12 * speedFactor);

          if (died) {
            this.handleZombieDeath(z, scrapManager, particleSystem);
          } else {
            // Recoil damage to player if hitting heavy tank at low speed
            if (z.type === 'TANK' && !isNitro) {
              playerCar.takeDamage(12);
            }
          }
        } else {
          // Slow car -> Zombie attacks
          if (z.attackTimer <= 0) {
            z.attackTimer = z.config.attackCooldown;
            playerCar.takeDamage(z.config.damage);
            cameraController.addTrauma(0.1);
          }
        }
      }
    }

    // 4. Update Boss
    if (this.boss && !this.boss.isDead) {
      this.boss.update(dt, playerPos, (slamPos) => {
        // Boss Ground Slam Shockwave
        particleSystem.emitExplosion(slamPos.x, 0.4, slamPos.z, 30);
        dynamicLights?.flash(slamPos.x, 0.6, slamPos.z, 0xff1100, 4.5, 22, 4.5);
        audioManager.playExplosion();
        cameraController.addTrauma(0.4);

        if (playerPos.distanceTo(slamPos) < 9.0) {
          playerCar.takeDamage(40);
        }
      });

      // Boss Car Collision
      const distToBoss = this.boss.position.distanceTo(playerPos);
      if (distToBoss < 3.8) {
        if (carSpeed > 8.0 || isNitro) {
          const speedFactor = carSpeed / stats.topSpeed;
          const driftBonus = isDrifting ? rageMult : 1.0;
          const nitroBonus = isNitro ? 2.5 : 1.0;
          const ramDmg = Math.floor(stats.ramDamage * (0.8 + speedFactor) * driftBonus * nitroBonus);

          this.damageBoss(ramDmg, scrapManager, particleSystem, cameraController, dynamicLights);
          playerCar.physics.velocity.multiplyScalar(-0.4);
          cameraController.addTrauma(0.35);
        } else {
          playerCar.takeDamage(this.boss.config.damage * dt * 2.0);
        }
      }
    }
  }

  private damageBoss(
    dmg: number,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem,
    cameraController: CameraController,
    dynamicLights?: DynamicLightManager
  ): void {
    if (!this.boss || this.boss.isDead) return;

    particleSystem.emitBloodSplatter(this.boss.position.x, this.boss.position.y + 1.2, this.boss.position.z, 16);
    particleSystem.emitSparks(this.boss.position.x, this.boss.position.y + 1.0, this.boss.position.z, 10);
    dynamicLights?.flash(this.boss.position.x, this.boss.position.y + 1.0, this.boss.position.z, 0xff0044, 2.5, 12, 12.0);
    audioManager.playRamImpact(1.8);

    const died = this.boss.takeDamage(dmg);
    if (died) {
      gameStore.run.stats.bossesDefeated += 1;
      gameStore.addXp(this.boss.config.xpValue);
      scrapManager.spawnScrap(this.boss.position, 60);
      scrapManager.spawnHealthPack(this.boss.position, 100);
      particleSystem.emitExplosion(this.boss.position.x, 1.5, this.boss.position.z, 50);
      dynamicLights?.flash(this.boss.position.x, 1.5, this.boss.position.z, 0xff2200, 6.0, 26, 3.0);
      cameraController.addTrauma(0.6);
      eventBus.emit('SLOW_MO_START', { duration: 1.5, scale: 0.25 });
    }
  }

  private damageInRadius(
    pos: THREE.Vector3,
    radius: number,
    damage: number,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem
  ): void {
    for (const z of this.zombies) {
      if (z.isDead) continue;
      const dist = z.position.distanceTo(pos);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        const dmg = Math.floor(damage * (0.5 + falloff * 0.5));
        const knock = z.position.clone().sub(pos).normalize().multiplyScalar(12 * falloff);
        knock.y = 4.0;
        if (z.takeDamage(dmg, knock)) {
          this.handleZombieDeath(z, scrapManager, particleSystem);
        }
      }
    }
  }

  private handleZombieDeath(
    z: Zombie,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem
  ): void {
    gameStore.run.stats.zombiesKilled += 1;
    gameStore.addXp(z.config.xpValue);

    // Drop Scrap & Rare Health
    const scrapCount = Math.floor(
      z.config.scrapDropMin + Math.random() * (z.config.scrapDropMax - z.config.scrapDropMin + 1)
    );
    scrapManager.spawnScrap(z.position, scrapCount);

    if (Math.random() < 0.08 || z.type === 'TANK') {
      scrapManager.spawnHealthPack(z.position, 35);
    }

    particleSystem.emitBloodSplatter(z.position.x, 0.4, z.position.z, 16);
    audioManager.playSplatter();
    eventBus.emit('ZOMBIE_KILLED', { type: z.type });
  }

  public clear(): void {
    for (const z of this.zombies) {
      this.group.remove(z.meshResult.root);
    }
    this.zombies = [];
    if (this.boss) {
      this.group.remove(this.boss.meshResult.root);
      this.boss = null;
    }
  }
}
