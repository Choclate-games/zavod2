import * as THREE from 'three';
import { SceneManager } from '../rendering/SceneManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { MeshSlicer } from '../slicing/MeshSlicer';
import { DebrisManager } from '../slicing/DebrisManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { Audio } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import { ComboRank } from '../core/Types';

export class CombatSystem {
  private sceneManager: SceneManager;
  private debrisManager: DebrisManager;
  private particles: ParticleSystem;

  // Combo & Heat
  public comboCount: number = 0;
  public comboRank: ComboRank = 'D';
  public comboTimer: number = 0;
  public readonly COMBO_WINDOW_SEC = 2.0;

  public heatMeter: number = 0;
  public maxHeat: number = 100;
  public score: number = 0;
  public creditsEarned: number = 0;
  public totalKills: number = 0;
  public maxComboAchieved: ComboRank = 'D';

  // Hitstop
  public hitstopTimer: number = 0;

  constructor(
    sceneManager: SceneManager,
    debrisManager: DebrisManager,
    particles: ParticleSystem
  ) {
    this.sceneManager = sceneManager;
    this.debrisManager = debrisManager;
    this.particles = particles;
  }

  public update(dt: number, player: Player): void {
    // Hitstop tick
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }

    // Heat decay when not in Overdrive
    if (!player.isOverdrive && this.heatMeter > 0) {
      this.heatMeter = Math.max(0, this.heatMeter - 6.0 * dt);
    }
  }

  public executeSwipe(
    startScreen: THREE.Vector2,
    endScreen: THREE.Vector2,
    player: Player,
    enemies: Enemy[],
    projectiles: Projectile[],
    spawnProjectile: (p: Projectile) => void
  ): boolean {
    const swipeDist = startScreen.distanceTo(endScreen);
    if (swipeDist < 25) return false; // Ignore micro-jitters

    // Camera and Screen Rays
    const camera = this.sceneManager.camera;
    const raycaster = new THREE.Raycaster();

    const ndcStart = new THREE.Vector2(
      (startScreen.x / window.innerWidth) * 2 - 1,
      -(startScreen.y / window.innerHeight) * 2 + 1
    );
    const ndcEnd = new THREE.Vector2(
      (endScreen.x / window.innerWidth) * 2 - 1,
      -(endScreen.y / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(ndcStart, camera);
    const rayStart = raycaster.ray.clone();

    raycaster.setFromCamera(ndcEnd, camera);
    const rayEnd = raycaster.ray.clone();

    // Slicing Plane Normal = RayStart x RayEnd
    let planeNormal = new THREE.Vector3().crossVectors(rayStart.direction, rayEnd.direction).normalize();
    if (planeNormal.lengthSq() < 0.001) {
      planeNormal = camera.getWorldDirection(new THREE.Vector3()).cross(new THREE.Vector3(0, 1, 0)).normalize();
    }

    // Slice plane passes through player / center of swipe
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundHit = new THREE.Vector3();
    rayStart.intersectPlane(groundPlane, groundHit);
    const slicePoint = groundHit.lengthSq() > 0.001 ? groundHit : player.position.clone();

    // Audio & Trail
    Audio.playSliceWhoosh();
    this.sceneManager.setTrailColor(player.getKatana().color);
    this.sceneManager.addTrailPoint(groundHit);

    let enemiesHit = 0;
    const katana = player.getKatana();
    const damageMultiplier = katana.damageMultiplier * (player.isOverdrive ? 2.5 : 1.0);
    const baseDamage = player.stats.damage * damageMultiplier;

    // Razor Wind Talent
    if (player.stats.razorWind) {
      const sliceDir = rayEnd.direction.clone().setY(0).normalize();
      spawnProjectile(
        new Projectile(
          this.sceneManager.scene,
          'razor_wind',
          player.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          sliceDir,
          22.0,
          baseDamage * 0.7,
          false
        )
      );
    }

    // --- Slicing Enemies ---
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.isDead) continue;

      const toEnemy = enemy.position.clone().sub(slicePoint);
      const distAlongNormal = Math.abs(planeNormal.dot(toEnemy));
      const distToSlice = toEnemy.length();

      // Check reach distance
      const maxReach = 8.5 * player.stats.sliceRangeBonus;
      if (distToSlice <= maxReach && distAlongNormal <= enemy.radius * 1.3) {
        enemiesHit++;

        let isCrit = false;
        let finalDamage = baseDamage;

        // Boss Weak Plane Critical Alignment Check
        if (enemy.type === 'boss' && enemy.weakPlane && enemy.weakPlane.active) {
          const alignment = Math.abs(planeNormal.dot(enemy.weakPlane.normal));
          if (alignment > 0.65) {
            isCrit = true;
            finalDamage *= 4.0;
            this.sceneManager.triggerScreenShake(1.2);
            this.hitstopTimer = 0.08;
            Audio.playParryClang();
            this.particles.emitShockwave(enemy.position, 0x00f3ff, 48);
          }
        }

        // Apply Damage
        const died = enemy.takeDamage(finalDamage);

        // Visual sparks
        this.particles.emitSparks(enemy.position, katana.color, isCrit ? 40 : 20, 12.0);
        Audio.playMetalSlice();

        // Perform Procedural 3D Mesh Slice on lethal strike or high damage
        if (died || isCrit) {
          const sliceRes = MeshSlicer.sliceMesh(
            enemy.mainSlicableMesh,
            slicePoint,
            planeNormal,
            katana.color
          );

          if (sliceRes.success && sliceRes.upperMesh && sliceRes.lowerMesh) {
            this.debrisManager.spawnSlicedPieces(
              sliceRes.upperMesh,
              sliceRes.lowerMesh,
              planeNormal,
              isCrit ? 9.0 : 6.0
            );
          }

          if (died) {
            this.onEnemyKilled(enemy, player, isCrit);
            enemies.splice(i, 1);
            enemy.dispose();
          }
        }

        // Chain Lightning Talent
        if (player.stats.chainLightning) {
          this.triggerChainLightning(enemy.position, enemies, baseDamage * 0.6);
        }

        // EMP Burst Talent
        if (player.stats.empBurst && enemy.type === 'drone') {
          this.triggerEMPBurst(enemy.position, enemies);
        }
      }
    }

    // --- Slicing Projectiles ---
    for (let j = projectiles.length - 1; j >= 0; j--) {
      const proj = projectiles[j];
      if (proj.isDead || !proj.isHostile) continue;

      const toProj = proj.position.clone().sub(slicePoint);
      const distNormal = Math.abs(planeNormal.dot(toProj));

      if (toProj.length() <= 9.0 && distNormal <= proj.radius * 1.5) {
        if (player.stats.ricochetEnabled) {
          // Reflect back to nearest enemy
          const nearest = this.findNearestEnemy(proj.position, enemies);
          const reflectDir = nearest 
            ? nearest.position.clone().sub(proj.position).normalize()
            : proj.velocity.clone().negate().normalize();

          proj.reflect(reflectDir);
          Audio.playParryClang();
          this.particles.emitSparks(proj.position, 0x00f3ff, 16);
          this.addScore(100);
        } else {
          // Slice & destroy projectile
          proj.isDead = true;
          this.particles.emitSparks(proj.position, 0xffaa00, 18);
          Audio.playExplosion();
          this.addScore(50);
        }
      }
    }

    if (enemiesHit > 0) {
      this.incrementCombo(enemiesHit, player);
      return true;
    }

    return false;
  }

  private onEnemyKilled(enemy: Enemy, player: Player, isCrit: boolean): void {
    this.totalKills++;
    const multi = this.getRankMultiplier();
    const scoreVal = Math.round(enemy.scoreValue * multi * (isCrit ? 2.5 : 1.0));
    const creditVal = Math.round(enemy.creditDrop * player.stats.creditMultiplier);

    this.addScore(scoreVal);
    this.creditsEarned += creditVal;

    // Chrono-vampirism
    if (player.stats.chronoVampirism) {
      player.heal(player.stats.maxHp * 0.06);
    }
    player.addChronoEnergy(16);

    EventBus.emit('enemy:killed', { enemy, score: scoreVal, credits: creditVal });
  }

  private incrementCombo(hitCount: number, player: Player): void {
    this.comboCount += hitCount;
    this.comboTimer = this.COMBO_WINDOW_SEC;

    // Heat meter buildup
    this.heatMeter = Math.min(this.maxHeat, this.heatMeter + hitCount * 14);

    if (this.heatMeter >= this.maxHeat && !player.isOverdrive) {
      player.triggerOverdrive(8.0);
      Audio.playOverdriveActivated();
      this.particles.emitShockwave(player.position, 0xffd700, 40);
    }

    // Rank evaluation
    const prevRank = this.comboRank;
    if (this.comboCount >= 30) this.comboRank = 'SSS';
    else if (this.comboCount >= 22) this.comboRank = 'SS';
    else if (this.comboCount >= 15) this.comboRank = 'S';
    else if (this.comboCount >= 10) this.comboRank = 'A';
    else if (this.comboCount >= 6) this.comboRank = 'B';
    else if (this.comboCount >= 3) this.comboRank = 'C';
    else this.comboRank = 'D';

    if (this.comboRank !== prevRank) {
      Audio.playComboRankUp(this.comboRank);
      EventBus.emit('combo:rank_up', this.comboRank);
    }

    this.updateMaxRank(this.comboRank);

    EventBus.emit('combo:updated', {
      count: this.comboCount,
      rank: this.comboRank,
      multiplier: this.getRankMultiplier(),
      heat: this.heatMeter
    });
  }

  private resetCombo(): void {
    this.comboCount = 0;
    this.comboRank = 'D';
    EventBus.emit('combo:updated', {
      count: 0,
      rank: 'D',
      multiplier: 1.0,
      heat: this.heatMeter
    });
  }

  public getRankMultiplier(): number {
    switch (this.comboRank) {
      case 'SSS': return 10.0;
      case 'SS': return 7.0;
      case 'S': return 5.0;
      case 'A': return 4.0;
      case 'B': return 3.0;
      case 'C': return 2.0;
      default: return 1.0;
    }
  }

  private updateMaxRank(rank: ComboRank): void {
    const ranks: ComboRank[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    if (ranks.indexOf(rank) > ranks.indexOf(this.maxComboAchieved)) {
      this.maxComboAchieved = rank;
    }
  }

  private addScore(amount: number): void {
    this.score += Math.round(amount);
    EventBus.emit('score:updated', this.score);
  }

  private findNearestEnemy(pos: THREE.Vector3, enemies: Enemy[]): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = Infinity;
    for (const e of enemies) {
      if (e.isDead) continue;
      const d = pos.distanceTo(e.position);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  private triggerChainLightning(origin: THREE.Vector3, enemies: Enemy[], damage: number): void {
    let arcs = 0;
    for (const e of enemies) {
      if (e.isDead || e.position.distanceTo(origin) > 8.0) continue;
      e.takeDamage(damage);
      this.particles.emitSparks(e.position, 0x00f3ff, 12);
      arcs++;
      if (arcs >= 2) break;
    }
  }

  private triggerEMPBurst(origin: THREE.Vector3, enemies: Enemy[]): void {
    this.particles.emitShockwave(origin, 0x00f3ff, 36);
    Audio.playParryClang();
    for (const e of enemies) {
      if (!e.isDead && e.position.distanceTo(origin) <= 10.0) {
        e.stun(2.2);
      }
    }
  }

  public reset(): void {
    this.comboCount = 0;
    this.comboRank = 'D';
    this.comboTimer = 0;
    this.heatMeter = 0;
    this.score = 0;
    this.creditsEarned = 0;
    this.totalKills = 0;
    this.maxComboAchieved = 'D';
  }
}
