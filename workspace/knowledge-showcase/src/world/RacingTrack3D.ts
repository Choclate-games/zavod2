import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export const CHECKPOINTS = 40;

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

    for (let i = 0; i <= this.samples; i++) {
      const t = (i / this.samples) % 1;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).normalize();

      const rawRight = new THREE.Vector3().crossVectors(tan, worldUp).normalize();
      if (rawRight.lengthSq() < 1e-4) rawRight.set(1, 0, 0);

      const k = this.evalCurvature(t);
      const bank = THREE.MathUtils.clamp(k * 2.2, -0.14, 0.14);
      const right = rawRight.clone().applyAxisAngle(tan, bank).normalize();
      const up = new THREE.Vector3().crossVectors(right, tan).normalize();

      const hw = THREE.MathUtils.lerp(7.2, 9.5, THREE.MathUtils.clamp(Math.abs(k) * 20, 0, 1));

      this.cachedPoint.push(p);
      this.cachedTangent.push(tan);
      this.cachedRight.push(right);
      this.cachedUp.push(up);
      this.cachedHalfWidth.push(hw);
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
      .addScaledVector(this.cachedRight[i], this.racingOffset[i] * this.cachedHalfWidth[i] * 0.70);
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
    return maxK < 1e-4 ? 1e4 : THREE.MathUtils.clamp(1 / (maxK * 7), 16, 1e4);
  }

  nearestT(target: THREE.Vector3, hintT = 0): number {
    const N = this.samples;
    let bestDistSq = Infinity;
    let bestIdx = 0;

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
    // Positions along the straight before checkpoint 0
    const t = (1 - (row * 9 + 8) / this.length + 1) % 1;
    const side = index % 2 === 0 ? -1 : 1;
    const i = this.index(t);
    out.copy(this.cachedPoint[i])
      .addScaledVector(this.cachedRight[i], side * 2.8)
      .addScaledVector(this.cachedUp[i], 0.28);
    return { pos: out, heading: this.cachedTangent[i].clone() };
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
      raw.push(THREE.MathUtils.clamp(-(k * 5.5 + ahead * 3.5), -0.85, 0.85));
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

    // 4. Terrain Skirt Geometry
    const skirtPositions: number[] = [];
    const skirtColors: number[] = [];
    const skirtNormals: number[] = [];
    const skirtIndices: number[] = [];

    const S = this.samples;
    const grassColor = new THREE.Color(0x385c32);
    const gravelColor = new THREE.Color(0x5e584c);
    const outerHillColor = new THREE.Color(0x42683c);
    const skirtWidth = 28;

    // ── Build Road, Lines & Curbs ──────────────────────────────────────────
    for (let i = 0; i <= S; i++) {
      const idx = i % S;
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const up = this.cachedUp[idx];
      const hw = this.cachedHalfWidth[idx];
      const u = (i / S) * (this.length / 4);

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

      // Road Markings (Lines)
      const isDash = (Math.floor(i / 2) % 4) < 2;
      const lineBase = linePositions.length / 3;

      const lineL1 = p.clone().addScaledVector(right, -hw + 0.35).addScaledVector(up, 0.015);
      const lineL2 = p.clone().addScaledVector(right, -hw + 0.65).addScaledVector(up, 0.015);
      linePositions.push(lineL1.x, lineL1.y, lineL1.z, lineL2.x, lineL2.y, lineL2.z);
      lineColors.push(0.95, 0.95, 0.95, 0.95, 0.95, 0.95);

      const lineR1 = p.clone().addScaledVector(right, hw - 0.65).addScaledVector(up, 0.015);
      const lineR2 = p.clone().addScaledVector(right, hw - 0.35).addScaledVector(up, 0.015);
      linePositions.push(lineR1.x, lineR1.y, lineR1.z, lineR2.x, lineR2.y, lineR2.z);
      lineColors.push(0.95, 0.95, 0.95, 0.95, 0.95, 0.95);

      if (isDash) {
        const cL = p.clone().addScaledVector(right, -0.15).addScaledVector(up, 0.015);
        const cR = p.clone().addScaledVector(right, 0.15).addScaledVector(up, 0.015);
        linePositions.push(cL.x, cL.y, cL.z, cR.x, cR.y, cR.z);
        lineColors.push(0.95, 0.95, 0.85, 0.95, 0.95, 0.85);
      } else {
        linePositions.push(p.x, p.y + 0.015, p.z, p.x, p.y + 0.015, p.z);
        lineColors.push(0.18, 0.18, 0.2, 0.18, 0.18, 0.2);
      }

      if (i < S && linePositions.length >= 24) {
        lineIndices.push(lineBase - 6, lineBase - 5, lineBase, lineBase - 5, lineBase + 1, lineBase);
        lineIndices.push(lineBase - 4, lineBase - 3, lineBase + 2, lineBase - 3, lineBase + 3, lineBase + 2);
        if (isDash) {
          lineIndices.push(lineBase - 2, lineBase - 1, lineBase + 4, lineBase - 1, lineBase + 5, lineBase + 4);
        }
      }

      // Curbs on curves
      const k = this.curvatureAt(i / S);
      if (Math.abs(k) > 0.018) {
        const isInnerLeft = k > 0;
        const curbSide = isInnerLeft ? -1 : 1;
        const curbInner = curbSide === -1 ? leftEdge : rightEdge;
        const curbOuter = curbInner.clone().addScaledVector(right, curbSide * 0.95).addScaledVector(up, 0.08);

        const curbBase = curbPositions.length / 3;
        curbPositions.push(curbInner.x, curbInner.y + 0.015, curbInner.z);
        curbPositions.push(curbOuter.x, curbOuter.y, curbOuter.z);

        const isRed = Math.floor((i / S) * 180) % 2 === 0;
        const r = isRed ? 0.92 : 0.98;
        const g = isRed ? 0.15 : 0.98;
        const b = isRed ? 0.15 : 0.98;
        curbColors.push(r, g, b, r, g, b);

        if (i < S && curbPositions.length >= 12) {
          curbIndices.push(curbBase - 2, curbBase - 1, curbBase, curbBase - 1, curbBase + 1, curbBase);
        }
      }

      // Skirt geometry
      const leftOuter = p.clone().addScaledVector(right, -(hw + skirtWidth)).setY(Math.max(-0.2, leftEdge.y - 0.8));
      const rightOuter = p.clone().addScaledVector(right, hw + skirtWidth).setY(Math.max(-0.2, rightEdge.y - 0.8));

      const sBase = skirtPositions.length / 3;
      skirtPositions.push(leftOuter.x, leftOuter.y, leftOuter.z);
      skirtPositions.push(leftEdge.x, leftEdge.y - 0.02, leftEdge.z);
      skirtColors.push(grassColor.r, grassColor.g, grassColor.b, gravelColor.r, gravelColor.g, gravelColor.b);
      skirtNormals.push(0, 1, 0, 0, 1, 0);

      skirtPositions.push(rightEdge.x, rightEdge.y - 0.02, rightEdge.z);
      skirtPositions.push(rightOuter.x, rightOuter.y, rightOuter.z);
      skirtColors.push(gravelColor.r, gravelColor.g, gravelColor.b, grassColor.r, grassColor.g, grassColor.b);
      skirtNormals.push(0, 1, 0, 0, 1, 0);

      if (i < S) {
        skirtIndices.push(sBase, sBase + 1, sBase + 4, sBase + 1, sBase + 5, sBase + 4);
        skirtIndices.push(sBase + 2, sBase + 3, sBase + 6, sBase + 3, sBase + 7, sBase + 6);
      }
    }

    // ── Outer Landscape Plane ──────────────────────────────────────────────
    const gridRes = 48;
    const gridSpan = 380;
    const groundGeom = new THREE.PlaneGeometry(gridSpan, gridSpan, gridRes, gridRes);
    groundGeom.rotateX(-Math.PI / 2);
    const gPosAttr = groundGeom.attributes.position as THREE.BufferAttribute;
    const gColors: number[] = [];

    for (let i = 0; i < gPosAttr.count; i++) {
      const vx = gPosAttr.getX(i);
      const vz = gPosAttr.getZ(i);

      const t = this.nearestT(new THREE.Vector3(vx, 0, vz));
      const sample = this.sample(t, { point: new THREE.Vector3(), tangent: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), halfWidth: 8 });
      const dist = Math.hypot(vx - sample.point.x, vz - sample.point.z);

      let vy = 0;
      if (dist < sample.halfWidth + skirtWidth) {
        vy = Math.max(-0.2, sample.point.y - 0.8);
      } else {
        const hill = Math.sin(vx * 0.022) * Math.cos(vz * 0.020) * 4.5
          + Math.sin((vx + vz) * 0.032) * 1.8;
        vy = Math.max(-0.2, hill);
      }
      gPosAttr.setY(i, vy);
      const c = dist < sample.halfWidth + skirtWidth + 12 ? grassColor : outerHillColor;
      gColors.push(c.r, c.g, c.b);
    }
    groundGeom.computeVertexNormals();
    groundGeom.setAttribute('color', new THREE.Float32BufferAttribute(gColors, 3));

    // ── Assemble 100% UNIFIED PHYSICALLY MANIFOLD TRIMESH ───────────────────
    const physPositions: number[] = [];
    const physIndices: number[] = [];

    // 1. Road buffer into physics
    const roadVertCount = roadPositions.length / 3;
    for (let i = 0; i < roadPositions.length; i++) physPositions.push(roadPositions[i]);
    for (let i = 0; i < roadIndices.length; i++) physIndices.push(roadIndices[i]);

    // 2. Skirt buffer into physics (cleanly offset by roadVertCount)
    const skirtVertCount = skirtPositions.length / 3;
    for (let i = 0; i < skirtPositions.length; i++) physPositions.push(skirtPositions[i]);
    for (let i = 0; i < skirtIndices.length; i++) physIndices.push(roadVertCount + skirtIndices[i]);

    // 3. Ground buffer into physics (cleanly offset by roadVertCount + skirtVertCount)
    const gIdxArray = groundGeom.getIndex()!.array;
    const baseGroundPhys = roadVertCount + skirtVertCount;
    for (let i = 0; i < gPosAttr.count; i++) {
      physPositions.push(gPosAttr.getX(i), gPosAttr.getY(i), gPosAttr.getZ(i));
    }
    for (let i = 0; i < gIdxArray.length; i++) {
      physIndices.push(baseGroundPhys + gIdxArray[i]);
    }

    // CREATE SOLID COLLIDER
    physics.createTerrain(
      new Float32Array(physPositions),
      new Uint32Array(physIndices),
    );

    // ── Visual Meshes ──────────────────────────────────────────────────────
    const roadGeom = new THREE.BufferGeometry();
    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeom.setIndex(roadIndices);
    roadGeom.computeVertexNormals();

    const roadMat = new THREE.MeshLambertMaterial({
      color: 0x27292e,
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

    const lineMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const lineMesh = new THREE.Mesh(lineGeom, lineMat);
    lineMesh.renderOrder = 1;
    scene.add(lineMesh);

    const curbGeom = new THREE.BufferGeometry();
    curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
    curbGeom.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
    if (curbIndices.length > 0) curbGeom.setIndex(curbIndices);
    curbGeom.computeVertexNormals();

    const curbMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const curbsMesh = new THREE.Mesh(curbGeom, curbMat);
    curbsMesh.receiveShadow = true;
    curbsMesh.castShadow = true;
    scene.add(curbsMesh);

    const skirtGeom = new THREE.BufferGeometry();
    skirtGeom.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
    skirtGeom.setAttribute('color', new THREE.Float32BufferAttribute(skirtColors, 3));
    skirtGeom.setAttribute('normal', new THREE.Float32BufferAttribute(skirtNormals, 3));
    skirtGeom.setIndex(skirtIndices);
    skirtGeom.computeVertexNormals();

    const skirtMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const terrainMesh = new THREE.Mesh(skirtGeom, skirtMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

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
    const matBanner = new THREE.MeshLambertMaterial({ color: 0x1a4488 });
    const matTireWall = new THREE.MeshLambertMaterial({ color: 0x222224 });
    const matTrunk = new THREE.MeshLambertMaterial({ color: 0x4a3622 });
    const matLeaves = new THREE.MeshLambertMaterial({ color: 0x2d5530 });

    const startP = this.cachedPoint[0];
    const startTan = this.cachedTangent[0];
    const startRight = this.cachedRight[0];
    const startUp = this.cachedUp[0];
    const hw = this.cachedHalfWidth[0];

    // 1. Start / Finish Gantry with Billboard facing the grid
    const gantry = new THREE.Group();
    gantry.position.copy(startP);
    gantry.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(startRight, startUp, startTan),
    );

    const postGeom = new THREE.BoxGeometry(0.55, 6.8, 0.55);
    const postL = new THREE.Mesh(postGeom, matMetal);
    postL.position.set(-hw - 1.4, 3.4, 0);
    const postR = new THREE.Mesh(postGeom, matMetal);
    postR.position.set(hw + 1.4, 3.4, 0);

    const barGeom = new THREE.BoxGeometry(hw * 2 + 3.4, 1.4, 0.9);
    const bar = new THREE.Mesh(barGeom, matDark);
    bar.position.set(0, 5.8, 0);

    // Billboard banner facing the approaching cars (-Z)
    const bannerGeom = new THREE.BoxGeometry(hw * 1.8, 1.1, 0.08);
    const banner = new THREE.Mesh(bannerGeom, matBanner);
    banner.position.set(0, 5.8, -0.48);

    // 5 Start Lamps facing the approaching cars (-Z)
    this.startLamps.length = 0;
    for (let k = -2; k <= 2; k++) {
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }),
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(k * 1.1, 5.8, -0.54);
      gantry.add(lamp);
      this.startLamps.push(lamp);
    }

    gantry.add(postL, postR, bar, banner);
    group.add(gantry);

    // 2. Grandstand & Pit Lane
    const grandstand = new THREE.Group();
    grandstand.position.copy(startP).addScaledVector(startRight, hw + 8.5).addScaledVector(startTan, -18);
    grandstand.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(startRight, startUp, startTan),
    );

    const standGeom = new THREE.BoxGeometry(26, 6.0, 10);
    const stand = new THREE.Mesh(standGeom, matMetal);
    stand.position.set(0, 3.0, 0);

    const roofGeom = new THREE.BoxGeometry(28, 0.45, 12);
    const roof = new THREE.Mesh(roofGeom, matRed);
    roof.position.set(0, 6.6, 0);
    grandstand.add(stand, roof);
    group.add(grandstand);

    // Pit Wall on the opposite side
    const pitWall = new THREE.Group();
    pitWall.position.copy(startP).addScaledVector(startRight, -hw - 4.5).addScaledVector(startTan, -10);
    pitWall.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(startRight, startUp, startTan),
    );
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 1.2, 0.6), matWhite);
    wallMesh.position.set(0, 0.6, 0);
    pitWall.add(wallMesh);
    group.add(pitWall);

    // 3. Sponsor Billboards
    for (let k = 0; k < 6; k++) {
      const t = 0.15 + k * 0.14;
      const idx = this.index(t);
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const tan = this.cachedTangent[idx];
      const curHw = this.cachedHalfWidth[idx];

      const board = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 0.25), matBanner);
      board.position.copy(p).addScaledVector(right, curHw + 3.2).setY(p.y + 2.0);
      board.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, new THREE.Vector3(0, 1, 0), tan),
      );
      group.add(board);

      const tireStack = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 10), matTireWall);
      tireStack.position.copy(p).addScaledVector(right, -curHw - 1.5).setY(p.y + 0.55);
      group.add(tireStack);
    }

    // 4. Outer Grove of Trees
    const treeCount = 95;
    const trunkGeom = new THREE.CylinderGeometry(0.25, 0.35, 3.2, 7);
    const crownGeom = new THREE.ConeGeometry(2.2, 4.0, 7);

    const trunkMesh = new THREE.InstancedMesh(trunkGeom, matTrunk, treeCount);
    const crownMesh = new THREE.InstancedMesh(crownGeom, matLeaves, treeCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < treeCount; i++) {
      const t = (i / treeCount) % 1;
      const idx = this.index(t);
      const p = this.cachedPoint[idx];
      const right = this.cachedRight[idx];
      const curHw = this.cachedHalfWidth[idx];

      const side = i % 2 === 0 ? 1 : -1;
      const dist = curHw + 14 + (i * 7) % 22;
      const treePos = p.clone().addScaledVector(right, side * dist);

      dummy.position.set(treePos.x, treePos.y + 1.6, treePos.z);
      const s = 0.85 + ((i * 11) % 5) * 0.12;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(treePos.x, treePos.y + 4.2 * s, treePos.z);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
    }

    trunkMesh.castShadow = true;
    crownMesh.castShadow = true;
    group.add(trunkMesh, crownMesh);
  }
}

/**
 * Beautiful, flowing, high-speed GP circuit layout (~650 meters).
 * Starts on a true straight along +Z so start line and gantry are cleanly aligned.
 */
export function defaultProTrackPoints(): THREE.Vector3[] {
  const raw: Array<[number, number, number]> = [
    [0, 0.2, -40],        // Start / Finish Line (Gantry at t = 0)
    [0, 0.2, 40],         // Main Straight end
    [35, 0.6, 95],        // Turn 1 sweeping fast right
    [85, 1.4, 110],       // Uphill gentle curve
    [130, 2.2, 85],       // Turn 2 crest
    [145, 3.2, 20],       // Fast sweeping downhill descent
    [140, 3.6, -40],      // High-speed transition
    [105, 3.2, -95],      // Turn 4 entry
    [55, 2.2, -135],      // Parabolica Hairpin apex
    [-10, 1.4, -140],     // Hairpin exit
    [-65, 0.8, -120],     // S-Chicane entry
    [-75, 0.4, -80],      // Mid chicane
    [-50, 0.2, -50],      // Fast sweeping curve
    [-25, 0.2, -80],      // Final turn entry
    [0, 0.2, -100],       // Straight entry towards start line
  ];
  return raw.map(([x, y, z]) => new THREE.Vector3(x, y, z));
}

export const defaultTrack3DPoints = defaultProTrackPoints;
