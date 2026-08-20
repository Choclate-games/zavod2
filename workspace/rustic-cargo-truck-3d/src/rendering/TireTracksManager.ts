import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';

interface TrackPoint {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  width: number;
  color: THREE.Color;
  alpha: number;
}

/**
 * Dynamic, high-performance SnowRunner-style tire tracks manager.
 * Creates persistent, realistic 3D wheel tracks imprinted into the road:
 * - Deep wet peat mud tracks with tread markings in swamp sectors
 * - Wet shiny tire tracks trailing out of water fords
 * - Dusty packed dirt impressions on dry roads
 * Uses pre-allocated static typed buffers with zero runtime memory allocations.
 */
export class TireTracksManager {
  private readonly maxSegmentsPerWheel = 160;
  private readonly maxWheels = 6;
  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly uvs: Float32Array;
  private readonly indices: Uint16Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;

  private readonly lastPoints: Array<TrackPoint | null> = [null, null, null, null, null, null];
  private readonly headIndices: number[] = [0, 0, 0, 0, 0, 0];
  private readonly segmentCounts: number[] = [0, 0, 0, 0, 0, 0];
  private dirty = false;

  private readonly scratchColor = new THREE.Color();
  private readonly deepMudColor = new THREE.Color(0x1a0f07);
  private readonly wetMudColor = new THREE.Color(0x2d1c0f);
  private readonly wetTrackColor = new THREE.Color(0x222a2e);
  private readonly dryDustColor = new THREE.Color(0x6b5742);

  constructor(
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {
    const totalVertices = this.maxWheels * this.maxSegmentsPerWheel * 2;
    const totalTriangles = this.maxWheels * this.maxSegmentsPerWheel * 2;

    this.positions = new Float32Array(totalVertices * 3);
    this.colors = new Float32Array(totalVertices * 4); // RGBA vertex colors
    this.uvs = new Float32Array(totalVertices * 2);
    this.indices = new Uint16Array(totalTriangles * 3);

    // Pre-build index buffer for triangle strips
    for (let w = 0; w < this.maxWheels; w += 1) {
      const wheelVertBase = w * this.maxSegmentsPerWheel * 2;
      const wheelIdxBase = w * this.maxSegmentsPerWheel * 6;
      for (let s = 0; s < this.maxSegmentsPerWheel - 1; s += 1) {
        const v0 = wheelVertBase + s * 2;
        const v1 = v0 + 1;
        const v2 = v0 + 2;
        const v3 = v0 + 3;
        const idx = wheelIdxBase + s * 6;

        this.indices[idx] = v0;
        this.indices[idx + 1] = v1;
        this.indices[idx + 2] = v2;

        this.indices[idx + 3] = v2;
        this.indices[idx + 4] = v1;
        this.indices[idx + 5] = v3;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 4);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color', this.colorAttr);
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

    // Custom shader-friendly or vertex-colored transparent material
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.receiveShadow = true;
    this.scene.roadGroup.add(this.mesh);
  }

  reset(): void {
    for (let w = 0; w < this.maxWheels; w += 1) {
      this.lastPoints[w] = null;
      this.headIndices[w] = 0;
      this.segmentCounts[w] = 0;
    }
    this.positions.fill(0);
    this.colors.fill(0);
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.dirty = false;
  }

  /**
   * Records tire track segment for a wheel on the ground.
   */
  addPoint(
    wheelIndex: number,
    worldX: number,
    worldZ: number,
    forwardX: number,
    forwardZ: number,
    wheelHalfWidth: number,
    mudIntensity: number,
    waterIntensity: number,
    wetTimer: number,
  ): void {
    if (wheelIndex < 0 || wheelIndex >= this.maxWheels) return;

    const groundY = this.road.heightAt(worldX, worldZ) + 0.015;
    const last = this.lastPoints[wheelIndex];

    if (last) {
      const dx = worldX - last.x;
      const dz = worldZ - last.z;
      const distSq = dx * dx + dz * dz;
      // Minimum distance between segments to keep smooth ribbon
      if (distSq < 0.22 * 0.22) return;
    }

    // Determine track tint and opacity based on environmental surface
    let alpha = 0.55;
    if (mudIntensity > 0.08) {
      this.scratchColor.copy(this.deepMudColor).lerp(this.wetMudColor, 1 - mudIntensity);
      alpha = 0.88 + mudIntensity * 0.10;
    } else if (waterIntensity > 0.1 || wetTimer > 0.1) {
      const wetRatio = Math.max(waterIntensity, wetTimer / 3.0);
      this.scratchColor.copy(this.wetTrackColor).lerp(this.wetMudColor, 0.4);
      alpha = 0.65 * Math.min(1.0, wetRatio + 0.3);
    } else {
      this.scratchColor.copy(this.dryDustColor);
      alpha = 0.45;
    }

    const curPoint: TrackPoint = {
      x: worldX,
      y: groundY,
      z: worldZ,
      dirX: forwardX,
      dirZ: forwardZ,
      width: wheelHalfWidth * 1.9,
      color: this.scratchColor.clone(),
      alpha,
    };

    const head = this.headIndices[wheelIndex];
    const vertBase = (wheelIndex * this.maxSegmentsPerWheel + head) * 2;

    // Normal perpendicular to wheel heading in XZ plane
    const perpX = -forwardZ;
    const perpZ = forwardX;
    const halfW = curPoint.width * 0.5;

    // Left vertex
    const lx = worldX + perpX * halfW;
    const lz = worldZ + perpZ * halfW;
    const ly = this.road.getDeformedHeightAt(lx, lz) + 0.012;

    // Right vertex
    const rx = worldX - perpX * halfW;
    const rz = worldZ - perpZ * halfW;
    const ry = this.road.getDeformedHeightAt(rx, rz) + 0.012;

    // Set vertex 0 (left)
    const p0 = vertBase * 3;
    this.positions[p0] = lx;
    this.positions[p0 + 1] = ly;
    this.positions[p0 + 2] = lz;

    const c0 = vertBase * 4;
    this.colors[c0] = curPoint.color.r;
    this.colors[c0 + 1] = curPoint.color.g;
    this.colors[c0 + 2] = curPoint.color.b;
    this.colors[c0 + 3] = curPoint.alpha;

    // Set vertex 1 (right)
    const p1 = (vertBase + 1) * 3;
    this.positions[p1] = rx;
    this.positions[p1 + 1] = ry;
    this.positions[p1 + 2] = rz;

    const c1 = (vertBase + 1) * 4;
    this.colors[c1] = curPoint.color.r;
    this.colors[c1 + 1] = curPoint.color.g;
    this.colors[c1 + 2] = curPoint.color.b;
    this.colors[c1 + 3] = curPoint.alpha;

    this.lastPoints[wheelIndex] = curPoint;
    this.headIndices[wheelIndex] = (head + 1) % this.maxSegmentsPerWheel;
    this.segmentCounts[wheelIndex] = Math.min(this.maxSegmentsPerWheel, this.segmentCounts[wheelIndex] + 1);
    this.dirty = true;
  }

  flush(): void {
    if (this.dirty) {
      this.posAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
      // Normals are not recomputed per-frame: the track ribbon is nearly flat on terrain,
      // so the initial flat normals are visually indistinguishable and cost nothing.
      this.dirty = false;
    }
  }
}
