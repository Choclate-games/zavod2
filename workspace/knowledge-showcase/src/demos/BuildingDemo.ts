import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  BaseBuildingSystem,
  CELL_SIZE,
  PYLON_LINK_RADIUS,
  STRUCTURE_DEFS,
  gridToWorld,
  snapToGrid,
  worldToGrid,
  type PlacedStructure,
  type StructureType,
} from '../game/gridBuilding';

interface Enemy {
  id: number;
  mesh: THREE.Mesh;
  gx: number;
  gz: number;
  worldPos: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  attackTimer: number;
}

interface LaserEffect {
  line: THREE.Line;
  life: number;
}

export class BuildingDemo implements Demo {
  readonly id = 'building';
  readonly title = ['🏗️ Сетка и база', '🏗️ Grid & Base Defense'] as const;
  readonly hint = [
    '<b>ЛКМ</b> строить · <b>1..4</b> выбор (1: Стена, 2: Турель, 3: Пилон, 4: Генератор) · <b>X</b> снос · <b>Space</b> волна · <b>R</b> сброс<br>'
    + 'Энергосеть (BFS) соединяет пилоны в радиусе 8 м. Турели стреляют только при наличии энергии.',
    '<b>LMB</b> build · <b>1..4</b> select (1: Wall, 2: Turret, 3: Pylon, 4: Generator) · <b>X</b> demolish · <b>Space</b> wave · <b>R</b> reset<br>'
    + 'Power grid (BFS) links pylons within 8 m. Turrets only fire when powered.',
  ] as const;
  readonly category = ['🎯 Стратегии и тактика', '🎯 Strategy & Tactics'] as const;
  readonly tags = ['строительство', 'сетка', 'база', 'энергосеть', 'турели', 'grid', 'base', 'pylon', 'power', 'defense'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.5, 120);

  private ctx!: DemoContext;
  private sys = new BaseBuildingSystem();
  private selectedType: StructureType = 'turret';
  private demolishMode = false;

  private structureMeshes = new Map<number, THREE.Group>();
  private enemies: Enemy[] = [];
  private nextEnemyId = 1;
  private lasers: LaserEffect[] = [];
  private powerLinkLines: THREE.LineSegments | null = null;

  private previewMesh!: THREE.Mesh;
  private cursorWorld = new THREE.Vector3();
  private cursorGridX = 0;
  private cursorGridZ = 0;
  private isValidPlacement = false;

  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private waveCount = 0;
  private waveTimer = 0;
  private autoWaveActive = true;
  private unsubscribeKey: (() => void) | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x0c111a);
    this.scene.fog = new THREE.FogExp2(0x0c111a, 0.015);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const ambLight = new THREE.HemisphereLight(0x446688, 0x112233, 0.8);
    this.scene.add(ambLight);

    this.buildGround();
    this.buildPreview();

    this.camera.position.set(0, 26, 24);
    this.camera.lookAt(0, 0, 0);

    this.syncStructureMeshes();
  }

  enter(): void {
    this.unsubscribeKey = this.ctx.input.onKey((code) => {
      if (code === 'Digit1') { this.selectedType = 'wall'; this.demolishMode = false; }
      else if (code === 'Digit2') { this.selectedType = 'turret'; this.demolishMode = false; }
      else if (code === 'Digit3') { this.selectedType = 'pylon'; this.demolishMode = false; }
      else if (code === 'Digit4') { this.selectedType = 'generator'; this.demolishMode = false; }
      else if (code === 'KeyX') { this.demolishMode = !this.demolishMode; }
      else if (code === 'Space') { this.spawnWave(); }
      else if (code === 'KeyR') { this.reset(); }
      this.updatePreviewVisual();
    });
  }

  exit(): void {
    this.unsubscribeKey?.();
    this.unsubscribeKey = null;
  }

  fixedUpdate(dt: number): void {
    this.updateRaycast();

    // Handle pointer down placement
    const primary = this.ctx.input.primary;
    if (primary && primary.down) {
      if (this.demolishMode) {
        const res = this.sys.demolish(this.cursorGridX, this.cursorGridZ);
        if (res) {
          this.ctx.audio.playExplosion(0.4);
          this.syncStructureMeshes();
        }
      } else {
        const placed = this.sys.placeStructure(this.selectedType, this.cursorGridX, this.cursorGridZ);
        if (placed) {
          this.ctx.audio.playButtonClick();
          this.ctx.addTrauma(0.1);
          this.syncStructureMeshes();
        }
      }
    }

    // Auto wave timer
    if (this.autoWaveActive) {
      this.waveTimer += dt;
      if (this.waveTimer >= 10.0) {
        this.waveTimer = 0;
        this.spawnWave();
      }
    }

    this.updateTurrets(dt);
    this.updateEnemies(dt);
    this.updateLasers(dt);
    this.updatePowerLinks();

    this.pushStatus();
  }

  update(dt: number): void {
    // Animate preview hover
    this.previewMesh.position.set(
      gridToWorld(this.cursorGridX),
      0.1 + Math.sin(Date.now() * 0.005) * 0.05,
      gridToWorld(this.cursorGridZ),
    );

    // Update enemy mesh positions
    for (const e of this.enemies) {
      e.mesh.position.copy(e.worldPos);
    }

    // Core pulsing light effect
    const coreMesh = this.structureMeshes.get(1);
    if (coreMesh) {
      coreMesh.rotation.y += dt * 0.5;
    }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private buildGround(): void {
    const size = 52;
    const grid = new THREE.GridHelper(size, size / CELL_SIZE, 0x3a4f66, 0x1a2633);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x101721, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private buildPreview(): void {
    this.previewMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.9, 0.4, CELL_SIZE * 0.9),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.45 }),
    );
    this.scene.add(this.previewMesh);
  }

  private updatePreviewVisual(): void {
    const mat = this.previewMesh.material as THREE.MeshBasicMaterial;
    if (this.demolishMode) {
      mat.color.setHex(0xe74c3c);
      return;
    }
    mat.color.setHex(this.isValidPlacement ? 0x2ecc71 : 0xe74c3c);
  }

  private updateRaycast(): void {
    const primary = this.ctx.input.primary;
    if (primary) {
      this.raycaster.setFromCamera(primary.ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
        this.cursorWorld.copy(hit);
        this.cursorGridX = worldToGrid(hit.x);
        this.cursorGridZ = worldToGrid(hit.z);
      }
    }

    if (this.demolishMode) {
      const existing = this.sys.getStructureAt(this.cursorGridX, this.cursorGridZ);
      this.isValidPlacement = existing !== undefined && existing.type !== 'core';
    } else {
      this.isValidPlacement = this.sys.canPlace(this.selectedType, this.cursorGridX, this.cursorGridZ).ok;
    }
    this.updatePreviewVisual();
  }

  private createStructureVisual(s: PlacedStructure): THREE.Group {
    const group = new THREE.Group();
    group.position.set(s.worldX, 0, s.worldZ);

    switch (s.type) {
      case 'core': {
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4, 1.6, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.8, roughness: 0.3 }),
        );
        base.position.y = 0.3;
        group.add(base);

        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.9, 0),
          new THREE.MeshStandardMaterial({ color: 0x00d2d3, emissive: 0x00a8ff, roughness: 0.1 }),
        );
        crystal.position.y = 1.6;
        group.add(crystal);
        break;
      }
      case 'wall': {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(CELL_SIZE * 0.95, 1.8, CELL_SIZE * 0.95),
          new THREE.MeshStandardMaterial({ color: 0x576574, roughness: 0.9 }),
        );
        wall.position.y = 0.9;
        wall.castShadow = true;
        group.add(wall);
        break;
      }
      case 'turret': {
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.9, 0.4, 8),
          new THREE.MeshStandardMaterial({ color: 0x2c3e50 }),
        );
        base.position.y = 0.2;
        group.add(base);

        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.5, 0.9),
          new THREE.MeshStandardMaterial({ color: s.isPowered ? 0xee5253 : 0x7f8c8d }),
        );
        head.position.y = 0.7;
        group.add(head);

        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e272e }),
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.7, 0.55);
        group.add(barrel);
        break;
      }
      case 'pylon': {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.3, 2.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x718093 }),
        );
        rod.position.y = 1.1;
        group.add(rod);

        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 8),
          new THREE.MeshStandardMaterial({
            color: s.isPowered ? 0x00d2d3 : 0x57606f,
            emissive: s.isPowered ? 0x00a8ff : 0x000000,
          }),
        );
        orb.position.y = 2.4;
        group.add(orb);
        break;
      }
      case 'generator': {
        const gen = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 1.2, 1.6),
          new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.4 }),
        );
        gen.position.y = 0.6;
        group.add(gen);
        break;
      }
    }

    return group;
  }

  private syncStructureMeshes(): void {
    const all = this.sys.getAllStructures();
    const currentIds = new Set(all.map((s) => s.id));

    // Remove obsolete
    for (const [id, grp] of this.structureMeshes) {
      if (!currentIds.has(id)) {
        disposeObject(grp);
        this.structureMeshes.delete(id);
      }
    }

    // Add or update
    for (const s of all) {
      let grp = this.structureMeshes.get(s.id);
      if (!grp) {
        grp = this.createStructureVisual(s);
        this.scene.add(grp);
        this.structureMeshes.set(s.id, grp);
      } else {
        // Re-color based on power
        if (s.type === 'turret') {
          const head = grp.children[1] as THREE.Mesh | undefined;
          if (head && head.material) {
            (head.material as THREE.MeshStandardMaterial).color.setHex(s.isPowered ? 0xee5253 : 0x7f8c8d);
          }
        } else if (s.type === 'pylon') {
          const orb = grp.children[1] as THREE.Mesh | undefined;
          if (orb && orb.material) {
            const mat = orb.material as THREE.MeshStandardMaterial;
            mat.color.setHex(s.isPowered ? 0x00d2d3 : 0x57606f);
            mat.emissive.setHex(s.isPowered ? 0x00a8ff : 0x000000);
          }
        }
      }
    }
  }

  private updatePowerLinks(): void {
    if (this.powerLinkLines) {
      disposeObject(this.powerLinkLines);
      this.powerLinkLines = null;
    }

    const all = this.sys.getAllStructures();
    const conductors = all.filter((s) => s.isPowered && (STRUCTURE_DEFS[s.type].energyProduction > 0 || s.type === 'pylon'));

    const points: THREE.Vector3[] = [];
    for (let i = 0; i < conductors.length; i++) {
      for (let j = i + 1; j < conductors.length; j++) {
        const a = conductors[i];
        const b = conductors[j];
        const dist = Math.hypot(a.worldX - b.worldX, a.worldZ - b.worldZ);
        if (dist <= PYLON_LINK_RADIUS + 0.1) {
          points.push(new THREE.Vector3(a.worldX, 1.8, a.worldZ));
          points.push(new THREE.Vector3(b.worldX, 1.8, b.worldZ));
        }
      }
    }

    if (points.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.7 });
      this.powerLinkLines = new THREE.LineSegments(geo, mat);
      this.scene.add(this.powerLinkLines);
    }
  }

  private spawnWave(): void {
    this.waveCount++;
    const count = 4 + this.waveCount * 2;
    const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    const spawnDist = 18;

    for (let i = 0; i < count; i++) {
      const baseAngle = angles[i % angles.length];
      const angle = baseAngle + (Math.random() - 0.5) * 0.5;
      const wx = Math.cos(angle) * spawnDist;
      const wz = Math.sin(angle) * spawnDist;
      const gx = worldToGrid(wx);
      const gz = worldToGrid(wz);

      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0xff3838, roughness: 0.5 }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(wx, 0.4, wz);
      this.scene.add(mesh);

      this.enemies.push({
        id: this.nextEnemyId++,
        mesh,
        gx,
        gz,
        worldPos: new THREE.Vector3(wx, 0.4, wz),
        hp: 50 + this.waveCount * 15,
        maxHp: 50 + this.waveCount * 15,
        speed: 2.2 + Math.random() * 0.4,
        attackTimer: 0,
      });
    }

    this.ctx.audio.playAlarm();
  }

  private updateTurrets(dt: number): void {
    const all = this.sys.getAllStructures();
    for (const s of all) {
      if (s.type !== 'turret' || !s.isPowered) continue;
      const def = STRUCTURE_DEFS.turret;
      s.cooldown = Math.max(0, s.cooldown - dt);

      if (s.cooldown <= 0 && this.enemies.length > 0) {
        // Find closest enemy in range
        let closest: Enemy | null = null;
        let minDist = def.range || 10.0;

        for (const e of this.enemies) {
          const d = Math.hypot(e.worldPos.x - s.worldX, e.worldPos.z - s.worldZ);
          if (d <= minDist) {
            minDist = d;
            closest = e;
          }
        }

        if (closest) {
          s.cooldown = 1.0 / (def.fireRate || 1.5);
          closest.hp -= def.damage || 30;

          // Visual laser
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(s.worldX, 0.8, s.worldZ),
            new THREE.Vector3(closest.worldPos.x, 0.4, closest.worldPos.z),
          ]);
          const line = new THREE.Line(
            geo,
            new THREE.LineBasicMaterial({ color: 0xff4757, linewidth: 2 }),
          );
          this.scene.add(line);
          this.lasers.push({ line, life: 0.1 });

          this.ctx.audio.playLaser();

          if (closest.hp <= 0) {
            this.sys.scrap += 8; // Kill reward
          }
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        disposeObject(e.mesh);
        this.enemies.splice(i, 1);
        this.ctx.audio.playExplosion(0.3);
        continue;
      }

      // Step towards Core (0,0)
      const curGx = worldToGrid(e.worldPos.x);
      const curGz = worldToGrid(e.worldPos.z);
      const next = this.sys.findNextStep(curGx, curGz, 0, 0);

      const targetWorldX = gridToWorld(next.gx);
      const targetWorldZ = gridToWorld(next.gz);

      const obstacle = this.sys.getStructureAt(next.gx, next.gz);
      if (obstacle && (obstacle.type === 'core' || STRUCTURE_DEFS[obstacle.type].blocksMovement)) {
        // Attack obstacle
        e.attackTimer += dt;
        if (e.attackTimer >= 1.0) {
          e.attackTimer = 0;
          const destroyed = this.sys.damageStructure(obstacle.id, 20);
          this.ctx.audio.playSpartanKick();
          if (destroyed) {
            this.ctx.audio.playExplosion(0.6);
            this.syncStructureMeshes();
          }
        }
      } else {
        // Move towards target step
        const dx = targetWorldX - e.worldPos.x;
        const dz = targetWorldZ - e.worldPos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          e.worldPos.x += (dx / d) * e.speed * dt;
          e.worldPos.z += (dz / d) * e.speed * dt;
          e.mesh.rotation.z = -Math.atan2(dx, dz);
        }
      }
    }
  }

  private updateLasers(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.life -= dt;
      if (l.life <= 0) {
        disposeObject(l.line);
        this.lasers.splice(i, 1);
      }
    }
  }

  private reset(): void {
    this.sys = new BaseBuildingSystem();
    for (const e of this.enemies) disposeObject(e.mesh);
    this.enemies = [];
    for (const l of this.lasers) disposeObject(l.line);
    this.lasers = [];
    this.waveCount = 0;
    this.waveTimer = 0;
    this.syncStructureMeshes();
  }

  private pushStatus(): void {
    const core = this.sys.getStructureAt(0, 0);
    const coreHp = core ? core.hp : 0;
    const modeStr = this.demolishMode
      ? '<span style="color:#e74c3c">РЕЖИМ СНОСА (X)</span>'
      : `Постройка: <b>${STRUCTURE_DEFS[this.selectedType].name}</b> (${STRUCTURE_DEFS[this.selectedType].scrapCost} металл)`;

    this.ctx.setStatus(
      `Металл: <b>${this.sys.scrap}</b> · Энергия: <b>${this.sys.totalPowerConsumed}/${this.sys.totalPowerProduced}</b> W`
      + ` · Ядро: <b>${coreHp} HP</b> · Волна: <b>#${this.waveCount}</b> (врагов: ${this.enemies.length}) · ${modeStr}`,
    );
  }
}
