import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { EntityManager } from '../entities/EntityManager';
import { EnemyType } from '../types';

export interface RoomData {
  center: THREE.Vector3;
  width: number;
  depth: number;
  doors: THREE.Vector3[];
}

export class LevelGenerator {
  private static instance: LevelGenerator;
  private roomMeshes: THREE.Object3D[] = [];

  public static getInstance(): LevelGenerator {
    if (!LevelGenerator.instance) {
      LevelGenerator.instance = new LevelGenerator();
    }
    return LevelGenerator.instance;
  }

  public clearLevel(scene: THREE.Scene): void {
    for (const mesh of this.roomMeshes) {
      scene.remove(mesh);
    }
    this.roomMeshes = [];
    PhysicsWorld.getInstance().clear();
  }

  public generateSector(stageIndex: number, roomIndex: number, scene: THREE.Scene): { spawnPos: THREE.Vector3 } {
    this.clearLevel(scene);
    EntityManager.getInstance().clearLevelEntities();

    const isBossRoom = stageIndex === 5 && roomIndex === 4;
    const roomWidth = isBossRoom ? 32 : 24;
    const roomDepth = isBossRoom ? 32 : 28;
    const wallHeight = 5.0;

    // 1. Floor & Ceiling
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x242831,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    this.roomMeshes.push(floorMesh);

    // 2. Outer Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e222b,
      roughness: 0.7,
      metalness: 0.3,
    });

    const hw = roomWidth * 0.5;
    const hd = roomDepth * 0.5;

    // North Wall (with door opening)
    this.createWallSegment(scene, new THREE.Vector3(0, wallHeight * 0.5, -hd), roomWidth, wallHeight, 0.8, wallMat, 'wall_n');
    // South Wall
    this.createWallSegment(scene, new THREE.Vector3(0, wallHeight * 0.5, hd), roomWidth, wallHeight, 0.8, wallMat, 'wall_s');
    // West Wall
    this.createWallSegment(scene, new THREE.Vector3(-hw, wallHeight * 0.5, 0), 0.8, wallHeight, roomDepth, wallMat, 'wall_w');
    // East Wall
    this.createWallSegment(scene, new THREE.Vector3(hw, wallHeight * 0.5, 0), 0.8, wallHeight, roomDepth, wallMat, 'wall_e');

    // 3. Interior Partitions and Tactical Breachable Doors
    if (!isBossRoom) {
      // Partition wall dividing room in two sections
      const partMat = new THREE.MeshStandardMaterial({ color: 0x2c313c, roughness: 0.8 });
      this.createWallSegment(scene, new THREE.Vector3(-6, wallHeight * 0.5, 0), 10, wallHeight, 0.6, partMat, 'part_1');
      this.createWallSegment(scene, new THREE.Vector3(6, wallHeight * 0.5, 0), 10, wallHeight, 0.6, partMat, 'part_2');

      // Breachable Door in center partition gap
      EntityManager.getInstance().spawnDoor(new THREE.Vector3(0, 0, 0), 0);

      // Exit Door at North Wall
      EntityManager.getInstance().spawnDoor(new THREE.Vector3(0, 0, -hd + 0.4), 0);
    } else {
      // Boss arena exit door
      EntityManager.getInstance().spawnDoor(new THREE.Vector3(0, 0, -hd + 0.4), 0);
    }

    // 4. Decorative Pillars / Obstacles
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4c9f70, roughness: 0.4, metalness: 0.6 });
    const pillarPositions = [
      new THREE.Vector3(-6, 0, -6),
      new THREE.Vector3(6, 0, -6),
      new THREE.Vector3(-6, 0, 6),
      new THREE.Vector3(6, 0, 6),
    ];
    for (let i = 0; i < pillarPositions.length; i++) {
      const pos = pillarPositions[i];
      const pMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, wallHeight, 1.2), pillarMat);
      pMesh.position.set(pos.x, wallHeight * 0.5, pos.z);
      pMesh.castShadow = true;
      scene.add(pMesh);
      this.roomMeshes.push(pMesh);

      PhysicsWorld.getInstance().addStaticBox(
        `pillar_${i}`,
        new THREE.Vector3(pos.x - 0.6, 0, pos.z - 0.6),
        new THREE.Vector3(pos.x + 0.6, wallHeight, pos.z + 0.6),
        'OBSTACLE'
      );
    }

    // 5. Spawn Explosive Barrels
    EntityManager.getInstance().spawnBarrel(new THREE.Vector3(-3.5, 0, -3));
    EntityManager.getInstance().spawnBarrel(new THREE.Vector3(3.5, 0, -3));
    if (isBossRoom) {
      EntityManager.getInstance().spawnBarrel(new THREE.Vector3(-8, 0, -8));
      EntityManager.getInstance().spawnBarrel(new THREE.Vector3(8, 0, -8));
    }

    // 6. Spawn Weapon Drops on floor
    if (roomIndex === 0) {
      EntityManager.getInstance().spawnWeaponDrop('SHOTGUN', new THREE.Vector3(-2, 0.5, 2));
    }

    // 7. Spawn Enemies based on threat budget
    this.spawnRoomEnemies(stageIndex, roomIndex, isBossRoom);

    // Player spawn at south end
    return { spawnPos: new THREE.Vector3(0, 1.7, hd - 4) };
  }

  private createWallSegment(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    id: string
  ): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    this.roomMeshes.push(mesh);

    PhysicsWorld.getInstance().addStaticBox(
      id,
      new THREE.Vector3(pos.x - w * 0.5, 0, pos.z - d * 0.5),
      new THREE.Vector3(pos.x + w * 0.5, h, pos.z + d * 0.5),
      'WALL'
    );
  }

  private spawnRoomEnemies(stageIndex: number, roomIndex: number, isBossRoom: boolean): void {
    const em = EntityManager.getInstance();

    if (isBossRoom) {
      // Spawn Boss Mech
      em.spawnEnemy('BOSS_MECH', new THREE.Vector3(0, 0, -8));
      em.spawnEnemy('GUNNER', new THREE.Vector3(-6, 0, -6));
      em.spawnEnemy('GUNNER', new THREE.Vector3(6, 0, -6));
      return;
    }

    // Formula: room_threat_budget = 100 + (run_stage_index * 45) + (roomIndex * 20)
    const enemyCount = 3 + stageIndex + roomIndex;

    const enemyTypes: EnemyType[] = ['GRUNT', 'GRUNT', 'SHIELDER', 'GUNNER', 'KAMIKAZE'];

    for (let i = 0; i < enemyCount; i++) {
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      const posX = (Math.random() - 0.5) * 16;
      const posZ = -4 - Math.random() * 8; // Placed behind partition/door
      em.spawnEnemy(type, new THREE.Vector3(posX, 0, posZ));
    }
  }
}
