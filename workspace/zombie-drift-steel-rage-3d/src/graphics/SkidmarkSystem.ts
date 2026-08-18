import * as THREE from 'three';

export class SkidmarkSystem {
  public group = new THREE.Group();
  private maxMarks = 400;
  private markIndex = 0;
  private positions: Float32Array;
  private alphas: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  private lastLeftPos: THREE.Vector3 | null = null;
  private lastRightPos: THREE.Vector3 | null = null;

  constructor() {
    this.positions = new Float32Array(this.maxMarks * 6 * 3); // 2 triangles per quad segment
    this.alphas = new Float32Array(this.maxMarks * 6);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      uniforms: {
        color: { value: new THREE.Color(0x111111) },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.01) discard;
          gl_FragColor = vec4(color, vAlpha * 0.75);
        }
      `,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.group.add(this.mesh);
  }

  public addSkidmark(
    leftWheelPos: THREE.Vector3,
    rightWheelPos: THREE.Vector3,
    intensity: number
  ): void {
    if (!this.lastLeftPos || !this.lastRightPos) {
      this.lastLeftPos = leftWheelPos.clone();
      this.lastRightPos = rightWheelPos.clone();
      return;
    }

    const dist = this.lastLeftPos.distanceTo(leftWheelPos);
    if (dist < 0.4) return; // Don't generate too densely

    const yOffset = 0.03; // Slightly above ground
    const idx = (this.markIndex % this.maxMarks) * 18; // 6 vertices * 3 coords
    const aIdx = (this.markIndex % this.maxMarks) * 6;

    // Quad: P0(lastL), P1(lastR), P2(currR), P3(currL)
    const p0 = this.lastLeftPos;
    const p1 = this.lastRightPos;
    const p2 = rightWheelPos;
    const p3 = leftWheelPos;

    // Triangle 1: p0, p1, p2
    this.positions[idx + 0] = p0.x;
    this.positions[idx + 1] = yOffset;
    this.positions[idx + 2] = p0.z;

    this.positions[idx + 3] = p1.x;
    this.positions[idx + 4] = yOffset;
    this.positions[idx + 5] = p1.z;

    this.positions[idx + 6] = p2.x;
    this.positions[idx + 7] = yOffset;
    this.positions[idx + 8] = p2.z;

    // Triangle 2: p0, p2, p3
    this.positions[idx + 9] = p0.x;
    this.positions[idx + 10] = yOffset;
    this.positions[idx + 11] = p0.z;

    this.positions[idx + 12] = p2.x;
    this.positions[idx + 13] = yOffset;
    this.positions[idx + 14] = p2.z;

    this.positions[idx + 15] = p3.x;
    this.positions[idx + 16] = yOffset;
    this.positions[idx + 17] = p3.z;

    const clampedAlpha = Math.min(1.0, Math.max(0.1, intensity));
    for (let k = 0; k < 6; k++) {
      this.alphas[aIdx + k] = clampedAlpha;
    }

    this.markIndex++;
    this.lastLeftPos.copy(leftWheelPos);
    this.lastRightPos.copy(rightWheelPos);

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
  }

  public breakSkidmark(): void {
    this.lastLeftPos = null;
    this.lastRightPos = null;
  }

  public update(dt: number): void {
    // Slowly fade skidmarks
    let updated = false;
    for (let i = 0; i < this.alphas.length; i++) {
      if (this.alphas[i] > 0) {
        this.alphas[i] = Math.max(0, this.alphas[i] - dt * 0.02);
        updated = true;
      }
    }
    if (updated) {
      this.geometry.attributes.alpha.needsUpdate = true;
    }
  }
}
