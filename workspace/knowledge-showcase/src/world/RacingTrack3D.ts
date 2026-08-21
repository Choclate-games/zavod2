import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export const CHECKPOINTS = 36;

export interface TrackSample3D {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  halfWidth: number;
}

export class RacingTrack3D {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly checkpoints: THREE.Vector3[] = [];
  readonly checkpointSpacing: number;

  readonly samples = 720;
  readonly cachedPoint: THREE.Vector3[] = [];
  readonly cachedTangent: THREE.Vector3[] = [];
  readonly cachedRight: THREE.Vector3[] = [];
  readonly cachedUp: THREE.Vector3[] = [];
  readonly cachedHalfWidth: number[] = [];
  readonly racingOffset: number[] = [];

  readonly startLamps: THREE.Mesh[] = [];

  constructor(controlPoints: THREE.Vector3[] = defaultProTrackPoints()) {
    this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    this.checkpointSpacing = this.length / CHECKPOINTS;

    const worldUp = new THREE.Vector3(0, 1, 0);

    const rawHw: number[] = [];
    for (let i = 0; i <= this.samples; i++) {
      const t = (i / this.samples) % 1;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).normalize();

      const rawRight = new THREE.Vector3().crossVectors(tan, worldUp).normalize();
      if (rawRight.lengthSq() < 1e-4) rawRight.set(1, 0, 0);

      const k = this.evalCurvature(t);
      const bank = THREE.MathUtils.clamp(k * 1.5, -0.08, 0.08);
      const right = rawRight.clone().applyAxisAngle(tan, bank).normalize();
      const up = new THREE.Vector3().crossVectors(right, tan).normalize();

      const hw = THREE.MathUtils.lerp(8.0, 9.6, THREE.MathUtils.clamp(Math.abs(k) * 25, 0, 1));

      this.cachedPoint.push(p);
      this.cachedTangent.push(tan);
      this.cachedRight.push(right);
      this.cachedUp.push(up);
      rawHw.push(hw);
    }

    // Smooth halfwidth over a wide window to eliminate any notches
    for (let i = 0; i <= this.samples; i++) {
      let sum = 0;
      for (let j = -15; j <= 15; j++) {
        sum += rawHw[((i + j) % this.samples + this.samples) % this.samples];
      }
      this.cachedHalfWidth.push(sum / 31);
    }

    for (let i = 0; i < CHECKPOINTS; i++) {
      this.checkpoints.push(this.curve.getPointAt(i / CHECKPOINTS));
    }

    this.buildRacingLine();
  }

  halfWidthAt(t: number): number {
    return this.cachedHalfWidth[this.index(t)];
  }

  sample(t: number, out: TrackSample3D): TrackSample3D {
    const idx = this.index(t);
    out.point = this.cachedPoint[idx];
    out.tangent = this.cachedTangent[idx];
    out.right = this.cachedRight[idx];
    out.up = this.cachedUp[idx];
    out.halfWidth = this.cachedHalfWidth[idx];
    return out;
  }

  private evalCurvature(t: number): number {
    const dt = 0.01;
    const t0 = ((t - dt) % 1 + 1) % 1;
    const t1 = ((t + dt) % 1 + 1) % 1;
    const tan0 = this.curve.getTangentAt(t0).normalize();
    const tan1 = this.curve.getTangentAt(t1).normalize();
    return tan0.x * tan1.z - tan0.z * tan1.x;
  }

  curvatureAt(t: number): number {
    const i = this.index(t);
    const a = this.cachedTangent[(i - 6 + this.samples) % this.samples];
    const b = this.cachedTangent[(i + 6) % this.samples];
    return a.x * b.z - a.z * b.x;
  }

  racingOffsetAt(t: number): number {
    return this.racingOffset[this.index(t)];
  }

  pointOnRacingLine(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const i = this.index(t);
    return out.copy(this.cachedPoint[i])
      .addScaledVector(this.cachedRight[i], this.racingOffset[i] * this.cachedHalfWidth[i] * 0.65);
  }

  rightAt(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.cachedRight[this.index(t)]);
  }

  tangentAt(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.cachedTangent[this.index(t)]);
  }

  curvatureRadiusAhead(t: number, aheadMeters: number): number {
    const step = aheadMeters / this.length;
    let maxK = 0;
    for (let i = 0; i <= 6; i++) {
      maxK = Math.max(maxK, Math.abs(this.curvatureAt((t + (step * i) / 6) % 1)));
    }
    return maxK < 1e-4 ? 1e4 : THREE.MathUtils.clamp(1 / (maxK * 6.5), 25, 1e4);
  }

  nearestT(target: THREE.Vector3, hintT?: number): number {
    const N = this.samples;
    let bestDistSq = Infinity;
    let bestIdx = 0;

    // 1. Local window search if hint is provided
    if (hintT !== undefined && hintT >= 0) {
      const centerIdx = this.index(hintT);
      const searchRadius = Math.floor(N * 0.15); // +/- 15% of track
      for (let offset = -searchRadius; offset <= searchRadius; offset++) {
        const i = (centerIdx + offset + N) % N;
        const p = this.cachedPoint[i];
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
      if (bestDistSq < 625) { // within 25 meters
        return bestIdx / N;
      }
    }

    // 2. Global fallback search
    bestDistSq = Infinity;
    for (let i = 0; i < N; i += 2) {
      const p = this.cachedPoint[i];
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    for (let offset = -2; offset <= 2; offset++) {
      const i = (bestIdx + offset + N) % N;
      const p = this.cachedPoint[i];
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    return bestIdx / N;
  }

  gridSlot(index: number, out = new THREE.Vector3()): { pos: THREE.Vector3; heading: THREE.Vector3 } {
    const row = Math.floor(index / 2);
    // Grid staggered positions along the straight before the start line (t = 0)
    const distBefore = row * 9.0 + 8.5;
    const t = (1 - distBefore / this.length + 1) % 1;
    const side = index % 2 === 0 ? -1 : 1;
    const i = this.index(t);
    out.copy(this.cachedPoint[i])
      .addScaledVector(this.cachedRight[i], side * 2.8)
      .addScaledVector(this.cachedUp[i], 0.28);
    return { pos: out, heading: this.cachedTangent[i].clone() };
  }

  terrainHeightAt(vx: number, vz: number): number {
    const t = this.nearestT(new THREE.Vector3(vx, 0, vz));
    const sample = this.sample(t, {
      point: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      halfWidth: 8.8,
    });

    const dist = Math.hypot(vx - sample.point.x, vz - sample.point.z);
    const innerLimit = sample.halfWidth + 7.0; // shoulder width

    const naturalHill = Math.sin(vx * 0.012 + 0.3) * Math.cos(vz * 0.011) * 3.5
      + Math.sin((vx + vz) * 0.018) * 1.5;

    if (dist < innerLimit) {
      return sample.point.y - 0.45;
    } else if (dist < innerLimit + 35.0) {
      const blend = THREE.MathUtils.smoothstep(dist, innerLimit, innerLimit + 35.0);
      return THREE.MathUtils.lerp(sample.point.y - 0.45, naturalHill, blend);
    }
    return naturalHill;
  }

  private index(t: number): number {
    const wrapped = ((t % 1) + 1) % 1;
    return Math.min(this.samples - 1, Math.floor(wrapped * this.samples));
  }

  private buildRacingLine(): void {
    const raw: number[] = [];
    for (let i = 0; i < this.samples; i++) {
      const t = i / this.samples;
      const k = this.curvatureAt(t);
      const ahead = this.curvatureAt((t + 0.035) % 1);
      raw.push(THREE.MathUtils.clamp(-(k * 4.5 + ahead * 2.5), -0.75, 0.75));
    }
    for (let i = 0; i < this.samples; i++) {
      let sum = 0;
      for (let j = -5; j <= 5; j++) {
        sum += raw[((i + j) % this.samples + this.samples) % this.samples];
      }
      this.racingOffset.push(sum / 11);
    }
  }

  /**
   * Builds high-res circuit road, markings, curbs, terrain, and guaranteed clean manifold physics collider.
   */
  buildWorld(scene: THREE.Scene, physics: PhysicsWorld): {
    roadMesh: THREE.Mesh;
    curbsMesh: THREE.Mesh;
    terrainMesh: THREE.Mesh;
    decorGroup: THREE.Group;
  } {
    const decorGroup = new THREE.Group();

    // 1. Road Geometry
    const roadPositions: number[] = [];
    const roadNormals: number[] = [];
    const roadUvs: number[] = [];
    const roadIndices: number[] = [];

    // 2. Road Markings
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const lineIndices: number[] = [];

    // 3. Curbs Geometry
    const curbPositions: number[] = [];
    const curbColors: number[] = [];
    const curbIndices: number[] = [];

    // 4. Gravel Shoulders
    const shoulderPositions: number[] = [];
    const shoulderColors: number[] = [];
    const shoulderNormals: number[] = [];
    const shoulderIndices: number[] = [];

    const S = this.samples;
    const grassColor = new THREE.Color(0x385c32);
    const darkGrassColor = new THREE.Color(0x2a4825);
    const gravelColor = new THREE.Color(0x726b5d);
    const shoulderWidth = 7.0;

    // ── 1. Road Surface & Shoulders ─────────────────────────────────────────
    for (let i = 0; i <= S; i++) {
      const idx = i % S;
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const up = this.cachedUp[idx];
      const hw = this.cachedHalfWidth[idx];
      const u = (i / S) * (this.length / 4.5);

      const leftEdge = p.clone().addScaledVector(right, -hw);
      const rightEdge = p.clone().addScaledVector(right, hw);

      roadPositions.push(leftEdge.x, leftEdge.y, leftEdge.z);
      roadPositions.push(rightEdge.x, rightEdge.y, rightEdge.z);
      roadNormals.push(up.x, up.y, up.z, up.x, up.y, up.z);
      roadUvs.push(0, u, 1, u);

      if (i < S) {
        const a = i * 2;
        roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }

      // Shoulders
      const leftShoulder = leftEdge.clone().addScaledVector(right, -shoulderWidth).addScaledVector(up, -0.18);
      const rightShoulder = rightEdge.clone().addScaledVector(right, shoulderWidth).addScaledVector(up, -0.18);

      const shBase = shoulderPositions.length / 3;
      shoulderPositions.push(leftShoulder.x, leftShoulder.y, leftShoulder.z);
      shoulderPositions.push(leftEdge.x, leftEdge.y - 0.01, leftEdge.z);
      shoulderNormals.push(up.x, up.y, up.z, up.x, up.y, up.z);
      shoulderColors.push(gravelColor.r, gravelColor.g, gravelColor.b, gravelColor.r, gravelColor.g, gravelColor.b);

      shoulderPositions.push(rightEdge.x, rightEdge.y - 0.01, rightEdge.z);
      shoulderPositions.push(rightShoulder.x, rightShoulder.y, rightShoulder.z);
      shoulderNormals.push(up.x, up.y, up.z, up.x, up.y, up.z);
      shoulderColors.push(gravelColor.r, gravelColor.g, gravelColor.b, gravelColor.r, gravelColor.g, gravelColor.b);

      if (i < S) {
        shoulderIndices.push(shBase, shBase + 1, shBase + 4, shBase + 1, shBase + 5, shBase + 4);
        shoulderIndices.push(shBase + 2, shBase + 3, shBase + 6, shBase + 3, shBase + 7, shBase + 6);
      }
    }

    // ── 2. Independent Road Markings Builders ───────────────────────────────
    // A. Left White Edge Line
    const leftLineStart = linePositions.length / 3;
    for (let i = 0; i <= S; i++) {
      const idx = i % S;
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const up = this.cachedUp[idx];
      const hw = this.cachedHalfWidth[idx];

      const pL1 = p.clone().addScaledVector(right, -hw + 0.35).addScaledVector(up, 0.035);
      const pL2 = p.clone().addScaledVector(right, -hw + 0.65).addScaledVector(up, 0.035);
      linePositions.push(pL1.x, pL1.y, pL1.z, pL2.x, pL2.y, pL2.z);
      lineColors.push(0.96, 0.96, 0.96, 0.96, 0.96, 0.96);

      if (i < S) {
        const a = leftLineStart + i * 2;
        lineIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    // B. Right White Edge Line
    const rightLineStart = linePositions.length / 3;
    for (let i = 0; i <= S; i++) {
      const idx = i % S;
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const up = this.cachedUp[idx];
      const hw = this.cachedHalfWidth[idx];

      const pR1 = p.clone().addScaledVector(right, hw - 0.65).addScaledVector(up, 0.035);
      const pR2 = p.clone().addScaledVector(right, hw - 0.35).addScaledVector(up, 0.035);
      linePositions.push(pR1.x, pR1.y, pR1.z, pR2.x, pR2.y, pR2.z);
      lineColors.push(0.96, 0.96, 0.96, 0.96, 0.96, 0.96);

      if (i < S) {
        const a = rightLineStart + i * 2;
        lineIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    // C. Center Dashed Line
    const dashSpacing = 8.0;
    const dashLength = 4.2;
    for (let i = 0; i < S; i++) {
      const arcDist = (i / S) * this.length;
      const nextArcDist = ((i + 1) / S) * this.length;
      const inDash = (arcDist % dashSpacing) < dashLength;
      const nextInDash = (nextArcDist % dashSpacing) < dashLength;

      if (inDash && nextInDash) {
        const idx = i;
        const nextIdx = (i + 1) % S;

        const p = this.cachedPoint[idx];
        const right = this.cachedRight[idx];
        const up = this.cachedUp[idx];

        const nextP = this.cachedPoint[nextIdx];
        const nextR = this.cachedRight[nextIdx];
        const nextUp = this.cachedUp[nextIdx];

        const c1L = p.clone().addScaledVector(right, -0.15).addScaledVector(up, 0.035);
        const c1R = p.clone().addScaledVector(right, 0.15).addScaledVector(up, 0.035);
        const c2L = nextP.clone().addScaledVector(nextR, -0.15).addScaledVector(nextUp, 0.035);
        const c2R = nextP.clone().addScaledVector(nextR, 0.15).addScaledVector(nextUp, 0.035);

        const base = linePositions.length / 3;
        linePositions.push(c1L.x, c1L.y, c1L.z, c1R.x, c1R.y, c1R.z, c2L.x, c2L.y, c2L.z, c2R.x, c2R.y, c2R.z);
        lineColors.push(0.95, 0.95, 0.88, 0.95, 0.95, 0.88, 0.95, 0.95, 0.88, 0.95, 0.95, 0.88);
        lineIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    // D. Start / Finish Checkered Line
    const startP = this.cachedPoint[0];
    const startTan = this.cachedTangent[0];
    const startRight = this.cachedRight[0];
    const startUp = this.cachedUp[0];
    const startHw = this.cachedHalfWidth[0];

    const numCheckers = 16;
    const checkWidth = (startHw * 2) / numCheckers;
    const checkDepth = 1.6;

    for (let c = 0; c < numCheckers; c++) {
      const xOffset = -startHw + c * checkWidth;
      const p1 = startP.clone().addScaledVector(startRight, xOffset).addScaledVector(startTan, -checkDepth / 2).addScaledVector(startUp, 0.038);
      const p2 = startP.clone().addScaledVector(startRight, xOffset + checkWidth).addScaledVector(startTan, -checkDepth / 2).addScaledVector(startUp, 0.038);
      const p3 = startP.clone().addScaledVector(startRight, xOffset).addScaledVector(startTan, checkDepth / 2).addScaledVector(startUp, 0.038);
      const p4 = startP.clone().addScaledVector(startRight, xOffset + checkWidth).addScaledVector(startTan, checkDepth / 2).addScaledVector(startUp, 0.038);

      const isWhite = c % 2 === 0;
      const baseIdx = linePositions.length / 3;
      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z);
      const col = isWhite ? 0.98 : 0.12;
      lineColors.push(col, col, col, col, col, col, col, col, col, col, col, col);
      lineIndices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx + 1, baseIdx + 3, baseIdx + 2);
    }

    // ── 3. Curbs on Corners ────────────────────────────────────────────────
    const curbThreshold = 0.008;
    let inCurb = false;
    let curbSide = 1;
    let curbStartVertex = -1;

    for (let i = 0; i <= S; i++) {
      const idx = i % S;
      const k = this.curvatureAt(i / S);
      const hasCurb = Math.abs(k) > curbThreshold;
      const side = k > 0 ? -1 : 1;

      if (hasCurb) {
        if (!inCurb || side !== curbSide) {
          inCurb = true;
          curbSide = side;
          curbStartVertex = -1;
        }

        const p = this.cachedPoint[idx];
        const right = this.cachedRight[idx];
        const up = this.cachedUp[idx];
        const hw = this.cachedHalfWidth[idx];

        const innerPoint = p.clone().addScaledVector(right, curbSide * hw).addScaledVector(up, 0.01);
        const outerPoint = innerPoint.clone()
          .addScaledVector(right, curbSide * 1.1)
          .addScaledVector(up, 0.07);

        const currentBase = curbPositions.length / 3;
        curbPositions.push(innerPoint.x, innerPoint.y, innerPoint.z);
        curbPositions.push(outerPoint.x, outerPoint.y, outerPoint.z);

        const isRed = Math.floor((i / S) * 180) % 2 === 0;
        const r = isRed ? 0.92 : 0.98;
        const g = isRed ? 0.15 : 0.98;
        const b = isRed ? 0.15 : 0.98;
        curbColors.push(r, g, b, r, g, b);

        if (curbStartVertex >= 0) {
          curbIndices.push(
            curbStartVertex, curbStartVertex + 1, currentBase,
            curbStartVertex + 1, currentBase + 1, currentBase,
          );
        }
        curbStartVertex = currentBase;
      } else {
        inCurb = false;
        curbStartVertex = -1;
      }
    }

    // ── 4. Unified Terrain Heightfield ──────────────────────────────────────
    const gridRes = 90;
    const gridSpan = 520;
    const groundGeom = new THREE.PlaneGeometry(gridSpan, gridSpan, gridRes, gridRes);
    groundGeom.rotateX(-Math.PI / 2);
    const gPosAttr = groundGeom.attributes.position as THREE.BufferAttribute;
    const gColors: number[] = [];

    for (let i = 0; i < gPosAttr.count; i++) {
      const vx = gPosAttr.getX(i);
      const vz = gPosAttr.getZ(i);

      const vy = this.terrainHeightAt(vx, vz);
      gPosAttr.setY(i, vy);

      const t = this.nearestT(new THREE.Vector3(vx, 0, vz));
      const p = this.cachedPoint[this.index(t)];
      const hw = this.cachedHalfWidth[this.index(t)];
      const dist = Math.hypot(vx - p.x, vz - p.z);

      if (dist < hw + shoulderWidth + 10) {
        gColors.push(gravelColor.r * 0.9, gravelColor.g * 0.9, gravelColor.b * 0.9);
      } else if (vy > 2.5) {
        gColors.push(darkGrassColor.r, darkGrassColor.g, darkGrassColor.b);
      } else {
        gColors.push(grassColor.r, grassColor.g, grassColor.b);
      }
    }
    groundGeom.computeVertexNormals();
    groundGeom.setAttribute('color', new THREE.Float32BufferAttribute(gColors, 3));

    // ── 5. Monolithic Solid Collider for Rapier ────────────────────────────
    const physPositions: number[] = [];
    const physIndices: number[] = [];

    // Road
    const roadVertCount = roadPositions.length / 3;
    for (let i = 0; i < roadPositions.length; i++) physPositions.push(roadPositions[i]);
    for (let i = 0; i < roadIndices.length; i++) physIndices.push(roadIndices[i]);

    // Shoulders
    const shoulderVertCount = shoulderPositions.length / 3;
    for (let i = 0; i < shoulderPositions.length; i++) physPositions.push(shoulderPositions[i]);
    for (let i = 0; i < shoulderIndices.length; i++) physIndices.push(roadVertCount + shoulderIndices[i]);

    // Ground
    const gIdxArray = groundGeom.getIndex()!.array;
    const baseGroundPhys = roadVertCount + shoulderVertCount;
    for (let i = 0; i < gPosAttr.count; i++) {
      physPositions.push(gPosAttr.getX(i), gPosAttr.getY(i), gPosAttr.getZ(i));
    }
    for (let i = 0; i < gIdxArray.length; i++) {
      physIndices.push(baseGroundPhys + gIdxArray[i]);
    }

    physics.createTerrain(
      new Float32Array(physPositions),
      new Uint32Array(physIndices),
    );

    // ── 6. Visual Materials & Meshes ───────────────────────────────────────
    const roadGeom = new THREE.BufferGeometry();
    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeom.setIndex(roadIndices);
    roadGeom.computeVertexNormals();

    const roadMat = new THREE.MeshLambertMaterial({
      color: 0x24262a,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeom.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    if (lineIndices.length > 0) lineGeom.setIndex(lineIndices);
    lineGeom.computeVertexNormals();

    const lineMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const lineMesh = new THREE.Mesh(lineGeom, lineMat);
    lineMesh.renderOrder = 2;
    scene.add(lineMesh);

    const curbGeom = new THREE.BufferGeometry();
    curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
    curbGeom.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
    if (curbIndices.length > 0) curbGeom.setIndex(curbIndices);
    curbGeom.computeVertexNormals();

    const curbMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const curbsMesh = new THREE.Mesh(curbGeom, curbMat);
    curbsMesh.receiveShadow = true;
    curbsMesh.castShadow = true;
    scene.add(curbsMesh);

    const shoulderGeom = new THREE.BufferGeometry();
    shoulderGeom.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPositions, 3));
    shoulderGeom.setAttribute('color', new THREE.Float32BufferAttribute(shoulderColors, 3));
    shoulderGeom.setAttribute('normal', new THREE.Float32BufferAttribute(shoulderNormals, 3));
    shoulderGeom.setIndex(shoulderIndices);
    shoulderGeom.computeVertexNormals();

    const shoulderMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const terrainMesh = new THREE.Mesh(shoulderGeom, shoulderMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // ── 7. Decor & Circuit Atmosphere ──────────────────────────────────────
    this.buildTrackDecorations(scene, decorGroup);
    scene.add(decorGroup);

    return { roadMesh, curbsMesh, terrainMesh, decorGroup };
  }

  updateStartLights(countdown: number): void {
    if (this.startLamps.length === 0) return;
    const stage = Math.ceil(countdown); // 3, 2, 1, 0 (GO)

    for (let i = 0; i < 5; i++) {
      const mat = this.startLamps[i].material as THREE.MeshBasicMaterial;
      if (countdown <= 0) {
        mat.color.setHex(0x22ff22);
      } else {
        const active = i < (4 - stage + 2);
        mat.color.setHex(active ? 0xff2222 : 0x220000);
      }
    }
  }

  private buildTrackDecorations(scene: THREE.Scene, group: THREE.Group): void {
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x828892 });
    const matRed = new THREE.MeshLambertMaterial({ color: 0xd42222 });
    const matWhite = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const matDark = new THREE.MeshLambertMaterial({ color: 0x1e2024 });
    const matBanner = new THREE.MeshLambertMaterial({ color: 0x184898 });
    const matTireWall = new THREE.MeshLambertMaterial({ color: 0x222224 });
    const matTrunk = new THREE.MeshLambertMaterial({ color: 0x4a3622 });
    const matLeaves = new THREE.MeshLambertMaterial({ color: 0x274f2a });
    const matArmco = new THREE.MeshLambertMaterial({ color: 0xa5abb5 });

    const startP = this.cachedPoint[0];
    const startTan = this.cachedTangent[0];
    const startRight = this.cachedRight[0];
    const startUp = this.cachedUp[0];
    const hw = this.cachedHalfWidth[0];

    // ── 1. Start / Finish Gantry with Billboard facing oncoming cars (-Z) ──
    const gantry = new THREE.Group();
    gantry.position.copy(startP);
    gantry.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(startRight, startUp, startTan),
    );

    const postGeom = new THREE.BoxGeometry(0.6, 7.2, 0.6);
    const postL = new THREE.Mesh(postGeom, matMetal);
    postL.position.set(-hw - 1.8, 3.6, 0);
    const postR = new THREE.Mesh(postGeom, matMetal);
    postR.position.set(hw + 1.8, 3.6, 0);

    const barGeom = new THREE.BoxGeometry(hw * 2 + 4.2, 1.5, 1.0);
    const bar = new THREE.Mesh(barGeom, matDark);
    bar.position.set(0, 6.2, 0);

    // Billboard banner facing oncoming cars (-Z)
    const bannerGeom = new THREE.BoxGeometry(hw * 1.8, 1.2, 0.1);
    const banner = new THREE.Mesh(bannerGeom, matBanner);
    banner.position.set(0, 6.2, -0.52);

    // 5 Start Lamps facing oncoming cars (-Z)
    this.startLamps.length = 0;
    for (let k = -2; k <= 2; k++) {
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.18, 14),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }),
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(k * 1.2, 6.2, -0.60);
      gantry.add(lamp);
      this.startLamps.push(lamp);
    }

    gantry.add(postL, postR, bar, banner);
    group.add(gantry);

    // ── 2. Grandstand (Outside of straight, Z = length along straight) ───────
    const grandstand = new THREE.Group();
    grandstand.position.copy(startP).addScaledVector(startRight, -hw - 8.5).addScaledVector(startTan, -18);
    grandstand.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(startRight, startUp, startTan),
    );

    const standGeom = new THREE.BoxGeometry(8.0, 5.5, 36);
    const stand = new THREE.Mesh(standGeom, matMetal);
    stand.position.set(0, 2.75, 0);

    const roofGeom = new THREE.BoxGeometry(9.5, 0.45, 38);
    const roof = new THREE.Mesh(roofGeom, matRed);
    roof.position.set(0, 6.0, 0);
    grandstand.add(stand, roof);
    group.add(grandstand);

    // Pit Wall (Infield side, Z = length along straight)
    const pitWall = new THREE.Group();
    pitWall.position.copy(startP).addScaledVector(startRight, hw + 5.5).addScaledVector(startTan, -14);
    pitWall.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(startRight, startUp, startTan),
    );
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 40), matWhite);
    wallMesh.position.set(0, 0.6, 0);
    pitWall.add(wallMesh);
    group.add(pitWall);

    // ── 3. Armco Guardrails on Fast Sweeping Curves ────────────────────────
    for (let k = 0; k < 8; k++) {
      const t = (0.12 + k * 0.11) % 1;
      const idx = this.index(t);
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const tan = this.cachedTangent[idx];
      const up = this.cachedUp[idx];
      const curHw = this.cachedHalfWidth[idx];
      const curveK = this.curvatureAt(t);

      if (Math.abs(curveK) > 0.007) {
        const outerSide = curveK > 0 ? 1 : -1;
        const armcoGroup = new THREE.Group();
        const armcoPos = p.clone().addScaledVector(right, outerSide * (curHw + 5.5));
        const ty = this.terrainHeightAt(armcoPos.x, armcoPos.z);
        armcoGroup.position.set(armcoPos.x, ty + 0.35, armcoPos.z);
        armcoGroup.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(right, up, tan),
        );

        const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 16.0), matArmco);
        barrier.position.set(0, 0.5, 0);
        armcoGroup.add(barrier);
        group.add(armcoGroup);
      }
    }

    // ── 4. Brake Distance Marker Boards (150m, 100m, 50m) ──────────────────
    const brakingZones = [0.18, 0.68];
    for (const bz of brakingZones) {
      const markers = [
        { dist: 150, text: '150' },
        { dist: 100, text: '100' },
        { dist: 50, text: '50' },
      ];

      for (const m of markers) {
        const t = (bz - m.dist / this.length + 1) % 1;
        const idx = this.index(t);
        const p = this.cachedPoint[idx];
        const right = this.cachedRight[idx];
        const tan = this.cachedTangent[idx];
        const up = this.cachedUp[idx];
        const curHw = this.cachedHalfWidth[idx];

        const boardGroup = new THREE.Group();
        const boardPos = p.clone().addScaledVector(right, -curHw - 3.8);
        const ty = this.terrainHeightAt(boardPos.x, boardPos.z);
        boardGroup.position.set(boardPos.x, ty + 0.1, boardPos.z);
        boardGroup.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(right, up, tan),
        );

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), matMetal);
        pole.position.set(0, 1.2, 0);
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.1), matWhite);
        board.position.set(0, 2.0, 0);
        boardGroup.add(pole, board);
        group.add(boardGroup);
      }
    }

    // ── 5. Tire Wall Barriers at Run-off Ends ───────────────────────────────
    for (let k = 0; k < 6; k++) {
      const t = (0.24 + k * 0.16) % 1;
      const idx = this.index(t);
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const curHw = this.cachedHalfWidth[idx];

      const tireGroup = new THREE.Group();
      const tirePos = p.clone().addScaledVector(right, curHw + 5.0);
      const ty = this.terrainHeightAt(tirePos.x, tirePos.z);
      tireGroup.position.set(tirePos.x, ty + 0.45, tirePos.z);
      for (let tx = -2; tx <= 2; tx++) {
        for (let tyOffset = 0; tyOffset < 2; tyOffset++) {
          const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 10), matTireWall);
          tire.position.set(tx * 1.05, tyOffset * 0.48, 0);
          tireGroup.add(tire);
        }
      }
      group.add(tireGroup);
    }

    // ── 6. Instanced Trees on Outer Parkland & Infield ──────────────────────
    const treeCount = 120;
    const trunkGeom = new THREE.CylinderGeometry(0.28, 0.38, 3.6, 7);
    const crownGeom = new THREE.ConeGeometry(2.4, 4.4, 7);

    const trunkMesh = new THREE.InstancedMesh(trunkGeom, matTrunk, treeCount);
    const crownMesh = new THREE.InstancedMesh(crownGeom, matLeaves, treeCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < treeCount; i++) {
      const t = (i / treeCount) % 1;
      const idx = this.index(t);
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const curHw = this.cachedHalfWidth[idx];

      // Infield or outfield placement
      const side = i % 2 === 0 ? 1 : -1;
      const dist = curHw + 18.0 + (i * 11) % 32;
      const treePos = p.clone().addScaledVector(right, side * dist);
      const ty = this.terrainHeightAt(treePos.x, treePos.z);

      const s = 0.85 + ((i * 13) % 7) * 0.12;
      dummy.position.set(treePos.x, ty + 1.8 * s, treePos.z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(treePos.x, ty + 4.6 * s, treePos.z);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
    }

    trunkMesh.castShadow = true;
    crownMesh.castShadow = true;
    group.add(trunkMesh, crownMesh);
  }
}

/**
 * Beautiful, expansive, non-intersecting GP circuit (~920 meters).
 * 200m+ clearance between West straight and East straight.
 */
export function defaultProTrackPoints(): THREE.Vector3[] {
  const raw: Array<[number, number, number]> = [
    [-90, 0.2, -40],      // Start / Finish Line (t = 0, heading +Z)
    [-90, 0.2, 50],       // Main Straight mid
    [-90, 0.2, 120],      // Main Straight end
    [-75, 0.2, 175],      // Turn 1 entry
    [-35, 0.2, 210],      // Turn 1 apex (north-west)
    [25, 0.2, 215],       // North crest apex
    [75, 0.2, 185],       // Turn 1 exit (north-east)
    [105, 0.2, 130],      // East straight entry
    [115, 0.2, 50],       // East high-speed straight north
    [115, 0.2, -50],      // East high-speed straight south
    [105, 0.2, -130],     // Turn 2 entry (south-east)
    [75, 0.2, -185],      // Turn 2 apex east
    [25, 0.2, -215],      // South crest apex
    [-35, 0.2, -210],     // Turn 2 apex west (south-west)
    [-75, 0.2, -175],     // Turn 2 exit towards main straight
    [-90, 0.2, -120],     // Main Straight approach
  ];
  return raw.map(([x, y, z]) => new THREE.Vector3(x, y, z));
}

export const defaultTrack3DPoints = defaultProTrackPoints;
