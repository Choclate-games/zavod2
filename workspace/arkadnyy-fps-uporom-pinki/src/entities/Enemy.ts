import * as THREE from 'three';
import { EnemyType, WeaponType } from '../types';
import { ProceduralModels } from '../rendering/ProceduralModels';
import { PhysicsBody, PhysicsWorld, CollisionBox } from '../physics/PhysicsWorld';
import { EventBus } from '../core/EventBus';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { AudioManager } from '../audio/AudioManager';

export type EnemyState = 'IDLE' | 'CHASE' | 'AIM' | 'ATTACK' | 'STAGGER' | 'RAGDOLL_FLYING' | 'WALL_SPLAT' | 'DEAD';

export class Enemy {
  public id: string;
  public type: EnemyType;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public state: EnemyState = 'CHASE';
  public hp: number;
  public maxHp: number;
  public massKg: number = 75.0;
  public hasShield: boolean = false;
  public isDead: boolean = false;
  public mesh: THREE.Group;
  public body: PhysicsBody;

  // AI timers & behaviors
  private attackCooldown = 0;
  private attackInterval = 1.6;
  private staggerTimer = 0;
  private ragdollTimer = 0;
  private splatTimer = 0;
  private shootRange = 12.0;
  private meleeRange = 1.8;
  private moveSpeed = 4.2;

  // Weapon to drop on disarm/kick
  public carriedWeapon: WeaponType = 'PISTOL';

  constructor(id: string, type: EnemyType, pos: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.position = pos.clone();
    this.velocity = new THREE.Vector3();

    // Stats configuration by type
    if (type === 'BOSS_MECH') {
      this.maxHp = 650;
      this.massKg = 350;
      this.moveSpeed = 2.8;
      this.shootRange = 16.0;
      this.attackInterval = 1.0;
      this.carriedWeapon = 'SHOTGUN';
    } else if (type === 'SHIELDER') {
      this.maxHp = 130;
      this.massKg = 95;
      this.hasShield = true;
      this.moveSpeed = 3.5;
      this.shootRange = 2.0;
      this.attackInterval = 1.4;
      this.carriedWeapon = 'PISTOL';
    } else if (type === 'GUNNER') {
      this.maxHp = 70;
      this.massKg = 70;
      this.moveSpeed = 3.8;
      this.shootRange = 14.0;
      this.attackInterval = 1.8;
      this.carriedWeapon = 'SMG';
    } else if (type === 'KAMIKAZE') {
      this.maxHp = 45;
      this.massKg = 65;
      this.moveSpeed = 6.2;
      this.shootRange = 1.5;
      this.attackInterval = 0.5;
      this.carriedWeapon = 'PISTOL';
    } else {
      // GRUNT
      this.maxHp = 80;
      this.massKg = 75;
      this.moveSpeed = 4.5;
      this.shootRange = 1.8;
      this.attackInterval = 1.2;
      this.carriedWeapon = Math.random() < 0.35 ? 'SHOTGUN' : 'PISTOL';
    }

    this.hp = this.maxHp;

    this.mesh = ProceduralModels.createEnemyMesh(type);
    this.mesh.position.copy(this.position);

    // Physics body
    this.body = {
      id: `enemy_${id}`,
      position: this.position,
      velocity: this.velocity,
      radius: type === 'BOSS_MECH' ? 1.2 : 0.45,
      height: type === 'BOSS_MECH' ? 3.0 : 1.9,
      mass: this.massKg,
      isStatic: false,
      isGrounded: true,
      useGravity: true,
      drag: 1.2,
      restitution: 0.25,
      onCollide: (other, normal, impactSpeed) => {
        this.handleCollision(other, normal, impactSpeed);
      },
    };

    PhysicsWorld.getInstance().addBody(this.body);
  }

  public launchRagdoll(launchVector: THREE.Vector3): void {
    this.state = 'RAGDOLL_FLYING';
    this.ragdollTimer = 1.5;
    this.velocity.copy(launchVector);
    this.body.drag = 0.4;
    this.body.restitution = 0.45;

    // Knock off shield if active
    if (this.hasShield) {
      this.hasShield = false;
      const shieldObj = this.mesh.getObjectByName('riotShield');
      if (shieldObj) shieldObj.visible = false;
    }
  }

  public takeDamage(dmg: number, isCritical = false, isWallSplat = false): boolean {
    if (this.isDead) return false;

    this.hp -= dmg;
    EventBus.getInstance().emit('enemy:hit', {
      enemyId: this.id,
      damage: Math.round(dmg),
      isWallSplat,
      isCritical,
    });

    // Stagger if not flying
    if (this.state !== 'RAGDOLL_FLYING' && this.state !== 'WALL_SPLAT') {
      this.state = 'STAGGER';
      this.staggerTimer = 0.25;
      this.velocity.multiplyScalar(0.2);
    }

    if (this.hp <= 0) {
      this.die(isWallSplat);
      return true;
    }
    return false;
  }

  private handleCollision(other: CollisionBox | PhysicsBody, normal: THREE.Vector3, impactSpeed: number): void {
    if (this.state === 'RAGDOLL_FLYING' && impactSpeed > 6.0) {
      // WALL SPLAT TRIGGER
      const isWallSplat = impactSpeed >= 9.0;
      // Formula: impact_wall_damage = base_kick_dmg(45) + (ragdoll_velocity^1.45 * enemy_mass * 0.08) * (is_wall_splat ? 2.5 : 1.0)
      const speedTerm = Math.pow(impactSpeed, 1.45) * this.massKg * 0.08;
      const splatDamage = (45 + speedTerm) * (isWallSplat ? 2.5 : 1.0);

      this.state = 'WALL_SPLAT';
      this.splatTimer = 0.35;

      ParticleSystem.getInstance().spawnWallCrushDebris(this.position, normal, isWallSplat ? 22 : 12);
      AudioManager.getInstance().playKickHit(isWallSplat);
      EventBus.getInstance().emit('hitstop:trigger', { durationSec: isWallSplat ? 0.05 : 0.03 });
      EventBus.getInstance().emit('camera:shake', { intensity: isWallSplat ? 0.6 : 0.3, durationSec: 0.2 });

      if (isWallSplat) {
        EventBus.getInstance().emit('ui:floatingText', {
          text: 'WALL CRUSH x2.5!',
          color: '#ff7700',
          scale: 1.6,
          worldPos: [this.position.x, this.position.y + 1.2, this.position.z],
          duration: 1.2,
        });
      }

      this.takeDamage(splatDamage, isWallSplat, true);
    }
  }

  private die(isWallSplat: boolean): void {
    if (this.isDead) return;
    this.isDead = true;
    const wasKickKilled = this.state === 'WALL_SPLAT' || this.state === 'RAGDOLL_FLYING' || isWallSplat;
    this.state = 'DEAD';

    ParticleSystem.getInstance().spawnSparks(this.position, 18, 0xff3333);

    EventBus.getInstance().emit('enemy:killed', {
      enemyId: this.id,
      type: this.type,
      byKick: wasKickKilled,
      isWallSplat,
      position: [this.position.x, this.position.y, this.position.z],
    });
  }

  public update(dt: number, playerPos: THREE.Vector3, onEnemyShoot?: (enemy: Enemy, dir: THREE.Vector3) => void): void {
    if (this.isDead) return;

    // 1. RAGDOLL / SPLAT timers
    if (this.state === 'WALL_SPLAT') {
      this.splatTimer -= dt;
      if (this.splatTimer <= 0) {
        this.state = 'STAGGER';
        this.staggerTimer = 0.3;
      }
      this.mesh.position.copy(this.position);
      return;
    }

    if (this.state === 'RAGDOLL_FLYING') {
      this.ragdollTimer -= dt;
      // Ragdoll tumble rotation
      this.mesh.rotation.x += 12.0 * dt;
      this.mesh.rotation.z += 8.0 * dt;
      this.mesh.position.copy(this.position);

      if (this.ragdollTimer <= 0 && this.body.isGrounded) {
        this.state = 'STAGGER';
        this.staggerTimer = 0.4;
        this.mesh.rotation.set(0, this.mesh.rotation.y, 0);
        this.body.drag = 1.2;
      }
      return;
    }

    if (this.state === 'STAGGER') {
      this.staggerTimer -= dt;
      if (this.staggerTimer <= 0) {
        this.state = 'CHASE';
      }
      this.mesh.position.copy(this.position);
      return;
    }

    // 2. AI Behavior & Movement
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    const distToPlayer = toPlayer.length();
    toPlayer.y = 0;
    toPlayer.normalize();

    // Look at player
    const angleY = Math.atan2(toPlayer.x, toPlayer.z);
    this.mesh.rotation.y = angleY;

    this.attackCooldown -= dt;

    if (distToPlayer > this.shootRange) {
      // Approach
      this.velocity.x = toPlayer.x * this.moveSpeed;
      this.velocity.z = toPlayer.z * this.moveSpeed;
    } else if (distToPlayer > this.meleeRange && this.type === 'GRUNT') {
      // Grunt runs into melee range
      this.velocity.x = toPlayer.x * this.moveSpeed;
      this.velocity.z = toPlayer.z * this.moveSpeed;
    } else {
      // In combat range: strafe / aim / shoot
      this.velocity.x = 0;
      this.velocity.z = 0;

      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.attackInterval;
        if (onEnemyShoot) {
          const aimDir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
          onEnemyShoot(this, aimDir);
        }
      }
    }

    this.mesh.position.copy(this.position);
  }

  public destroy(scene: THREE.Scene): void {
    PhysicsWorld.getInstance().removeBody(this.body.id);
    scene.remove(this.mesh);
  }
}
