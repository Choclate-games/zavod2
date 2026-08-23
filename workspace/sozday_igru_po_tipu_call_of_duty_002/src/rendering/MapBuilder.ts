import * as THREE from 'three';
import { physicsWorld } from '../physics/PhysicsWorld';

export class MapBuilder {
  private static containerMaterials: THREE.MeshStandardMaterial[] = [];

  private static initMaterials(): void {
    if (this.containerMaterials.length > 0) return;

    const colors = [
      0x8b1e1e, // Crimson Red
      0x1e3a8a, // Navy Blue
      0x2e4053, // Dark Slate
      0xb45309, // Rust Amber
      0x1f2937  // Charcoal Gray
    ];

    this.containerMaterials = colors.map((c) => 
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.65,
        metalness: 0.35
      })
    );
  }

  public static buildArena(scene: THREE.Scene): { spawnPoints: THREE.Vector3[] } {
    this.initMaterials();
    physicsWorld.clear();

    const arenaGroup = new THREE.Group();
    arenaGroup.name = 'arena_container_terminal';

    // 1. Wet asphalt floor
    const floorGeo = new THREE.PlaneGeometry(80, 80, 16, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0d1117,
      roughness: 0.25, // Wet gloss
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arenaGroup.add(floor);

    // Add perimeter boundary walls to physics
    physicsWorld.addBox(new THREE.Vector3(0, 3, -37), new THREE.Vector3(80, 6, 2), 'wall', false);
    physicsWorld.addBox(new THREE.Vector3(0, 3, 37), new THREE.Vector3(80, 6, 2), 'wall', false);
    physicsWorld.addBox(new THREE.Vector3(-37, 3, 0), new THREE.Vector3(2, 6, 80), 'wall', false);
    physicsWorld.addBox(new THREE.Vector3(37, 3, 0), new THREE.Vector3(2, 6, 80), 'wall', false);

    // Perimeter boundary visual fences
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.2 });
    const northFence = new THREE.Mesh(new THREE.BoxGeometry(76, 4, 0.5), fenceMat);
    northFence.position.set(0, 2, -36);
    arenaGroup.add(northFence);

    const southFence = new THREE.Mesh(new THREE.BoxGeometry(76, 4, 0.5), fenceMat);
    southFence.position.set(0, 2, 36);
    arenaGroup.add(southFence);

    const westFence = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 76), fenceMat);
    westFence.position.set(-36, 2, 0);
    arenaGroup.add(westFence);

    const eastFence = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 76), fenceMat);
    eastFence.position.set(36, 2, 0);
    arenaGroup.add(eastFence);

    // 2. Shipment Container Layout Configurations
    // Standard shipping container: width 2.44m, height 2.60m, length 6.05m
    const containerWidth = 2.44;
    const containerHeight = 2.60;
    const containerLength = 6.05;

    const containerDefs: Array<{ x: number; z: number; rotY: number; matIdx: number; stacked?: boolean }> = [
      // Central crossroads cluster
      { x: -5.5, z: -5.0, rotY: 0, matIdx: 0 },
      { x: -5.5, z: 5.0, rotY: 0, matIdx: 1 },
      { x: 5.5, z: -5.0, rotY: 0, matIdx: 2 },
      { x: 5.5, z: 5.0, rotY: 0, matIdx: 3 },

      // Center flanking angled containers
      { x: -14.0, z: 0.0, rotY: Math.PI / 2, matIdx: 4 },
      { x: 14.0, z: 0.0, rotY: Math.PI / 2, matIdx: 0 },
      { x: 0.0, z: -14.0, rotY: 0, matIdx: 1 },
      { x: 0.0, z: 14.0, rotY: 0, matIdx: 2 },

      // Perimeter outer ring corridors
      { x: -22.0, z: -16.0, rotY: 0, matIdx: 3, stacked: true },
      { x: -22.0, z: 16.0, rotY: 0, matIdx: 4 },
      { x: 22.0, z: -16.0, rotY: 0, matIdx: 0 },
      { x: 22.0, z: 16.0, rotY: 0, matIdx: 1, stacked: true },

      { x: -16.0, z: -25.0, rotY: Math.PI / 2, matIdx: 2 },
      { x: 16.0, z: -25.0, rotY: Math.PI / 2, matIdx: 3 },
      { x: -16.0, z: 25.0, rotY: Math.PI / 2, matIdx: 4, stacked: true },
      { x: 16.0, z: 25.0, rotY: Math.PI / 2, matIdx: 0 },

      // Corner cover stacks
      { x: -26.0, z: -26.0, rotY: 0.4, matIdx: 1 },
      { x: 26.0, z: -26.0, rotY: -0.4, matIdx: 2 },
      { x: -26.0, z: 26.0, rotY: -0.4, matIdx: 3 },
      { x: 26.0, z: 26.0, rotY: 0.4, matIdx: 4 }
    ];

    containerDefs.forEach((def, idx) => {
      const mat = this.containerMaterials[def.matIdx % this.containerMaterials.length];
      const isRotated = Math.abs(Math.sin(def.rotY)) > 0.5;
      const sizeX = isRotated ? containerLength : containerWidth;
      const sizeZ = isRotated ? containerWidth : containerLength;

      // Base container
      const containerMesh = this.buildContainerMesh(containerWidth, containerHeight, containerLength, mat);
      containerMesh.position.set(def.x, containerHeight / 2, def.z);
      containerMesh.rotation.y = def.rotY;
      containerMesh.castShadow = true;
      containerMesh.receiveShadow = true;
      arenaGroup.add(containerMesh);

      // Register with physics world
      physicsWorld.addBox(
        new THREE.Vector3(def.x, containerHeight / 2, def.z),
        new THREE.Vector3(sizeX, containerHeight, sizeZ),
        'container',
        true // Vaultable
      );

      // Stacked container on top
      if (def.stacked) {
        const topMat = this.containerMaterials[(def.matIdx + 1) % this.containerMaterials.length];
        const topMesh = this.buildContainerMesh(containerWidth, containerHeight, containerLength, topMat);
        topMesh.position.set(def.x, containerHeight * 1.5, def.z);
        topMesh.rotation.y = def.rotY;
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        arenaGroup.add(topMesh);

        physicsWorld.addBox(
          new THREE.Vector3(def.x, containerHeight * 1.5, def.z),
          new THREE.Vector3(sizeX, containerHeight, sizeZ),
          'container_top',
          false
        );
      }
    });

    // 3. Floodlight towers in 4 corners
    const towerCoords = [
      { x: -30, z: -30 },
      { x: 30, z: -30 },
      { x: -30, z: 30 },
      { x: 30, z: 30 }
    ];

    towerCoords.forEach((coord) => {
      const tower = this.buildFloodlightTower();
      tower.position.set(coord.x, 0, coord.z);
      arenaGroup.add(tower);

      // Pointlight for tactical night illumination
      const light = new THREE.PointLight(0xffecd2, 1.2, 35, 1.5);
      light.position.set(coord.x, 8.5, coord.z);
      light.castShadow = true;
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      arenaGroup.add(light);
    });

    scene.add(arenaGroup);

    // Spawn points distributed across the terminal
    const spawnPoints = [
      new THREE.Vector3(-24, 0, -8),
      new THREE.Vector3(24, 0, 8),
      new THREE.Vector3(-8, 0, 24),
      new THREE.Vector3(8, 0, -24),
      new THREE.Vector3(-18, 0, -18),
      new THREE.Vector3(18, 0, 18),
      new THREE.Vector3(-18, 0, 18),
      new THREE.Vector3(18, 0, -18),
      new THREE.Vector3(0, 0, 0)
    ];

    return { spawnPoints };
  }

  private static buildContainerMesh(w: number, h: number, l: number, mat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    group.add(mainBox);

    // Corrugation ridges / detail ribs
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.3 });
    const ribCount = 6;
    for (let i = 0; i < ribCount; i++) {
      const offsetZ = -l / 2 + (l / (ribCount + 1)) * (i + 1);
      const ribLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.9, 0.08), ribMat);
      ribLeft.position.set(-w / 2 - 0.02, 0, offsetZ);
      group.add(ribLeft);

      const ribRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.9, 0.08), ribMat);
      ribRight.position.set(w / 2 + 0.02, 0, offsetZ);
      group.add(ribRight);
    }

    return group;
  }

  private static buildFloodlightTower(): THREE.Group {
    const tower = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.4 });

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 9, 6), frameMat);
    mast.position.set(0, 4.5, 0);
    tower.add(mast);

    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 1.4), frameMat);
    platform.position.set(0, 9, 0);
    tower.add(platform);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), lampMat);
    lamp.position.set(0, 9.4, 0);
    tower.add(lamp);

    return tower;
  }
}