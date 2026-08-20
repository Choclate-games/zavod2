import * as THREE from 'three';

export interface Projectile {
  active: boolean;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  areaRadius: number;
  isExplosive: boolean;
  fromPlayer: boolean;
  life: number;
  maxLife: number;
  homingTarget?: THREE.Vector3;
}

const _scratchUp = new THREE.Vector3(0, 1, 0);
const _scratchDir = new THREE.Vector3();

export class ProjectileManager {
  public group = new THREE.Group();

  // Pre-allocated Object Pools
  private bulletPool: Projectile[] = [];
  private rocketPool: Projectile[] = [];
  private acidPool: Projectile[] = [];

  private bulletGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

  private rocketGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8);
  private rocketMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });

  private acidGeo = new THREE.SphereGeometry(0.3, 8, 8);
  private acidMat = new THREE.MeshBasicMaterial({ color: 0x76ff03 });

  constructor() {
    // 1. Bullet Pool (80 pre-allocated objects)
    for (let i = 0; i < 80; i++) {
      const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.visible = false;
      this.group.add(mesh);

      this.bulletPool.push({
        active: false,
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        damage: 10,
        areaRadius: 0.8,
        isExplosive: false,
        fromPlayer: true,
        life: 0,
        maxLife: 1.2,
      });
    }

    // 2. Rocket Pool (25 pre-allocated objects)
    for (let i = 0; i < 25; i++) {
      const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      mesh.visible = false;
      this.group.add(mesh);

      this.rocketPool.push({
        active: false,
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        damage: 85,
        areaRadius: 6.0,
        isExplosive: true,
        fromPlayer: true,
        life: 0,
        maxLife: 2.5,
      });
    }

    // 3. Acid Glob Pool (35 pre-allocated objects)
    for (let i = 0; i < 35; i++) {
      const mesh = new THREE.Mesh(this.acidGeo, this.acidMat);
      mesh.visible = false;
      this.group.add(mesh);

      this.acidPool.push({
        active: false,
        mesh,
        position: mesh.position,
        velocity: new THREE.Vector3(),
        damage: 16,
        areaRadius: 2.4,
        isExplosive: true,
        fromPlayer: false,
        life: 0,
        maxLife: 2.0,
      });
    }
  }

  // Active projectiles view for collision systems
  public get projectiles(): Projectile[] {
    const list: Projectile[] = [];
    for (let i = 0; i < this.bulletPool.length; i++) {
      if (this.bulletPool[i].active) list.push(this.bulletPool[i]);
    }
    for (let i = 0; i < this.rocketPool.length; i++) {
      if (this.rocketPool[i].active) list.push(this.rocketPool[i]);
    }
    for (let i = 0; i < this.acidPool.length; i++) {
      if (this.acidPool[i].active) list.push(this.acidPool[i]);
    }
    return list;
  }

  public forEachActive(callback: (p: Projectile) => void): void {
    for (let i = 0; i < this.bulletPool.length; i++) {
      if (this.bulletPool[i].active) callback(this.bulletPool[i]);
    }
    for (let i = 0; i < this.rocketPool.length; i++) {
      if (this.rocketPool[i].active) callback(this.rocketPool[i]);
    }
    for (let i = 0; i < this.acidPool.length; i++) {
      if (this.acidPool[i].active) callback(this.acidPool[i]);
    }
  }

  public spawnBullet(origin: THREE.Vector3, direction: THREE.Vector3, damage: number): void {
    let p: Projectile | null = null;
    for (let i = 0; i < this.bulletPool.length; i++) {
      if (!this.bulletPool[i].active) {
        p = this.bulletPool[i];
        break;
      }
    }
    if (!p) return; // Pool exhausted

    _scratchDir.copy(direction).normalize();
    p.mesh.quaternion.setFromUnitVectors(_scratchUp, _scratchDir);
    p.position.copy(origin);
    p.mesh.position.copy(origin);
    p.velocity.set(_scratchDir.x * 55, _scratchDir.y * 55, _scratchDir.z * 55);
    p.damage = damage;
    p.areaRadius = 0.8;
    p.isExplosive = false;
    p.fromPlayer = true;
    p.life = 0;
    p.maxLife = 1.2;
    p.active = true;
    p.mesh.visible = true;
  }

  public spawnRocket(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, target?: THREE.Vector3): void {
    let p: Projectile | null = null;
    for (let i = 0; i < this.rocketPool.length; i++) {
      if (!this.rocketPool[i].active) {
        p = this.rocketPool[i];
        break;
      }
    }
    if (!p) return;

    _scratchDir.copy(direction).normalize();
    p.mesh.quaternion.setFromUnitVectors(_scratchUp, _scratchDir);
    p.position.copy(origin);
    p.mesh.position.copy(origin);
    p.velocity.set(_scratchDir.x * 28, _scratchDir.y * 28, _scratchDir.z * 28);
    p.damage = damage;
    p.areaRadius = 6.0;
    p.isExplosive = true;
    p.fromPlayer = true;
    p.life = 0;
    p.maxLife = 2.5;
    p.homingTarget = target;
    p.active = true;
    p.mesh.visible = true;
  }

  public spawnAcidGlob(origin: THREE.Vector3, targetPos: THREE.Vector3, damage: number): void {
    let p: Projectile | null = null;
    for (let i = 0; i < this.acidPool.length; i++) {
      if (!this.acidPool[i].active) {
        p = this.acidPool[i];
        break;
      }
    }
    if (!p) return;

    const dx = targetPos.x - origin.x;
    const dy = targetPos.y - origin.y;
    const dz = targetPos.z - origin.z;
    const dist = Math.hypot(dx, dz);
    const flightTime = Math.max(0.6, dist / 18);
    const vx = dx / flightTime;
    const vz = dz / flightTime;
    const vy = (dy + 0.5 * 14 * flightTime * flightTime) / flightTime;

    p.position.copy(origin);
    p.mesh.position.copy(origin);
    p.velocity.set(vx, vy, vz);
    p.damage = damage;
    p.areaRadius = 2.4;
    p.isExplosive = true;
    p.fromPlayer = false;
    p.life = 0;
    p.maxLife = flightTime + 0.1;
    p.active = true;
    p.mesh.visible = true;
  }

  public update(dt: number, onExplode?: (proj: Projectile) => void): void {
    // 1. Update Bullets
    for (let i = 0; i < this.bulletPool.length; i++) {
      const p = this.bulletPool[i];
      if (!p.active) continue;

      p.life += dt;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;
      p.mesh.position.copy(p.position);

      if (p.position.y <= 0.1 || p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // 2. Update Rockets
    for (let i = 0; i < this.rocketPool.length; i++) {
      const p = this.rocketPool[i];
      if (!p.active) continue;

      p.life += dt;

      if (p.homingTarget) {
        _scratchDir.set(
          p.homingTarget.x - p.position.x,
          p.homingTarget.y - p.position.y,
          p.homingTarget.z - p.position.z
        ).normalize().multiplyScalar(34);

        p.velocity.lerp(_scratchDir, dt * 3.5);
        _scratchDir.copy(p.velocity).normalize();
        p.mesh.quaternion.setFromUnitVectors(_scratchUp, _scratchDir);
      }

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;
      p.mesh.position.copy(p.position);

      if (p.position.y <= 0.1 || p.life >= p.maxLife) {
        if (p.isExplosive) {
          onExplode?.(p);
        }
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // 3. Update Acid Globs
    for (let i = 0; i < this.acidPool.length; i++) {
      const p = this.acidPool[i];
      if (!p.active) continue;

      p.life += dt;
      p.velocity.y -= 14 * dt;

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;
      p.mesh.position.copy(p.position);

      if (p.position.y <= 0.1 || p.life >= p.maxLife) {
        if (p.isExplosive) {
          onExplode?.(p);
        }
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  public deactivate(p: Projectile): void {
    p.active = false;
    p.mesh.visible = false;
  }

  public clear(): void {
    for (let i = 0; i < this.bulletPool.length; i++) {
      this.bulletPool[i].active = false;
      this.bulletPool[i].mesh.visible = false;
    }
    for (let i = 0; i < this.rocketPool.length; i++) {
      this.rocketPool[i].active = false;
      this.rocketPool[i].mesh.visible = false;
    }
    for (let i = 0; i < this.acidPool.length; i++) {
      this.acidPool[i].active = false;
      this.acidPool[i].mesh.visible = false;
    }
  }
}
