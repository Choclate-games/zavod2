import * as THREE from 'three';
import { Zombie } from './Zombie';
import { BossZombie } from './BossZombie';
import { ZombieType, BossType } from '../types/zombie';
import { PlayerCar } from './PlayerCar';
import { ProjectileManager } from './Projectile';
import { ScrapManager } from './ScrapDrop';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { RagdollSystem, DeathType } from '../graphics/RagdollSystem';
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
  public ragdolls: RagdollSystem;

  // Max active zombies for massive horde battles
  public maxConcurrentZombies = 180;

  constructor() {
    this.ragdolls = new RagdollSystem();
    this.group.add(this.ragdolls.group);
  }

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
    customName?: string,
    bossType: BossType = 'BOSS_GOLIATH'
  ): void {
    if (this.boss && !this.boss.isDead) return;

    const angle = Math.random() * Math.PI * 2;
    _scratchSpawnPos.set(
      playerPos.x + Math.sin(angle) * 32,
      0,
      playerPos.z + Math.cos(angle) * 32
    );

    this.boss = new BossZombie(_scratchSpawnPos, hpMultiplier, speedMultiplier, customName, bossType);
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

    // 0. Update Ragdoll Physics Simulation
    this.ragdolls.update(dt, particleSystem);

    // 1. Update Projectiles & Check Collisions with Zombies, Barrels, Crates
    projectileManager.update(dt, (proj) => {
      // Area of effect explosion
      particleSystem.emitExplosion(proj.position.x, proj.position.y, proj.position.z, 20);
      dynamicLights?.flash(proj.position.x, proj.position.y + 0.8, proj.position.z, 0xff7700, 3.5, 16, 6.0);
      audioManager.playExplosion();
      cameraController.addTrauma(0.25);

      // Damage all zombies in explosion radius
      this.damageInRadius(proj.position, proj.areaRadius, proj.damage, scrapManager, particleSystem, 'EXPLOSION');
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
            const isToxic = z.type === 'SPITTER';
            const died = z.takeDamage(proj.damage);
            particleSystem.emitBloodSpurt(z.position.x, z.position.y + 0.5, z.position.z, proj.velocity, 16, isToxic);
            particleSystem.emitBloodMist(z.position.x, z.position.y + 0.5, z.position.z, 4, isToxic);
            particleSystem.emitBloodSplatter(z.position.x, z.position.y + 0.5, z.position.z, 10, isToxic);
            if (died) {
              this.handleZombieDeath(z, scrapManager, particleSystem, proj.velocity, 'BULLET');
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
          const deathType: DeathType = playerCar.weapons.weapons.has('SIDE_BUZZSAWS') ? 'SAW'
            : playerCar.weapons.weapons.has('FLAMETHROWER') ? 'FIRE'
            : playerCar.weapons.weapons.has('SHOCK_RING') ? 'SHOCK' : 'BULLET';
          this.handleZombieDeath(z, scrapManager, particleSystem, playerVel, deathType);
        }
      },
      (dmg) => {
        this.damageBoss(dmg, scrapManager, particleSystem, cameraController, dynamicLights);
      },
      projectileManager,
      particleSystem,
      dynamicLights
    );

    // 3. Update Zombies, AI, Obstacle Collisions & Ramming
    const speedFactor = Math.min(1.5, carSpeed / Math.max(1, stats.topSpeed));
    const isRammingSpeed = carSpeed > 6.0 || isNitro;

    // Vehicle collision geometry (OBB)
    const carHeading = playerCar.physics.headingAngle;
    const sinCar = Math.sin(carHeading);
    const cosCar = Math.cos(carHeading);
    const carHalfWidth = 1.15;
    const carHalfLength = 2.2;

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
              z.meshResult.root.position.copy(z.position);
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
              z.meshResult.root.position.copy(z.position);
            }
          }
        }
      }

      // Precise Solid Oriented Bounding Box (OBB) Car Collision Resolution
      const cdx = z.position.x - playerPos.x;
      const cdz = z.position.z - playerPos.z;

      // Transform world delta into car local coordinates
      const locX = -cdx * cosCar + cdz * sinCar; // Right axis
      const locZ = cdx * sinCar + cdz * cosCar;  // Forward axis

      const zRadius = (z.type === 'TANK' ? 0.85 : 0.55) * z.config.scale;
      const boundX = carHalfWidth + zRadius;
      const boundZ = carHalfLength + zRadius;

      const isCarColliding = Math.abs(locX) < boundX && Math.abs(locZ) < boundZ;

      if (isCarColliding) {
        // Resolve penetration immediately: push zombie out to exterior perimeter
        const penX = boundX - Math.abs(locX);
        const penZ = boundZ - Math.abs(locZ);

        let pushLocX = locX;
        let pushLocZ = locZ;

        if (penX < penZ) {
          pushLocX = (locX >= 0 ? 1 : -1) * boundX;
        } else {
          pushLocZ = (locZ >= 0 ? 1 : -1) * boundZ;
        }

        // Convert resolved position back to world coordinates
        z.position.x = playerPos.x - pushLocX * cosCar + pushLocZ * sinCar;
        z.position.z = playerPos.z + pushLocX * sinCar + pushLocZ * cosCar;
        z.meshResult.root.position.copy(z.position);

        if (isRammingSpeed) {
          // Ramming Impact with balanced scaling
          const driftBonus = isDrifting ? rageMult : 1.0;
          const nitroBonus = isNitro ? 1.5 : 1.0;
          const ramDmg = Math.floor(stats.ramDamage * (0.22 + speedFactor * 0.65) * driftBonus * nitroBonus);

          // Knockback vector in direction of vehicle velocity / heading
          const pSpeed = Math.max(1, playerVel.length());
          _scratchKnockback.set(
            (playerVel.x / pSpeed) * (10 + carSpeed * 0.4),
            3.2,
            (playerVel.z / pSpeed) * (10 + carSpeed * 0.4)
          );

          const isToxic = z.type === 'SPITTER';
          const died = z.takeDamage(ramDmg, _scratchKnockback);
          particleSystem.emitBloodBurst(z.position.x, z.position.y + 0.5, z.position.z, 26, 1.25, isToxic);
          particleSystem.emitBloodSpurt(z.position.x, z.position.y + 0.5, z.position.z, playerVel, 18, isToxic);
          particleSystem.emitBloodMist(z.position.x, z.position.y + 0.5, z.position.z, 6, isToxic);
          particleSystem.emitBloodChunks(z.position.x, z.position.y + 0.5, z.position.z, 8, _scratchKnockback);
          particleSystem.emitSparks(z.position.x, z.position.y + 0.3, z.position.z, 6);
          dynamicLights?.flash(z.position.x, z.position.y + 0.4, z.position.z, 0xffa500, 1.8, 8, 16.0);
          audioManager.playRamImpact(Math.min(2.0, 0.6 + speedFactor));
          cameraController.addTrauma(0.08 * speedFactor);

          if (died) {
            this.handleZombieDeath(z, scrapManager, particleSystem, _scratchKnockback, 'RAM');
          } else {
            // Recoil damage to player when hitting heavy tank or slow collision
            if (z.type === 'TANK' && !isNitro && carSpeed < 14) {
              playerCar.takeDamage(12);
            } else if (!isDrifting && !isNitro && carSpeed < 10) {
              playerCar.takeDamage(5);
            }
          }
        } else {
          // Slow car -> Zombie attacks from the exterior
          if (z.attackTimer <= 0) {
            z.attackTimer = z.config.attackCooldown;
            playerCar.takeDamage(z.config.damage);
            cameraController.addTrauma(0.12);
          }
        }
      }
    }

    // 3.5. Zombie-to-Zombie Crowd Separation & Flocking
    const zLen = this.zombies.length;
    for (let i = 0; i < zLen; i++) {
      const z1 = this.zombies[i];
      if (z1.isDead) continue;
      for (let j = i + 1; j < zLen; j++) {
        const z2 = this.zombies[j];
        if (z2.isDead) continue;
        const sepX = z2.position.x - z1.position.x;
        const sepZ = z2.position.z - z1.position.z;
        const minDist = 0.95 * ((z1.config.scale + z2.config.scale) * 0.5);
        const distSq = sepX * sepX + sepZ * sepZ;
        if (distSq < minDist * minDist && distSq > 0.0001) {
          const d = Math.sqrt(distSq);
          const push = (minDist - d) * 0.45;
          const nx = sepX / d;
          const nz = sepZ / d;
          z1.position.x -= nx * push;
          z1.position.z -= nz * push;
          z2.position.x += nx * push;
          z2.position.z += nz * push;
          z1.meshResult.root.position.copy(z1.position);
          z2.meshResult.root.position.copy(z2.position);
        }
      }
    }

    // 4. Update Boss & Specialized Attacks
    if (this.boss && !this.boss.isDead) {
      this.boss.update(
        dt,
        playerPos,
        (slamPos, bossType) => {
          // Unique Shockwave Visuals per Boss Archetype
          if (bossType === 'BOSS_TOXIC_BEHEMOTH') {
            particleSystem.emitAcidSplash(slamPos.x, 0.5, slamPos.z, 24);
            dynamicLights?.flash(slamPos.x, 0.8, slamPos.z, 0x76ff03, 4.0, 20, 4.5);
          } else if (bossType === 'BOSS_INFERNO_TITAN' || bossType === 'BOSS_ASHEN_OVERLORD') {
            particleSystem.emitExplosion(slamPos.x, 0.5, slamPos.z, 36);
            particleSystem.emitFlameStream(slamPos, new THREE.Vector3(1, 0, 0), 4);
            particleSystem.emitFlameStream(slamPos, new THREE.Vector3(-1, 0, 0), 4);
            dynamicLights?.flash(slamPos.x, 0.8, slamPos.z, 0xff3300, 4.5, 22, 4.0);
          } else if (bossType === 'BOSS_CYBER_REAPER') {
            particleSystem.emitLightningArc(slamPos, new THREE.Vector3(slamPos.x + 4, 0.5, slamPos.z), 5);
            particleSystem.emitLightningArc(slamPos, new THREE.Vector3(slamPos.x - 4, 0.5, slamPos.z), 5);
            dynamicLights?.flash(slamPos.x, 0.8, slamPos.z, 0x00f0ff, 4.0, 20, 6.0);
          } else if (bossType === 'BOSS_STORM_BRINGER') {
            particleSystem.emitLightningArc(slamPos, new THREE.Vector3(slamPos.x + 5, 0.5, slamPos.z + 5), 6);
            particleSystem.emitLightningArc(slamPos, new THREE.Vector3(slamPos.x - 5, 0.5, slamPos.z - 5), 6);
            dynamicLights?.flash(slamPos.x, 0.8, slamPos.z, 0x48cae4, 4.5, 24, 5.0);
          } else if (bossType === 'BOSS_APOCALYPSE_LORD') {
            particleSystem.emitExplosion(slamPos.x, 0.5, slamPos.z, 40);
            dynamicLights?.flash(slamPos.x, 0.8, slamPos.z, 0x9d4edd, 5.0, 28, 3.0);
          } else {
            particleSystem.emitExplosion(slamPos.x, 0.5, slamPos.z, 30);
            dynamicLights?.flash(slamPos.x, 0.6, slamPos.z, 0xff1100, 4.0, 20, 4.5);
          }

          audioManager.playExplosion();
          cameraController.addTrauma(0.42);

          if (playerPos.distanceTo(slamPos) < 9.5) {
            playerCar.takeDamage(38);
          }
        },
        projectileManager,
        (pos) => {
          // Boss Summons Minion Reinforcements
          this.spawnZombieBatch('TANK', pos, 2, 1.2, 1.1);
          this.spawnZombieBatch('RUNNER', pos, 3, 1.2, 1.2);
          particleSystem.emitExplosion(pos.x, 1.0, pos.z, 20);
        }
      );

      // Boss vs Car Solid Collision Resolution (OBB)
      const bdx = this.boss.position.x - playerPos.x;
      const bdz = this.boss.position.z - playerPos.z;
      const bLocX = -bdx * cosCar + bdz * sinCar;
      const bLocZ = bdx * sinCar + bdz * cosCar;

      const bossRadius = 1.75 * this.boss.config.scale;
      const bossBoundX = carHalfWidth + bossRadius;
      const bossBoundZ = carHalfLength + bossRadius;

      if (Math.abs(bLocX) < bossBoundX && Math.abs(bLocZ) < bossBoundZ) {
        // Push boss outside car perimeter
        const bPenX = bossBoundX - Math.abs(bLocX);
        const bPenZ = bossBoundZ - Math.abs(bLocZ);

        let pushBLocX = bLocX;
        let pushBLocZ = bLocZ;

        if (bPenX < bPenZ) {
          pushBLocX = (bLocX >= 0 ? 1 : -1) * bossBoundX;
        } else {
          pushBLocZ = (bLocZ >= 0 ? 1 : -1) * bossBoundZ;
        }

        this.boss.position.x = playerPos.x - pushBLocX * cosCar + pushBLocZ * sinCar;
        this.boss.position.z = playerPos.z + pushBLocX * sinCar + pushBLocZ * cosCar;
        this.boss.meshResult.root.position.copy(this.boss.position);

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
    this.damageInRadius(barrel.position, 8.5, 180, scrapManager, particleSystem, 'EXPLOSION');

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

    particleSystem.emitBloodBurst(this.boss.position.x, this.boss.position.y + 1.2, this.boss.position.z, 36, 1.4);
    particleSystem.emitBloodMist(this.boss.position.x, this.boss.position.y + 1.2, this.boss.position.z, 10);
    particleSystem.emitBloodChunks(this.boss.position.x, this.boss.position.y + 1.2, this.boss.position.z, 12);
    particleSystem.emitSparks(this.boss.position.x, this.boss.position.y + 1.0, this.boss.position.z, 10);
    dynamicLights?.flash(this.boss.position.x, this.boss.position.y + 1.0, this.boss.position.z, 0xff0044, 2.5, 12, 12.0);
    audioManager.playRamImpact(1.8);

    const died = this.boss.takeDamage(dmg);
    if (died) {
      gameStore.run.stats.bossesDefeated += 1;
      gameStore.addXp(this.boss.config.xpValue);
      scrapManager.spawnScrap(this.boss.position, 80);
      scrapManager.spawnHealthPack(this.boss.position, 40);
      particleSystem.emitBloodBurst(this.boss.position.x, 1.5, this.boss.position.z, 64, 2.0);
      particleSystem.emitBloodMist(this.boss.position.x, 1.5, this.boss.position.z, 20);
      particleSystem.emitBloodChunks(this.boss.position.x, 1.5, this.boss.position.z, 24);
      particleSystem.emitExplosion(this.boss.position.x, 1.5, this.boss.position.z, 50);
      dynamicLights?.flash(this.boss.position.x, 1.5, this.boss.position.z, 0xff2200, 5.0, 24, 3.0);
      cameraController.addTrauma(0.6);
      eventBus.emit('SLOW_MO_START', { duration: 1.5, scale: 0.25 });

      // Spawn massive ragdoll launch on boss defeat
      this.ragdolls.spawnRagdoll(
        this.boss.position,
        this.boss.bossType,
        new THREE.Vector3((Math.random() - 0.5) * 12, 8, (Math.random() - 0.5) * 12),
        'EXPLOSION',
        this.boss.config.scale
      );
    }
  }

  private damageInRadius(
    pos: THREE.Vector3,
    radius: number,
    damage: number,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem,
    deathType: DeathType = 'EXPLOSION'
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
          dist > 0.001 ? (dx / dist) * (9 * falloff) : 0,
          3.5,
          dist > 0.001 ? (dz / dist) * (9 * falloff) : 0
        );
        const isToxic = z.type === 'SPITTER';
        particleSystem.emitBloodBurst(z.position.x, z.position.y + 0.5, z.position.z, 16, 1.1, isToxic);
        particleSystem.emitBloodMist(z.position.x, z.position.y + 0.5, z.position.z, 4, isToxic);
        if (z.takeDamage(dmg, _scratchKnockback)) {
          this.handleZombieDeath(z, scrapManager, particleSystem, _scratchKnockback, deathType);
        }
      }
    }
  }

  private handleZombieDeath(
    z: Zombie,
    scrapManager: ScrapManager,
    particleSystem: ParticleSystem,
    impactVel?: THREE.Vector3,
    deathType: DeathType = 'RAM'
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

    // Spawn 3D Physical Ragdoll / Severed Limbs
    const vel = impactVel || new THREE.Vector3((Math.random() - 0.5) * 8, 4, (Math.random() - 0.5) * 8);
    this.ragdolls.spawnRagdoll(z.position, z.type, vel, deathType, z.config.scale);

    const isToxic = z.type === 'SPITTER';
    particleSystem.emitBloodBurst(z.position.x, 0.5, z.position.z, 30, 1.2, isToxic);
    particleSystem.emitBloodMist(z.position.x, 0.5, z.position.z, 6, isToxic);
    particleSystem.emitBloodChunks(z.position.x, 0.5, z.position.z, 8, vel);
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
    this.ragdolls.clear();
  }
}
