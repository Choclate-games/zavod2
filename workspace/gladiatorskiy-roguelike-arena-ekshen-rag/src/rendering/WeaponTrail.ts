import * as THREE from 'three';

export class WeaponTrail {
  public mesh: THREE.Mesh;
  private readonly MAX_POINTS = 16;
  private tipHistory: THREE.Vector3[] = [];
  private baseHistory: THREE.Vector3[] = [];
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    const vertexCount = this.MAX_POINTS * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 3);

    // Build strip indices
    const indices: number[] = [];
    for (let i = 0; i < this.MAX_POINTS - 1; i++) {
      const i0 = i * 2;
      const i1 = i * 2 + 1;
      const i2 = (i + 1) * 2;
      const i3 = (i + 1) * 2 + 1;

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    this.geometry.setIndex(indices);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }

  public update(tip: THREE.Vector3, base: THREE.Vector3, speed: number): void {
    // Add current frame points
    this.tipHistory.unshift(tip.clone());
    this.baseHistory.unshift(base.clone());

    if (this.tipHistory.length > this.MAX_POINTS) {
      this.tipHistory.pop();
      this.baseHistory.pop();
    }

    // Color based on velocity: Azure steel (<14 m/s) -> Molten Orange (>14 m/s)
    const isHighSpeed = speed > 13.0;
    const baseR = isHighSpeed ? 1.0 : 0.4;
    const baseG = isHighSpeed ? 0.45 : 0.75;
    const baseB = isHighSpeed ? 0.1 : 1.0;

    const count = this.tipHistory.length;
    for (let i = 0; i < this.MAX_POINTS; i++) {
      const idx0 = i * 2;
      const idx1 = i * 2 + 1;

      if (i < count && speed > 2.5) {
        const alpha = Math.pow(1 - i / this.MAX_POINTS, 1.5);
        const t = this.tipHistory[i];
        const b = this.baseHistory[i];

        this.positions[idx0 * 3] = t.x;
        this.positions[idx0 * 3 + 1] = t.y;
        this.positions[idx0 * 3 + 2] = t.z;

        this.positions[idx1 * 3] = b.x;
        this.positions[idx1 * 3 + 1] = b.y;
        this.positions[idx1 * 3 + 2] = b.z;

        this.colors[idx0 * 3] = baseR * alpha;
        this.colors[idx0 * 3 + 1] = baseG * alpha;
        this.colors[idx0 * 3 + 2] = baseB * alpha;

        this.colors[idx1 * 3] = baseR * alpha * 0.5;
        this.colors[idx1 * 3 + 1] = baseG * alpha * 0.5;
        this.colors[idx1 * 3 + 2] = baseB * alpha * 0.5;
      } else {
        // Zero out inactive
        this.positions[idx0 * 3] = 0;
        this.positions[idx0 * 3 + 1] = -100;
        this.positions[idx0 * 3 + 2] = 0;

        this.positions[idx1 * 3] = 0;
        this.positions[idx1 * 3 + 1] = -100;
        this.positions[idx1 * 3 + 2] = 0;
      }
    }

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
