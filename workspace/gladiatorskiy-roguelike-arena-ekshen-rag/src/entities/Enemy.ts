import * as THREE from 'three';
import { Ragdoll } from '../physics/Ragdoll';
import { Weapon } from './Weapon';
import { globalEventBus } from '../core/EventBus';

export type EnemyType = 'retiarius' | 'murmillo' | 'centurion' | 'titan';

export interface EnemyStats {
  id: number;
  type: EnemyType;
  maxHp: number;
  hp: number;
  baseMassKg: number;
  speed: number;
  damage: number;
  armorAbsorption: number; // Reduces incoming damage
  attackRange: number;
  attackCooldown: number;
  goldReward: number;
}

export class Enemy {
  public id: number;
  public stats: EnemyStats;
  public ragdoll: Ragdoll;
  public weapon: Weapon;

  public isAlive: boolean = true;
  private attackTimer: number = 0;
  private isTelegraphing: boolean = false;
  private telegraphTimer: number = 0;
  private swingPhase: number = 0;

  constructor(id: number, type: EnemyType, waveIndex: number = 1) {
    this.id = id;
    const waveScale = 1.0 + waveIndex * 0.08;

    let colorArmor = 0x888888;
    let colorCloth = 0x2e4053;
    let baseMass = 75.0 * waveScale;
    let maxHp = 50 * waveScale;
    let speed = 4.8;
    let damage = 15 + waveIndex * 2;
    let armorAbsorption = 5.0;
    let attackRange = 2.2;
    let goldReward = 10 + waveIndex * 5;
    let bladeLength = 1.1;

    switch (type) {
      case 'retiarius':
        colorArmor = 0xa08060;
        colorCloth = 0x117864;
        baseMass = 65.0 * waveScale;
        maxHp = 45 * waveScale;
        speed = 5.8;
        armorAbsorption = 2.0;
        attackRange = 2.6;
        bladeLength = 1.4; // Trident length
        break;
      case 'murmillo':
        colorArmor = 0xb09050;
        colorCloth = 0x7b241c;
        baseMass = 85.0 * waveScale;
        maxHp = 80 * waveScale;
        speed = 4.4;
        armorAbsorption = 12.0;
        attackRange = 2.0;
        bladeLength = 1.1;
        break;
      case 'centurion':
        colorArmor = 0xd4af37;
        colorCloth = 0x4a148c;
        baseMass = 130.0 * waveScale;
        maxHp = 220 * waveScale;
        speed = 3.8;
        damage = 30 + waveIndex * 3;
        armorAbsorption = 22.0;
        attackRange = 2.5;
        goldReward = 45 + waveIndex * 10;
        bladeLength = 1.6;
        break;
      case 'titan':
        colorArmor = 0x212121;
        colorCloth = 0xb71c1c;
        baseMass = 260.0 * waveScale;
        maxHp = 600 * waveScale;
        speed = 3.2;
        damage = 50 + waveIndex * 4;
        armorAbsorption = 35.0;
        attackRange = 3.4;
        goldReward = 150;
        bladeLength = 2.2;
        break;
    }

    this.stats = {
      id,
      type,
      maxHp,
      hp: maxHp,
      baseMassKg: baseMass,
      speed,
      damage,
      armorAbsorption,
      attackRange,
      attackCooldown: 1.8,
      goldReward,
    };

    this.ragdoll = new Ragdoll({
      massKg: baseMass,
      jointMotorTorque: 700.0,
      height: type === 'titan' ? 2.6 : 1.8,
      isPlayer: false,
      colorArmor,
      colorSkin: 0xc49a6c,
      colorCloth,
    });

    if (type === 'titan') {
      this.ragdoll.group.scale.set(1.4, 1.4, 1.4);
    }

    // Weapon
    this.weapon = new Weapon({
      massKg: type === 'titan' ? 12.0 : 4.0,
      bladeLengthM: bladeLength,
      baseDamage: damage,
    });
    this.ragdoll.rightArmMesh.add(this.weapon.mesh);
    this.weapon.mesh.position.set(0, -0.4, 0.1);
    this.weapon.mesh.rotation.x = Math.PI * 0.5;

    if (type === 'murmillo' || type === 'centurion') {
      this.ragdoll.equipShield(colorCloth);
    }
  }

  public takeDamage(
    amount: number,
    isCrit: boolean = false,
    shearedArmor: boolean = false,
    knockback?: THREE.Vector3
  ): void {
    if (!this.isAlive) return;

    this.stats.hp = Math.max(0, this.stats.hp - amount);

    globalEventBus.emit('enemy:hit', {
      enemyId: this.id,
      damage: amount,
      isCrit,
      shearedArmor,
      position: { x: this.ragdoll.position.x, y: this.ragdoll.position.y + 1.2, z: this.ragdoll.position.z },
    });

    if (knockback) {
      this.ragdoll.applyImpulse(knockback);
    }

    if (shearedArmor) {
      if (this.ragdoll.hasShield) {
        this.ragdoll.shearArmorPiece('shield');
        this.stats.armorAbsorption *= 0.5;
      } else if (this.ragdoll.hasPauldron) {
        this.ragdoll.shearArmorPiece('pauldron');
        this.stats.armorAbsorption *= 0.7;
      } else if (this.ragdoll.hasHelmet) {
        this.ragdoll.shearArmorPiece('helmet');
      }
    }

    if (this.stats.hp <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.isAlive = false;
    this.ragdoll.triggerKnockdown(999);
    globalEventBus.emit('enemy:killed', {
      enemyId: this.id,
      type: this.stats.type,
      position: { x: this.ragdoll.position.x, y: this.ragdoll.position.y, z: this.ragdoll.position.z },
      gold: this.stats.goldReward,
    });
  }

  public update(dt: number, playerPos: THREE.Vector3, onHitPlayer: (damage: number) => void): void {
    if (!this.isAlive) {
      this.ragdoll.update(dt);
      return;
    }

    // Cooldown timers
    if (this.attackTimer > 0) this.attackTimer -= dt;

    // AI navigation towards player
    const dx = playerPos.x - this.ragdoll.position.x;
    const dz = playerPos.z - this.ragdoll.position.z;
    const dist = Math.hypot(dx, dz);

    if (!this.ragdoll.isKnockedDown && !this.ragdoll.isStaggered) {
      const angleToPlayer = Math.atan2(dx, dz);
      this.ragdoll.targetRotationY = angleToPlayer;

      if (dist > this.stats.attackRange * 0.8) {
        // Move towards player
        const targetVelX = (dx / dist) * this.stats.speed;
        const targetVelZ = (dz / dist) * this.stats.speed;
        this.ragdoll.velocity.x = THREE.MathUtils.lerp(this.ragdoll.velocity.x, targetVelX, Math.min(1.0, 10.0 * dt));
        this.ragdoll.velocity.z = THREE.MathUtils.lerp(this.ragdoll.velocity.z, targetVelZ, Math.min(1.0, 10.0 * dt));
      }

      // Attack AI
      if (dist <= this.stats.attackRange && this.attackTimer <= 0 && !this.isTelegraphing) {
        this.isTelegraphing = true;
        this.telegraphTimer = 0.4; // 400ms windup telegraph
      }

      if (this.isTelegraphing) {
        this.telegraphTimer -= dt;
        this.swingPhase = -Math.PI * 0.5; // Wind back weapon

        if (this.telegraphTimer <= 0) {
          // Strike!
          this.isTelegraphing = false;
          this.attackTimer = this.stats.attackCooldown;
          this.swingPhase = Math.PI * 0.6; // Swing forward

          if (dist <= this.stats.attackRange + 0.5) {
            onHitPlayer(this.stats.damage);
          }
        }
      } else {
        this.swingPhase = THREE.MathUtils.lerp(this.swingPhase, 0, Math.min(1.0, 8.0 * dt));
      }
    }

    this.weapon.update(dt, this.ragdoll.position, this.ragdoll.rotationY, this.swingPhase);
    const arenaCollision = this.ragdoll.update(dt);

    // Wall impact damage if ragdoll was launched into arena wall or spikes
    if (arenaCollision.hitWall && arenaCollision.impactSpeed > 6.0) {
      const wallDamage = Math.floor(arenaCollision.impactSpeed * 4.5);
      this.takeDamage(wallDamage, true, false);
      globalEventBus.emit('audio:play_sfx', { sound: 'wall_smash', pitchVariation: 1.0 });
    }
  }
}
