import * as THREE from 'three';
import { ProjectileData } from '../types';

export class Projectile {
  public data: ProjectileData;
  public isDead: boolean = false;

  constructor(
    pos: THREE.Vector3,
    velocity: THREE.Vector3,
    damage: number,
    isPlayer: boolean,
    type: 'spike' | 'arrow' | 'fireball' | 'spore' = 'spike'
  ) {
    let mesh: THREE.Mesh;
    let radius = 0.2;

    if (type === 'spike') {
      const geom = new THREE.ConeGeometry(0.12, 0.6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
      mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = Math.PI / 2;
      radius = 0.25;
    } else if (type === 'arrow') {
      const geom = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
      mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = Math.PI / 2;
      radius = 0.2;
    } else if (type === 'fireball') {
      const geom = new THREE.SphereGeometry(0.3, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
      mesh = new THREE.Mesh(geom, mat);
      radius = 0.35;
    } else {
      // Spore
      const geom = new THREE.SphereGeometry(0.2, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
      mesh = new THREE.Mesh(geom, mat);
      radius = 0.25;
    }

    mesh.position.copy(pos);

    // Orient mesh in velocity direction
    if (velocity.lengthSq() > 0.001) {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), velocity.clone().normalize());
    }

    this.data = {
      position: pos.clone(),
      velocity: velocity.clone(),
      radius,
      damage,
      isPlayer,
      life: 0,
      maxLife: 3.5,
      mesh,
      type
    };
  }

  public update(dt: number): void {
    this.data.life += dt;
    if (this.data.life >= this.data.maxLife) {
      this.isDead = true;
      return;
    }

    this.data.position.addScaledVector(this.data.velocity, dt);
    this.data.mesh.position.copy(this.data.position);
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.data.mesh);
    this.data.mesh.geometry.dispose();
    (this.data.mesh.material as THREE.Material).dispose();
  }
}
