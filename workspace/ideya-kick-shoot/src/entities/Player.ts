import { Vector3D, WeaponType } from '../core/Types';
import { Weapon } from './Weapon';
import { MathUtils } from '../physics/MathUtils';
import { RigidBody } from '../physics/PhysicsWorld';

export enum KickState {
  READY = 'READY',
  WINDUP = 'WINDUP',
  ACTIVE_HITBOX = 'ACTIVE_HITBOX',
  HIT_FREEZE = 'HIT_FREEZE',
  RECOVERY = 'RECOVERY'
}

export class Player {
  public position: Vector3D = { x: 0, y: 0, z: 8 };
  public velocity: Vector3D = { x: 0, y: 0, z: 0 };
  public aimAngle: number = -Math.PI / 2; // facing north by default
  public radius: number = 0.65;

  public maxHp: number = 100;
  public hp: number = 100;
  public energy: number = 100;
  public maxEnergy: number = 100;

  public baseSpeed: number = 6.8;
  public moveSpeed: number = 6.8;

  // Kinetic Kick State Machine
  public kickState: KickState = KickState.READY;
  public kickStateTimer: number = 0;
  public kickCooldown: number = 0;
  public readonly kickCooldownDuration: number = 0.45;

  public kickRange: number = 2.4;
  public kickConeAngle: number = 55; // degrees
  public bootBoosterLevel: number = 0;

  // Secondary Ability Shockwave
  public abilityCooldown: number = 0;

  // Dash
  public dashCooldown: number = 0;
  public isDashing: boolean = false;
  public dashTimer: number = 0;

  // Weapon
  public currentWeapon: Weapon;
  public secondaryWeapon: Weapon | null = null;

  // Upgrades & Perks
  public shockSoles: boolean = false;
  public autoMagnetRadius: number = 2.4;
  public wallSmashHeal: number = 0;

  public rigidBody: RigidBody;

  constructor() {
    this.currentWeapon = new Weapon(WeaponType.PISTOL);

    this.rigidBody = {
      id: 'player',
      position: this.position,
      velocity: this.velocity,
      radius: this.radius,
      height: 1.8,
      mass: 80,
      isStatic: false,
      isGrounded: true,
      drag: 8.0,
      bounce: 0.1
    };
  }

  public reset(): void {
    this.position.x = 0;
    this.position.y = 0;
    this.position.z = 8;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
    this.kickState = KickState.READY;
    this.kickStateTimer = 0;
    this.kickCooldown = 0;
    this.currentWeapon = new Weapon(WeaponType.PISTOL);
  }

  public update(dt: number, moveX: number, moveZ: number, aimAngle: number): void {
    this.aimAngle = aimAngle;

    // 1. Dash handling
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // 2. Movement Acceleration
    if (!this.isDashing) {
      const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;
      if (isMoving) {
        const accel = 45;
        this.velocity.x += moveX * accel * dt;
        this.velocity.z += moveZ * accel * dt;

        // Speed clamping
        const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (currentSpeed > this.moveSpeed) {
          this.velocity.x = (this.velocity.x / currentSpeed) * this.moveSpeed;
          this.velocity.z = (this.velocity.z / currentSpeed) * this.moveSpeed;
        }
      }
    }

    // 3. Kick State Machine
    if (this.kickCooldown > 0) this.kickCooldown -= dt;
    if (this.abilityCooldown > 0) this.abilityCooldown -= dt;

    if (this.kickState !== KickState.READY) {
      this.kickStateTimer -= dt;
      if (this.kickStateTimer <= 0) {
        switch (this.kickState) {
          case KickState.WINDUP:
            this.kickState = KickState.ACTIVE_HITBOX;
            this.kickStateTimer = 0.12; // 0.12s active hitbox window
            break;
          case KickState.ACTIVE_HITBOX:
            this.kickState = KickState.RECOVERY;
            this.kickStateTimer = 0.16; // 0.16s recovery
            break;
          case KickState.HIT_FREEZE:
            this.kickState = KickState.RECOVERY;
            this.kickStateTimer = 0.16;
            break;
          case KickState.RECOVERY:
            this.kickState = KickState.READY;
            break;
        }
      }
    }

    // 4. Energy regeneration
    if (this.energy < this.maxEnergy) {
      this.energy = Math.min(this.maxEnergy, this.energy + 18 * dt);
    }

    // 5. Update weapon
    this.currentWeapon.update(dt);
  }

  public triggerDash(): boolean {
    if (this.dashCooldown > 0 || this.isDashing) return false;

    // Dash towards aim or movement direction
    let dirX = Math.cos(this.aimAngle);
    let dirZ = Math.sin(this.aimAngle);

    const moveMag = Math.hypot(this.velocity.x, this.velocity.z);
    if (moveMag > 0.5) {
      dirX = this.velocity.x / moveMag;
      dirZ = this.velocity.z / moveMag;
    }

    const dashSpeed = 22.0;
    this.velocity.x = dirX * dashSpeed;
    this.velocity.z = dirZ * dashSpeed;
    this.isDashing = true;
    this.dashTimer = 0.22;
    this.dashCooldown = 0.9;
    return true;
  }

  public triggerKick(): boolean {
    if (this.kickState !== KickState.READY || this.kickCooldown > 0) {
      return false;
    }

    this.kickState = KickState.WINDUP;
    this.kickStateTimer = 0.07; // 0.07s windup
    this.kickCooldown = this.kickCooldownDuration;
    return true;
  }

  public getKickLaunchVelocity(): number {
    const forwardSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    // BaseLaunchSpeed (17.5 m/s) * (1.0 + BootBoosterUpgrade * 0.12) * clamp(PlayerForwardSpeed / 6.0 m/s, 1.0, 1.6)
    const baseSpeed = 17.5;
    const upgradeFactor = 1.0 + this.bootBoosterLevel * 0.12;
    const speedBonus = MathUtils.clamp(forwardSpeed / 6.0, 1.0, 1.6);
    return baseSpeed * upgradeFactor * speedBonus;
  }

  public takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      return true; // Dead
    }
    return false;
  }

  public equipWeapon(weapon: Weapon): void {
    this.currentWeapon = weapon;
  }
}
