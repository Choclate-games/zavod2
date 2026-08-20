import { EnemyState, EnemyType, Vector3D, WeaponType } from '../core/Types';
import { RigidBody } from '../physics/PhysicsWorld';
import { MathUtils } from '../physics/MathUtils';

export class Enemy {
  public id: string;
  public type: EnemyType;
  public state: EnemyState = EnemyState.IDLE;

  public position: Vector3D = { x: 0, y: 0, z: 0 };
  public velocity: Vector3D = { x: 0, y: 0, z: 0 };
  public radius: number = 0.65;
  public height: number = 1.8;
  public mass: number = 75;

  public hp: number = 60;
  public maxHp: number = 60;
  public moveSpeed: number = 4.0;
  public attackCooldown: number = 0;
  public attackRange: number = 1.6;
  public damage: number = 15;

  // Airborne Skeet Juggling
  public isAirborneSkeet: boolean = false;
  public skeetHangTimer: number = 0;
  public readonly maxSkeetHangTime: number = 0.95;

  // Stun / Domino
  public stunTimer: number = 0;
  public isDominoProjectile: boolean = false;

  // Shield / Armor
  public hasShield: boolean = false;
  public shieldHp: number = 50;
  public isSpikedArmor: boolean = false;

  // Disarm
  public carriedWeaponType: WeaponType | null = null;

  public isActive: boolean = false;
  public rigidBody: RigidBody;

  constructor(id: string) {
    this.id = id;
    this.type = EnemyType.GRUNT;

    this.rigidBody = {
      id: this.id,
      position: this.position,
      velocity: this.velocity,
      radius: this.radius,
      height: this.height,
      mass: this.mass,
      isStatic: false,
      isGrounded: true,
      drag: 5.5,
      bounce: 0.35,
      onWallCollision: (speed, normal) => this.handleWallCollision(speed, normal),
      onBodyCollision: (other, speed) => this.handleBodyCollision(other, speed)
    };
  }

  public init(type: EnemyType, x: number, z: number, sectorMultiplier: number = 1.0): void {
    this.type = type;
    this.isActive = true;
    this.state = EnemyState.CHASE;
    this.position.x = x;
    this.position.y = 0;
    this.position.z = z;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.isAirborneSkeet = false;
    this.skeetHangTimer = 0;
    this.stunTimer = 0;
    this.isDominoProjectile = false;
    this.attackCooldown = 1.0 + Math.random() * 0.5;

    switch (type) {
      case EnemyType.SHIELD_SOLDIER:
        this.maxHp = Math.round(110 * sectorMultiplier);
        this.hp = this.maxHp;
        this.moveSpeed = 3.2;
        this.damage = 18;
        this.hasShield = true;
        this.shieldHp = 50;
        this.isSpikedArmor = false;
        this.radius = 0.75;
        this.mass = 95;
        this.carriedWeaponType = WeaponType.SHOTGUN;
        break;

      case EnemyType.BERSERKER:
        this.maxHp = Math.round(90 * sectorMultiplier);
        this.hp = this.maxHp;
        this.moveSpeed = 5.6;
        this.damage = 25;
        this.hasShield = false;
        this.isSpikedArmor = true;
        this.radius = 0.7;
        this.mass = 85;
        this.carriedWeaponType = null;
        break;

      case EnemyType.SNIPER:
        this.maxHp = Math.round(50 * sectorMultiplier);
        this.hp = this.maxHp;
        this.moveSpeed = 3.5;
        this.damage = 30;
        this.attackRange = 12.0;
        this.hasShield = false;
        this.isSpikedArmor = false;
        this.radius = 0.55;
        this.mass = 65;
        this.carriedWeaponType = WeaponType.ASSAULT_RIFLE;
        break;

      case EnemyType.BOSS_COLOSSUS:
        this.maxHp = Math.round(650 * sectorMultiplier);
        this.hp = this.maxHp;
        this.moveSpeed = 2.4;
        this.damage = 40;
        this.attackRange = 4.0;
        this.hasShield = true;
        this.shieldHp = 180;
        this.isSpikedArmor = false;
        this.radius = 1.5;
        this.mass = 400;
        this.carriedWeaponType = WeaponType.ROCKET_LAUNCHER;
        break;

      case EnemyType.GRUNT:
      default:
        this.maxHp = Math.round(60 * sectorMultiplier);
        this.hp = this.maxHp;
        this.moveSpeed = 4.2;
        this.damage = 14;
        this.hasShield = false;
        this.isSpikedArmor = false;
        this.radius = 0.65;
        this.mass = 75;
        this.carriedWeaponType = Math.random() > 0.4 ? WeaponType.PISTOL : null;
        break;
    }

    this.rigidBody.radius = this.radius;
    this.rigidBody.mass = this.mass;
  }

  public update(dt: number, playerPos: Vector3D): void {
    if (!this.isActive || this.state === EnemyState.DEAD) return;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // Check Airborne Skeet status
    if (this.isAirborneSkeet) {
      this.skeetHangTimer -= dt;
      if (this.position.y <= 0.1 && this.skeetHangTimer <= 0) {
        this.isAirborneSkeet = false;
        this.isDominoProjectile = false;
        this.state = EnemyState.CHASE;
      }
    }

    // Stun state
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.state = EnemyState.CHASE;
      }
      return;
    }

    if (this.isAirborneSkeet || this.state === EnemyState.RAGDOLL_FLYING) {
      return; // Physics takes over
    }

    // AI Chase & Behavior
    const distToPlayer = MathUtils.distance2D(this.position.x, this.position.z, playerPos.x, playerPos.z);

    if (distToPlayer > this.attackRange) {
      this.state = EnemyState.CHASE;
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const norm = Math.hypot(dx, dz);

      if (norm > 0.01) {
        this.velocity.x = (dx / norm) * this.moveSpeed;
        this.velocity.z = (dz / norm) * this.moveSpeed;
      }
    } else {
      this.state = EnemyState.ATTACK;
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
    }
  }

  public applyKickLaunch(impulse: Vector3D): void {
    this.velocity.x = impulse.x;
    this.velocity.y = Math.max(8.5, impulse.y);
    this.velocity.z = impulse.z;

    this.isAirborneSkeet = true;
    this.skeetHangTimer = this.maxSkeetHangTime;
    this.isDominoProjectile = true;
    this.state = EnemyState.AIRBORNE_SKEET;
  }

  private handleWallCollision(speed: number, normal: Vector3D): void {
    if (this.isDominoProjectile || speed > 5.0) {
      // Wall Impact Damage formula: 45 + (speed ^ 1.4) * 1.15
      const wallDamage = 45 + Math.pow(speed, 1.4) * 1.15;
      this.hp -= Math.round(wallDamage);
      this.stunTimer = 0.6;
      this.state = EnemyState.WALL_STUNNED;
      this.isDominoProjectile = false;
    }
  }

  private handleBodyCollision(other: RigidBody, relSpeed: number): void {
    if (this.isDominoProjectile && relSpeed > 4.0) {
      // Domino damage: speed * 4.5
      const damage = relSpeed * 4.5;
      this.hp -= Math.round(damage * 0.5);
    }
  }

  public takeDamage(amount: number, isSkeetShot: boolean = false): boolean {
    let finalDamage = amount;
    if (isSkeetShot && this.isAirborneSkeet) {
      finalDamage *= 2.5; // Skeet crit 2.5x
    }

    if (this.hasShield && this.shieldHp > 0 && !isSkeetShot) {
      this.shieldHp -= finalDamage;
      if (this.shieldHp <= 0) {
        this.hasShield = false;
      }
      return false;
    }

    this.hp -= Math.round(finalDamage);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = EnemyState.DEAD;
      this.isActive = false;
      return true; // Enemy Died
    }
    return false;
  }
}
