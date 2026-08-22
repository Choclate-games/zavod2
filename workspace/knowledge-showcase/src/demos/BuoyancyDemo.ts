import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  DebrisPool,
  MiningDrill,
  ROCK_DEFS,
  getWaveHeight,
  getWaveNormal,
  type RockType,
} from '../game/fluidPhysics';

interface WorldRock {
  id: number;
  mesh: THREE.Mesh;
  type: RockType;
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  size: number;
}

interface LootOrb {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  baseY: number;
  collected: boolean;
}

export class BuoyancyDemo implements Demo {
  readonly id = 'buoyancy';
  readonly title = ['🌊 Вода и разрушения', '🌊 Fluid Buoyancy & Destruction'] as const;
  readonly hint = [
    '<b>WASD</b> управление катером · <b>Space / ЛКМ</b> бурить породу · <b>R</b> сброс<br>'
    + 'Катер держит дифферент по нормалям волн. Следи за температурой бура: при 100°C бур клинит на 2 сек.',
    '<b>WASD</b> steer vessel · <b>Space / LMB</b> drill rock · <b>R</b> reset<br>'
    + 'Vessel pitches to wave normals. Watch drill temperature: jams for 2s at 100°C.',
  ] as const;
  readonly category = ['🚗 Физика и транспорт', '🚗 Physics & Vehicles'] as const;
  readonly tags = ['вода', 'волны', 'плавучесть', 'разрушения', 'бур', 'buoyancy', 'water', 'drill', 'mining', 'destruction'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.5, 120);

  private ctx!: DemoContext;
  private time = 0;

  // Water
  private waterMesh!: THREE.Mesh;
  private waterGeo!: THREE.PlaneGeometry;
  private waterGridSize = 40;
  private waterDim = 50;

  // Boat
  private boatGroup = new THREE.Group();
  private drillMesh!: THREE.Mesh;
  private boatPos = new THREE.Vector3(0, 0, 10);
  private boatHeading = 0;
  private boatSpeed = 0;
  private maxBoatSpeed = 8.0;

  // Mining & Physics
  private drill = new MiningDrill();
  private rocks: WorldRock[] = [];
  private lootOrbs: LootOrb[] = [];
  private debrisPool = new DebrisPool();
  private debrisInstMesh!: THREE.InstancedMesh;
  private dummyObj = new THREE.Object3D();

  private collectedLoot = 0;
  private rocksDestroyed = 0;
  private nextRockId = 1;
  private unsubscribeKey: (() => void) | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x071526);
    this.scene.fog = new THREE.FogExp2(0x071526, 0.018);

    const sun = new THREE.DirectionalLight(0xfff1cf, 1.3);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    this.scene.add(sun);

    const skyLight = new THREE.HemisphereLight(0x4aa3df, 0x051d38, 0.9);
    this.scene.add(skyLight);

    this.buildWater();
    this.buildBoat();
    this.buildDebrisInstancer();
    this.spawnRocks();

    this.camera.position.set(0, 18, 22);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribeKey = this.ctx.input.onKey((code) => {
      if (code === 'KeyR') this.reset();
    });
  }

  exit(): void {
    this.unsubscribeKey?.();
    this.unsubscribeKey = null;
  }

  fixedUpdate(dt: number): void {
    this.time += dt;

    this.updateControls(dt);
    this.updateWaterGeometry();
    this.updateBoatPhysics(dt);
    this.updateDrilling(dt);
    this.updateDebris(dt);
    this.updateLoot(dt);

    this.pushStatus();
  }

  update(dt: number): void {
    // Camera follow boat smoothly
    const targetCamX = this.boatPos.x - Math.sin(this.boatHeading) * 14;
    const targetCamZ = this.boatPos.z - Math.cos(this.boatHeading) * 14;
    const targetCamY = this.boatPos.y + 9;

    const k = 1 - Math.exp(-4 * dt);
    this.camera.position.x += (targetCamX - this.camera.position.x) * k;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * k;
    this.camera.position.y += (targetCamY - this.camera.position.y) * k;
    this.camera.lookAt(this.boatPos.x, this.boatPos.y + 1.0, this.boatPos.z);

    // Drill spinning animation
    const primary = this.ctx.input.primary;
    const isDrilling = (primary && primary.down) || this.ctx.input.isDown('Space');
    if (isDrilling && !this.drill.isJammed) {
      this.drillMesh.rotation.z += dt * 30.0;
    }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private buildWater(): void {
    this.waterGeo = new THREE.PlaneGeometry(this.waterDim, this.waterDim, this.waterGridSize, this.waterGridSize);
    this.waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0984e3,
      roughness: 0.1,
      metalness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 0.88,
    });

    this.waterMesh = new THREE.Mesh(this.waterGeo, waterMat);
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  private updateWaterGeometry(): void {
    const pos = this.waterGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < pos.count; i++) {
      const vx = arr[i * 3];
      const vz = arr[i * 3 + 2];
      arr[i * 3 + 1] = getWaveHeight(vx, vz, this.time);
    }
    pos.needsUpdate = true;
    this.waterGeo.computeVertexNormals();
  }

  private buildBoat(): void {
    // Hull
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.3, metalness: 0.4 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 3.4), hullMat);
    hull.position.y = 0.35;
    hull.castShadow = true;
    this.boatGroup.add(hull);

    // Cabin
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.4), cabinMat);
    cabin.position.set(0, 0.9, -0.3);
    cabin.castShadow = true;
    this.boatGroup.add(cabin);

    // Drill mount & cone
    const drillMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.9 }),
    );
    drillMount.rotation.x = Math.PI / 2;
    drillMount.position.set(0, 0.4, 1.9);
    this.boatGroup.add(drillMount);

    this.drillMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8, roughness: 0.2 }),
    );
    this.drillMesh.rotation.x = Math.PI / 2;
    this.drillMesh.position.set(0, 0.4, 2.5);
    this.drillMesh.castShadow = true;
    this.boatGroup.add(this.drillMesh);

    this.scene.add(this.boatGroup);
  }

  private buildDebrisInstancer(): void {
    const geo = new THREE.DodecahedronGeometry(0.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.7 });
    this.debrisInstMesh = new THREE.InstancedMesh(geo, mat, this.debrisPool.maxCapacity);
    this.debrisInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.debrisInstMesh);

    // Hide all initially
    for (let i = 0; i < this.debrisPool.maxCapacity; i++) {
      this.dummyObj.position.set(0, -999, 0);
      this.dummyObj.updateMatrix();
      this.debrisInstMesh.setMatrixAt(i, this.dummyObj.matrix);
    }
    this.debrisInstMesh.instanceMatrix.needsUpdate = true;
  }

  private spawnRocks(): void {
    const rockConfigs: Array<{ type: RockType; x: number; z: number; size: number }> = [
      { type: 'sand', x: -6, z: 0, size: 2.0 },
      { type: 'sand', x: 6, z: -4, size: 2.2 },
      { type: 'basalt', x: -10, z: -10, size: 2.6 },
      { type: 'basalt', x: 8, z: 8, size: 2.8 },
      { type: 'ore', x: 0, z: -12, size: 2.2 },
      { type: 'ore', x: -8, z: 10, size: 2.4 },
      { type: 'sand', x: 12, z: -10, size: 1.8 },
      { type: 'ore', x: 10, z: 2, size: 2.0 },
    ];

    for (const cfg of rockConfigs) {
      const def = ROCK_DEFS[cfg.type];
      let color = 0xd35400; // sand/clay
      if (cfg.type === 'basalt') color = 0x2d3436;
      if (cfg.type === 'ore') color = 0xf1c40f;

      const geo = cfg.type === 'ore'
        ? new THREE.OctahedronGeometry(cfg.size * 0.6, 1)
        : new THREE.DodecahedronGeometry(cfg.size * 0.6, 0);

      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: cfg.type === 'ore' ? 0.2 : 0.85,
        metalness: cfg.type === 'ore' ? 0.9 : 0.1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cfg.x, 0.4, cfg.z);
      mesh.castShadow = true;
      this.scene.add(mesh);

      this.rocks.push({
        id: this.nextRockId++,
        mesh,
        type: cfg.type,
        hp: def.maxHp,
        maxHp: def.maxHp,
        x: cfg.x,
        z: cfg.z,
        size: cfg.size,
      });
    }
  }

  private updateControls(dt: number): void {
    const input = this.ctx.input;
    const mv = input.moveVector();

    // Steer
    if (Math.abs(mv.x) > 0.05) {
      this.boatHeading -= mv.x * 2.2 * dt;
    }

    // Throttle / Reverse
    const throttle = -mv.y;
    if (throttle > 0.1) {
      this.boatSpeed = Math.min(this.maxBoatSpeed, this.boatSpeed + throttle * 6.0 * dt);
    } else if (throttle < -0.1) {
      this.boatSpeed = Math.max(-3.0, this.boatSpeed + throttle * 4.0 * dt);
    } else {
      this.boatSpeed *= Math.exp(-1.5 * dt); // Drag
    }

    // Position integration
    this.boatPos.x += Math.sin(this.boatHeading) * this.boatSpeed * dt;
    this.boatPos.z += Math.cos(this.boatHeading) * this.boatSpeed * dt;

    // Clamp within area
    this.boatPos.x = THREE.MathUtils.clamp(this.boatPos.x, -22, 22);
    this.boatPos.z = THREE.MathUtils.clamp(this.boatPos.z, -22, 22);
  }

  private updateBoatPhysics(dt: number): void {
    // Wave height at boat center
    const waveY = getWaveHeight(this.boatPos.x, this.boatPos.z, this.time);
    this.boatPos.y = waveY + 0.15; // Floating height

    // Normal gradient alignment (Pitch & Roll)
    const norm = getWaveNormal(this.boatPos.x, this.boatPos.z, this.time);

    this.boatGroup.position.copy(this.boatPos);

    // Apply orientation: boat faces boatHeading, tilts according to wave normal
    const up = new THREE.Vector3(norm.nx, norm.ny, norm.nz).normalize();
    const forward = new THREE.Vector3(Math.sin(this.boatHeading), 0, Math.cos(this.boatHeading));
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    forward.crossVectors(right, up).normalize();

    const m = new THREE.Matrix4();
    m.makeBasis(right, up, forward);
    this.boatGroup.quaternion.setFromRotationMatrix(m);
  }

  private updateDrilling(dt: number): void {
    const primary = this.ctx.input.primary;
    const isDrilling = (primary && primary.down) || this.ctx.input.isDown('Space');

    this.drill.update(dt, isDrilling);

    // Visual heat color on drill
    const heatRatio = (this.drill.temperature - 20) / (this.drill.maxTemp - 20);
    const drillMat = this.drillMesh.material as THREE.MeshStandardMaterial;
    if (this.drill.isJammed) {
      drillMat.color.setHex(0x34495e); // Jammed cold / stalled
    } else {
      const red = Math.floor(241 + (255 - 241) * heatRatio);
      const green = Math.floor(196 * (1 - heatRatio * 0.8));
      const blue = Math.floor(15 * (1 - heatRatio));
      drillMat.color.setRGB(red / 255, green / 255, blue / 255);
    }

    if (isDrilling && !this.drill.isJammed) {
      // Find rock in front of drill tip (world coord at boat front + 2.5m)
      const tipX = this.boatPos.x + Math.sin(this.boatHeading) * 2.8;
      const tipZ = this.boatPos.z + Math.cos(this.boatHeading) * 2.8;

      for (let i = this.rocks.length - 1; i >= 0; i--) {
        const r = this.rocks[i];
        const dist = Math.hypot(r.x - tipX, r.z - tipZ);
        if (dist <= r.size * 0.75) {
          const res = this.drill.mineRock(r, dt);
          this.ctx.addTrauma(0.08);

          if (Math.random() < 0.3) {
            this.ctx.audio.playSwordSlash();
            this.debrisPool.spawnExplosion(tipX, 0.5, tipZ, 3, 4.0);
          }

          if (res.destroyed) {
            this.ctx.audio.playExplosion(0.8);
            this.ctx.addTrauma(0.4);
            this.rocksDestroyed++;

            // Big debris explosion
            this.debrisPool.spawnExplosion(r.x, 0.5, r.z, 25, 9.0);

            // Spawn loot orbs if ore
            if (res.loot > 0) {
              for (let k = 0; k < res.loot; k++) {
                this.spawnLootOrb(r.x + (Math.random() - 0.5) * 1.5, r.z + (Math.random() - 0.5) * 1.5);
              }
            }

            disposeObject(r.mesh);
            this.rocks.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  private spawnLootOrb(x: number, z: number): void {
    const geo = new THREE.SphereGeometry(0.25, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0xf39c12, roughness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.3, z);
    this.scene.add(mesh);
    this.lootOrbs.push({ mesh, x, z, baseY: 0.3, collected: false });
  }

  private updateLoot(dt: number): void {
    for (let i = this.lootOrbs.length - 1; i >= 0; i--) {
      const orb = this.lootOrbs[i];
      const dist = Math.hypot(orb.x - this.boatPos.x, orb.z - this.boatPos.z);

      // Float on wave
      const wY = getWaveHeight(orb.x, orb.z, this.time);
      orb.mesh.position.set(orb.x, wY + 0.3 + Math.sin(this.time * 3.0) * 0.1, orb.z);

      if (dist < 2.0) {
        // Collect
        this.collectedLoot += 10;
        this.ctx.audio.playCoinPickup();
        disposeObject(orb.mesh);
        this.lootOrbs.splice(i, 1);
      }
    }
  }

  private updateDebris(dt: number): void {
    this.debrisPool.update(dt);

    for (let i = 0; i < this.debrisPool.maxCapacity; i++) {
      const p = this.debrisPool.particles[i];
      if (p.active) {
        this.dummyObj.position.set(p.x, p.y, p.z);
        this.dummyObj.scale.setScalar(p.scale);
        this.dummyObj.updateMatrix();
        this.debrisInstMesh.setMatrixAt(i, this.dummyObj.matrix);
      } else {
        this.dummyObj.position.set(0, -999, 0);
        this.dummyObj.updateMatrix();
        this.debrisInstMesh.setMatrixAt(i, this.dummyObj.matrix);
      }
    }
    this.debrisInstMesh.instanceMatrix.needsUpdate = true;
  }

  private reset(): void {
    this.boatPos.set(0, 0, 10);
    this.boatHeading = 0;
    this.boatSpeed = 0;
    this.drill = new MiningDrill();
    for (const r of this.rocks) disposeObject(r.mesh);
    this.rocks = [];
    for (const o of this.lootOrbs) disposeObject(o.mesh);
    this.lootOrbs = [];
    this.collectedLoot = 0;
    this.rocksDestroyed = 0;
    this.spawnRocks();
  }

  private pushStatus(): void {
    const curWaveH = getWaveHeight(this.boatPos.x, this.boatPos.z, this.time);
    const jamText = this.drill.isJammed
      ? '<span style="color:#e74c3c;font-weight:bold">КЛИН (ПЕРЕГРЕВ 100°C)</span>'
      : `<b>${this.drill.temperature.toFixed(0)}°C</b>`;

    this.ctx.setStatus(
      `Скорость: <b>${(this.boatSpeed * 3.6).toFixed(1)} км/ч</b> · Высота волны: <b>${curWaveH.toFixed(2)} м</b>`
      + ` · Бур: ${jamText} · Добыто: <b>${this.collectedLoot}</b> золота · Разрушено скал: <b>${this.rocksDestroyed}</b>`,
    );
  }
}
