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
import { ArenaBuilder, ExplosiveBarrel, SupplyCrate } from '../graphics/ArenaBuilder';

const _scratchSpawnPos = new THREE.Vector3();
const _scratchKnockback = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();

export class ZombieManager {
  public group = new THREE.Group();
  public zombies: Zombie[] = [];
  public boss: BossZombie | null = null;

  // Max active zombies for massive horde battles
  public maxConcurrentZombies = 180;

  public spawnZombie(
    type: ZombieType,
    playerPos: THREE.Vector3,
    hpMultiplier = 1.0,
    speedMultiplier = 1.0
  ): void {
    if (this.zombies.length >= this.maxConcurrentZombies) return;

    // Spawn at arena edge or off-screen radius
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 22;
    const sx = Math.max(-ARENA_HALF + 6, Math.min(ARENA_HALF - 6, playerPos.x + Math.sin(angle) * distance));
    const sz = Math.max(-ARENA_HALF + 6, Math.min(ARENA_HALF - 6, playerPos.z + Math.cos(angle) * distance));

    _scratchSpawnPos.set(sx, 0, sz);
    const zombie = new Zombie(type, _scratchSpawnPos, hpMultiplier, speedMultiplier);
    this.zombies.push(zombie);
    this.group.add(zombie.meshResult.root);
  }

  public spawnZombieBatch(
    type: ZombieType,
    playerPos: THREE.Vector3,
    count: number,
    hpMultiplier = 1.0,
    speedMultiplier = 1.0
  ): void {
    const baseAngle = Math.random() * Math.PI * 2;
    const distance = 32 + Math.random() * 18;

    for (let i = 0; i < count; i++) {
      if (this.zombies.length >= this.maxConcurrentZombies) break;
      const angle = baseAngle + (Math.random() - 0.5) * 0.8;
      const d = distance + (Math.random() - 0.5) * 6;
      const sx = Math.max(-ARENA_HALF + 6, Math.min(ARENA_HALF - 6, playerPos.x + Math.sin(angle) * d));
      const sz = Math.max(-ARENA_HALF + 6, Math.min(ARENA_HALF - 6, playerPos.z + Math.cos(angle) * d));

      _scratchSpawnPos.set(sx, 0, sz);
      const zombie = new Zombie(type, _scratchSpawnPos, hpMultiplier, speedMultiplier);
      this.zombies.push(zombie);
      this.group.add(zombie.meshResult.root);
    }
  }

  public spawnBoss(
    playerPos: THREE.Vector3,
    hpMultiplier = 1.0,
    speedMultiplier = 1.0,
    customName?: string
  ): void {
    if (this.boss && !this.boss.isDead) return;

    const angle = Math.random() * Math.PI * 2;
    _scratchSpawnPos.set(
      playerPos.x + Math.sin(angle) * 32,
      0,
      playerPos.z + Math.cos(angle) * 32
    );

    this.boss = new BossZombie(_scratchSpawnPos, hpMultiplier, speedMultiplier, customName);
    this.group.add(this.boss.meshResult.root);
  }

  public update(
    dt: number,
    playerCar: PlayerCar,
    projectileManager: ProjectileManager,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem,
    cameraController: CameraController,
    dynamicLights?: DynamicLightManager,
    arena?: ArenaBuilder
  ): void {
    const playerPos = playerCar.physics.position;
    const playerVel = playerCar.physics.velocity;
    const carSpeed = playerCar.physics.speed;
    const isDrifting = playerCar.physics.isDrifting;
    const isNitro = playerCar.physics.isNitroActive;
    const rageMult = playerCar.physics.driftMultiplier;
    const stats = gameStore.getEffectiveVehicleStats();

    // 1. Update Projectiles & Check Collisions with Zombies, Barrels, Crates
    projectileManager.update(dt, (proj) => {
      // Area of effect explosion
      particleSystem.emitExplosion(proj.position.x, proj.position.y, proj.position.z, 20);
      dynamicLights?.flash(proj.position.x, proj.position.y + 0.8, proj.position.z, 0xff7700, 3.5, 16, 6.0);
      audioManager.playExplosion();
      cameraController.addTrauma(0.25);

      // Damage all zombies in explosion radius
      this.damageInRadius(proj.position, proj.areaRadius, proj.damage, scrapManager, particleSystem);
      if (this.boss && !this.boss.isDead) {
        if (this.boss.position.distanceTo(proj.position) <= proj.areaRadius + 2.0) {
          this.damageBoss(proj.damage, scrapManager, particleSystem, cameraController, dynamicLights);
        }
      }

      // Check if explosion hits barrels
      if (arena) {
        for (let bi = 0; bi < arena.barrels.length; bi++) {
          const b = arena.barrels[bi];
          if (!b.exploded && b.position.distanceTo(proj.position) <= proj.areaRadius + 1.2) {
            this.explodeBarrel(b, scrapManager, particleSystem, cameraController, playerCar, dynamicLights, arena);
          }
        }
      }
    });

    // Direct projectile collision checks against zombies, barrels and crates
    const projs = projectileManager.projectiles;
    for (let pi = projs.length - 1; pi >= 0; pi--) {
      const proj = projs[pi];
      if (!proj.fromPlayer || proj.isExplosive) continue;

      let hit = false;
      const px = proj.position.x;
      const pz = proj.position.z;

      // Check vs Barrels
      if (arena) {
        for (let bi = 0; bi < arena.barrels.length; bi++) {
          const b = arena.barrels[bi];
          if (b.exploded) continue;
          const bdx = b.position.x - px;
          const bdz = b.position.z - pz;
          if (bdx * bdx + bdz * bdz < 1.2) {
            this.explodeBarrel(b, scrapManager, particleSystem, cameraController, playerCar, dynamicLights, arena);
            hit = true;
            break;
          }
        }
      }

      // Check vs Crates
      if (!hit && arena) {
        for (let ci = 0; ci < arena.crates.length; ci++) {
          const c = arena.crates[ci];
          if (c.destroyed) continue;
          const cdx = c.position.x - px;
          const cdz = c.position.z - pz;
          if (cdx * cdx + cdz * cdz < 1.4) {
            this.smashCrate(c, scrapManager, particleSystem);
            hit = true;
            break;
          }
        }
      }

      // Check vs Zombies
      if (!hit) {
        for (let zi = 0; zi < this.zombies.length; zi++) {
          const z = this.zombies[zi];
          if (z.isDead) continue;
          const dx = z.position.x - px;
          const dz = z.position.z - pz;
          const r = 1.3 * z.config.scale;
          if (dx * dx + dz * dz < r * r) {
            const died = z.takeDamage(proj.damage);
            particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 6);
            if (died) {
              this.handleZombieDeath(z, scrapManager, particleSystem);
            }
            hit = true;
            break;
          }
        }
      }

      if (!hit && this.boss && !this.boss.isDead) {
        const bdx = this.boss.position.x - px;
        const bdz = this.boss.position.z - pz;
        if (bdx * bdx + bdz * bdz < 6.25) {
          this.damageBoss(proj.damage, scrapManager, particleSystem, cameraController, dynamicLights);
          hit = true;
        }
      }

      if (hit) {
        projectileManager.deactivate(proj);
      }
    }

    // 2. Update Weapons
    _scratchForward.set(
      Math.sin(playerCar.physics.headingAngle),
      0,
      Math.cos(playerCar.physics.headingAngle)
    );

    playerCar.weapons.updateDirect(
      dt,
      playerPos,
      _scratchForward,
      playerCar.physics.headingAngle,
      isDrifting,
      rageMult,
      this.zombies,
      this.boss,
      (z, dmg) => {
        if (z.takeDamage(dmg)) {
          this.handleZombieDeath(z, scrapManager, particleSystem);
        }
      },
      (dmg) => {
        this.damageBoss(dmg, scrapManager, particleSystem, cameraController, dynamicLights);
      },
      projectileManager,
      particleSystem,
      dynamicLights
    );

    // 3. Update Zombies, AI, Obstacle Collisions & Toxic Pools
    const speedFactor = Math.min(1.5, carSpeed / Math.max(1, stats.topSpeed));
    const isRammingSpeed = carSpeed > 6.0 || isNitro;

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

      // Zombie vs Arena Solid Obstacles Collision Resolution
      if (arena) {
        const zRadius = 0.55 * z.config.scale;
        for (let oi = 0; oi < arena.obstacles.length; oi++) {
          const obs = arena.obstacles[oi];
          if (!obs.active) continue;

          if (obs.type === 'cylinder') {
            const rad = obs.radius || obs.width;
            const odx = z.position.x - obs.x;
            const odz = z.position.z - obs.z;
            const minDist = zRadius + rad;
            const dSq = odx * odx + odz * odz;
            if (dSq < minDist * minDist) {
              const d = Math.max(0.001, Math.sqrt(dSq));
              const pen = minDist - d;
              z.position.x += (odx / d) * pen;
              z.position.z += (odz / d) * pen;
            }
          } else {
            // Box obstacle OBB
            const cosR = Math.cos(-obs.rotation);
            const sinR = Math.sin(-obs.rotation);
            const relX = z.position.x - obs.x;
            const relZ = z.position.z - obs.z;
            const localX = relX * cosR - relZ * sinR;
            const localZ = relX * sinR + relZ * cosR;

            const hx = obs.width;
            const hz = obs.depth;

            const clampX = Math.max(-hx, Math.min(hx, localX));
            const clampZ = Math.max(-hz, Math.min(hz, localZ));

            const diffX = localX - clampX;
            const diffZ = localZ - clampZ;
            const dSq = diffX * diffX + diffZ * diffZ;

            if (dSq < zRadius * zRadius) {
              const d = Math.max(0.001, Math.sqrt(dSq));
              const pen = zRadius - d;
              const localNx = diffX / d;
              const localNz = diffZ / d;
              const cosW = Math.cos(obs.rotation);
              const sinW = Math.sin(obs.rotation);
              const wNx = localNx * cosW - localNz * sinW;
              const wNz = localNx * sinW + localNz * cosW;
              z.position.x += wNx * pen;
              z.position.z += wNz * pen;
            }
          }
        }
      }

      // Collision with Player Car
      const cdx = z.position.x - playerPos.x;
      const cdz = z.position.z - playerPos.z;
      const hitDistSq = cdx * cdx + cdz * cdz;
      const hitRadius = 1.9 * z.config.scale;

      if (hitDistSq < hitRadius * hitRadius) {
        if (isRammingSpeed) {
          // Ramming Impact with balanced scaling (2x debuffed)
          const driftBonus = isDrifting ? rageMult : 1.0;
          const nitroBonus = isNitro ? 1.5 : 1.0;
          const ramDmg = Math.floor(stats.ramDamage * (0.22 + speedFactor * 0.65) * driftBonus * nitroBonus);

          // Knockback vector
          const pSpeed = Math.max(1, playerVel.length());
          _scratchKnockback.set(
            (playerVel.x / pSpeed) * (8 + carSpeed * 0.3),
            2.5,
            (playerVel.z / pSpeed) * (8 + carSpeed * 0.3)
          );

          const died = z.takeDamage(ramDmg, _scratchKnockback);
          particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 12);
          particleSystem.emitSparks(z.position.x, z.position.y + 0.3, z.position.z, 5);
          dynamicLights?.flash(z.position.x, z.position.y + 0.4, z.position.z, 0xffa500, 1.8, 8, 16.0);
          audioManager.playRamImpact(Math.min(2.0, 0.6 + speedFactor));
          cameraController.addTrauma(0.08 * speedFactor);

          if (died) {
            this.handleZombieDeath(z, scrapManager, particleSystem);
          } else {
            // Recoil damage to player when hitting heavy tank or surviving zombie without nitro/high drift
            if (z.type === 'TANK' && !isNitro && carSpeed < 14) {
              playerCar.takeDamage(12);
            } else if (!isDrifting && !isNitro && carSpeed < 10) {
              playerCar.takeDamage(5);
            }
          }
        } else {
          // Slow car -> Zombie attacks
          if (z.attackTimer <= 0) {
            z.attackTimer = z.config.attackCooldown;
            playerCar.takeDamage(z.config.damage);
            cameraController.addTrauma(0.12);
          }
        }
      }
    }

    // 4. Update Boss
    if (this.boss && !this.boss.isDead) {
      this.boss.update(dt, playerPos, (slamPos) => {
        particleSystem.emitExplosion(slamPos.x, 0.4, slamPos.z, 30);
        dynamicLights?.flash(slamPos.x, 0.6, slamPos.z, 0xff1100, 4.0, 20, 4.5);
        audioManager.playExplosion();
        cameraController.addTrauma(0.4);

        if (playerPos.distanceTo(slamPos) < 9.0) {
          playerCar.takeDamage(35);
        }
      });

      // Boss Car Collision
      const bdx = this.boss.position.x - playerPos.x;
      const bdz = this.boss.position.z - playerPos.z;
      const bossDistSq = bdx * bdx + bdz * bdz;

      if (bossDistSq < 16.0) {
        if (carSpeed > 6.0 || isNitro) {
          const driftBonus = isDrifting ? rageMult : 1.0;
          const nitroBonus = isNitro ? 1.75 : 1.0;
          const ramDmg = Math.floor(stats.ramDamage * (0.5 + speedFactor * 0.75) * driftBonus * nitroBonus);

          this.damageBoss(ramDmg, scrapManager, particleSystem, cameraController, dynamicLights);
          playerCar.physics.velocity.x *= -0.3;
          playerCar.physics.velocity.z *= -0.3;
          cameraController.addTrauma(0.35);
        } else {
          playerCar.takeDamage(this.boss.config.damage * dt * 1.5);
        }
      }
    }
  }

  public explodeBarrel(
    barrel: ExplosiveBarrel,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem,
    cameraController: CameraController,
    playerCar: PlayerCar,
    dynamicLights?: DynamicLightManager,
    arena?: ArenaBuilder
  ): void {
    if (barrel.exploded) return;
    barrel.exploded = true;
    barrel.mesh.visible = false;
    barrel.obstacleRef.active = false;
    barrel.respawnTimer = 25.0;

    const bx = barrel.position.x;
    const bz = barrel.position.z;

    particleSystem.emitExplosion(bx, 0.6, bz, 36);
    dynamicLights?.flash(bx, 1.0, bz, 0xff4500, 4.5, 20, 4.0);
    audioManager.playExplosion();
    cameraController.addTrauma(0.4);

    // Massive AoE damage (180 dmg) to all zombies in 8.5m radius
    this.damageInRadius(barrel.position, 8.5, 180, scrapManager, particleSystem);

    if (this.boss && !this.boss.isDead) {
      if (this.boss.position.distanceTo(barrel.position) < 10.0) {
        this.damageBoss(90, scrapManager, particleSystem, cameraController, dynamicLights);
      }
    }

    // Car impact check
    const carDist = playerCar.physics.position.distanceTo(barrel.position);
    if (carDist < 6.5) {
      playerCar.takeDamage(12);
      playerCar.physics.velocity.x += (playerCar.physics.position.x - bx) * 2.0;
      playerCar.physics.velocity.z += (playerCar.physics.position.z - bz) * 2.0;
    }

    // Chain reaction with nearby barrels
    if (arena) {
      for (let bi = 0; bi < arena.barrels.length; bi++) {
        const other = arena.barrels[bi];
        if (!other.exploded && other.id !== barrel.id) {
          if (other.position.distanceTo(barrel.position) < 7.0) {
            setTimeout(() => {
              this.explodeBarrel(other, scrapManager, particleSystem, cameraController, playerCar, dynamicLights, arena);
            }, 120);
          }
        }
      }
    }
  }

  public smashCrate(
    crate: SupplyCrate,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem
  ): void {
    if (crate.destroyed) return;
    crate.destroyed = true;
    crate.mesh.visible = false;
    crate.obstacleRef.active = false;
    crate.respawnTimer = 35.0;

    particleSystem.emitWoodSplinters(crate.position.x, crate.position.y, crate.position.z, 16);
    audioManager.playCrateSmash();

    // Drop loot: 15-30 scrap gears and 45% chance for a repair health kit
    scrapManager.spawnScrap(crate.position, 18 + Math.floor(Math.random() * 12));
    if (Math.random() < 0.45) {
      scrapManager.spawnHealthPack(crate.position, 20);
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
      scrapManager.spawnScrap(this.boss.position, 80);
      scrapManager.spawnHealthPack(this.boss.position, 40);
      particleSystem.emitExplosion(this.boss.position.x, 1.5, this.boss.position.z, 50);
      dynamicLights?.flash(this.boss.position.x, 1.5, this.boss.position.z, 0xff2200, 5.0, 24, 3.0);
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
    const radSq = radius * radius;
    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (z.isDead) continue;
      const dx = z.position.x - pos.x;
      const dz = z.position.z - pos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= radSq) {
        const dist = Math.sqrt(distSq);
        const falloff = 1 - dist / radius;
        const dmg = Math.floor(damage * (0.5 + falloff * 0.5));
        _scratchKnockback.set(
          dist > 0.001 ? (dx / dist) * (7 * falloff) : 0,
          2.5,
          dist > 0.001 ? (dz / dist) * (7 * falloff) : 0
        );
        if (z.takeDamage(dmg, _scratchKnockback)) {
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

    // Drop Scrap & Health Packs
    const scrapCount = Math.floor(
      z.config.scrapDropMin + Math.random() * (z.config.scrapDropMax - z.config.scrapDropMin + 1)
    );
    scrapManager.spawnScrap(z.position, scrapCount);

    if (Math.random() < 0.05 || z.type === 'TANK') {
      scrapManager.spawnHealthPack(z.position, z.type === 'TANK' ? 25 : 15);
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
