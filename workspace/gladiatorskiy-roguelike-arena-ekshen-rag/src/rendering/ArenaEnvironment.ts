import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class ArenaEnvironment {
  public group: THREE.Group;
  private brazierLights: THREE.PointLight[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.buildColosseumArena();
  }

  private buildColosseumArena(): void {
    const arenaRadius = PhysicsWorld.ARENA_RADIUS;

    // 1. Sand Floor with procedural circular canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#c2a677';
    ctx.fillRect(0, 0, 512, 512);

    // Sand grain noise & Roman arena blood circles
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const d = Math.hypot(x - 256, y - 256);
      if (d < 240) {
        ctx.fillStyle = Math.random() > 0.5 ? '#b59764' : '#d4b785';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // Arena circular dividing rings
    ctx.strokeStyle = 'rgba(120, 90, 60, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 256, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.stroke();

    const sandTexture = new THREE.CanvasTexture(canvas);
    const floorGeo = new THREE.CircleGeometry(arenaRadius + 1.0, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      map: sandTexture,
      roughness: 0.9,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI * 0.5;
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // 2. Colosseum Wall & Arches (Outer stone ring)
    const wallHeight = 4.5;
    const wallGeo = new THREE.CylinderGeometry(arenaRadius + 0.5, arenaRadius + 0.5, wallHeight, 48, 1, true);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x5a4838,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.BackSide,
    });
    const wallMesh = new THREE.Mesh(wallGeo, stoneMat);
    wallMesh.position.y = wallHeight * 0.5;
    wallMesh.receiveShadow = true;
    this.group.add(wallMesh);

    // Roman Spectator Stands (Tiers behind wall)
    const standGeo = new THREE.CylinderGeometry(arenaRadius + 8.0, arenaRadius + 1.0, 7.0, 48, 3, true);
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x3d3025,
      roughness: 0.9,
      side: THREE.BackSide,
    });
    const standMesh = new THREE.Mesh(standGeo, standMat);
    standMesh.position.y = 3.5;
    this.group.add(standMesh);

    // 3. Four Roman Marble Pillars
    const pillarDist = 8.5;
    const pillarPositions = [
      [pillarDist, pillarDist],
      [-pillarDist, pillarDist],
      [pillarDist, -pillarDist],
      [-pillarDist, -pillarDist],
    ];

    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.4, 6.0, 16);
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xe0dad1,
      roughness: 0.3,
      metalness: 0.1,
    });

    pillarPositions.forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(pillarGeo, marbleMat);
      pillar.position.set(px, 3.0, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.group.add(pillar);

      // Pillar Capital (Top ornament)
      const capGeo = new THREE.BoxGeometry(3.2, 0.6, 3.2);
      const cap = new THREE.Mesh(capGeo, marbleMat);
      cap.position.y = 3.0;
      pillar.add(cap);
    });

    // 4. Flaming Braziers (at 4 cardinals near wall)
    const brazierDist = 14.5;
    const brazierPositions = [
      [brazierDist, 0],
      [-brazierDist, 0],
      [0, brazierDist],
      [0, -brazierDist],
    ];

    const brazierGeo = new THREE.CylinderGeometry(0.8, 0.4, 1.5, 12);
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x4a3622, roughness: 0.6, metalness: 0.7 });

    brazierPositions.forEach(([bx, bz]) => {
      const brazier = new THREE.Mesh(brazierGeo, bronzeMat);
      brazier.position.set(bx, 0.75, bz);
      brazier.castShadow = true;
      this.group.add(brazier);

      // Point Light with flickering warm flame
      const light = new THREE.PointLight(0xff6600, 1.5, 16, 1.5);
      light.position.set(bx, 2.0, bz);
      this.group.add(light);
      this.brazierLights.push(light);
    });

    // 5. Spiked Wall Traps
    const spikeGeo = new THREE.ConeGeometry(0.2, 1.2, 6);
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });

    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const sx = Math.cos(angle) * (arenaRadius - 0.2);
      const sz = Math.sin(angle) * (arenaRadius - 0.2);

      const spike = new THREE.Mesh(spikeGeo, ironMat);
      spike.position.set(sx, 0.6, sz);
      spike.rotation.x = Math.PI * 0.5;
      spike.lookAt(0, 0.6, 0);
      spike.castShadow = true;
      this.group.add(spike);
    }
  }

  public update(_dt: number): void {
    // Flickering torch & brazier lights
    const time = performance.now() * 0.005;
    this.brazierLights.forEach((light, i) => {
      light.intensity = 1.4 + Math.sin(time * 3 + i * 1.5) * 0.35 + (Math.random() - 0.5) * 0.15;
    });
  }
}
