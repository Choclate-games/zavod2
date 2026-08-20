import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

interface FloatingObject {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  baseY: number;
  mass: number;
}

interface DestructiblePillar {
  group: THREE.Group;
  pieces: THREE.Mesh[];
  isShattered: boolean;
  hp: number;
}

interface MiningVoxel {
  mesh: THREE.Mesh;
  type: 'stone' | 'ore' | 'crystal';
  destroyed: boolean;
  gridPos: THREE.Vector3;
}

export class FluidDestructionMode {
  public group = new THREE.Group();

  // Water Mesh
  private waterPlane: THREE.Mesh;
  private waterGeom: THREE.PlaneGeometry;
  private waterTime = 0;
  public floatingObjects: FloatingObject[] = [];

  // Destructible Pillars
  public pillars: DestructiblePillar[] = [];
  public debrisPool: { mesh: THREE.Mesh; vel: THREE.Vector3; rot: THREE.Vector3; life: number }[] = [];

  // Voxel Mining Grid
  public voxels: MiningVoxel[] = [];
  public crystals: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildWater();
    this.buildFloatingObjects();
    this.buildDestructiblePillars();
    this.buildMiningGrid();
  }

  private buildWater(): void {
    this.waterGeom = new THREE.PlaneGeometry(35, 20, 48, 32);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0984e3,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });

    this.waterPlane = new THREE.Mesh(this.waterGeom, waterMat);
    this.waterPlane.rotation.x = -Math.PI / 2;
    this.waterPlane.position.set(-8, 0, 0);
    this.group.add(this.waterPlane);
  }

  private buildFloatingObjects(): void {
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.4, metalness: 0.3 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.8 });

    // Floating Barrel
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 14), barrelMat);
      b.position.set(-12 + i * 4, 0.2, -4 + (i % 2) * 6);
      b.castShadow = true;
      this.group.add(b);

      this.floatingObjects.push({
        mesh: b,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 0),
        baseY: 0,
        mass: 1.0,
      });
    }

    // Floating Wooden Crate
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crateMat);
    crate.position.set(-8, 0.2, 2);
    crate.castShadow = true;
    this.group.add(crate);
    this.floatingObjects.push({
      mesh: crate,
      velocity: new THREE.Vector3(),
      rotVelocity: new THREE.Vector3(),
      baseY: 0,
      mass: 1.5,
    });
  }

  private buildDestructiblePillars(): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.7 });

    for (let p = 0; p < 2; p++) {
      const pGroup = new THREE.Group();
      const pieces: THREE.Mesh[] = [];

      // Stack 4 fracture blocks vertically
      for (let y = 0; y < 4; y++) {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), pillarMat);
        piece.position.set(0, 0.4 + y * 0.8, 0);
        piece.castShadow = true;
        pGroup.add(piece);
        pieces.push(piece);
      }

      pGroup.position.set(5 + p * 4.5, 0, -5);
      this.group.add(pGroup);

      this.pillars.push({
        group: pGroup,
        pieces,
        isShattered: false,
        hp: 3,
      });
    }
  }

  private buildMiningGrid(): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.9 });
    const oreMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.8, roughness: 0.3 });
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, emissive: 0x9b59b6, emissiveIntensity: 0.4 });

    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const isCrystal = (x + y + z) % 5 === 0;
          const isOre = (x + y) % 3 === 0;
          const type = isCrystal ? 'crystal' : isOre ? 'ore' : 'stone';
          const mat = isCrystal ? crystalMat : isOre ? oreMat : stoneMat;

          const block = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat);
          const pos = new THREE.Vector3(5 + x * 0.95, 0.45 + y * 0.95, 3 + z * 0.95);
          block.position.copy(pos);
          block.castShadow = true;
          this.group.add(block);

          this.voxels.push({
            mesh: block,
            type,
            destroyed: false,
            gridPos: pos,
          });
        }
      }
    }
  }

  public getWaveHeightAt(x: number, z: number, t: number): number {
    return (
      Math.sin(x * 0.35 + t * 2.2) * 0.35 +
      Math.cos(z * 0.45 + t * 1.8) * 0.25
    );
  }

  public smashPillar(): void {
    const pillar = this.pillars.find((p) => !p.isShattered);
    if (!pillar) return;

    pillar.hp--;
    if (pillar.hp <= 0) {
      pillar.isShattered = true;
      this.audio.playExplosion(0.8);
      this.onCameraShake(0.5);

      pillar.pieces.forEach((pc) => {
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 8.0,
          3.0 + Math.random() * 6.0,
          (Math.random() - 0.5) * 8.0
        );
        const rot = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        this.debrisPool.push({ mesh: pc, vel, rot, life: 3.5 });
      });

      // Respawn pillar after 4s
      setTimeout(() => {
        pillar.isShattered = false;
        pillar.hp = 3;
        pillar.pieces.forEach((pc, idx) => {
          pc.position.set(0, 0.4 + idx * 0.8, 0);
          pc.rotation.set(0, 0, 0);
        });
      }, 4000);
    } else {
      this.audio.playSpartanKick();
      this.onCameraShake(0.2);
    }
  }

  public drillVoxel(): void {
    const active = this.voxels.filter((v) => !v.destroyed);
    if (active.length === 0) {
      // Reset all
      this.voxels.forEach((v) => {
        v.destroyed = false;
        v.mesh.visible = true;
      });
      return;
    }

    const target = active[Math.floor(Math.random() * active.length)];
    target.destroyed = true;
    target.mesh.visible = false;

    this.audio.playSwordSlash();
    this.onCameraShake(0.15);

    if (target.type === 'crystal' || target.type === 'ore') {
      this.audio.playCoinPickup();

      // Spawn loot crystal drop
      const cMat = new THREE.MeshStandardMaterial({ color: target.type === 'crystal' ? 0x9b59b6 : 0xf1c40f });
      const cMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), cMat);
      cMesh.position.copy(target.gridPos);
      this.group.add(cMesh);

      this.crystals.push({
        mesh: cMesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, 5.0, (Math.random() - 0.5) * 4),
      });
    }
  }

  public update(dt: number): void {
    if (!this.group.visible) return;
    this.waterTime += dt;

    // 1. Dynamic Water Surface Vertex Displacement
    const posAttr = this.waterGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getX(i);
      const v = posAttr.getY(i);
      const h = this.getWaveHeightAt(u - 8, v, this.waterTime);
      posAttr.setZ(i, h);
    }
    posAttr.needsUpdate = true;
    this.waterGeom.computeVertexNormals();

    // 2. Archimedes Buoyancy on Floating Objects
    this.floatingObjects.forEach((obj) => {
      const waveH = this.getWaveHeightAt(obj.mesh.position.x, obj.mesh.position.z, this.waterTime);
      const depth = waveH - obj.mesh.position.y;

      if (depth > 0) {
        // Submerged: buoyancy force upwards
        const buoyancy = depth * 28.0;
        obj.velocity.y += (buoyancy - 9.8) * dt;
        obj.velocity.y *= Math.pow(0.92, dt * 60); // water drag
      } else {
        // In air: gravity
        obj.velocity.y -= 9.8 * dt;
      }

      obj.mesh.position.y += obj.velocity.y * dt;

      // Tilting by wave normal
      const waveHX2 = this.getWaveHeightAt(obj.mesh.position.x + 0.5, obj.mesh.position.z, this.waterTime);
      const waveHZ2 = this.getWaveHeightAt(obj.mesh.position.x, obj.mesh.position.z + 0.5, this.waterTime);
      obj.mesh.rotation.z = (waveHX2 - waveH) * 0.8;
      obj.mesh.rotation.x = -(waveHZ2 - waveH) * 0.8;
      obj.mesh.rotation.y += obj.rotVelocity.y * dt;
    });

    // 3. Debris Physics
    for (let i = this.debrisPool.length - 1; i >= 0; i--) {
      const d = this.debrisPool[i];
      d.life -= dt;
      d.vel.y -= 18.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rot.x * dt;
      d.mesh.rotation.y += d.rot.y * dt;

      if (d.mesh.position.y <= 0) {
        d.mesh.position.y = 0;
        d.vel.y *= -0.3; // bounce
        d.vel.x *= 0.8;
        d.vel.z *= 0.8;
      }

      if (d.life <= 0) {
        this.debrisPool.splice(i, 1);
      }
    }

    // 4. Crystals physics
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      c.vel.y -= 16.0 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.y += 4.0 * dt;

      if (c.mesh.position.y <= 0.2) {
        c.mesh.position.y = 0.2;
        c.vel.set(0, 0, 0);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
