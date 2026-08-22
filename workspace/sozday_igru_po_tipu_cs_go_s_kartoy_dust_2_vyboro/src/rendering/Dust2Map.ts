import * as THREE from 'three';
import { physics, MapCollider } from '../physics/PhysicsWorld';

export interface PlantSiteZone {
  site: 'A' | 'B';
  center: THREE.Vector3;
  radius: number;
}

export class Dust2Map {
  private static instance: Dust2Map;
  public group: THREE.Group;
  public plantSites: PlantSiteZone[] = [
    { site: 'A', center: new THREE.Vector3(18, 0.5, -12), radius: 5.5 },
    { site: 'B', center: new THREE.Vector3(-22, 0.5, -8), radius: 5.5 },
  ];

  // Procedural Materials
  private sandMat!: THREE.MeshLambertMaterial;
  private wallMat!: THREE.MeshLambertMaterial;
  private trimMat!: THREE.MeshLambertMaterial;
  private woodCrateMat!: THREE.MeshLambertMaterial;
  private doorMat!: THREE.MeshLambertMaterial;
  private platformMat!: THREE.MeshLambertMaterial;

  private constructor() {
    this.group = new THREE.Group();
    this.initMaterials();
  }

  public static getInstance(): Dust2Map {
    if (!Dust2Map.instance) {
      Dust2Map.instance = new Dust2Map();
    }
    return Dust2Map.instance;
  }

  private initMaterials(): void {
    // Warm Sandstone Palette
    this.sandMat = new THREE.MeshLambertMaterial({ color: 0xD2B48C }); // Sand floor
    this.wallMat = new THREE.MeshLambertMaterial({ color: 0xC29B6B }); // Sandstone walls
    this.trimMat = new THREE.MeshLambertMaterial({ color: 0x8C6B48 }); // Dark stone trim
    this.woodCrateMat = new THREE.MeshLambertMaterial({ color: 0xA0522D }); // Wooden crate
    this.doorMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Wooden/metal doors
    this.platformMat = new THREE.MeshLambertMaterial({ color: 0xB8976C });
  }

  public build(scene: THREE.Scene): void {
    physics.clear();
    this.group.clear();

    // 1. Ground Plane (120m x 120m)
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMesh = new THREE.Mesh(groundGeo, this.sandMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);

    // Ground collider
    physics.addCollider({
      box: new THREE.Box3(new THREE.Vector3(-60, -1, -60), new THREE.Vector3(60, 0, 60)),
      isWall: false,
      isPenetrable: false,
      material: 'concrete',
      thicknessMeters: 10,
    });

    // 2. Build Perimeter Walls
    this.createWall(new THREE.Vector3(0, 3, -35), new THREE.Vector3(80, 6, 2), 'concrete', false); // North Wall
    this.createWall(new THREE.Vector3(0, 3, 35), new THREE.Vector3(80, 6, 2), 'concrete', false);  // South Wall
    this.createWall(new THREE.Vector3(-40, 3, 0), new THREE.Vector3(2, 6, 72), 'concrete', false); // West Wall
    this.createWall(new THREE.Vector3(40, 3, 0), new THREE.Vector3(2, 6, 72), 'concrete', false);  // East Wall

    // 3. PLANT A SITE GEOMETRY
    // Platform A
    this.createPlatform(new THREE.Vector3(18, 0.3, -12), new THREE.Vector3(12, 0.6, 12));

    // Goose Corner Wall (Protective L-shape)
    this.createWall(new THREE.Vector3(24, 2.5, -17), new THREE.Vector3(2, 5, 8), 'concrete', false);
    this.createWall(new THREE.Vector3(20, 2.5, -21), new THREE.Vector3(10, 5, 2), 'concrete', false);

    // Site A Triple Crates (Stacked wooden penetrable boxes)
    this.createCrate(new THREE.Vector3(16, 0.9, -10), new THREE.Vector3(1.6, 1.6, 1.6), true);
    this.createCrate(new THREE.Vector3(17.8, 0.9, -10), new THREE.Vector3(1.6, 1.6, 1.6), true);
    this.createCrate(new THREE.Vector3(16.9, 2.5, -10), new THREE.Vector3(1.6, 1.6, 1.6), true);

    // Long A Corridor & Doors
    this.createWall(new THREE.Vector3(30, 2.5, -5), new THREE.Vector3(2, 5, 24), 'concrete', false);
    this.createWall(new THREE.Vector3(22, 2.5, 6), new THREE.Vector3(2, 5, 18), 'concrete', false);
    // Penetrable Wooden Long Doors
    this.createDoor(new THREE.Vector3(26, 2.0, 15), new THREE.Vector3(6, 4, 0.3), true, 'wood');

    // Catwalk / Short A Stairs & Ramp
    this.createPlatform(new THREE.Vector3(8, 0.6, -14), new THREE.Vector3(8, 1.2, 4));
    this.createWall(new THREE.Vector3(8, 2.5, -16.5), new THREE.Vector3(8, 5, 1), 'concrete', false);

    // 4. PLANT B SITE GEOMETRY
    // Platform B
    this.createPlatform(new THREE.Vector3(-22, 0.3, -8), new THREE.Vector3(14, 0.6, 14));

    // B Back Plat Wall
    this.createWall(new THREE.Vector3(-29, 2.5, -8), new THREE.Vector3(2, 5, 16), 'concrete', false);
    this.createWall(new THREE.Vector3(-22, 2.5, -16), new THREE.Vector3(16, 5, 2), 'concrete', false);

    // B Crates Stack
    this.createCrate(new THREE.Vector3(-20, 0.9, -6), new THREE.Vector3(1.8, 1.8, 1.8), true);
    this.createCrate(new THREE.Vector3(-20, 2.7, -6), new THREE.Vector3(1.8, 1.8, 1.8), true);
    this.createCrate(new THREE.Vector3(-24, 0.9, -10), new THREE.Vector3(1.5, 1.5, 1.5), true);

    // B Doors (Prostreled double doors)
    this.createDoor(new THREE.Vector3(-14, 2.0, -8), new THREE.Vector3(0.3, 4, 5.0), true, 'wood');
    // B Window
    this.createWall(new THREE.Vector3(-22, 1.2, 0), new THREE.Vector3(6, 2.4, 2), 'concrete', false);
    this.createWall(new THREE.Vector3(-22, 4.2, 0), new THREE.Vector3(6, 1.6, 2), 'concrete', false);

    // 5. MID & CONNECTORS
    // Mid Corridor Walls
    this.createWall(new THREE.Vector3(-5, 2.5, 5), new THREE.Vector3(2, 5, 20), 'concrete', false);
    this.createWall(new THREE.Vector3(5, 2.5, 5), new THREE.Vector3(2, 5, 20), 'concrete', false);
    // Mid Doors (Metal penetrable)
    this.createDoor(new THREE.Vector3(0, 2.0, 15), new THREE.Vector3(8, 4, 0.2), true, 'metal');

    // CT Spawn divider
    this.createWall(new THREE.Vector3(0, 2.0, -22), new THREE.Vector3(22, 4, 2), 'concrete', false);

    // Decorative archways
    this.createArch(new THREE.Vector3(26, 3.5, -1));
    this.createArch(new THREE.Vector3(-14, 3.5, -8));

    scene.add(this.group);
  }

  private createWall(pos: THREE.Vector3, size: THREE.Vector3, material: 'concrete' | 'wood' | 'metal' = 'concrete', penetrable = false): void {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, this.wallMat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    physics.addCollider({
      box: new THREE.Box3().setFromCenterAndSize(pos, size),
      mesh,
      isWall: true,
      isPenetrable: penetrable,
      material,
      thicknessMeters: Math.min(size.x, size.z),
    });
  }

  private createPlatform(pos: THREE.Vector3, size: THREE.Vector3): void {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, this.platformMat);
    mesh.position.copy(pos);
    mesh.receiveShadow = true;
    this.group.add(mesh);

    physics.addCollider({
      box: new THREE.Box3().setFromCenterAndSize(pos, size),
      mesh,
      isWall: false,
      isPenetrable: false,
      material: 'concrete',
      thicknessMeters: size.y,
    });
  }

  private createCrate(pos: THREE.Vector3, size: THREE.Vector3, penetrable = true): void {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, this.woodCrateMat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    physics.addCollider({
      box: new THREE.Box3().setFromCenterAndSize(pos, size),
      mesh,
      isWall: true,
      isPenetrable: penetrable,
      material: 'wood',
      thicknessMeters: Math.min(size.x, size.z),
    });
  }

  private createDoor(pos: THREE.Vector3, size: THREE.Vector3, penetrable = true, material: 'wood' | 'metal' = 'wood'): void {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, this.doorMat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    physics.addCollider({
      box: new THREE.Box3().setFromCenterAndSize(pos, size),
      mesh,
      isWall: true,
      isPenetrable: penetrable,
      material,
      thicknessMeters: Math.min(size.x, size.z),
    });
  }

  private createArch(pos: THREE.Vector3): void {
    const archGeo = new THREE.BoxGeometry(3, 0.8, 1);
    const archMesh = new THREE.Mesh(archGeo, this.trimMat);
    archMesh.position.copy(pos);
    archMesh.castShadow = true;
    this.group.add(archMesh);
  }
}

export const dust2Map = Dust2Map.getInstance();
