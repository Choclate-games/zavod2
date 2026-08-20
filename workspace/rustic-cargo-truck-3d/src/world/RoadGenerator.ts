import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import type { LevelConfig } from './levels';
import { LEVELS } from './levels';
import {
  TERRAIN,
  buildTerrainGeometry,
  heightAt,
  roadHeightAt,
  getMudIntensity,
  getWaterIntensity,
  mainRoadCenterX,
  getActiveFork,
  getRoadProximity,
  setLevel,
} from './terrain';

export class RoadGenerator {
  readonly startZ = 0;
  finishZ = 300;
  length = 300;

  roadHeightAt = roadHeightAt;
  heightAt = heightAt;
  getMudIntensity = getMudIntensity;
  getWaterIntensity = getWaterIntensity;
  mainRoadCenterX = mainRoadCenterX;
  getActiveFork = getActiveFork;
  getRoadProximity = getRoadProximity;

  getDeformedHeightAt(worldX: number, worldZ: number): number {
    if (!this.positionAttr || worldZ < TERRAIN.startZ || worldZ > TERRAIN.endZ) {
      return heightAt(worldX, worldZ);
    }
    const gridX = ((worldX + TERRAIN.halfWidth) / (TERRAIN.halfWidth * 2)) * TERRAIN.segmentsX;
    const gridZ = ((worldZ - TERRAIN.startZ) / (TERRAIN.endZ - TERRAIN.startZ)) * this.segmentsZ;
    const ix = Math.round(gridX);
    const iz = Math.round(gridZ);
    if (ix < 0 || ix > TERRAIN.segmentsX || iz < 0 || iz > this.segmentsZ) {
      return heightAt(worldX, worldZ);
    }
    const idx = iz * (TERRAIN.segmentsX + 1) + ix;
    return this.positionAttr.getY(idx);
  }

  private terrainGeometry: THREE.BufferGeometry | null = null;
  private positionAttr: THREE.BufferAttribute | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;
  private segmentsZ = 0;
  private modifiedVertices = false;

  build(scene: SceneManager, physics: PhysicsWorld, level: LevelConfig = LEVELS[0]): void {
    setLevel(level);
    this.finishZ = level.length;
    this.length = this.finishZ - this.startZ;

    scene.clearGroup(scene.roadGroup);
    scene.clearGroup(scene.decorationGroup);
    physics.clearObstacles();

    const geometry = buildTerrainGeometry();
    this.terrainGeometry = geometry;
    this.positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    this.colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    this.segmentsZ = Math.round((TERRAIN.endZ - TERRAIN.startZ) / TERRAIN.segmentLength);

    const ground = new THREE.Mesh(geometry, scene.materials.terrain);
    ground.receiveShadow = true;
    scene.roadGroup.add(ground);

    physics.createTerrain(
      geometry.getAttribute('position').array as Float32Array,
      new Uint32Array(geometry.getIndex()!.array),
    );

    this.buildForest(scene, physics, level);
    this.buildBoulders(scene, physics, level);
    this.buildWaterZones(scene, level);
    this.buildRoadSigns(scene, level);
    this.buildVillage(scene);
    this.buildSawmill(scene);
  }

  /**
   * Real-time SnowRunner-style terrain and mud deformation under rolling and spinning wheels.
   * - Carves continuous deep tire ruts directly under the contact patch
   * - Pushes displaced mud outwards into raised lateral berms along the rut edges
   * - Progressively churns deeper under wheelspin
   * - Stains soil to dark wet peat mud in the trench and clumpy textured mud on berms
   */
  deformRoad(worldX: number, worldZ: number, depth: number, isSpinning = false): void {
    if (!this.positionAttr || !this.colorAttr || !this.terrainGeometry) return;
    if (worldZ < TERRAIN.startZ || worldZ > TERRAIN.endZ) return;
    const prox = getRoadProximity(worldX, worldZ);
    if (prox.distToRoad > TERRAIN.roadHalfWidth + 3.0) return;

    const gridX = ((worldX + TERRAIN.halfWidth) / (TERRAIN.halfWidth * 2)) * TERRAIN.segmentsX;
    const gridZ = ((worldZ - TERRAIN.startZ) / (TERRAIN.endZ - TERRAIN.startZ)) * this.segmentsZ;

    const cx = Math.round(gridX);
    const cz = Math.round(gridZ);

    if (cx < 3 || cx >= TERRAIN.segmentsX - 2 || cz < 3 || cz >= this.segmentsZ - 2) return;

    const rowStride = TERRAIN.segmentsX + 1;
    const maxRutDepth = isSpinning ? 0.38 : 0.28;
    const effectiveDepth = Math.min(depth * (isSpinning ? 1.8 : 1.2), 0.08);

    const rutRadius = 0.95;
    const bermRadius = 2.10;

    // 2D kernel over 7x7 vertex neighborhood
    for (let dz = -3; dz <= 3; dz += 1) {
      const iz = cz + dz;
      if (iz < 0 || iz >= this.segmentsZ) continue;

      for (let dx = -3; dx <= 3; dx += 1) {
        const ix = cx + dx;
        if (ix < 0 || ix >= TERRAIN.segmentsX) continue;

        const idx = iz * rowStride + ix;
        const vx = this.positionAttr.getX(idx);
        const vz = this.positionAttr.getZ(idx);
        const curY = this.positionAttr.getY(idx);
        const origY = heightAt(vx, vz);

        const dist = Math.sqrt((vx - worldX) * (vx - worldX) + (vz - worldZ) * (vz - worldZ));

        if (dist <= rutRadius) {
          // Central rut trough: depress soil
          const weight = Math.cos((dist / rutRadius) * (Math.PI / 2));
          const sink = effectiveDepth * weight;

          if (curY > origY - maxRutDepth) {
            const newY = Math.max(origY - maxRutDepth, curY - sink);
            this.positionAttr.setY(idx, newY);

            // Dark wet peat mud color
            const mudFactor = Math.min(1.0, (origY - newY) / (maxRutDepth * 0.7));
            const r = THREE.MathUtils.lerp(0.24, 0.10, mudFactor);
            const g = THREE.MathUtils.lerp(0.16, 0.06, mudFactor);
            const b = THREE.MathUtils.lerp(0.10, 0.03, mudFactor);
            this.colorAttr.setXYZ(idx, r, g, b);
            this.modifiedVertices = true;
          }
        } else if (dist <= bermRadius) {
          // Outer perimeter berm: push displaced soil upwards
          const bermWeight = Math.sin(((dist - rutRadius) / (bermRadius - rutRadius)) * Math.PI);
          const rise = effectiveDepth * 0.42 * bermWeight;

          if (curY < origY + 0.18) {
            this.positionAttr.setY(idx, curY + rise);
            // Clumpy textured mud color
            this.colorAttr.setXYZ(idx, 0.30, 0.20, 0.12);
            this.modifiedVertices = true;
          }
        }
      }
    }
  }

  flushDeformations(): void {
    if (this.modifiedVertices && this.positionAttr && this.colorAttr && this.terrainGeometry) {
      this.positionAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
      this.terrainGeometry.computeVertexNormals();
      this.modifiedVertices = false;
    }
  }

  private buildForest(scene: SceneManager, physics: PhysicsWorld, level: LevelConfig): void {
    const routeLen = level.length;
    // 1. Spruces (3-tier realistic conical crowns)
    const treeCount = Math.round(180 * (routeLen / 300));
    const trunkGeom = new THREE.CylinderGeometry(0.22, 0.32, 3.4, 7);
    const crownGeom = new THREE.ConeGeometry(2.4, 2.9, 7);

    const trunkMesh = new THREE.InstancedMesh(trunkGeom, scene.materials.trunk, treeCount);
    const crown1 = new THREE.InstancedMesh(crownGeom, scene.materials.pineDark, treeCount);
    const crown2 = new THREE.InstancedMesh(crownGeom, scene.materials.pineMed, treeCount);
    const crown3 = new THREE.InstancedMesh(crownGeom, scene.materials.pineLight, treeCount);

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const rot = new THREE.Euler();
    const sc = new THREE.Vector3();

    for (let i = 0; i < treeCount; i += 1) {
      const z = -12 + (i / treeCount) * (routeLen + 36) + (Math.sin(i * 1.7) * 2.2);
      const side = (i % 2 === 0 ? 1 : -1);
      const laneOffset = 5.6 + ((i * 7) % 6) * 3.4;
      const forkInfo = getActiveFork(z);

      let x: number;
      if (forkInfo && forkInfo.splitFactor > 0.25 && (i % 3 !== 1)) {
        // Place on central median divider island/mountain between wide fork branches
        const span = forkInfo.rightCX - forkInfo.leftCX;
        const norm = 0.2 + 0.6 * ((i * 13) % 7) / 6.0;
        x = forkInfo.leftCX + norm * span;
      } else if (forkInfo && forkInfo.splitFactor > 0.1) {
        x = side > 0 ? (forkInfo.rightCX + laneOffset) : (forkInfo.leftCX - laneOffset);
      } else {
        const roadCX = mainRoadCenterX(z);
        x = roadCX + side * laneOffset;
      }

      const y = heightAt(x, z);

      const scale = 0.85 + ((i * 11) % 7) * 0.08;
      sc.set(scale, scale, scale);
      rot.set(0, (i * 1.7) % (Math.PI * 2), 0);
      quat.setFromEuler(rot);

      pos.set(x, y + 1.5 * scale - 0.3, z);
      matrix.compose(pos, quat, sc);
      trunkMesh.setMatrixAt(i, matrix);

      pos.set(x, y + 2.9 * scale, z);
      matrix.compose(pos, quat, sc);
      crown1.setMatrixAt(i, matrix);

      pos.set(x, y + 4.2 * scale, z);
      matrix.compose(pos, quat, sc);
      crown2.setMatrixAt(i, matrix);

      pos.set(x, y + 5.4 * scale, z);
      matrix.compose(pos, quat, sc);
      crown3.setMatrixAt(i, matrix);

      // Solid physical collider for trees near any road branch
      const prox = getRoadProximity(x, z);
      if (prox.distToRoad < 22 && z > 14 && z < routeLen - 16) {
        physics.createTreeCollider(new THREE.Vector3(x, y, z), 0.35 * scale, 1.8 * scale);
      }
    }

    trunkMesh.castShadow = true;
    crown1.castShadow = true;
    crown2.castShadow = true;
    crown3.castShadow = true;
    scene.decorationGroup.add(trunkMesh, crown1, crown2, crown3);

    // 2. Birches
    const birchCount = Math.round(75 * (routeLen / 300));
    const bTrunkGeom = new THREE.CylinderGeometry(0.16, 0.24, 3.8, 6);
    const bCrownGeom = new THREE.DodecahedronGeometry(1.7, 1);
    const bTrunkMesh = new THREE.InstancedMesh(bTrunkGeom, scene.materials.birchTrunk, birchCount);
    const bCrownMesh = new THREE.InstancedMesh(bCrownGeom, scene.materials.birchLeaves, birchCount);

    for (let i = 0; i < birchCount; i += 1) {
      const z = -6 + (i / birchCount) * (routeLen + 30) + Math.cos(i * 2.3) * 3.1;
      const side = (i % 3 === 0 ? -1 : 1);
      const laneOffset = 6.4 + ((i * 5) % 4) * 2.5;
      const forkInfo = getActiveFork(z);

      let x: number;
      if (forkInfo && forkInfo.splitFactor > 0.3 && (i % 3 === 0)) {
        const span = forkInfo.rightCX - forkInfo.leftCX;
        const norm = 0.25 + 0.5 * ((i * 11) % 5) / 4.0;
        x = forkInfo.leftCX + norm * span;
      } else if (forkInfo && forkInfo.splitFactor > 0.1) {
        x = side > 0 ? (forkInfo.rightCX + laneOffset) : (forkInfo.leftCX - laneOffset);
      } else {
        const roadCX = mainRoadCenterX(z);
        x = roadCX + side * laneOffset;
      }

      const y = heightAt(x, z);

      const scale = 0.8 + ((i * 9) % 6) * 0.09;
      sc.set(scale, scale, scale);
      rot.set(0.04 * Math.sin(i), (i * 2.1) % (Math.PI * 2), 0.04 * Math.cos(i));
      quat.setFromEuler(rot);

      pos.set(x, y + 1.7 * scale - 0.25, z);
      matrix.compose(pos, quat, sc);
      bTrunkMesh.setMatrixAt(i, matrix);

      pos.set(x, y + 4.0 * scale, z);
      matrix.compose(pos, quat, sc);
      bCrownMesh.setMatrixAt(i, matrix);

      const prox = getRoadProximity(x, z);
      if (prox.distToRoad < 22 && z > 14 && z < routeLen - 16) {
        physics.createTreeCollider(new THREE.Vector3(x, y, z), 0.3 * scale, 1.8 * scale);
      }
    }

    bTrunkMesh.castShadow = true;
    bCrownMesh.castShadow = true;
    scene.decorationGroup.add(bTrunkMesh, bCrownMesh);

    // 3. Forest Undergrowth (Bushes)
    const bushCount = Math.round(90 * (routeLen / 300));
    const bushGeom = new THREE.SphereGeometry(1.0, 6, 5);
    bushGeom.scale(1.2, 0.7, 1.2);
    const bushMesh = new THREE.InstancedMesh(bushGeom, scene.materials.bush, bushCount);

    for (let i = 0; i < bushCount; i += 1) {
      const z = -10 + (i / bushCount) * (routeLen + 32);
      const side = (i % 2 === 0 ? 1 : -1);
      const forkInfo = getActiveFork(z);

      let x: number;
      if (forkInfo && forkInfo.splitFactor > 0.25 && (i % 2 === 0)) {
        const span = forkInfo.rightCX - forkInfo.leftCX;
        x = forkInfo.leftCX + (0.3 + 0.4 * ((i * 7) % 4) / 3.0) * span;
      } else if (forkInfo && forkInfo.splitFactor > 0.1) {
        x = side > 0
          ? (forkInfo.rightCX + TERRAIN.roadHalfWidth + 0.8 + ((i * 4) % 5) * 1.1)
          : (forkInfo.leftCX - (TERRAIN.roadHalfWidth + 0.8 + ((i * 4) % 5) * 1.1));
      } else {
        const roadCX = mainRoadCenterX(z);
        x = roadCX + side * (TERRAIN.roadHalfWidth + 0.8 + ((i * 4) % 5) * 1.1);
      }

      const y = heightAt(x, z);
      const scale = 0.55 + ((i * 7) % 5) * 0.12;
      sc.set(scale, scale, scale);
      pos.set(x, y + 0.3 * scale, z);
      rot.set(0, i * 1.1, 0);
      quat.setFromEuler(rot);
      matrix.compose(pos, quat, sc);
      bushMesh.setMatrixAt(i, matrix);
    }
    bushMesh.castShadow = true;
    scene.decorationGroup.add(bushMesh);
  }

  private buildBoulders(scene: SceneManager, physics: PhysicsWorld, level: LevelConfig): void {
    const rockGeom = new THREE.DodecahedronGeometry(1, 1);
    const routeLen = level.length;
    const count = level.boulderCount;

    for (let i = 0; i < count; i += 1) {
      const fraction = (i + 1) / (count + 1);
      const z = 24 + fraction * (routeLen - 48) + Math.sin(i * 2.7) * 2.2;
      const side = (i % 2 === 0 ? 1 : -1);

      const onRoad = (level.tag === 'Камни' || level.tag === 'Экстрим' || i % 2 === 1);
      const forkInfo = getActiveFork(z);

      let x: number;
      if (forkInfo && forkInfo.splitFactor > 0.3) {
        const targetLeft = (forkInfo.fork.leftBoulders && !forkInfo.fork.rightBoulders) || (i % 2 === 0);
        const branchCX = targetLeft ? forkInfo.leftCX : forkInfo.rightCX;
        const branchHasBoulders = targetLeft ? (forkInfo.fork.leftBoulders ?? 0) > 0 : (forkInfo.fork.rightBoulders ?? 0) > 0;
        x = (onRoad && branchHasBoulders)
          ? branchCX + ((i * 11) % 5 - 2) * 0.85
          : branchCX + side * (TERRAIN.roadHalfWidth + 0.4 + ((i * 3) % 4) * 0.5);
      } else {
        const roadCX = mainRoadCenterX(z);
        x = onRoad
          ? roadCX + ((i * 11) % 5 - 2) * 0.9
          : roadCX + side * (TERRAIN.roadHalfWidth + 0.4 + ((i * 3) % 4) * 0.5);
      }

      const y = heightAt(x, z);
      const radius = onRoad ? 0.48 + ((i * 7) % 5) * 0.10 : 0.85 + ((i * 5) % 4) * 0.15;

      const mesh = new THREE.Mesh(rockGeom, i % 2 === 0 ? scene.materials.rock : scene.materials.rockDark);
      mesh.scale.set(radius * 1.15, radius * 0.85, radius * 1.05);
      mesh.position.set(x, y + radius * 0.45 - 0.12, z);
      mesh.rotation.set(x * 0.4, z * 0.3, radius + i);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.decorationGroup.add(mesh);

      // Physical rigid collider
      physics.createObstacle(
        new THREE.Vector3(x, y + radius * 0.4, z),
        radius * 0.88,
      );
    }
  }

  /**
   * Conformal water meshes: vertices perfectly follow road height at every step Z,
   * completely eliminating floating/levitating water planes in the air.
   */
  private createConformalWaterMesh(
    startZ: number,
    endZ: number,
    getCenterX: (z: number) => number,
    width: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const length = Math.max(2, endZ - startZ);
    const stepsZ = Math.max(12, Math.round(length / 1.5));
    const stepsX = 8;
    const geom = new THREE.PlaneGeometry(width, length, stepsX, stepsZ);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);
      const worldZ = (startZ + endZ) / 2 + localZ;
      const roadCX = getCenterX(worldZ);
      const worldX = roadCX + localX;
      const bedY = roadHeightAt(worldZ, worldX);
      const worldY = bedY + 0.05;
      pos.setXYZ(i, worldX, worldY, worldZ);
    }
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildWaterZones(scene: SceneManager, level: LevelConfig): void {
    // 1. Main road water zones
    if (level.waterZones && level.waterZones.length > 0) {
      for (const zone of level.waterZones) {
        const mesh = this.createConformalWaterMesh(
          zone.startZ,
          zone.endZ,
          (z) => mainRoadCenterX(z),
          (TERRAIN.roadHalfWidth + 1.2) * 2,
          scene.materials.water,
        );
        scene.decorationGroup.add(mesh);
      }
    }

    // 2. Fork branch water zones
    if (level.forks) {
      for (const fork of level.forks) {
        if (fork.leftWaterDepth) {
          const mesh = this.createConformalWaterMesh(
            fork.startZ + 6,
            fork.endZ - 6,
            (z) => {
              const info = getActiveFork(z);
              return info ? info.leftCX : mainRoadCenterX(z) + fork.leftOffset;
            },
            (TERRAIN.roadHalfWidth + 1.0) * 2,
            scene.materials.water,
          );
          scene.decorationGroup.add(mesh);
        }
        if (fork.rightWaterDepth) {
          const mesh = this.createConformalWaterMesh(
            fork.startZ + 6,
            fork.endZ - 6,
            (z) => {
              const info = getActiveFork(z);
              return info ? info.rightCX : mainRoadCenterX(z) + fork.rightOffset;
            },
            (TERRAIN.roadHalfWidth + 1.0) * 2,
            scene.materials.water,
          );
          scene.decorationGroup.add(mesh);
        }
      }
    }
  }

  private buildRoadSigns(scene: SceneManager, level: LevelConfig): void {
    const signs: Array<{ z: number; text: string; side: number }> = [
      { z: 28, text: 'ОСТОРОЖНО', side: 1 },
    ];

    for (const zone of level.mudZones) {
      signs.push({ z: Math.max(30, zone.startZ - 12), text: 'ВЯЗКАЯ ГРЯЗЬ', side: -1 });
    }
    if (level.tag === 'Кочки' || level.bumpAmp > 0.3) {
      signs.push({ z: 65, text: 'УХАБЫ', side: 1 });
    }
    if (level.tag === 'Экстрим' || level.tag === 'Сложно' || level.tag === 'Камни') {
      signs.push({ z: Math.round(level.length * 0.5), text: 'СКАЛЫ', side: 1 });
    }
    signs.push({ z: level.length - 24, text: 'ПИЛОРАМА', side: 1 });

    const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6);
    const boardGeom = new THREE.BoxGeometry(1.4, 0.6, 0.08);

    for (const sign of signs) {
      const roadCX = mainRoadCenterX(sign.z);
      const x = roadCX + sign.side * (TERRAIN.roadHalfWidth + 0.9);
      const y = heightAt(x, sign.z);

      const post = new THREE.Mesh(postGeom, scene.materials.woodPlank);
      post.position.set(x, y + 1.0, sign.z);
      post.castShadow = true;

      const board = new THREE.Mesh(boardGeom, scene.materials.signBoard);
      board.position.set(x, y + 1.8, sign.z);
      board.rotation.y = sign.side > 0 ? -0.2 : 0.2;
      board.castShadow = true;

      scene.decorationGroup.add(post, board);
    }

    // Fork Directional Signs & Chevron Island Markers
    if (level.forks) {
      for (const fork of level.forks) {
        const splitSignZ = Math.max(20, fork.startZ - 12);
        const splitCX = mainRoadCenterX(splitSignZ);

        // 1. Double signpost before the fork
        for (const side of [-1, 1]) {
          const isLeft = side < 0;
          const signX = splitCX + side * (TERRAIN.roadHalfWidth + 1.2);
          const signY = heightAt(signX, splitSignZ);

          const post = new THREE.Mesh(postGeom, scene.materials.woodPlank);
          post.position.set(signX, signY + 1.0, splitSignZ);
          post.castShadow = true;

          const arrowBoard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 0.08), scene.materials.signBoard);
          arrowBoard.position.set(signX, signY + 1.85, splitSignZ);
          arrowBoard.rotation.y = isLeft ? 0.35 : -0.35;
          arrowBoard.castShadow = true;

          scene.decorationGroup.add(post, arrowBoard);
        }

        // 2. Chevron beacon at the tip of the median island
        const islandTipZ = fork.startZ + 4;
        const islandTipX = mainRoadCenterX(islandTipZ);
        const islandTipY = heightAt(islandTipX, islandTipZ);

        const beaconPost = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), scene.materials.trunk);
        beaconPost.position.set(islandTipX, islandTipY + 0.9, islandTipZ);
        beaconPost.castShadow = true;

        const chevronBoard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.12), scene.materials.banner);
        chevronBoard.position.set(islandTipX, islandTipY + 1.8, islandTipZ);
        chevronBoard.castShadow = true;

        scene.decorationGroup.add(beaconPost, chevronBoard);

        // 3. Merge sign at the end of the fork
        const mergeZ = fork.endZ - 4;
        const mergeCX = mainRoadCenterX(mergeZ);
        const mergeX = mergeCX + (TERRAIN.roadHalfWidth + 1.0);
        const mergeY = heightAt(mergeX, mergeZ);

        const mergePost = new THREE.Mesh(postGeom, scene.materials.woodPlank);
        mergePost.position.set(mergeX, mergeY + 1.0, mergeZ);
        mergePost.castShadow = true;

        const mergeBoard = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.08), scene.materials.signBoard);
        mergeBoard.position.set(mergeX, mergeY + 1.8, mergeZ);
        mergeBoard.rotation.y = -0.2;
        mergeBoard.castShadow = true;

        scene.decorationGroup.add(mergePost, mergeBoard);
      }
    }
  }

  private buildVillage(scene: SceneManager): void {
    // Village houses grounded on flat clearings at z = -4..18
    const houses = [
      { x: -11, z: 6, w: 5.6, h: 3.2, d: 5.2 },
      { x: 12, z: 14, w: 6.2, h: 3.4, d: 5.5 },
    ];

    for (const h of houses) {
      const baseY = heightAt(h.x, h.z);

      // Stone foundation slab
      const foundation = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.4, 0.8, h.d + 0.4), scene.materials.foundation);
      foundation.position.set(h.x, baseY + 0.2, h.z);
      foundation.receiveShadow = true;

      // Wooden log cabin
      const house = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), scene.materials.house);
      house.position.set(h.x, baseY + 0.6 + h.h / 2, h.z);
      house.castShadow = true;

      // Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.78, 2.4, 4), scene.materials.roof);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(h.x, baseY + 0.6 + h.h + 1.1, h.z);
      roof.castShadow = true;

      // Stone chimney
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 3.2, 6), scene.materials.foundation);
      chimney.position.set(h.x + h.w * 0.3, baseY + h.h + 2.0, h.z);
      chimney.castShadow = true;

      scene.decorationGroup.add(foundation, house, roof, chimney);
    }

    // Wooden timber stack at start
    const stackY = heightAt(8, -2);
    const stackGeom = new THREE.CylinderGeometry(0.24, 0.24, 3.8, 8);
    stackGeom.rotateZ(Math.PI / 2);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3 - r; c += 1) {
        const logMesh = new THREE.Mesh(stackGeom, scene.materials.log);
        logMesh.position.set(8 + (c - (2 - r) * 0.5) * 0.52, stackY + 0.25 + r * 0.44, -2);
        logMesh.castShadow = true;
        scene.decorationGroup.add(logMesh);
      }
    }
  }

  private buildSawmill(scene: SceneManager): void {
    const sawmillZ = this.finishZ + 12;
    const gateCX = mainRoadCenterX(this.finishZ);
    const base = heightAt(gateCX + 13, sawmillZ);

    // Large main factory building
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(13.4, 1.0, 11.4), scene.materials.foundation);
    foundation.position.set(gateCX + 13, base + 0.3, sawmillZ);
    foundation.receiveShadow = true;

    const building = new THREE.Mesh(new THREE.BoxGeometry(13, 5.5, 11), scene.materials.house);
    building.position.set(gateCX + 13, base + 3.4, sawmillZ);
    building.castShadow = true;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 4.0, 4), scene.materials.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(gateCX + 13, base + 7.8, sawmillZ);
    roof.castShadow = true;

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 6.5, 8), scene.materials.foundation);
    chimney.position.set(gateCX + 17, base + 8.2, sawmillZ);
    chimney.castShadow = true;

    scene.decorationGroup.add(foundation, building, roof, chimney);

    // Lumber storage piles
    const plankGeom = new THREE.BoxGeometry(4.2, 1.6, 2.2);
    const lumberY = heightAt(gateCX - 12, sawmillZ - 4);
    const lumber = new THREE.Mesh(plankGeom, scene.materials.woodPlank);
    lumber.position.set(gateCX - 12, lumberY + 0.8, sawmillZ - 4);
    lumber.castShadow = true;
    scene.decorationGroup.add(lumber);

    // Finish Gate / Archway
    const gateY = roadHeightAt(this.finishZ, gateCX);
    const spanWidth = TERRAIN.roadHalfWidth * 2 + 1.2;

    const beam = new THREE.Mesh(new THREE.BoxGeometry(spanWidth, 0.45, 0.6), scene.materials.woodPlank);
    beam.position.set(gateCX, gateY + 3.8, this.finishZ);
    beam.castShadow = true;

    const banner = new THREE.Mesh(new THREE.BoxGeometry(spanWidth * 0.8, 0.8, 0.08), scene.materials.banner);
    banner.position.set(gateCX, gateY + 3.2, this.finishZ);
    banner.castShadow = true;

    const postGeometry = new THREE.BoxGeometry(0.42, 4.2, 0.42);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, scene.materials.trunk);
      post.position.set(gateCX + side * (TERRAIN.roadHalfWidth + 0.5), gateY + 1.9, this.finishZ);
      post.castShadow = true;
      scene.decorationGroup.add(post);
    }

    scene.decorationGroup.add(beam, banner);
  }
}
