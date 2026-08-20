import { Player, KickState } from '../entities/Player';
import { EnemyPool } from '../entities/EnemyPool';
import { Enemy } from '../entities/Enemy';
import { ExplosiveBarrel, BreachDoor, DroppedWeaponPickup, DroppedShardPickup } from '../entities/Props';
import { ProjectilePool } from '../entities/ProjectilePool';
import { MathUtils } from '../physics/MathUtils';
import { ComboRank, Vector3D, WeaponType } from '../core/Types';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';

export interface FloatingTextData {
  text: string;
  x: number;
  y: number;
  z: number;
  style: 'normal' | 'crit' | 'skeet' | 'domino';
}

export class CombatSystem {
  private player: Player;
  private enemyPool: EnemyPool;
  private projectilePool: ProjectilePool;
  private audioManager: AudioManager;
  private eventBus: EventBus;

  public barrels: ExplosiveBarrel[] = [];
  public doors: BreachDoor[] = [];
  public droppedWeapons: DroppedWeaponPickup[] = [];
  public droppedShards: DroppedShardPickup[] = [];

  // Combo system
  public comboScore: number = 0;
  public comboPoints: number = 0;
  public comboRank: ComboRank = ComboRank.C;
  public comboDecayTimer: number = 0;
  public totalKills: number = 0;
  public skeetKills: number = 0;
  public dominoStrikes: number = 0;
  public barrelsExploded: number = 0;
  public doorsBreached: number = 0;

  // Visual text popups buffer
  public floatingTexts: FloatingTextData[] = [];

  constructor(
    player: Player,
    enemyPool: EnemyPool,
    projectilePool: ProjectilePool
  ) {
    this.player = player;
    this.enemyPool = enemyPool;
    this.projectilePool = projectilePool;
    this.audioManager = AudioManager.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  public update(dt: number): void {
    // 1. Update combo decay
    if (this.comboDecayTimer > 0) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) {
        this.comboPoints = Math.max(0, this.comboPoints - 25 * dt);
        this.updateComboRank();
      }
    }

    // 2. Check Player Kick Hitbox (Active window)
    if (this.player.kickState === KickState.ACTIVE_HITBOX && this.player.kickStateTimer >= 0.10) {
      this.resolveKickAttack();
    }

    // 3. Update Barrels
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const barrel = this.barrels[i];
      if (barrel.isDetonated) {
        this.detonateBarrel(barrel);
        this.barrels.splice(i, 1);
      }
    }

    // 4. Update Dropped Weapons (Mid-air catch)
    for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
      const weapon = this.droppedWeapons[i];
      weapon.update(dt);

      // Mid-Air Grab check (2.2m radius or magnet perk)
      const dist = MathUtils.distance2D(this.player.position.x, this.player.position.z, weapon.position.x, weapon.position.z);
      if (dist <= this.player.autoMagnetRadius && weapon.isMidAirCatchable && !weapon.isPickedUp) {
        weapon.isPickedUp = true;
        this.player.equipWeapon(new (weapon.type as any)(weapon.type, true)); // Overdrive gun!
        this.audioManager.playPickup();
        this.addFloatingText('GUN CAUGHT! [OVERDRIVE +35%]', this.player.position.x, this.player.position.y + 1.2, this.player.position.z, 'crit');
        this.droppedWeapons.splice(i, 1);
      } else if (weapon.lifeTimer <= 0) {
        this.droppedWeapons.splice(i, 1);
      }
    }

    // 5. Update Dropped Shards
    for (let i = this.droppedShards.length - 1; i >= 0; i--) {
      const shard = this.droppedShards[i];
      const collected = shard.update(dt, this.player.position, this.player.autoMagnetRadius);
      if (collected) {
        if (shard.type === 'plasma') {
          this.eventBus.emit('pickup:plasma', shard.amount);
        } else if (shard.type === 'ammo') {
          this.player.currentWeapon.addAmmo(shard.amount);
          this.eventBus.emit('pickup:ammo', shard.amount);
        } else if (shard.type === 'health') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + shard.amount);
          this.eventBus.emit('pickup:health', shard.amount);
        }
        this.audioManager.playPickup();
        this.droppedShards.splice(i, 1);
      }
    }

    // 6. Resolve Projectile Collisions
    this.resolveProjectiles();
  }

  public resolveKickAttack(): void {
    const fX = Math.cos(this.player.aimAngle);
    const fZ = Math.sin(this.player.aimAngle);
    let hitAny = false;

    // A. Check Breach Doors
    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      if (!door.isBreached) {
        const dist = MathUtils.distance2D(this.player.position.x, this.player.position.z, door.position.x, door.position.z);
        if (dist < 3.2) {
          door.breach(fX, fZ);
          this.doorsBreached++;
          this.audioManager.playBreachSlowmo();
          this.eventBus.emit('camera:shake', { amplitude: 0.5, duration: 0.35 });
          this.eventBus.emit('game:slowmo', { scale: 0.25, duration: 0.8 });
          this.addFloatingText('BREACH KICK!', door.position.x, 1.5, door.position.z, 'crit');

          // Damage enemies in doorway
          const enemies = this.enemyPool.getActiveEnemies();
          for (let e = 0; e < enemies.length; e++) {
            const enemy = enemies[e];
            const eDist = MathUtils.distance2D(door.position.x, door.position.z, enemy.position.x, enemy.position.z);
            if (eDist < 3.5) {
              const killed = enemy.takeDamage(90);
              enemy.applyKickLaunch({ x: fX * 22, y: 8, z: fZ * 22 });
              if (killed) this.onEnemyKilled(enemy, 'door');
            }
          }
          hitAny = true;
        }
      }
    }

    // B. Check Barrels
    for (let i = 0; i < this.barrels.length; i++) {
      const barrel = this.barrels[i];
      const dist = MathUtils.distance2D(this.player.position.x, this.player.position.z, barrel.position.x, barrel.position.z);
      if (dist < this.player.kickRange) {
        barrel.velocity.x = fX * 22.0;
        barrel.velocity.y = 5.0;
        barrel.velocity.z = fZ * 22.0;
        hitAny = true;
      }
    }

    // C. Check Enemies in Cone
    const enemies = this.enemyPool.getActiveEnemies();
    const kickSpeed = this.player.getKickLaunchVelocity();

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const inCone = MathUtils.isInsideCone(
        this.player.position.x,
        this.player.position.z,
        fX,
        fZ,
        enemy.position.x,
        enemy.position.z,
        this.player.kickRange,
        this.player.kickConeAngle
      );

      if (inCone) {
        hitAny = true;

        // Shield check
        if (enemy.hasShield && enemy.shieldHp > 0) {
          enemy.shieldHp -= 35;
          this.audioManager.playWallCrash();
          this.player.velocity.x = -fX * 6.0; // Knockback player
          this.player.velocity.z = -fZ * 6.0;
          this.addFloatingText('BLOCKED!', enemy.position.x, 1.5, enemy.position.z, 'normal');
          continue;
        }

        // Spiked Berserker check
        if (enemy.isSpikedArmor && enemy.hp >= enemy.maxHp) {
          this.player.takeDamage(15);
          this.addFloatingText('SPIKED! -15 HP', this.player.position.x, 1.2, this.player.position.z, 'domino');
        }

        // Apply Spartan Kick Launch Impulse
        const impulseVector: Vector3D = {
          x: fX * kickSpeed,
          y: 7.5,
          z: fZ * kickSpeed
        };
        enemy.applyKickLaunch(impulseVector);

        // Disarm chance
        if (enemy.carriedWeaponType) {
          this.spawnDisarmedWeapon(enemy.carriedWeaponType, enemy.position, fX, fZ);
          enemy.carriedWeaponType = null;
        }

        // Hitstop & Camera shake
        this.eventBus.emit('game:hitstop', 0.06);
        this.eventBus.emit('camera:shake', { amplitude: 0.35, duration: 0.2 });
        this.audioManager.playKick();

        // Add combo
        this.addComboScore(100, 'SPARTAN KICK');
        this.addFloatingText('KICK!', enemy.position.x, 1.6, enemy.position.z, 'crit');
      }
    }

    if (hitAny) {
      this.player.kickState = KickState.HIT_FREEZE;
      this.player.kickStateTimer = 0.06;
    }
  }

  public triggerShockwaveAbility(): boolean {
    if (this.player.energy < 30 || this.player.abilityCooldown > 0) {
      return false;
    }

    this.player.energy -= 30;
    this.player.abilityCooldown = 1.2;
    this.audioManager.playShockwave();
    this.eventBus.emit('camera:shake', { amplitude: 0.45, duration: 0.25 });
    this.eventBus.emit('vfx:shockwave', { x: this.player.position.x, z: this.player.position.z, radius: 4.5 });

    const enemies = this.enemyPool.getActiveEnemies();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const dist = MathUtils.distance2D(this.player.position.x, this.player.position.z, enemy.position.x, enemy.position.z);
      if (dist < 4.8) {
        const dx = enemy.position.x - this.player.position.x;
        const dz = enemy.position.z - this.player.position.z;
        const norm = Math.max(0.1, Math.hypot(dx, dz));
        const impulse: Vector3D = {
          x: (dx / norm) * 16.0,
          y: 6.0,
          z: (dz / norm) * 16.0
        };
        enemy.applyKickLaunch(impulse);
        const killed = enemy.takeDamage(45);
        if (killed) this.onEnemyKilled(enemy, 'shockwave');
      }
    }

    this.addFloatingText('SHOCKWAVE EMP!', this.player.position.x, 1.8, this.player.position.z, 'crit');
    return true;
  }

  private spawnDisarmedWeapon(type: WeaponType, pos: Vector3D, forwardX: number, forwardZ: number): void {
    const pickup = new DroppedWeaponPickup(
      `drop_${Date.now()}`,
      type,
      pos.x,
      1.5,
      pos.z,
      {
        x: -forwardX * 3.0 + (Math.random() - 0.5) * 2,
        y: 8.0,
        z: -forwardZ * 3.0 + (Math.random() - 0.5) * 2
      }
    );
    this.droppedWeapons.push(pickup);
    this.addFloatingText('DISARMED!', pos.x, 2.0, pos.z, 'crit');
  }

  private resolveProjectiles(): void {
    const projectiles = this.projectilePool.getActive();
    const enemies = this.enemyPool.getActiveEnemies();

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p.isActive) continue;

      if (p.isPlayerOwned) {
        // Check vs Enemies
        for (let e = 0; e < enemies.length; e++) {
          const enemy = enemies[e];
          const dist = MathUtils.distance3D(p.position, enemy.position);
          if (dist < enemy.radius + p.radius) {
            p.isActive = false;

            if (p.isExplosive) {
              this.detonateExplosion(p.position.x, p.position.z, 4.0, 130);
            } else {
              const isSkeet = enemy.isAirborneSkeet;
              const killed = enemy.takeDamage(p.damage, isSkeet);

              if (isSkeet) {
                this.audioManager.playSkeetCrit();
                this.eventBus.emit('camera:punchFov', 3.0);
                this.addFloatingText('SKEET CRIT! x2.5', enemy.position.x, enemy.position.y + 1.2, enemy.position.z, 'skeet');
                this.addComboScore(250, 'AIR SKEET CRIT');
                if (killed) {
                  this.skeetKills++;
                  this.onEnemyKilled(enemy, 'skeet');
                }
              } else {
                this.addFloatingText(`${Math.round(p.damage)}`, enemy.position.x, enemy.position.y + 1.0, enemy.position.z, 'normal');
                if (killed) this.onEnemyKilled(enemy, 'bullet');
              }
            }
            break;
          }
        }
      } else {
        // Enemy projectile hitting player
        const dist = MathUtils.distance3D(p.position, this.player.position);
        if (dist < this.player.radius + p.radius) {
          p.isActive = false;
          this.player.takeDamage(p.damage);
          this.eventBus.emit('camera:shake', { amplitude: 0.3, duration: 0.15 });
          this.addFloatingText(`-${Math.round(p.damage)} HP`, this.player.position.x, 1.5, this.player.position.z, 'domino');
        }
      }
    }
  }

  private detonateBarrel(barrel: ExplosiveBarrel): void {
    this.barrelsExploded++;
    this.detonateExplosion(barrel.position.x, barrel.position.z, 4.2, 120);
  }

  private detonateExplosion(x: number, z: number, radius: number, damage: number): void {
    this.audioManager.playExplosion();
    this.eventBus.emit('camera:shake', { amplitude: 0.6, duration: 0.35 });
    this.eventBus.emit('vfx:explosion', { x, z, radius });
    this.addFloatingText('BOOM!', x, 1.8, z, 'domino');

    const enemies = this.enemyPool.getActiveEnemies();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const dist = MathUtils.distance2D(x, z, enemy.position.x, enemy.position.z);
      if (dist < radius) {
        const falloff = 1 - dist / radius;
        const finalDmg = damage * falloff;
        const dx = enemy.position.x - x;
        const dz = enemy.position.z - z;
        const norm = Math.max(0.1, Math.hypot(dx, dz));

        enemy.applyKickLaunch({
          x: (dx / norm) * 18 * falloff,
          y: 7.0 * falloff,
          z: (dz / norm) * 18 * falloff
        });

        const killed = enemy.takeDamage(finalDmg);
        if (killed) this.onEnemyKilled(enemy, 'barrel');
      }
    }
  }

  private onEnemyKilled(enemy: Enemy, cause: string): void {
    this.totalKills++;

    // Base drop + Skeet bonus
    const dropPlasmaCount = cause === 'skeet' ? 5 : 2;
    for (let i = 0; i < dropPlasmaCount; i++) {
      this.droppedShards.push(new DroppedShardPickup(`plasma_${Date.now()}_${i}`, 'plasma', 10, enemy.position.x, enemy.position.z));
    }

    // Ammo drop chance: 0.15 + (KilledByWallOrBarrelKick ? 0.70 : 0.0) + ComboLevel * 0.05
    const isWallOrBarrel = cause === 'wall' || cause === 'barrel' || cause === 'door';
    let ammoChance = 0.15 + (isWallOrBarrel ? 0.70 : 0.0) + (cause === 'skeet' ? 0.85 : 0.0);

    if (Math.random() < ammoChance) {
      const ammoAmount = cause === 'skeet' ? 6 : 3;
      this.droppedShards.push(new DroppedShardPickup(`ammo_${Date.now()}`, 'ammo', ammoAmount, enemy.position.x, enemy.position.z));
    }

    // Wall Smash Bio-Siphon perk
    if (isWallOrBarrel && this.player.wallSmashHeal > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.wallSmashHeal);
    }
  }

  public addComboScore(points: number, reason: string): void {
    let mult = 1.0;
    switch (this.comboRank) {
      case ComboRank.B: mult = 1.25; break;
      case ComboRank.A: mult = 1.5; break;
      case ComboRank.S: mult = 2.0; break;
      case ComboRank.SSS: mult = 3.0; break;
    }

    const earned = Math.round(points * mult);
    this.comboScore += earned;
    this.comboPoints += points;
    this.comboDecayTimer = 3.5;
    this.updateComboRank();
  }

  private updateComboRank(): void {
    if (this.comboPoints > 1200) this.comboRank = ComboRank.SSS;
    else if (this.comboPoints > 700) this.comboRank = ComboRank.S;
    else if (this.comboPoints > 350) this.comboRank = ComboRank.A;
    else if (this.comboPoints > 120) this.comboRank = ComboRank.B;
    else this.comboRank = ComboRank.C;
  }

  public addFloatingText(text: string, x: number, y: number, z: number, style: 'normal' | 'crit' | 'skeet' | 'domino'): void {
    this.floatingTexts.push({ text, x, y, z, style });
    if (this.floatingTexts.length > 20) {
      this.floatingTexts.shift();
    }
  }

  public clear(): void {
    this.barrels = [];
    this.doors = [];
    this.droppedWeapons = [];
    this.droppedShards = [];
    this.floatingTexts = [];
    this.comboScore = 0;
    this.comboPoints = 0;
    this.comboRank = ComboRank.C;
    this.totalKills = 0;
    this.skeetKills = 0;
    this.dominoStrikes = 0;
    this.barrelsExploded = 0;
    this.doorsBreached = 0;
  }
}
