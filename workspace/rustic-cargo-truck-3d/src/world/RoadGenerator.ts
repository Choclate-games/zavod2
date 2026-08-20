import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import type { LevelConfig } from './levels';
import { LEVELS } from './levels';
import { TERRAIN, buildTerrainGeometry, heightAt, roadHeightAt, getMudIntensity, getWaterIntensity, setLevel } from './terrain';

export class RoadGenerator {
  readonly startZ = 0;
  finishZ = 300;
  length = 300;

  roadHeightAt = roadHeightAt;
  heightAt = heightAt;
  getMudIntensity = getMudIntensity;
  getWaterIntensity = getWaterIntensity;


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
   * Real-time terrain and mud deformation under heavy spinning wheels.
   * Depresses the road surface, pushes a small mud ridge on the edges, and stains the ground dark wet brown.
   */
  deformRoad(worldX: number, worldZ: number, depth: number): void {
    if (!this.positionAttr || !this.colorAttr || !this.terrainGeometry) return;
    if (worldZ < TERRAIN.startZ || worldZ > TERRAIN.endZ || Math.abs(worldX) > TERRAIN.roadHalfWidth + 1.2) return;

    const gridX = ((worldX + TERRAIN.halfWidth) / (TERRAIN.halfWidth * 2)) * TERRAIN.segmentsX;
    const gridZ = ((worldZ - TERRAIN.startZ) / (TERRAIN.endZ - TERRAIN.startZ)) * this.segmentsZ;

    const ix = Math.round(gridX);
    const iz = Math.round(gridZ);

    if (ix < 1 || ix >= TERRAIN.segmentsX || iz < 1 || iz >= this.segmentsZ) return;

    const rowStride = TERRAIN.segmentsX + 1;
    const centerIdx = iz * rowStride + ix;

    const currentY = this.positionAttr.getY(centerIdx);
    const originalY = heightAt(this.positionAttr.getX(centerIdx), this.positionAttr.getZ(centerIdx));
    const maxRutDepth = 0.22;

    if (currentY > originalY - maxRutDepth) {
      const applyDepth = Math.min(depth, 0.05);
      this.positionAttr.setY(centerIdx, currentY - applyDepth);

      // Darken to wet mud color
      this.colorAttr.setXYZ(centerIdx, 0.22, 0.14, 0.09);

      // Displace neighbor vertices slightly upwards to create realistic displacement berms
      for (const dx of [-1, 1]) {
        const nIdx = iz * rowStride + (ix + dx);
        if (nIdx >= 0 && nIdx < this.positionAttr.count) {
          const nY = this.positionAttr.getY(nIdx);
          this.positionAttr.setY(nIdx, nY + applyDepth * 0.28);
          this.colorAttr.setXYZ(nIdx, 0.28, 0.18, 0.11);
        }
      }

      this.modifiedVertices = true;
    }

  }

  flushDeformations(): void {
    if (this.modifiedVertices && this.positionAttr && this.colorAttr) {
      this.positionAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
      this.modifiedVertices = false;
    }
  }

  private buildForest(scene: SceneManager, physics: PhysicsWorld, level: LevelConfig): void {
    const routeLen = level.length;
    // 1. Spruces (3-tier realistic conical crowns)
    const treeCount = Math.round(150 * (routeLen / 300));
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
      const laneOffset = 5.8 + ((i * 7) % 6) * 3.6;
      const x = side * laneOffset;
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

      // Solid physical collider for trees near the road / driving verge
      if (Math.abs(x) < 20 && z > 12 && z < routeLen - 15) {
        physics.createTreeCollider(new THREE.Vector3(x, y, z), 0.35 * scale, 1.8 * scale);
      }
    }

    trunkMesh.castShadow = true;
    crown1.castShadow = true;
    crown2.castShadow = true;
    crown3.castShadow = true;
    scene.decorationGroup.add(trunkMesh, crown1, crown2, crown3);

    // 2. Birches
    const birchCount = Math.round(60 * (routeLen / 300));
    const bTrunkGeom = new THREE.CylinderGeometry(0.16, 0.24, 3.8, 6);
    const bCrownGeom = new THREE.DodecahedronGeometry(1.7, 1);
    const bTrunkMesh = new THREE.InstancedMesh(bTrunkGeom, scene.materials.birchTrunk, birchCount);
    const bCrownMesh = new THREE.InstancedMesh(bCrownGeom, scene.materials.birchLeaves, birchCount);

    for (let i = 0; i < birchCount; i += 1) {
      const z = -6 + (i / birchCount) * (routeLen + 30) + Math.cos(i * 2.3) * 3.1;
      const side = (i % 3 === 0 ? -1 : 1);
      const x = side * (6.6 + ((i * 5) % 4) * 2.6);
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

      // Solid physical collider for roadside birches
      if (Math.abs(x) < 20 && z > 12 && z < routeLen - 15) {
        physics.createTreeCollider(new THREE.Vector3(x, y, z), 0.3 * scale, 1.8 * scale);
      }
    }

    bTrunkMesh.castShadow = true;
    bCrownMesh.castShadow = true;
    scene.decorationGroup.add(bTrunkMesh, bCrownMesh);

    // 3. Forest Undergrowth (Bushes)
    const bushCount = Math.round(75 * (routeLen / 300));
    const bushGeom = new THREE.SphereGeometry(1.0, 6, 5);
    bushGeom.scale(1.2, 0.7, 1.2);
    const bushMesh = new THREE.InstancedMesh(bushGeom, scene.materials.bush, bushCount);

    for (let i = 0; i < bushCount; i += 1) {
      const z = -10 + (i / bushCount) * (routeLen + 32);
      const side = (i % 2 === 0 ? 1 : -1);
      const x = side * (TERRAIN.roadHalfWidth + 0.8 + ((i * 4) % 5) * 1.2);
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

      // On rocky/extreme levels or every 2nd boulder, place it directly on the road lanes!
      const onRoad = (level.tag === 'Камни' || level.tag === 'Экстрим' || i % 2 === 1);
      const x = onRoad
        ? ((i * 11) % 5 - 2) * 1.05 // Between -2.1m and +2.1m right in the driving path
        : side * (TERRAIN.roadHalfWidth + 0.4 + ((i * 3) % 4) * 0.5);

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

  private buildWaterZones(scene: SceneManager, level: LevelConfig): void {
    if (!level.waterZones || level.waterZones.length === 0) return;

    for (const zone of level.waterZones) {
      const length = zone.endZ - zone.startZ;
      const width = (TERRAIN.roadHalfWidth + 2.5) * 2;
      const centerZ = (zone.startZ + zone.endZ) / 2;
      const centerY = roadHeightAt(centerZ) - 0.05;

      const waterGeom = new THREE.PlaneGeometry(width, length, 8, 8);
      waterGeom.rotateX(-Math.PI / 2);

      const waterMesh = new THREE.Mesh(waterGeom, scene.materials.water);
      waterMesh.position.set(0, centerY, centerZ);
      waterMesh.receiveShadow = true;
      scene.decorationGroup.add(waterMesh);
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
    if (level.tag === 'Экстрим' || level.tag === 'Сложно') {
      signs.push({ z: Math.round(level.length * 0.5), text: 'СКАЛЫ', side: 1 });
    }
    signs.push({ z: level.length - 24, text: 'ПИЛОРАМА', side: 1 });

    const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6);
    const boardGeom = new THREE.BoxGeometry(1.4, 0.6, 0.08);

    for (const sign of signs) {
      const x = sign.side * (TERRAIN.roadHalfWidth + 0.9);
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
    const base = heightAt(13, sawmillZ);

    // Large main factory building
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(13.4, 1.0, 11.4), scene.materials.foundation);
    foundation.position.set(13, base + 0.3, sawmillZ);
    foundation.receiveShadow = true;

    const building = new THREE.Mesh(new THREE.BoxGeometry(13, 5.5, 11), scene.materials.house);
    building.position.set(13, base + 3.4, sawmillZ);
    building.castShadow = true;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 4.0, 4), scene.materials.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(13, base + 7.8, sawmillZ);
    roof.castShadow = true;

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 6.5, 8), scene.materials.foundation);
    chimney.position.set(17, base + 8.2, sawmillZ);
    chimney.castShadow = true;

    scene.decorationGroup.add(foundation, building, roof, chimney);

    // Lumber storage piles
    const plankGeom = new THREE.BoxGeometry(4.2, 1.6, 2.2);
    const lumberY = heightAt(-12, sawmillZ - 4);
    const lumber = new THREE.Mesh(plankGeom, scene.materials.woodPlank);
    lumber.position.set(-12, lumberY + 0.8, sawmillZ - 4);
    lumber.castShadow = true;
    scene.decorationGroup.add(lumber);

    // Finish Gate / Archway
    const gateY = roadHeightAt(this.finishZ);
    const spanWidth = TERRAIN.roadHalfWidth * 2 + 1.2;

    const beam = new THREE.Mesh(new THREE.BoxGeometry(spanWidth, 0.45, 0.6), scene.materials.woodPlank);
    beam.position.set(0, gateY + 3.8, this.finishZ);
    beam.castShadow = true;

    const banner = new THREE.Mesh(new THREE.BoxGeometry(spanWidth * 0.8, 0.8, 0.08), scene.materials.banner);
    banner.position.set(0, gateY + 3.2, this.finishZ);
    banner.castShadow = true;

    const postGeometry = new THREE.BoxGeometry(0.42, 4.2, 0.42);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, scene.materials.trunk);
      post.position.set(side * (TERRAIN.roadHalfWidth + 0.5), gateY + 1.9, this.finishZ);
      post.castShadow = true;
      scene.decorationGroup.add(post);
    }

    scene.decorationGroup.add(beam, banner);
  }
}
