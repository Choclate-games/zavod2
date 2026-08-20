import * as THREE from "three";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { CrystalCluster } from "../entities/CrystalCluster";
import { EnemyPool } from "../entities/EnemyPool";
import { EventBus } from "../core/EventBus";
import { MathUtils } from "../utils/MathUtils";

export interface CaveLevelData {
  startPos: THREE.Vector3;
  stationPos: THREE.Vector3;
  exitPos: THREE.Vector3;
  crystalClusters: CrystalCluster[];
  wallMeshes: THREE.Mesh[];
  floorMeshes: THREE.Mesh[];
  stationMesh: THREE.Group;
  exitMesh: THREE.Group;
}

export class CaveGenerator {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private eventBus: EventBus;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, eventBus: EventBus) {
    this.scene = scene;
    this.physics = physics;
    this.eventBus = eventBus;
  }

  public generateFloor(floorIndex: number, enemyPool: EnemyPool, baseCrystalVal: number): CaveLevelData {
    this.physics.clear();

    const wallMeshes: THREE.Mesh[] = [];
    const floorMeshes: THREE.Mesh[] = [];
    const crystalClusters: CrystalCluster[] = [];

    // Cave Palette
    const rockMat = new THREE.MeshStandardMaterial({
      color: floorIndex === 1 ? 0x182030 : floorIndex === 2 ? 0x24142e : 0x101a18,
      roughness: 0.9,
      metalness: 0.1
    });

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0d131f,
      roughness: 0.95,
      metalness: 0.05
    });

    // 1. Generate Main Floor Grid
    const roomSize = 48 + floorIndex * 8;
    const half = roomSize / 2;

    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0, 0);
    this.scene.add(floorMesh);
    floorMeshes.push(floorMesh);

    // 2. Outer Cave Perimeter Walls
    const wallHeight = 6.0;
    const wallThick = 4.0;

    const createWall = (x: number, z: number, w: number, d: number) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, rockMat);
      mesh.position.set(x, wallHeight / 2, z);
      this.scene.add(mesh);
      wallMeshes.push(mesh);

      const min = new THREE.Vector3(x - w / 2, 0, z - d / 2);
      const max = new THREE.Vector3(x + w / 2, wallHeight, z + d / 2);
      this.physics.addStaticObstacle(min, max);
    };

    // 4 Border Walls
    createWall(0, -half - wallThick / 2, roomSize + wallThick * 2, wallThick);
    createWall(0, half + wallThick / 2, roomSize + wallThick * 2, wallThick);
    createWall(-half - wallThick / 2, 0, wallThick, roomSize + wallThick * 2);
    createWall(half + wallThick / 2, 0, wallThick, roomSize + wallThick * 2);

    // 3. Internal Columns & Rock Formations (Labyrinth Structure)
    const pillarCount = 14 + floorIndex * 4;
    for (let i = 0; i < pillarCount; i++) {
      const px = MathUtils.randomRange(-half + 8, half - 8);
      const pz = MathUtils.randomRange(-half + 8, half - 8);

      // Keep start area clear
      if (Math.abs(px) < 6 && Math.abs(pz) < 6) continue;

      const pw = MathUtils.randomRange(3.0, 7.0);
      const pd = MathUtils.randomRange(3.0, 7.0);

      createWall(px, pz, pw, pd);
    }

    // 4. Chasm Pits (Hazard zones where falling leads to death)
    const chasmCount = 2 + floorIndex * 2;
    for (let i = 0; i < chasmCount; i++) {
      const cx = MathUtils.randomRange(-half + 10, half - 10);
      const cz = MathUtils.randomRange(-half + 10, half - 10);

      if (Math.abs(cx) < 8 && Math.abs(cz) < 8) continue;

      const cw = MathUtils.randomRange(4.0, 7.0);
      const cd = MathUtils.randomRange(4.0, 7.0);

      const min = new THREE.Vector3(cx - cw / 2, -10, cz - cd / 2);
      const max = new THREE.Vector3(cx + cw / 2, 0.1, cz + cd / 2);
      this.physics.addChasmPit(min, max);

      // Visual Chasm Black Hole
      const pitGeo = new THREE.PlaneGeometry(cw, cd);
      pitGeo.rotateX(-Math.PI / 2);
      const pitMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const pitMesh = new THREE.Mesh(pitGeo, pitMat);
      pitMesh.position.set(cx, 0.02, cz);
      this.scene.add(pitMesh);
      floorMeshes.push(pitMesh);
    }

    // 5. Crystal Formations
    const crystalCount = 6 + floorIndex * 3;
    for (let i = 0; i < crystalCount; i++) {
      const cx = MathUtils.randomRange(-half + 6, half - 6);
      const cz = MathUtils.randomRange(-half + 6, half - 6);

      if (Math.abs(cx) < 5 && Math.abs(cz) < 5) continue;
      if (this.physics.checkWallCollision(cx, 0, cz, 1.0) || this.physics.isPositionInChasm(cx, cz)) continue;

      const cluster = new CrystalCluster(
        `c_${floorIndex}_${i}`,
        new THREE.Vector3(cx, 0, cz),
        baseCrystalVal,
        floorIndex,
        this.eventBus
      );

      this.scene.add(cluster.mesh);
      this.physics.addBody(cluster.body);
      crystalClusters.push(cluster);
    }

    // 6. Seismic Station (Terminal for Upgrades)
    const stationPos = new THREE.Vector3(
      MathUtils.randomRange(half * 0.3, half * 0.7),
      0,
      MathUtils.randomRange(-half * 0.5, half * 0.5)
    );
    const stationGroup = this.buildSeismicStation(stationPos);
    this.scene.add(stationGroup);

    // 7. Exit Elevator / Lift
    const exitPos = new THREE.Vector3(
      MathUtils.randomRange(-half * 0.8, -half * 0.4),
      0,
      MathUtils.randomRange(-half * 0.8, -half * 0.4)
    );
    const exitGroup = this.buildExitLift(exitPos);
    this.scene.add(exitGroup);

    // 8. Spawn Stalkers
    enemyPool.clear();
    const enemyCount = 3 + floorIndex * 2;
    for (let i = 0; i < enemyCount; i++) {
      const ex = MathUtils.randomRange(-half + 8, half - 8);
      const ez = MathUtils.randomRange(-half + 8, half - 8);

      if (Math.abs(ex) < 10 && Math.abs(ez) < 10) continue;
      if (this.physics.checkWallCollision(ex, 0, ez, 1.0) || this.physics.isPositionInChasm(ex, ez)) continue;

      enemyPool.spawnEnemy(new THREE.Vector3(ex, 0, ez));
    }

    return {
      startPos: new THREE.Vector3(0, 0, 0),
      stationPos,
      exitPos,
      crystalClusters,
      wallMeshes,
      floorMeshes,
      stationMesh: stationGroup,
      exitMesh: exitGroup
    };
  }

  private buildSeismicStation(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    group.add(base);

    const consoleGeo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x334455 });
    const terminal = new THREE.Mesh(consoleGeo, consoleMat);
    terminal.position.set(0, 0.8, 0);
    group.add(terminal);

    const screenGeo = new THREE.PlaneGeometry(0.6, 0.4);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.0, 0.26);
    group.add(screen);

    const light = new THREE.PointLight(0x00ff88, 2.0, 10, 1.8);
    light.position.set(0, 1.2, 0.5);
    group.add(light);

    return group;
  }

  private buildExitLift(pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    const padGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.3, 16);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.15;
    group.add(pad);

    const ringGeo = new THREE.RingGeometry(1.2, 1.4, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.32;
    group.add(ring);

    const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 4.0, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 2.0;
    group.add(beam);

    const light = new THREE.PointLight(0x00f0ff, 2.5, 14, 1.5);
    light.position.set(0, 1.5, 0);
    group.add(light);

    return group;
  }
}
