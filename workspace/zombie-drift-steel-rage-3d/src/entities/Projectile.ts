import * as THREE from 'three';

export interface Projectile {
  mesh: THREE.Mesh | THREE.Group;
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

export class ProjectileManager {
  public group = new THREE.Group();
  public projectiles: Projectile[] = [];

  private bulletGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

  private rocketGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8);
  private rocketMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });

  private acidGeo = new THREE.SphereGeometry(0.3, 8, 8);
  private acidMat = new THREE.MeshBasicMaterial({ color: 0x76ff03 });

  public spawnBullet(origin: THREE.Vector3, direction: THREE.Vector3, damage: number): void {
    const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.position.copy(origin);
    this.group.add(mesh);

    this.projectiles.push({
      mesh,
      position: mesh.position,
      velocity: direction.clone().normalize().multiplyScalar(55),
      damage,
      areaRadius: 0.8,
      isExplosive: false,
      fromPlayer: true,
      life: 0,
      maxLife: 1.2,
    });
  }

  public spawnRocket(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, target?: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.position.copy(origin);
    this.group.add(mesh);

    this.projectiles.push({
      mesh,
      position: mesh.position,
      velocity: direction.clone().normalize().multiplyScalar(28),
      damage,
      areaRadius: 5.5,
      isExplosive: true,
      fromPlayer: true,
      life: 0,
      maxLife: 2.5,
      homingTarget: target,
    });
  }

  public spawnAcidGlob(origin: THREE.Vector3, targetPos: THREE.Vector3, damage: number): void {
    const mesh = new THREE.Mesh(this.acidGeo, this.acidMat);
    mesh.position.copy(origin);
    this.group.add(mesh);

    const dir = targetPos.clone().sub(origin);
    const dist = dir.length();
    const flightTime = Math.max(0.6, dist / 18);
    const vx = dir.x / flightTime;
    const vz = dir.z / flightTime;
    const vy = (dir.y + 0.5 * 14 * flightTime * flightTime) / flightTime;

    this.projectiles.push({
      mesh,
      position: mesh.position,
      velocity: new THREE.Vector3(vx, vy, vz),
      damage,
      areaRadius: 2.2,
      isExplosive: true,
      fromPlayer: false,
      life: 0,
      maxLife: flightTime + 0.1,
    });
  }

  public update(dt: number, onExplode?: (proj: Projectile) => void): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;

      // Homing guidance for rockets
      if (p.homingTarget && p.isExplosive && p.fromPlayer) {
        const targetDir = p.homingTarget.clone().sub(p.position).normalize();
        p.velocity.lerp(targetDir.multiplyScalar(32), dt * 3.5);
        p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.velocity.clone().normalize());
      }

      // Acid gravity
      if (!p.fromPlayer) {
        p.velocity.y -= 14 * dt;
      }

      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      // Hit ground or expired
      if (p.position.y <= 0.1 || p.life >= p.maxLife) {
        if (p.isExplosive) {
          onExplode?.(p);
        }
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  public removeProjectile(index: number): void {
    const p = this.projectiles[index];
    if (p) {
      this.group.remove(p.mesh);
      this.projectiles.splice(index, 1);
    }
  }
}
