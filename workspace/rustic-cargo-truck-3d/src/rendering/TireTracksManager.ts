import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { RoadGenerator } from '../world/RoadGenerator';

interface WheelTrackState {
  lastLeft: THREE.Vector3;
  lastRight: THREE.Vector3;
  lastPos: THREE.Vector3;
  accumulatedDist: number;
  hasValidLast: boolean;
  spinAccumTimer: number;
}

/**
 * Procedural authentic Soviet truck off-road chevron / herringbone tire tread texture.
 */
function createTreadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, 128, 256);

  // Solid base footprint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillRect(4, 0, 120, 256);

  // Central longitudinal drainage channel
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(58, 0, 12, 256);

  // Aggressive chevron (ёлочка) off-road lugs
  ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const numLugs = 6;
  const step = 256 / numLugs;

  for (let i = -1; i <= numLugs + 1; i += 1) {
    const y = i * step;

    // Left chevron lug
    ctx.beginPath();
    ctx.moveTo(10, y + 24);
    ctx.lineTo(56, y + 6);
    ctx.stroke();

    // Right chevron lug (staggered for authentic ZIL/Ural tire tread pattern)
    ctx.beginPath();
    ctx.moveTo(118, y + 24 + step * 0.5);
    ctx.lineTo(72, y + 6 + step * 0.5);
    ctx.stroke();

    // Outer edge bite blocks
    ctx.fillRect(2, y + 16, 16, 14);
    ctx.fillRect(110, y + 16 + step * 0.5, 16, 14);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Dynamic, high-performance SnowRunner-style tire tracks manager.
 * Features:
 * - 16,000+ independent 3D Quad segments (safe cyclic pool)
 * - 15-second guaranteed full visibility, followed by gradual 5-second fade-out
 * - Dynamic burnout (пробуксовка), heavy braking (торможение) and drift skidmarks
 * - Procedural chevron off-road tread pattern texture with distance-based UV mapping
 * - Discontinuity handling (breakTrack) when wheels are airborne or jumping
 * - Surface-reactive coloring: deep peat mud, wet glossy ford exit, dry dirt road, burning rubber
 * - Unlit high-contrast MeshBasicMaterial with polygonOffset to eliminate z-fighting
 */
export class TireTracksManager {
  private readonly maxQuads = 16384;
  private readonly maxWheels = 6;
  private readonly treadRepeatLength = 0.85; // meters per tread repeat
  private readonly stayDuration = 15.0; // Stay at 100% full opacity for 15 seconds
  private readonly fadeDuration = 5.0; // Fade away over 5 seconds after the 15s mark

  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly uvs: Float32Array;
  private readonly indices: Uint32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly uvAttr: THREE.BufferAttribute;

  // Metadata per quad for 15s lifetime and gradual fading
  private readonly quadCreationTime = new Float32Array(this.maxQuads);
  private readonly quadBaseAlpha = new Float32Array(this.maxQuads);
  private readonly quadActive = new Uint8Array(this.maxQuads);

  private readonly wheelStates: WheelTrackState[] = [];
  private headQuad = 0;
  private quadCount = 0;
  private currentTime = 0;
  private dirty = false;
  private alphaDirty = false;
  private fadeUpdateTimer = 0;

  // Surface and state colors
  private readonly burnoutColor = new THREE.Color(0x111111);
  private readonly skidmarkColor = new THREE.Color(0x1a1a18);
  private readonly deepMudColor = new THREE.Color(0x180f07);
  private readonly wetMudColor = new THREE.Color(0x2a1a0e);
  private readonly wetTrackColor = new THREE.Color(0x1e282e);
  private readonly dryDustColor = new THREE.Color(0x4a3928);
  private readonly scratchColor = new THREE.Color();

  constructor(
    private readonly scene: SceneManager,
    private readonly road: RoadGenerator,
  ) {
    const totalVertices = this.maxQuads * 4;
    const totalIndices = this.maxQuads * 6;

    this.positions = new Float32Array(totalVertices * 3);
    this.colors = new Float32Array(totalVertices * 4);
    this.uvs = new Float32Array(totalVertices * 2);
    this.indices = new Uint32Array(totalIndices);

    // Pre-populate index buffer for independent Quad units
    for (let q = 0; q < this.maxQuads; q += 1) {
      const vBase = q * 4;
      const iBase = q * 6;
      this.indices[iBase + 0] = vBase + 0;
      this.indices[iBase + 1] = vBase + 1;
      this.indices[iBase + 2] = vBase + 2;
      this.indices[iBase + 3] = vBase + 2;
      this.indices[iBase + 4] = vBase + 1;
      this.indices[iBase + 5] = vBase + 3;
    }

    for (let w = 0; w < this.maxWheels; w += 1) {
      this.wheelStates.push({
        lastLeft: new THREE.Vector3(),
        lastRight: new THREE.Vector3(),
        lastPos: new THREE.Vector3(),
        accumulatedDist: 0,
        hasValidLast: false,
        spinAccumTimer: 0,
      });
    }

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 4);
    this.uvAttr = new THREE.BufferAttribute(this.uvs, 2);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color', this.colorAttr);
    this.geometry.setAttribute('uv', this.uvAttr);
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
    this.geometry.setDrawRange(0, 0);

    const treadTexture = createTreadTexture();

    // High-contrast, unlit MeshBasicMaterial ensures tracks are brightly visible under all sun angles
    const mat = new THREE.MeshBasicMaterial({
      map: treadTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.frustumCulled = false; // Dynamic world-space geometry — bounding sphere is unreliable
    this.mesh.renderOrder = 2; // Render directly above ground mesh
    this.scene.trackGroup.add(this.mesh);
  }

  reset(): void {
    for (let w = 0; w < this.maxWheels; w += 1) {
      const state = this.wheelStates[w];
      state.hasValidLast = false;
      state.accumulatedDist = 0;
      state.spinAccumTimer = 0;
    }
    this.headQuad = 0;
    this.quadCount = 0;
    this.currentTime = 0;
    this.positions.fill(0);
    this.colors.fill(0);
    this.uvs.fill(0);
    this.quadActive.fill(0);
    this.geometry.setDrawRange(0, 0);
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
    this.dirty = false;
    this.alphaDirty = false;
  }

  /**
   * Clears active contact point for a wheel when airborne or jumping to prevent air bridges.
   */
  breakTrack(wheelIndex: number): void {
    if (wheelIndex >= 0 && wheelIndex < this.maxWheels) {
      this.wheelStates[wheelIndex].hasValidLast = false;
      this.wheelStates[wheelIndex].spinAccumTimer = 0;
    }
  }

  /**
   * Clears contact for all wheels (e.g. on truck rollover, respawn, or jump).
   */
  breakAllTracks(): void {
    for (let w = 0; w < this.maxWheels; w += 1) {
      this.wheelStates[w].hasValidLast = false;
      this.wheelStates[w].spinAccumTimer = 0;
    }
  }

  /**
   * Updates track lifespans and handles the gradual 15-second fade-out.
   */
  update(dt: number): void {
    this.currentTime += dt;
    this.fadeUpdateTimer += dt;

    // Throttle fade updates to 20Hz for zero CPU overhead
    if (this.fadeUpdateTimer < 0.05) return;
    this.fadeUpdateTimer = 0;

    const curTime = this.currentTime;
    const activeLimit = Math.min(this.quadCount, this.maxQuads);
    let changed = false;

    for (let q = 0; q < activeLimit; q += 1) {
      if (this.quadActive[q] === 0) continue;

      const age = curTime - this.quadCreationTime[q];
      const baseAlpha = this.quadBaseAlpha[q];
      const cBase = q * 4 * 4;

      if (age < this.stayDuration) {
        // First 15 seconds: 100% full opacity, no fading!
        continue;
      } else if (age < this.stayDuration + this.fadeDuration) {
        // 15s to 20s: gradual smooth fade-out
        const fadeRatio = 1.0 - (age - this.stayDuration) / this.fadeDuration;
        const currentAlpha = Math.max(0, baseAlpha * fadeRatio);
        this.colors[cBase + 3] = currentAlpha;
        this.colors[cBase + 7] = currentAlpha;
        this.colors[cBase + 11] = currentAlpha;
        this.colors[cBase + 15] = currentAlpha;
        changed = true;
      } else {
        // Over 20s: completely faded out
        this.colors[cBase + 3] = 0;
        this.colors[cBase + 7] = 0;
        this.colors[cBase + 11] = 0;
        this.colors[cBase + 15] = 0;
        this.quadActive[q] = 0;
        changed = true;
      }
    }

    if (changed) {
      this.alphaDirty = true;
    }
  }

  /**
   * Records a tire track segment for a wheel in contact with the ground.
   * Handles regular driving, wheel spin (пробуксовка), braking (торможение) and drift.
   *
   * @returns true if a quad was actually written this call. Callers use this to keep
   *   tire smoke in lockstep with the visible skidmark instead of running their own
   *   independent rate limiter, which drifts out of sync and makes smoke look sparse.
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
    isSpinning = false,
    isBraking = false,
    isDrifting = false,
  ): boolean {
    if (wheelIndex < 0 || wheelIndex >= this.maxWheels) return false;

    const state = this.wheelStates[wheelIndex];

    // Compute normal perpendicular to wheel rolling direction in XZ plane
    const headingLen = Math.hypot(forwardX, forwardZ);
    const fx = headingLen > 1e-4 ? forwardX / headingLen : 0;
    const fz = headingLen > 1e-4 ? forwardZ / headingLen : 1;

    const perpX = -fz;
    const perpZ = fx;
    const halfW = wheelHalfWidth * (isDrifting || isSpinning ? 1.15 : 1.05);

    // Left and Right contact edges
    const lx = worldX + perpX * halfW;
    const lz = worldZ + perpZ * halfW;
    const ly = this.road.getDeformedHeightAt(lx, lz) + 0.032;

    const rx = worldX - perpX * halfW;
    const rz = worldZ - perpZ * halfW;
    const ry = this.road.getDeformedHeightAt(rx, rz) + 0.032;

    const centerY = (ly + ry) * 0.5;

    if (!state.hasValidLast) {
      state.lastLeft.set(lx, ly, lz);
      state.lastRight.set(rx, ry, rz);
      state.lastPos.set(worldX, centerY, worldZ);
      state.hasValidLast = true;
      return false;
    }

    const dx = worldX - state.lastPos.x;
    const dz = worldZ - state.lastPos.z;
    const dist = Math.hypot(dx, dz);

    // Handle wheel spin in place (burnout / пробуксовка), starting from stop, braking or drift
    if (isSpinning || isBraking || isDrifting) {
      state.spinAccumTimer += 0.016;
      if (dist < 0.06 && state.spinAccumTimer < 0.06) {
        return false;
      }
      state.spinAccumTimer = 0;
    } else {
      // Minimum distance between segments to keep smooth ribbon without overcrowding
      if (dist < 0.14) return false;
    }

    // If wheel moved too far in one step (teleport/respawn/huge collision), break track
    if (dist > 4.0) {
      state.lastLeft.set(lx, ly, lz);
      state.lastRight.set(rx, ry, rz);
      state.lastPos.set(worldX, centerY, worldZ);
      return false;
    }

    // Determine track tint and opacity based on environmental surface and vehicle action
    let alpha = 0.72;
    if (isSpinning) {
      // Dark burning rubber & churned earth from wheel spin (пробуксовка)
      this.scratchColor.copy(this.burnoutColor);
      alpha = 0.95;
    } else if (isBraking || isDrifting) {
      // Heavy dark skidmark from braking / handbrake drift (торможение / занос)
      this.scratchColor.copy(this.skidmarkColor);
      alpha = 0.92;
    } else if (mudIntensity > 0.08) {
      this.scratchColor.copy(this.deepMudColor).lerp(this.wetMudColor, 1 - Math.min(1.0, mudIntensity));
      alpha = 0.92 + Math.min(0.07, mudIntensity * 0.07);
    } else if (waterIntensity > 0.1 || wetTimer > 0.1) {
      const wetRatio = Math.max(waterIntensity, wetTimer / 4.0);
      this.scratchColor.copy(this.wetTrackColor).lerp(this.wetMudColor, 0.35);
      alpha = 0.75 * Math.min(1.0, wetRatio + 0.35);
    } else {
      this.scratchColor.copy(this.dryDustColor);
      alpha = 0.65;
    }

    // Quad slot in the pre-allocated buffer
    const quadIndex = this.headQuad % this.maxQuads;
    const vertBase = quadIndex * 4;
    const pBase = vertBase * 3;
    const cBase = vertBase * 4;
    const uBase = vertBase * 2;

    const u0 = 0.0;
    const u1 = 1.0;
    const effectiveStep = Math.max(0.15, dist);
    const v0 = state.accumulatedDist / this.treadRepeatLength;
    const v1 = (state.accumulatedDist + effectiveStep) / this.treadRepeatLength;

    // V0: previous left
    this.positions[pBase + 0] = state.lastLeft.x;
    this.positions[pBase + 1] = state.lastLeft.y;
    this.positions[pBase + 2] = state.lastLeft.z;

    this.colors[cBase + 0] = this.scratchColor.r;
    this.colors[cBase + 1] = this.scratchColor.g;
    this.colors[cBase + 2] = this.scratchColor.b;
    this.colors[cBase + 3] = alpha;

    this.uvs[uBase + 0] = u0;
    this.uvs[uBase + 1] = v0;

    // V1: previous right
    this.positions[pBase + 3] = state.lastRight.x;
    this.positions[pBase + 4] = state.lastRight.y;
    this.positions[pBase + 5] = state.lastRight.z;

    this.colors[cBase + 4] = this.scratchColor.r;
    this.colors[cBase + 5] = this.scratchColor.g;
    this.colors[cBase + 6] = this.scratchColor.b;
    this.colors[cBase + 7] = alpha;

    this.uvs[uBase + 2] = u1;
    this.uvs[uBase + 3] = v0;

    // V2: current left
    this.positions[pBase + 6] = lx;
    this.positions[pBase + 7] = ly;
    this.positions[pBase + 8] = lz;

    this.colors[cBase + 8] = this.scratchColor.r;
    this.colors[cBase + 9] = this.scratchColor.g;
    this.colors[cBase + 10] = this.scratchColor.b;
    this.colors[cBase + 11] = alpha;

    this.uvs[uBase + 4] = u0;
    this.uvs[uBase + 5] = v1;

    // V3: current right
    this.positions[pBase + 9] = rx;
    this.positions[pBase + 10] = ry;
    this.positions[pBase + 11] = rz;

    this.colors[cBase + 12] = this.scratchColor.r;
    this.colors[cBase + 13] = this.scratchColor.g;
    this.colors[cBase + 14] = this.scratchColor.b;
    this.colors[cBase + 15] = alpha;

    this.uvs[uBase + 6] = u1;
    this.uvs[uBase + 7] = v1;

    // Store metadata for 15-second lifetime tracking
    this.quadCreationTime[quadIndex] = this.currentTime;
    this.quadBaseAlpha[quadIndex] = alpha;
    this.quadActive[quadIndex] = 1;

    state.lastLeft.set(lx, ly, lz);
    state.lastRight.set(rx, ry, rz);
    state.lastPos.set(worldX, centerY, worldZ);
    state.accumulatedDist += effectiveStep;

    this.headQuad += 1;
    this.quadCount = Math.min(this.maxQuads, this.quadCount + 1);
    this.dirty = true;
    return true; // a segment was actually laid — callers hang tire smoke off this
  }

  flush(): void {
    if (this.dirty || this.alphaDirty) {
      if (this.dirty) {
        this.posAttr.needsUpdate = true;
        this.uvAttr.needsUpdate = true;
        this.geometry.setDrawRange(0, this.quadCount * 6);
      }
      this.colorAttr.needsUpdate = true;
      this.dirty = false;
      this.alphaDirty = false;
    }
  }
}
