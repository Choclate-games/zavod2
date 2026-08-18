import * as THREE from 'three';
import { PlayerSlime } from '../entities/PlayerSlime';
import { Enemy } from '../entities/Enemy';
import { BiomassOrb } from '../entities/BiomassOrb';
import { Projectile } from '../entities/Projectile';
import { SlimeMinion } from '../entities/SlimeMinion';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { SceneManager } from '../rendering/SceneManager';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameConfig } from '../config/GameConfig';
import { GameLoop } from '../core/GameLoop';

export class CombatSystem {
  constructor() {}

  public update(
    dt: number,
    player: PlayerSlime,
    enemies: Enemy[],
    minions: SlimeMinion[],
    projectiles: Projectile[],
    orbs: BiomassOrb[],
    particles: ParticleSystem,
    sceneManager: SceneManager,
    gameLoop: GameLoop,
    scene: THREE.Scene
  ): void {
    const audio = AudioManager.getInstance();

    // 1. Process Acid Puddles DoT on Enemies
    const puddles = particles.getActivePuddles();
    if (puddles.length > 0) {
      for (const enemy of enemies) {
        if (enemy.isDead || enemy.isBeingAbsorbed) continue;

        for (const puddle of puddles) {
          const dx = enemy.position.x - puddle.position.x;
          const dz = enemy.position.z - puddle.position.z;
          if (dx * dx + dz * dz <= puddle.radius * puddle.radius) {
            const dotDmg = puddle.damagePerSec * dt;
            const died = enemy.takeDamage(dotDmg);
            if (died) {
              this.onEnemyDefeated(enemy, orbs, particles, sceneManager, scene);
            }
          }
        }
      }
    }

    // 2. Process Player vs Enemy Absorption & Collisions
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];

      // If being absorbed, check if suction animation finished
      if (enemy.isBeingAbsorbed) {
        if (enemy.absorbProgress >= 1.0) {
          // Finished eating!
          audio.playAbsorb();
          particles.emitSlimeBurst(player.position, 14);

          // Give player biomass & check level up
          const leveledUp = player.addBiomass(enemy.config.biomassValue);
          player.stats.dnaEarned += enemy.config.dnaValue;
          player.stats.enemiesAbsorbed++;

          // Digest enzymes heal
          if (player.stats.hp < player.stats.maxHp) {
            player.heal(player.stats.maxHp * 0.04);
          }

          if (leveledUp) {
            audio.playLevelUp();
            EventBus.emit('game:levelup');
          }

          // Cleanup enemy
          scene.remove(enemy.group);
          enemy.dispose();
          enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.isDead) continue;

      const dx = player.position.x - enemy.position.x;
      const dz = player.position.z - enemy.position.z;
      const distSq = dx * dx + dz * dz;
      const totalR = player.stats.radius + enemy.config.radius;

      if (distSq < totalR * totalR) {
        const dist = Math.sqrt(distSq);
        const dir = new THREE.Vector3(dx / (dist || 1), 0, dz / (dist || 1));

        // Absorption Rule: Mass(Player) > Mass(Target) * 1.15
        if (player.stats.mass > enemy.config.mass * GameConfig.PLAYER.MASS_ABSORB_RATIO || player.isDashing) {
          enemy.startAbsorption(player.position);
          audio.playSquish();
          sceneManager.addTrauma(0.12);
        } else {
          // Collision Attack from Enemy
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.config.attackCooldown;
            const died = player.takeDamage(enemy.config.damage);
            audio.playHit();
            sceneManager.addTrauma(0.25);
            gameLoop.triggerHitstop();

            // Push player and enemy apart
            enemy.knockback.addScaledVector(dir, -8.0);

            // Chitin armor thorns reflection
            if (player.stats.damageReduction > 0) {
              const thornDmg = enemy.config.damage * 0.5;
              const enemyDied = enemy.takeDamage(thornDmg, dir.clone().negate(), 6.0);
              if (enemyDied) {
                this.onEnemyDefeated(enemy, orbs, particles, sceneManager, scene);
              }
            }

            if (died) {
              EventBus.emit('game:gameover');
            }
          }
        }
      }

      // Ranged Enemy Attacks (Archers / Archmages / Catapults)
      if (enemy.config.attackRange > 5.0 && enemy.attackTimer <= 0 && !enemy.isBeingAbsorbed && !enemy.isDead) {
        const dist = Math.hypot(dx, dz);
        if (dist <= enemy.config.attackRange) {
          enemy.attackTimer = enemy.config.attackCooldown;
          const projDir = new THREE.Vector3(-dx / dist, 0, -dz / dist);
          const projType = enemy.type === 'archer' ? 'arrow' : (enemy.type === 'archmage' ? 'fireball' : 'arrow');
          const proj = new Projectile(
            enemy.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
            projDir.multiplyScalar(15),
            enemy.config.damage,
            false,
            projType
          );
          projectiles.push(proj);
          scene.add(proj.data.mesh);
        }
      }
    }

    // 3. Process Minions vs Enemies
    for (const minion of minions) {
      if (minion.attackTimer <= 0) {
        for (const enemy of enemies) {
          if (enemy.isDead || enemy.isBeingAbsorbed) continue;
          const dist = minion.position.distanceTo(enemy.position);
          if (dist < minion.radius + enemy.config.radius + 0.3) {
            minion.attackTimer = minion.attackCooldown;
            const enemyDied = enemy.takeDamage(minion.damage, enemy.position.clone().sub(minion.position).normalize(), 4.0);
            audio.playSquish();
            particles.emitSlimeBurst(enemy.position, 4);
            if (enemyDied) {
              this.onEnemyDefeated(enemy, orbs, particles, sceneManager, scene);
            }
            break;
          }
        }
      }
    }

    // 4. Process Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.update(dt);

      if (proj.isDead) {
        proj.dispose(scene);
        projectiles.splice(i, 1);
        continue;
      }

      if (proj.data.isPlayer) {
        // Player Spike hitting Enemies
        for (const enemy of enemies) {
          if (enemy.isDead || enemy.isBeingAbsorbed) continue;
          const distSq = proj.data.position.distanceToSquared(enemy.position);
          const hitDist = proj.data.radius + enemy.config.radius;
          if (distSq < hitDist * hitDist) {
            const died = enemy.takeDamage(proj.data.damage, proj.data.velocity.clone().normalize(), 8.0);
            particles.emitSlimeBurst(enemy.position, 6, 0xa855f7);
            audio.playHit();
            proj.isDead = true;

            if (died) {
              this.onEnemyDefeated(enemy, orbs, particles, sceneManager, scene);
            }
            break;
          }
        }
      } else {
        // Enemy Projectile hitting Player
        const distSq = proj.data.position.distanceToSquared(player.position);
        const hitDist = proj.data.radius + player.stats.radius;
        if (distSq < hitDist * hitDist) {
          const died = player.takeDamage(proj.data.damage);
          audio.playHit();
          sceneManager.addTrauma(0.2);
          particles.emitSlimeBurst(player.position, 8, 0xff0044);
          proj.isDead = true;

          if (died) {
            EventBus.emit('game:gameover');
          }
        }
      }
    }

    // 5. Process Biomass & DNA Orbs collection
    for (let i = orbs.length - 1; i >= 0; i--) {
      const orb = orbs[i];
      orb.update(player.position, player.stats.magnetRadius, dt);

      const distSq = orb.position.distanceToSquared(player.position);
      if (distSq < player.stats.radius * player.stats.radius + 0.5) {
        // Collected!
        if (orb.type === 'biomass') {
          const leveledUp = player.addBiomass(orb.value);
          if (leveledUp) {
            audio.playLevelUp();
            EventBus.emit('game:levelup');
          }
        } else {
          player.stats.dnaEarned += orb.value;
        }

        orb.dispose(scene);
        orbs.splice(i, 1);
      }
    }
  }

  private onEnemyDefeated(
    enemy: Enemy,
    orbs: BiomassOrb[],
    particles: ParticleSystem,
    sceneManager: SceneManager,
    scene: THREE.Scene
  ): void {
    const audio = AudioManager.getInstance();
    enemy.isDead = true;

    if (enemy.config.isBoss) {
      audio.playVictory();
      sceneManager.addTrauma(0.5);
      particles.emitSlimeBurst(enemy.position, 35, 0xffd700);

      // Huge drops
      for (let k = 0; k < 8; k++) {
        const dropPos = enemy.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
        const orb = new BiomassOrb(Date.now() + Math.random(), 'biomass', enemy.config.biomassValue / 8, dropPos);
        orbs.push(orb);
        scene.add(orb.mesh);
      }
      for (let k = 0; k < 6; k++) {
        const dropPos = enemy.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
        const orb = new BiomassOrb(Date.now() + Math.random() + 10, 'dna', enemy.config.dnaValue / 6, dropPos);
        orbs.push(orb);
        scene.add(orb.mesh);
      }

      if (enemy.type === 'boss_golem') {
        EventBus.emit('game:victory');
      }
    } else {
      particles.emitSlimeBurst(enemy.position, 8);
      // Spawn drop
      const orb = new BiomassOrb(Date.now() + Math.random(), 'biomass', enemy.config.biomassValue, enemy.position.clone());
      orbs.push(orb);
      scene.add(orb.mesh);

      if (enemy.config.dnaValue > 0 && Math.random() < 0.65) {
        const dnaOrb = new BiomassOrb(Date.now() + Math.random() + 5, 'dna', enemy.config.dnaValue, enemy.position.clone());
        orbs.push(dnaOrb);
        scene.add(dnaOrb.mesh);
      }
    }
  }
}
