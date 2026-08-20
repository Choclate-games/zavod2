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
  getDeformedHeightAt = heightAt;

  build(scene: SceneManager, physics: PhysicsWorld, level: LevelConfig = LEVELS[0]): void {
    setLevel(level);
    this.finishZ = level.length;
    this.length = this.finishZ - this.startZ;

    scene.clearGroup(scene.roadGroup);
    scene.clearGroup(scene.decorationGroup);
    physics.clearObstacles();

    const geometry = buildTerrainGeometry();

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
   * Lightweight stub for road deformation (Option 1 relies on visual wheel mud sink and 3D tire tracks).
   */
  deformRoad(_worldX: number, _worldZ: number, _depth: number, _isSpinning = false): void {
    // Zero CPU overhead
  }

  flushDeformations(): void {
    // Zero CPU overhead
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
    // Bushes are low ground foliage; disabling shadow casting saves 90+ shadow pass instances on mobile
    bushMesh.castShadow = false;
    scene.decorationGroup.add(bushMesh);
  }

  private buildBoulders(scene: SceneManager, physics: PhysicsWorld, level: LevelConfig): void {
    const rockGeom = new THREE.DodecahedronGeometry(1, 1);
    const routeLen = level.length;
    const count = level.boulderCount;
    if (count <= 0) return;

    const countRock = Math.ceil(count / 2);
    const countDark = Math.floor(count / 2);

    const rockMesh = new THREE.InstancedMesh(rockGeom, scene.materials.rock, Math.max(1, countRock));
    const darkMesh = new THREE.InstancedMesh(rockGeom, scene.materials.rockDark, Math.max(1, countDark));

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const rot = new THREE.Euler();
    const sc = new THREE.Vector3();

    let idxRock = 0;
    let idxDark = 0;

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

      sc.set(radius * 1.15, radius * 0.85, radius * 1.05);
      rot.set(x * 0.4, z * 0.3, radius + i);
      quat.setFromEuler(rot);
      pos.set(x, y + radius * 0.45 - 0.12, z);
      matrix.compose(pos, quat, sc);

      if (i % 2 === 0 && idxRock < countRock) {
        rockMesh.setMatrixAt(idxRock, matrix);
        idxRock += 1;
      } else if (idxDark < countDark) {
        darkMesh.setMatrixAt(idxDark, matrix);
        idxDark += 1;
      }

      // Physical rigid collider
      physics.createObstacle(
        new THREE.Vector3(x, y + radius * 0.4, z),
        radius * 0.88,
      );
    }

    rockMesh.count = idxRock;
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    darkMesh.count = idxDark;
    darkMesh.castShadow = true;
    darkMesh.receiveShadow = true;

    if (idxRock > 0) scene.decorationGroup.add(rockMesh);
    if (idxDark > 0) scene.decorationGroup.add(darkMesh);
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
    const signs: Array<{ z: number; side: number }> = [
      { z: 28, side: 1 },
    ];

    for (const zone of level.mudZones) {
      signs.push({ z: Math.max(30, zone.startZ - 12), side: -1 });
    }
    if (level.tag === 'Кочки' || level.bumpAmp > 0.3) {
      signs.push({ z: 65, side: 1 });
    }
    if (level.tag === 'Экстрим' || level.tag === 'Сложно' || level.tag === 'Камни') {
      signs.push({ z: Math.round(level.length * 0.5), side: 1 });
    }
    signs.push({ z: level.length - 24, side: 1 });

    const postTransforms: Array<{ pos: THREE.Vector3; rotY: number }> = [];
    const boardTransforms: Array<{ pos: THREE.Vector3; rotY: number; scale?: THREE.Vector3 }> = [];

    for (const sign of signs) {
      const roadCX = mainRoadCenterX(sign.z);
      const x = roadCX + sign.side * (TERRAIN.roadHalfWidth + 0.9);
      const y = heightAt(x, sign.z);

      postTransforms.push({ pos: new THREE.Vector3(x, y + 1.0, sign.z), rotY: 0 });
      boardTransforms.push({
        pos: new THREE.Vector3(x, y + 1.8, sign.z),
        rotY: sign.side > 0 ? -0.2 : 0.2,
      });
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

          postTransforms.push({ pos: new THREE.Vector3(signX, signY + 1.0, splitSignZ), rotY: 0 });
          boardTransforms.push({
            pos: new THREE.Vector3(signX, signY + 1.85, splitSignZ),
            rotY: isLeft ? 0.35 : -0.35,
            scale: new THREE.Vector3(1.14, 1.08, 1.0),
          });
        }

        // 2. Chevron beacon at the tip of the median island
        const islandTipZ = fork.startZ + 4;
        const islandTipX = mainRoadCenterX(islandTipZ);
        const islandTipY = heightAt(islandTipX, islandTipZ);

        postTransforms.push({ pos: new THREE.Vector3(islandTipX, islandTipY + 0.9, islandTipZ), rotY: 0 });
        boardTransforms.push({
          pos: new THREE.Vector3(islandTipX, islandTipY + 1.8, islandTipZ),
          rotY: 0,
          scale: new THREE.Vector3(0.85, 0.85, 1.5),
        });

        // 3. Merge sign at the end of the fork
        const mergeZ = fork.endZ - 4;
        const mergeCX = mainRoadCenterX(mergeZ);
        const mergeX = mergeCX + (TERRAIN.roadHalfWidth + 1.0);
        const mergeY = heightAt(mergeX, mergeZ);

        postTransforms.push({ pos: new THREE.Vector3(mergeX, mergeY + 1.0, mergeZ), rotY: 0 });
        boardTransforms.push({
          pos: new THREE.Vector3(mergeX, mergeY + 1.8, mergeZ),
          rotY: -0.2,
        });
      }
    }

    if (postTransforms.length === 0) return;

    const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6);
    const boardGeom = new THREE.BoxGeometry(1.4, 0.6, 0.08);

    const postMesh = new THREE.InstancedMesh(postGeom, scene.materials.woodPlank, postTransforms.length);
    const boardMesh = new THREE.InstancedMesh(boardGeom, scene.materials.signBoard, boardTransforms.length);

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const rot = new THREE.Euler();
    const defaultSc = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < postTransforms.length; i += 1) {
      const pt = postTransforms[i];
      rot.set(0, pt.rotY, 0);
      quat.setFromEuler(rot);
      matrix.compose(pt.pos, quat, defaultSc);
      postMesh.setMatrixAt(i, matrix);
    }

    for (let i = 0; i < boardTransforms.length; i += 1) {
      const bt = boardTransforms[i];
      rot.set(0, bt.rotY, 0);
      quat.setFromEuler(rot);
      matrix.compose(bt.pos, quat, bt.scale || defaultSc);
      boardMesh.setMatrixAt(i, matrix);
    }

    postMesh.castShadow = true;
    boardMesh.castShadow = true;
    scene.decorationGroup.add(postMesh, boardMesh);
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
