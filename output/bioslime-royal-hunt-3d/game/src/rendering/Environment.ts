import * as THREE from 'three';
import { GameConfig } from '../config/GameConfig';

export class Environment {
  private scene: THREE.Scene;
  private groundMesh!: THREE.Mesh;
  private wallGroup: THREE.Group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildGround();
    this.buildCastleWalls();
    this.buildDecorativeTowers();
  }

  private buildGround(): void {
    const size = GameConfig.ARENA_SIZE;
    const geometry = new THREE.PlaneGeometry(size, size, 32, 32);

    // Create procedural canvas texture for cobblestone castle courtyard
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base stone color
    ctx.fillStyle = '#232a35';
    ctx.fillRect(0, 0, 512, 512);

    // Cobblestone grid
    ctx.strokeStyle = '#181e28';
    ctx.lineWidth = 3;
    const step = 32;
    for (let x = 0; x < 512; x += step) {
      for (let y = 0; y < 512; y += step) {
        const stoneColor = (Math.random() > 0.4) ? '#2d3748' : ((Math.random() > 0.5) ? '#1f2937' : '#273343');
        ctx.fillStyle = stoneColor;
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
      }
    }

    // Mossy green patches
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const r = 20 + Math.random() * 40;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(16, 16);

    const material = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.1
    });

    this.groundMesh = new THREE.Mesh(geometry, material);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private buildCastleWalls(): void {
    const halfSize = GameConfig.ARENA_SIZE / 2;
    const wallHeight = 4.5;
    const wallThickness = 2.0;

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.15
    });

    const wallGeomX = new THREE.BoxGeometry(GameConfig.ARENA_SIZE, wallHeight, wallThickness);
    const wallGeomZ = new THREE.BoxGeometry(wallThickness, wallHeight, GameConfig.ARENA_SIZE);

    // North
    const wallN = new THREE.Mesh(wallGeomX, wallMaterial);
    wallN.position.set(0, wallHeight / 2, -halfSize);
    wallN.castShadow = true;
    wallN.receiveShadow = true;
    this.wallGroup.add(wallN);

    // South
    const wallS = new THREE.Mesh(wallGeomX, wallMaterial);
    wallS.position.set(0, wallHeight / 2, halfSize);
    wallS.castShadow = true;
    wallS.receiveShadow = true;
    this.wallGroup.add(wallS);

    // West
    const wallW = new THREE.Mesh(wallGeomZ, wallMaterial);
    wallW.position.set(-halfSize, wallHeight / 2, 0);
    wallW.castShadow = true;
    wallW.receiveShadow = true;
    this.wallGroup.add(wallW);

    // East
    const wallE = new THREE.Mesh(wallGeomZ, wallMaterial);
    wallE.position.set(halfSize, wallHeight / 2, 0);
    wallE.castShadow = true;
    wallE.receiveShadow = true;
    this.wallGroup.add(wallE);

    this.scene.add(this.wallGroup);
  }

  private buildDecorativeTowers(): void {
    const halfSize = GameConfig.ARENA_SIZE / 2;
    const towerGeom = new THREE.CylinderGeometry(3.5, 4.0, 9.0, 10);
    const roofGeom = new THREE.ConeGeometry(4.2, 5.0, 10);

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c, // Crimson royal roofs
      roughness: 0.7
    });

    const corners = [
      [-halfSize, -halfSize],
      [halfSize, -halfSize],
      [-halfSize, halfSize],
      [halfSize, halfSize]
    ];

    corners.forEach(([x, z]) => {
      const tower = new THREE.Mesh(towerGeom, towerMat);
      tower.position.set(x, 4.5, z);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);

      const roof = new THREE.Mesh(roofGeom, roofMat);
      roof.position.set(x, 11.5, z);
      roof.castShadow = true;
      this.scene.add(roof);
    });
  }
}
