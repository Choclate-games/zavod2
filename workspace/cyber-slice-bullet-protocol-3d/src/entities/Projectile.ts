import * as THREE from 'three';

export type ProjectileType = 'laser' | 'plasma' | 'rocket' | 'razor_wind';

export class Projectile {
  public mesh: THREE.Mesh;
  public type: ProjectileType;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isHostile: boolean;
  public damage: number;
  public life: number = 0;
  public maxLife: number = 5.0;
  public radius: number = 0.5;
  public isDead: boolean = false;

  private scene: THREE.Scene;

  constructor(
    scene: THREE.Scene,
    type: ProjectileType,
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    damage: number,
    isHostile: boolean = true
  ) {
    this.scene = scene;
    this.type = type;
    this.position.copy(pos);
    this.velocity.copy(dir).normalize().multiplyScalar(speed);
    this.damage = damage;
    this.isHostile = isHostile;

    this.mesh = this.createMesh(type, isHostile);
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    this.scene.add(this.mesh);
  }

  private createMesh(type: ProjectileType, isHostile: boolean): THREE.Mesh {
    let geo: THREE.BufferGeometry;
    let mat: THREE.Material;

    const color = isHostile ? 0xff0055 : 0x00f3ff;

    switch (type) {
      case 'laser':
        geo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6);
        geo.rotateX(Math.PI / 2);
        mat = new THREE.MeshBasicMaterial({ color });
        this.radius = 0.45;
        break;

      case 'plasma':
        geo = new THREE.SphereGeometry(0.4, 8, 8);
        mat = new THREE.MeshStandardMaterial({
          color: 0xffaa00,
          emissive: 0xff4400,
          emissiveIntensity: 1.5
        });
        this.radius = 0.6;
        break;

      case 'rocket':
        geo = new THREE.ConeGeometry(0.25, 1.0, 6);
        geo.rotateX(Math.PI / 2);
        mat = new THREE.MeshStandardMaterial({
          color: 0x333333,
          emissive: 0xff0000,
          emissiveIntensity: 0.8
        });
        this.radius = 0.55;
        break;

      case 'razor_wind':
        geo = new THREE.TorusGeometry(1.2, 0.08, 4, 16, Math.PI);
        geo.rotateY(Math.PI / 2);
        mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, side: THREE.DoubleSide });
        this.radius = 1.2;
        break;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  public update(dt: number, targetPos?: THREE.Vector3): void {
    this.life += dt;
    if (this.life >= this.maxLife) {
      this.isDead = true;
      return;
    }

    // Rocket homing logic
    if (this.type === 'rocket' && targetPos && this.isHostile) {
      const desired = targetPos.clone().sub(this.position).normalize();
      const currentDir = this.velocity.clone().normalize();
      const newDir = currentDir.lerp(desired, 3.5 * dt).normalize();
      const speed = this.velocity.length();
      this.velocity.copy(newDir).multiplyScalar(speed);
      this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), newDir);
    }

    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);

    // Floor collision
    if (this.position.y < 0.2) {
      this.isDead = true;
    }
  }

  public reflect(newDirection: THREE.Vector3): void {
    this.isHostile = false;
    const speed = this.velocity.length() * 1.5;
    this.velocity.copy(newDirection).normalize().multiplyScalar(speed);
    this.damage *= 2.0;

    if (this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.color.setHex(0x00f3ff);
    } else if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
      this.mesh.material.emissive.setHex(0x00f3ff);
    }
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) this.mesh.material.dispose();
  }
}
