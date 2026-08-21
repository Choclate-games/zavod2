import * as THREE from 'three';

interface TrackPoint {
  left: THREE.Vector3;
  right: THREE.Vector3;
  alpha: number;
  time: number;
}

export class TireTracksManager {
  private readonly maxQuads = 4096;
  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly uvs: Float32Array;
  private readonly indices: Uint32Array;

  private quadCount = 0;
  private headQuad = 0;
  private lastPoints: Map<number, TrackPoint> = new Map();

  constructor(scene: THREE.Scene) {
    const totalVertices = this.maxQuads * 4;
    const totalIndices = this.maxQuads * 6;

    this.positions = new Float32Array(totalVertices * 3);
    this.colors = new Float32Array(totalVertices * 4);
    this.uvs = new Float32Array(totalVertices * 2);
    this.indices = new Uint32Array(totalIndices);

    for (let i = 0; i < this.maxQuads; i++) {
      const vOffset = i * 4;
      const iOffset = i * 6;

      this.indices[iOffset + 0] = vOffset + 0;
      this.indices[iOffset + 1] = vOffset + 1;
      this.indices[iOffset + 2] = vOffset + 2;

      this.indices[iOffset + 3] = vOffset + 2;
      this.indices[iOffset + 4] = vOffset + 1;
      this.indices[iOffset + 5] = vOffset + 3;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

    const material = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.85,
      vertexColors: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  addTrackSegment(wheelId: number, centerPos: THREE.Vector3, forward: THREE.Vector3, wheelWidth = 0.3, alpha = 0.8): boolean {
    const halfW = wheelWidth * 0.5;
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();

    const left = new THREE.Vector3(
      centerPos.x - right.x * halfW,
      0.02,
      centerPos.z - right.z * halfW
    );
    const rPos = new THREE.Vector3(
      centerPos.x + right.x * halfW,
      0.02,
      centerPos.z + right.z * halfW
    );

    const prev = this.lastPoints.get(wheelId);
    if (!prev) {
      this.lastPoints.set(wheelId, { left, right: rPos, alpha, time: performance.now() });
      return false;
    }

    const distSq = left.distanceToSquared(prev.left);
    if (distSq < 0.08) {
      return false; // too close, skip to save budget
    }

    const qIdx = this.headQuad;
    this.headQuad = (this.headQuad + 1) % this.maxQuads;
    if (this.quadCount < this.maxQuads) this.quadCount++;

    const vBase = qIdx * 4;
    const pBase = vBase * 3;
    const cBase = vBase * 4;
    const uvBase = vBase * 2;

    // V0: prev.left
    this.positions[pBase + 0] = prev.left.x;
    this.positions[pBase + 1] = prev.left.y;
    this.positions[pBase + 2] = prev.left.z;

    // V1: prev.right
    this.positions[pBase + 3] = prev.right.x;
    this.positions[pBase + 4] = prev.right.y;
    this.positions[pBase + 5] = prev.right.z;

    // V2: curr.left
    this.positions[pBase + 6] = left.x;
    this.positions[pBase + 7] = left.y;
    this.positions[pBase + 8] = left.z;

    // V3: curr.right
    this.positions[pBase + 9] = rPos.x;
    this.positions[pBase + 10] = rPos.y;
    this.positions[pBase + 11] = rPos.z;

    // Colors with alpha
    for (let v = 0; v < 4; v++) {
      const idx = cBase + v * 4;
      this.colors[idx + 0] = 0.08;
      this.colors[idx + 1] = 0.08;
      this.colors[idx + 2] = 0.08;
      this.colors[idx + 3] = alpha;
    }

    this.uvs[uvBase + 0] = 0; this.uvs[uvBase + 1] = 0;
    this.uvs[uvBase + 2] = 1; this.uvs[uvBase + 3] = 0;
    this.uvs[uvBase + 4] = 0; this.uvs[uvBase + 5] = 1;
    this.uvs[uvBase + 6] = 1; this.uvs[uvBase + 7] = 1;

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    this.lastPoints.set(wheelId, { left, right: rPos, alpha, time: performance.now() });
    return true;
  }

  breakTrack(wheelId: number): void {
    this.lastPoints.delete(wheelId);
  }

  reset(): void {
    this.quadCount = 0;
    this.headQuad = 0;
    this.lastPoints.clear();
    this.positions.fill(0);
    this.colors.fill(0);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
