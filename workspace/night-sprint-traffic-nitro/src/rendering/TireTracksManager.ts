import * as THREE from 'three';

export class TireTracksManager {
  readonly mesh: THREE.Mesh;

  private readonly maxSegments = 400;
  private readonly positions: Float32Array;
  private readonly opacities: Float32Array;
  private geometry: THREE.BufferGeometry;
  private currentIndex = 0;

  private prevLEFT: THREE.Vector3 | null = null;
  private prevRIGHT: THREE.Vector3 | null = null;

  constructor(private readonly scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxSegments * 6 * 3);
    this.opacities = new Float32Array(this.maxSegments * 6);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );

    const mat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.70,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.scene.add(this.mesh);
  }

  addSkidMark(playerPos: THREE.Vector3, playerRight: THREE.Vector3, isSkidding: boolean): void {
    if (!isSkidding) {
      this.prevLEFT = null;
      this.prevRIGHT = null;
      return;
    }

    const wheelOffset = 0.85;
    const posLeft = playerPos.clone().add(playerRight.clone().multiplyScalar(-wheelOffset));
    const posRight = playerPos.clone().add(playerRight.clone().multiplyScalar(wheelOffset));
    posLeft.y = 0.02;
    posRight.y = 0.02;

    if (this.prevLEFT && this.prevRIGHT) {
      const dist = posLeft.distanceTo(this.prevLEFT);
      if (dist > 0.5 && dist < 8.0) {
        this.addQuad(this.prevLEFT, posLeft, 0.28);
        this.addQuad(this.prevRIGHT, posRight, 0.28);
      }
    }

    this.prevLEFT = posLeft;
    this.prevRIGHT = posRight;
  }

  private addQuad(p1: THREE.Vector3, p2: THREE.Vector3, width: number): void {
    const dir = p2.clone().sub(p1).normalize();
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);

    const v1 = p1.clone().sub(normal);
    const v2 = p1.clone().add(normal);
    const v3 = p2.clone().sub(normal);
    const v4 = p2.clone().add(normal);

    // 2 Triangles (6 Vertices)
    const verts = [v1, v2, v3, v2, v4, v3];
    const baseIdx = this.currentIndex * 6 * 3;

    for (let i = 0; i < 6; i++) {
      this.positions[baseIdx + i * 3] = verts[i].x;
      this.positions[baseIdx + i * 3 + 1] = verts[i].y;
      this.positions[baseIdx + i * 3 + 2] = verts[i].z;
    }

    this.currentIndex = (this.currentIndex + 1) % this.maxSegments;
    this.geometry.attributes.position.needsUpdate = true;
  }

  reset(): void {
    this.positions.fill(0);
    this.geometry.attributes.position.needsUpdate = true;
    this.prevLEFT = null;
    this.prevRIGHT = null;
  }
}
