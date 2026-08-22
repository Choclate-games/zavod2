import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  EvidenceGraphSystem,
  WORLD_HEIGHT,
  computeOrthoBounds,
  evaluateQuadraticBezier,
  segmentHitsCircle,
  type ClueNode,
} from '../game/ortho2dEvidence';

interface CardVisual {
  id: string;
  group: THREE.Group;
  cardMesh: THREE.Mesh;
  pinMesh: THREE.Mesh;
  x: number;
  y: number;
}

interface FlyingFruit {
  id: number;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sliced: boolean;
}

export class Ortho2dDemo implements Demo {
  readonly id = 'ortho2d';
  readonly title = ['👆 2D на ортокамере', '👆 Orthographic 2D & Evidence Board'] as const;
  readonly hint = [
    '<b>Режим Доски:</b> Перетаскивай карточки · Клик по булавке протягивает красную нить Безье к другой улике.<br>'
    + '<b>Режим Слайсера (Tab):</b> Свайпай летящие сферы клинком или рисуй путь сплайном. <b>R</b> — сброс.',
    '<b>Board Mode:</b> Drag cards · Click pin to stretch red Bezier thread to another clue.<br>'
    + '<b>Slicer Mode (Tab):</b> Swipe flying spheres or draw Catmull-Rom path. <b>R</b> — reset.',
  ] as const;
  readonly category = ['🧩 2D и головоломки', '🧩 2D & Puzzles'] as const;
  readonly tags = ['2d', 'ортокамера', 'улики', 'детектив', 'слайсер', 'сплайн', 'orthographic', 'evidence', 'board', 'slicer'] as const;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;

  private ctx!: DemoContext;
  private mode: 'board' | 'slicer' = 'board';

  // Board Mode
  private boardSys = new EvidenceGraphSystem();
  private cardVisuals: Map<string, CardVisual> = new Map();
  private stringLinesGroup = new THREE.Group();
  private draggedCard: CardVisual | null = null;
  private dragOffset = new THREE.Vector2();
  private linkingFromId: string | null = null;
  private tempThreadLine: THREE.Line | null = null;

  // Slicer & Spline Mode
  private fruits: FlyingFruit[] = [];
  private nextFruitId = 1;
  private fruitSpawnTimer = 0;
  private slicedCount = 0;
  private bladeTrailPoints: THREE.Vector3[] = [];
  private bladeLine!: THREE.Line;
  private prevPointerPos = new THREE.Vector2();

  // Unit following path
  private splinePathPoints: THREE.Vector3[] = [];
  private splineCurve: THREE.CatmullRomCurve3 | null = null;
  private splineLine!: THREE.Line;
  private pathFollowerMesh!: THREE.Mesh;
  private pathTravelled = 0;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private unsubscribeKey: (() => void) | null = null;

  constructor() {
    const w = typeof window !== 'undefined' ? (window.innerWidth || 1280) : 1280;
    const h = typeof window !== 'undefined' ? (window.innerHeight || 720) : 720;
    const b = computeOrthoBounds(w, h);
    this.camera = new THREE.OrthographicCamera(b.left, b.right, b.top, b.bottom, -100, 100);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
  }

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x2c231c); // Cork board wood tint

    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffeedd, 0.6);
    dir.position.set(5, 10, 15);
    this.scene.add(dir);

    this.scene.add(this.stringLinesGroup);

    this.buildBoardCards();
    this.buildSlicerElements();
    this.updateStringLines();
  }

  enter(): void {
    this.unsubscribeKey = this.ctx.input.onKey((code) => {
      if (code === 'Tab') {
        this.mode = this.mode === 'board' ? 'slicer' : 'board';
        this.toggleModeVisuals();
        this.ctx.audio.playButtonClick();
      } else if (code === 'KeyR') {
        this.reset();
      }
    });
  }

  exit(): void {
    this.unsubscribeKey?.();
    this.unsubscribeKey = null;
  }

  fixedUpdate(dt: number): void {
    const pointerWorld = this.getPointerWorld();

    if (this.mode === 'board') {
      this.updateBoardInteraction(pointerWorld);
    } else {
      this.updateSlicerInteraction(dt, pointerWorld);
      this.updatePathFollower(dt);
    }

    this.pushStatus();
  }

  update(dt: number): void {
    if (this.mode === 'slicer') {
      // Update flying fruits
      for (const f of this.fruits) {
        f.mesh.position.set(f.x, f.y, 0);
        f.mesh.rotation.z += dt * 2.0;
      }
    }
  }

  resize(w: number, h: number): void {
    const b = computeOrthoBounds(w, h);
    this.camera.left = b.left;
    this.camera.right = b.right;
    this.camera.top = b.top;
    this.camera.bottom = b.bottom;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private getPointerWorld(): THREE.Vector2 {
    const primary = this.ctx.input.primary;
    if (!primary) return new THREE.Vector2(-999, -999);

    this.ndc.copy(primary.ndc);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, hit);
    return new THREE.Vector2(hit.x, hit.y);
  }

  private buildBoardCards(): void {
    const clues = Array.from(this.boardSys.clues.values());

    for (const c of clues) {
      const group = new THREE.Group();
      group.position.set(c.x, c.y, 0);

      // Card paper background
      let color = 0xf5f6fa;
      if (c.category === 'suspect') color = 0xdcdde1;
      if (c.category === 'weapon') color = 0xffd2d2;
      if (c.category === 'location') color = 0xdff9fb;

      const cardGeo = new THREE.PlaneGeometry(4.2, 2.6);
      const cardMat = new THREE.MeshBasicMaterial({ color });
      const cardMesh = new THREE.Mesh(cardGeo, cardMat);
      cardMesh.position.z = 0.05;
      group.add(cardMesh);

      // Red pin
      const pinGeo = new THREE.CircleGeometry(0.3, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(0, 1.0, 0.1);
      group.add(pinMesh);

      this.scene.add(group);

      this.cardVisuals.set(c.id, {
        id: c.id,
        group,
        cardMesh,
        pinMesh,
        x: c.x,
        y: c.y,
      });
    }
  }

  private updateBoardInteraction(pw: THREE.Vector2): void {
    const primary = this.ctx.input.primary;
    if (!primary) {
      this.draggedCard = null;
      return;
    }

    if (primary.down) {
      if (!this.draggedCard) {
        // Test hit on pins or cards
        for (const cv of this.cardVisuals.values()) {
          const pinPos = new THREE.Vector2(cv.x, cv.y + 1.0);
          if (pw.distanceTo(pinPos) < 0.6) {
            // Clicked pin: start thread connection
            if (this.linkingFromId === null) {
              this.linkingFromId = cv.id;
              this.ctx.audio.playButtonClick();
            } else if (this.linkingFromId !== cv.id) {
              const res = this.boardSys.connectClues(this.linkingFromId, cv.id);
              if (res.isValid) {
                this.ctx.audio.playParryClang();
                this.ctx.audio.playLevelUp();
              } else {
                this.ctx.audio.playSpartanKick();
              }
              this.linkingFromId = null;
              this.updateStringLines();
            }
            return;
          }

          if (Math.abs(pw.x - cv.x) < 2.1 && Math.abs(pw.y - cv.y) < 1.3) {
            this.draggedCard = cv;
            this.dragOffset.set(cv.x - pw.x, cv.y - pw.y);
            this.ctx.audio.playButtonClick();
            break;
          }
        }
      } else {
        // Dragging active card
        this.draggedCard.x = pw.x + this.dragOffset.x;
        this.draggedCard.y = pw.y + this.dragOffset.y;
        this.draggedCard.group.position.set(this.draggedCard.x, this.draggedCard.y, 0.2);

        const clue = this.boardSys.clues.get(this.draggedCard.id);
        if (clue) {
          clue.x = this.draggedCard.x;
          clue.y = this.draggedCard.y;
        }
        this.updateStringLines();
      }
    } else {
      this.draggedCard = null;
    }
  }

  private updateStringLines(): void {
    // Clear old lines
    while (this.stringLinesGroup.children.length > 0) {
      const child = this.stringLinesGroup.children[0];
      disposeObject(child);
    }

    for (const link of this.boardSys.links) {
      const cardA = this.cardVisuals.get(link.fromId);
      const cardB = this.cardVisuals.get(link.toId);
      if (!cardA || !cardB) continue;

      const p0 = { x: cardA.x, y: cardA.y + 1.0 };
      const p2 = { x: cardB.x, y: cardB.y + 1.0 };
      const dist = Math.hypot(p2.x - p0.x, p2.y - p0.y);
      const sag = dist * 0.18;
      const p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 - sag };

      const points: THREE.Vector3[] = [];
      const segments = 20;
      for (let s = 0; s <= segments; s++) {
        const pt = evaluateQuadraticBezier(p0, p1, p2, s / segments);
        points.push(new THREE.Vector3(pt.x, pt.y, 0.08));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const color = link.isValid ? 0xe74c3c : 0x7f8c8d;
      const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      const line = new THREE.Line(geo, mat);
      this.stringLinesGroup.add(line);
    }
  }

  private buildSlicerElements(): void {
    // Slicer blade trail
    const bladeGeo = new THREE.BufferGeometry();
    this.bladeLine = new THREE.Line(bladeGeo, new THREE.LineBasicMaterial({ color: 0x00d2d3, linewidth: 3 }));
    this.bladeLine.visible = false;
    this.scene.add(this.bladeLine);

    // Spline path
    const splineGeo = new THREE.BufferGeometry();
    this.splineLine = new THREE.Line(splineGeo, new THREE.LineBasicMaterial({ color: 0xf1c40f, linewidth: 2 }));
    this.splineLine.visible = false;
    this.scene.add(this.splineLine);

    // Follower unit
    this.pathFollowerMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71 }),
    );
    this.pathFollowerMesh.rotation.z = -Math.PI / 2;
    this.pathFollowerMesh.visible = false;
    this.scene.add(this.pathFollowerMesh);
  }

  private updateSlicerInteraction(dt: number, pw: THREE.Vector2): void {
    const primary = this.ctx.input.primary;

    // Spawn flying targets
    this.fruitSpawnTimer += dt;
    if (this.fruitSpawnTimer > 1.2) {
      this.fruitSpawnTimer = 0;
      this.spawnFruit();
    }

    // Update fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.vy -= 9.8 * dt * 0.6;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      if (f.y < -12) {
        disposeObject(f.mesh);
        this.fruits.splice(i, 1);
      }
    }

    if (primary && primary.down) {
      if (this.bladeTrailPoints.length === 0) {
        this.prevPointerPos.copy(pw);
      }

      const speed = pw.distanceTo(this.prevPointerPos) / Math.max(0.001, dt);
      this.bladeTrailPoints.push(new THREE.Vector3(pw.x, pw.y, 0.5));
      if (this.bladeTrailPoints.length > 12) this.bladeTrailPoints.shift();

      this.bladeLine.geometry.dispose();
      this.bladeLine.geometry = new THREE.BufferGeometry().setFromPoints(this.bladeTrailPoints);
      this.bladeLine.visible = true;

      // Swipe slicer check: requires speed > 10.0 to cut
      if (speed > 10.0) {
        for (const f of this.fruits) {
          if (!f.sliced && segmentHitsCircle(this.prevPointerPos.x, this.prevPointerPos.y, pw.x, pw.y, f.x, f.y, f.radius)) {
            f.sliced = true;
            this.slicedCount++;
            (f.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xe74c3c);
            f.vx *= 2.0;
            f.vy = 4.0;
            this.ctx.audio.playSwordSlash();
            this.ctx.addTrauma(0.15);
          }
        }
      }

      // Add to path spline
      if (this.splinePathPoints.length === 0 || this.splinePathPoints[this.splinePathPoints.length - 1].distanceTo(new THREE.Vector3(pw.x, pw.y, 0)) > 0.4) {
        this.splinePathPoints.push(new THREE.Vector3(pw.x, pw.y, 0));
        if (this.splinePathPoints.length >= 3) {
          this.splineCurve = new THREE.CatmullRomCurve3(this.splinePathPoints, false, 'centripetal', 0.5);
          const pts = this.splineCurve.getSpacedPoints(Math.min(128, this.splinePathPoints.length * 6));
          this.splineLine.geometry.dispose();
          this.splineLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
          this.splineLine.visible = true;
          this.pathFollowerMesh.visible = true;
        }
      }

      this.prevPointerPos.copy(pw);
    } else {
      this.bladeTrailPoints = [];
      this.bladeLine.visible = false;
    }
  }

  private spawnFruit(): void {
    const geo = new THREE.CircleGeometry(0.8, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f });
    const mesh = new THREE.Mesh(geo, mat);
    const startX = (Math.random() - 0.5) * 14;
    mesh.position.set(startX, -10, 0);
    this.scene.add(mesh);

    this.fruits.push({
      id: this.nextFruitId++,
      mesh,
      x: startX,
      y: -10,
      vx: (Math.random() - 0.5) * 4,
      vy: 11 + Math.random() * 3,
      radius: 0.8,
      sliced: false,
    });
  }

  private updatePathFollower(dt: number): void {
    if (!this.splineCurve || this.splinePathPoints.length < 3) return;

    const len = this.splineCurve.getLength();
    if (len <= 0.1) return;

    this.pathTravelled += dt * 6.0;
    if (this.pathTravelled > len) this.pathTravelled = 0;

    const t = this.pathTravelled / len;
    const pt = this.splineCurve.getPointAt(t);
    const tan = this.splineCurve.getTangentAt(t);

    this.pathFollowerMesh.position.set(pt.x, pt.y, 0.2);
    this.pathFollowerMesh.rotation.z = Math.atan2(tan.y, tan.x) - Math.PI / 2;
  }

  private toggleModeVisuals(): void {
    const isBoard = this.mode === 'board';
    for (const cv of this.cardVisuals.values()) {
      cv.group.visible = isBoard;
    }
    this.stringLinesGroup.visible = isBoard;
    this.bladeLine.visible = !isBoard;
    this.splineLine.visible = !isBoard && this.splinePathPoints.length >= 3;
    this.pathFollowerMesh.visible = !isBoard && this.splinePathPoints.length >= 3;
    for (const f of this.fruits) {
      f.mesh.visible = !isBoard;
    }
  }

  private reset(): void {
    this.boardSys.reset();
    this.linkingFromId = null;
    this.updateStringLines();
    this.splinePathPoints = [];
    this.splineCurve = null;
    this.splineLine.visible = false;
    this.pathFollowerMesh.visible = false;
    for (const f of this.fruits) disposeObject(f.mesh);
    this.fruits = [];
    this.slicedCount = 0;
  }

  private pushStatus(): void {
    if (this.mode === 'board') {
      this.ctx.setStatus(
        `Режим: <b>Доска Улик (Детектив)</b> · Внимание: <b>${this.boardSys.detectiveFocus}%</b>`
        + ` · Зацепок раскрыто: <b>${this.boardSys.deductionsFound} / ${this.boardSys.totalValidDeductions}</b> · Tab: переключить на Слайсер`,
      );
    } else {
      this.ctx.setStatus(
        `Режим: <b>2D Слайсер & Сплайн Catmull-Rom</b> · Разрезано целей: <b>${this.slicedCount}</b>`
        + ` · Точек сплайна: <b>${this.splinePathPoints.length}</b> · Tab: переключить на Доску`,
      );
    }
  }
}
