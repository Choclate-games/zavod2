import * as THREE from 'three';

export type OrbType = 'biomass' | 'dna';

export class BiomassOrb {
  public id: number;
  public type: OrbType;
  public value: number;
  public mesh: THREE.Mesh;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isCollected: boolean = false;

  private bounceTimer: number;

  constructor(id: number, type: OrbType, value: number, pos: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.value = value;
    this.position.copy(pos);
    this.position.y = 0.25;
    this.bounceTimer = Math.random() * Math.PI * 2;

    const isDna = type === 'dna';
    const color = isDna ? 0x38bdf8 : 0x39ff14;
    const geom = isDna ? new THREE.OctahedronGeometry(0.2) : new THREE.SphereGeometry(0.18, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.copy(this.position);
  }

  public update(playerPos: THREE.Vector3, magnetRadius: number, dt: number): void {
    this.bounceTimer += dt * 4;
    this.position.y = 0.25 + Math.sin(this.bounceTimer) * 0.08;

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distSq = dx * dx + dz * dz;

    // Magnet attraction
    if (distSq < magnetRadius * magnetRadius) {
      const dist = Math.sqrt(distSq);
      const pullSpeed = Math.min(24.0, (magnetRadius / Math.max(0.5, dist)) * 14.0);
      this.velocity.x = (dx / dist) * pullSpeed;
      this.velocity.z = (dz / dist) * pullSpeed;

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y += dt * 3.0;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
