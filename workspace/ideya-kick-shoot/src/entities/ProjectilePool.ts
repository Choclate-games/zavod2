import { Vector3D, WeaponType } from '../core/Types';

export interface Projectile {
  id: string;
  isPlayerOwned: boolean;
  type: WeaponType;
  position: Vector3D;
  velocity: Vector3D;
  damage: number;
  radius: number;
  lifeTimer: number;
  isExplosive: boolean;
  isActive: boolean;
}

export class ProjectilePool {
  private pool: Projectile[] = [];
  private activeProjectiles: Projectile[] = [];

  constructor(initialCapacity: number = 64) {
    for (let i = 0; i < initialCapacity; i++) {
      this.pool.push({
        id: `proj_${i}`,
        isPlayerOwned: true,
        type: WeaponType.PISTOL,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        damage: 25,
        radius: 0.15,
        lifeTimer: 2.0,
        isExplosive: false,
        isActive: false
      });
    }
  }

  public spawn(
    isPlayerOwned: boolean,
    type: WeaponType,
    startX: number,
    startY: number,
    startZ: number,
    dirX: number,
    dirZ: number,
    speed: number,
    damage: number,
    spread: number = 0
  ): Projectile {
    let proj = this.pool.pop();
    if (!proj) {
      proj = {
        id: `proj_${Date.now()}_${Math.random()}`,
        isPlayerOwned,
        type,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        damage,
        radius: type === WeaponType.ROCKET_LAUNCHER ? 0.35 : 0.15,
        lifeTimer: 2.5,
        isExplosive: type === WeaponType.ROCKET_LAUNCHER,
        isActive: true
      };
    }

    proj.isPlayerOwned = isPlayerOwned;
    proj.type = type;
    proj.damage = damage;
    proj.position.x = startX;
    proj.position.y = startY;
    proj.position.z = startZ;
    proj.radius = type === WeaponType.ROCKET_LAUNCHER ? 0.35 : 0.15;
    proj.isExplosive = type === WeaponType.ROCKET_LAUNCHER;
    proj.lifeTimer = 2.0;
    proj.isActive = true;

    // Apply Spread
    const angle = Math.atan2(dirZ, dirX) + (Math.random() - 0.5) * spread;
    proj.velocity.x = Math.cos(angle) * speed;
    proj.velocity.y = 0;
    proj.velocity.z = Math.sin(angle) * speed;

    this.activeProjectiles.push(proj);
    return proj;
  }

  public update(dt: number): void {
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i];
      proj.lifeTimer -= dt;

      proj.position.x += proj.velocity.x * dt;
      proj.position.y += proj.velocity.y * dt;
      proj.position.z += proj.velocity.z * dt;

      if (proj.lifeTimer <= 0 || !proj.isActive) {
        proj.isActive = false;
        this.activeProjectiles.splice(i, 1);
        this.pool.push(proj);
      }
    }
  }

  public getActive(): Projectile[] {
    return this.activeProjectiles;
  }

  public clear(): void {
    for (let i = 0; i < this.activeProjectiles.length; i++) {
      this.activeProjectiles[i].isActive = false;
      this.pool.push(this.activeProjectiles[i]);
    }
    this.activeProjectiles = [];
  }
}
