import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export type BuildingType = 'extractor' | 'conveyor' | 'turret';

interface PlacedBuilding {
  type: BuildingType;
  group: THREE.Group;
  gx: number;
  gz: number;
}

interface ResourceItem {
  mesh: THREE.Mesh;
  gx: number;
  gz: number;
  progress: number;
}

export class GridBuildingMode {
  public group = new THREE.Group();

  // Grid settings
  public gridSize = 16;
  public cellSize = 2.0;
  public selectedBuildingType: BuildingType = 'extractor';
  public ghostMesh: THREE.Group;
  public ghostPos = { gx: 0, gz: 0 };

  // Buildings and conveyors
  public buildings: PlacedBuilding[] = [];
  public items: ResourceItem[] = [];
  private itemGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  private itemMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8 });
  private spawnItemTimer = 0;

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildGridFloor();
    this.buildGhost();
  }

  private buildGridFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize * this.cellSize, this.gridSize * this.cellSize),
      new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    const gridHelper = new THREE.GridHelper(
      this.gridSize * this.cellSize,
      this.gridSize,
      0x00cec9,
      0x34495e
    );
    gridHelper.position.y = 0.01;
    this.group.add(gridHelper);
  }

  private buildGhost(): void {
    this.ghostMesh = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x00cec9,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
    });

    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), ghostMat);
    box.position.y = 0.7;
    this.ghostMesh.add(box);
    this.group.add(this.ghostMesh);
  }

  public placeBuilding(gx: number, gz: number): void {
    // Check if cell occupied
    const exists = this.buildings.find((b) => b.gx === gx && b.gz === gz);
    if (exists) return;

    const bGroup = new THREE.Group();
    const worldX = (gx - this.gridSize / 2 + 0.5) * this.cellSize;
    const worldZ = (gz - this.gridSize / 2 + 0.5) * this.cellSize;
    bGroup.position.set(worldX, 0, worldZ);

    if (this.selectedBuildingType === 'extractor') {
      // Extractor Drill Structure
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.8, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.5 })
      );
      base.position.y = 0.2;
      const drill = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.9 })
      );
      drill.position.y = 0.9;
      bGroup.add(base, drill);
    } else if (this.selectedBuildingType === 'conveyor') {
      // Conveyor Belt
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.2, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.7 })
      );
      belt.position.y = 0.1;
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.8, 3),
        new THREE.MeshStandardMaterial({ color: 0x00cec9 })
      );
      arrow.rotation.x = Math.PI / 2;
      arrow.position.set(0, 0.25, 0);
      bGroup.add(belt, arrow);
    } else if (this.selectedBuildingType === 'turret') {
      // Defense Turret
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.7, 0.6, 12),
        new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8 })
      );
      base.position.y = 0.3;
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xe74c3c })
      );
      gun.position.set(0, 0.8, 0.2);
      bGroup.add(base, gun);
    }

    this.group.add(bGroup);
    this.buildings.push({
      type: this.selectedBuildingType,
      group: bGroup,
      gx,
      gz,
    });

    this.audio.playButtonClick();
  }

  public updateGhost(worldRayHit: THREE.Vector3): void {
    const half = this.gridSize / 2;
    const gx = Math.floor(worldRayHit.x / this.cellSize + half);
    const gz = Math.floor(worldRayHit.z / this.cellSize + half);

    if (gx >= 0 && gx < this.gridSize && gz >= 0 && gz < this.gridSize) {
      this.ghostPos.gx = gx;
      this.ghostPos.gz = gz;
      const wx = (gx - half + 0.5) * this.cellSize;
      const wz = (gz - half + 0.5) * this.cellSize;
      this.ghostMesh.position.set(wx, 0, wz);
      this.ghostMesh.visible = true;
    } else {
      this.ghostMesh.visible = false;
    }
  }

  public update(dt: number): void {
    if (!this.group.visible) return;

    // 1. Spawning resources from extractors
    this.spawnItemTimer += dt;
    if (this.spawnItemTimer >= 1.5) {
      this.spawnItemTimer = 0;
      const extractors = this.buildings.filter((b) => b.type === 'extractor');
      extractors.forEach((ext) => {
        const itemMesh = new THREE.Mesh(this.itemGeom, this.itemMat);
        const wx = (ext.gx - this.gridSize / 2 + 0.5) * this.cellSize;
        const wz = (ext.gz - this.gridSize / 2 + 0.5) * this.cellSize;
        itemMesh.position.set(wx, 0.5, wz);
        this.group.add(itemMesh);

        this.items.push({
          mesh: itemMesh,
          gx: ext.gx,
          gz: ext.gz,
          progress: 0,
        });
      });
    }

    // 2. Move items on conveyors
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.progress += dt * 1.4;

      const wx = (item.gx - this.gridSize / 2 + 0.5) * this.cellSize;
      const wz = (item.gz - this.gridSize / 2 + 0.5) * this.cellSize;
      item.mesh.position.set(wx, 0.4 + Math.sin(item.progress * 6) * 0.05, wz - item.progress * this.cellSize);

      if (item.progress >= 1.0) {
        // Move to next cell
        item.gz--;
        item.progress = 0;
        const onBelt = this.buildings.some((b) => b.gx === item.gx && b.gz === item.gz && b.type === 'conveyor');
        if (!onBelt) {
          // Delivered / collected
          this.audio.playCoinPickup();
          this.group.remove(item.mesh);
          this.items.splice(i, 1);
        }
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
