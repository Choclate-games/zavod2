import { Vector3D, WeaponType } from '../core/Types';
import { RigidBody, PhysicsWorld } from '../physics/PhysicsWorld';

export class ExplosiveBarrel {
  public id: string;
  public position: Vector3D;
  public velocity: Vector3D = { x: 0, y: 0, z: 0 };
  public radius: number = 0.75;
  public isDetonated: boolean = false;
  public rigidBody: RigidBody;

  constructor(id: string, x: number, z: number) {
    this.id = id;
    this.position = { x, y: 0, z };

    this.rigidBody = {
      id: this.id,
      position: this.position,
      velocity: this.velocity,
      radius: this.radius,
      height: 1.4,
      mass: 50,
      isStatic: false,
      isGrounded: true,
      drag: 4.0,
      bounce: 0.4,
      onWallCollision: (speed) => {
        if (speed > 6.0) this.isDetonated = true;
      },
      onBodyCollision: (other, speed) => {
        if (speed > 4.5) this.isDetonated = true;
      }
    };
  }
}

export class BreachDoor {
  public id: string;
  public position: Vector3D;
  public velocity: Vector3D = { x: 0, y: 0, z: 0 };
  public isBreached: boolean = false;
  public isHingesBroken: boolean = false;
  public rigidBody: RigidBody;

  constructor(id: string, x: number, z: number) {
    this.id = id;
    this.position = { x, y: 0, z };

    this.rigidBody = {
      id: this.id,
      position: this.position,
      velocity: this.velocity,
      radius: 1.8,
      height: 3.0,
      mass: 200,
      isStatic: true,
      isGrounded: true,
      drag: 3.0,
      bounce: 0.2
    };
  }

  public breach(forwardX: number, forwardZ: number): void {
    if (this.isBreached) return;
    this.isBreached = true;
    this.isHingesBroken = true;
    this.rigidBody.isStatic = false;
    const launchSpeed = 22.0;
    this.velocity.x = forwardX * launchSpeed;
    this.velocity.y = 4.0;
    this.velocity.z = forwardZ * launchSpeed;
  }
}

export class DroppedWeaponPickup {
  public id: string;
  public type: WeaponType;
  public position: Vector3D;
  public velocity: Vector3D;
  public isMidAirCatchable: boolean = true;
  public lifeTimer: number = 6.0;
  public isPickedUp: boolean = false;

  constructor(id: string, type: WeaponType, x: number, y: number, z: number, impulse: Vector3D) {
    this.id = id;
    this.type = type;
    this.position = { x, y, z };
    this.velocity = { ...impulse };
  }

  public update(dt: number): void {
    if (this.lifeTimer > 0) this.lifeTimer -= dt;

    // Ballistic flight
    if (this.position.y > 0 || this.velocity.y > 0) {
      this.velocity.y -= 25.0 * dt;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;
      }
    }
  }
}

export class DroppedShardPickup {
  public id: string;
  public type: 'plasma' | 'ammo' | 'health';
  public amount: number;
  public position: Vector3D;
  public velocity: Vector3D;
  public isCollected: boolean = false;

  constructor(id: string, type: 'plasma' | 'ammo' | 'health', amount: number, x: number, z: number) {
    this.id = id;
    this.type = type;
    this.amount = amount;
    this.position = { x, y: 0.3, z };
    this.velocity = {
      x: (Math.random() - 0.5) * 5,
      y: 4.5 + Math.random() * 3,
      z: (Math.random() - 0.5) * 5
    };
  }

  public update(dt: number, playerPos: Vector3D, magnetRadius: number): boolean {
    if (this.position.y > 0 || this.velocity.y > 0) {
      this.velocity.y -= 25.0 * dt;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;

      if (this.position.y <= 0) {
        this.position.y = 0;
      }
    }

    // Magnet to player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < magnetRadius) {
      const speed = 12.0;
      this.position.x += (dx / dist) * speed * dt;
      this.position.z += (dz / dist) * speed * dt;
      if (dist < 0.8) {
        this.isCollected = true;
        return true;
      }
    }

    return false;
  }
}
