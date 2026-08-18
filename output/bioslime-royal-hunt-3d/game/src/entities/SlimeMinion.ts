import * as THREE from 'three';
import { createSlimeMaterial } from '../rendering/SlimeShader';
import { GameConfig } from '../config/GameConfig';

export class SlimeMinion {
  public id: number;
  public group: THREE.Group = new THREE.Group();
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;

  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 0.35;
  public damage: number = 14;
  public attackCooldown: number = 0.8;
  public attackTimer: number = 0;

  private orbitAngle: number;
  private orbitDist: number;

  constructor(id: number, spawnPos: THREE.Vector3, index: number) {
    this.id = id;
    this.orbitAngle = (index / 6) * Math.PI * 2;
    this.orbitDist = 2.2 + (index % 2) * 0.8;
    this.position.copy(spawnPos);

    const geom = new THREE.SphereGeometry(0.35, 16, 16);
    this.material = createSlimeMaterial(0x39ff14, 0x00b33c, 0x55ff88);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    this.group.position.copy(this.position);
  }

  public update(playerPos: THREE.Vector3, nearestEnemyPos: THREE.Vector3 | null, dt: number, time: number): void {
    this.material.uniforms.uTime.value = time;

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    if (nearestEnemyPos && nearestEnemyPos.distanceTo(playerPos) < 12.0) {
      // Hunt nearby enemy
      const dir = nearestEnemyPos.clone().sub(this.position).normalize();
      this.velocity.lerp(dir.multiplyScalar(8.5), dt * 6);
    } else {
      // Orbit around player
      this.orbitAngle += dt * 1.8;
      const targetPos = new THREE.Vector3(
        playerPos.x + Math.cos(this.orbitAngle) * this.orbitDist,
        0.35,
        playerPos.z + Math.sin(this.orbitAngle) * this.orbitDist
      );
      const dir = targetPos.clone().sub(this.position);
      this.velocity.lerp(dir.multiplyScalar(6.0), dt * 8);
    }

    this.position.addScaledVector(this.velocity, dt);
    this.position.y = 0.35;
    this.group.position.copy(this.position);

    this.material.uniforms.uVelocity.value.copy(this.velocity);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
