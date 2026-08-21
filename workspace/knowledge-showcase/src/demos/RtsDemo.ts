import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  FlowField, assignSlots, damageMultiplier, formationSlots,
  type UnitClass, type Vec2,
} from '../game/flowField';

const MAP_HALF = 44;
const CELL = 2;
const COLS = Math.round((MAP_HALF * 2) / CELL);
const MAX_UNITS = 220;
const AGGRO = 9;

interface Unit {
  id: number;
  team: 0 | 1;
  cls: UnitClass;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;
  heading: number;
  /** Слот строя текущего приказа; null — стоим. */
  order: Vec2 | null;
  /** Очередь приказов (Shift): тактика, а не кликанье. */
  queue: Vec2[];
  selected: boolean;
  alive: boolean;
}

const CLASSES: Record<UnitClass, { hp: number; speed: number; damage: number; range: number; color: number }> = {
  infantry: { hp: 90,  speed: 5.2, damage: 11, range: 5.5, color: 0x3498db },
  armored:  { hp: 260, speed: 3.4, damage: 22, range: 4.5, color: 0x8e6e53 },
  air:      { hp: 120, speed: 7.0, damage: 15, range: 6.5, color: 0x9b59b6 },
};

/**
 * RTS: выделение рамкой, строй, флоу-филд, камень-ножницы-бумага.
 *
 * Прямая проверка knowledge/threejs/rts_selection_and_command.md.
 * Юниты — один InstancedMesh на команду; расталкивание — по равномерной
 * сетке, не Rapier: физические коллайдеры для 200 юнитов дороже всей игры.
 */
export class RtsDemo implements Demo {
  readonly id = 'rts';
  readonly title = ['⚔️ Стратегия: строй и приказы', '⚔️ RTS: formations and orders'] as const;
  readonly hint = [
    '<b>ЛКМ</b> рамка выделения · <b>ПКМ</b>/<b>ЛКМ+Shift</b> приказ · <b>Ctrl+Shift</b> добавить к выделению · <b>A</b> выделить всех · <b>F</b> флоу-филд · <b>R</b> рестарт',
    '<b>LMB</b> selection box · <b>RMB</b>/<b>LMB+Shift</b> order · <b>Ctrl+Shift</b> add to selection · <b>A</b> select all · <b>F</b> flow field · <b>R</b> restart',
  ] as const;
  readonly category = ['🧠 Стратегия и AI', '🧠 Strategy & AI'] as const;
  readonly tags = ['стратегия', 'rts', 'строй', 'приказы', 'выделение рамкой', 'флоуфилд', 'юниты', 'instanced mesh'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);

  private ctx!: DemoContext;
  private units: Unit[] = [];
  private field!: FlowField;
  private selection: Unit[] = [];
  private teamMesh: THREE.InstancedMesh[] = [];
  private ringMesh!: THREE.InstancedMesh;
  private boxEl!: HTMLDivElement;
  private fieldHelper!: THREE.LineSegments;

  private dragStart: THREE.Vector2 | null = null;
  private dragCurrent = new THREE.Vector2();
  private pointerWasDown = false;
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;
  private lastOrderInfo = '';

  private readonly dummy = new THREE.Object3D();
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();
  private readonly tmpVec = new THREE.Vector3();
  private readonly flowSample: Vec2 = { x: 0, z: 0 };

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x22301f);
    this.scene.fog = new THREE.Fog(0x22301f, 70, 190);

    const sun = new THREE.DirectionalLight(0xfff0d0, 2.3);
    sun.position.set(30, 50, 20);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0xbcd6ee, 0x1a2417, 1.3));

    this.field = new FlowField(COLS, COLS, CELL, -MAP_HALF, -MAP_HALF);
    this.buildTerrain();
    this.buildPools();
    this.spawnArmies();

    // Камера RTS: фиксированный наклон, без орбиты.
    this.camera.position.set(0, 62, 52);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyA') { this.selection = this.units.filter((u) => u.team === 0 && u.alive); this.refreshSelection(); }
      if (code === 'KeyF') this.fieldHelper.visible = !this.fieldHelper.visible;
      if (code === 'KeyR') this.spawnArmies();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.dragStart = null;
    this.hideBoxHelper();
  }

  fixedUpdate(dt: number): void {
    this.handlePointer();
    this.moveSystem(dt);
    this.combatSystem(dt);
    this.separationSystem();
  }

  update(dt: number): void {
    this.renderSystem();
    this.statusTimer += dt;
    if (this.statusTimer > 0.15) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    this.boxEl?.remove();
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ───────────────────────────────────────────────────────────── системы
  private moveSystem(dt: number): void {
    for (const u of this.units) {
      if (!u.alive || !u.order) continue;
      const dx = u.order.x - u.x;
      const dz = u.order.z - u.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.6) {
        // Слот занят — берём следующий приказ из очереди, а не «последний побеждает».
        u.order = u.queue.shift() ?? null;
        continue;
      }

      // Вблизи цели идём напрямую, вдали — по флоу-филду: он огибает препятствия.
      let mx: number;
      let mz: number;
      if (dist < CELL * 2 || u.cls === 'air') {
        mx = dx / dist; mz = dz / dist;
      } else {
        this.field.sample(u.x, u.z, this.flowSample);
        if (this.flowSample.x === 0 && this.flowSample.z === 0) { mx = dx / dist; mz = dz / dist; }
        else { mx = this.flowSample.x; mz = this.flowSample.z; }
      }

      const step = u.speed * dt;
      u.x += mx * step;
      u.z += mz * step;
      u.heading = Math.atan2(mx, mz);
      u.x = THREE.MathUtils.clamp(u.x, -MAP_HALF + 1, MAP_HALF - 1);
      u.z = THREE.MathUtils.clamp(u.z, -MAP_HALF + 1, MAP_HALF - 1);
    }
  }

  private combatSystem(dt: number): void {
    for (const u of this.units) {
      if (!u.alive) continue;
      u.cooldown -= dt;

      let target: Unit | null = null;
      let bestD = AGGRO * AGGRO;
      for (const other of this.units) {
        if (!other.alive || other.team === u.team) continue;
        const d = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
        if (d < bestD) { bestD = d; target = other; }
      }
      if (!target) continue;

      // Авто-агро НЕ отменяет приказ игрока: юнит огрызается, но не бежит
      // за врагом через полкарты — самая частая жалоба на самодельные RTS.
      if (Math.sqrt(bestD) > u.range) {
        if (!u.order && u.team === 1) {
          u.order = { x: target.x, z: target.z };   // боты наступают сами
        }
        continue;
      }

      if (u.cooldown > 0) continue;
      u.cooldown = 0.8;
      target.hp -= u.damage * damageMultiplier(u.cls, target.cls);
      u.heading = Math.atan2(target.x - u.x, target.z - u.z);
      if (target.hp <= 0) {
        target.alive = false;
        target.selected = false;
        this.selection = this.selection.filter((s) => s.alive);
      }
    }
  }

  /** Расталкивание по сетке, не O(n²) и не Rapier. */
  private separationSystem(): void {
    const buckets = new Map<number, Unit[]>();
    for (const u of this.units) {
      if (!u.alive) continue;
      const key = (Math.floor(u.x / 3) & 0xffff) << 16 | (Math.floor(u.z / 3) & 0xffff);
      const b = buckets.get(key);
      if (b) b.push(u); else buckets.set(key, [u]);
    }
    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];
          if (a.cls === 'air' !== (b.cls === 'air')) continue;   // воздух не толкает землю
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d > 1.5 || d < 1e-4) continue;
          const push = (1.5 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  private renderSystem(): void {
    for (let team = 0; team < 2; team++) {
      const mesh = this.teamMesh[team];
      let i = 0;
      for (const u of this.units) {
        if (!u.alive || u.team !== team) continue;
        const hp = u.hp / u.maxHp;
        this.dummy.position.set(u.x, u.cls === 'air' ? 3.2 : 0.8, u.z);
        this.dummy.rotation.set(0, u.heading, 0);
        this.dummy.scale.set(1, 0.6 + hp * 0.6, 1);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
        mesh.setColorAt(i, CLASS_COLORS[u.cls][team]);
        i++;
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Подсветка выделения — декали-кольца, а не дублирующие меши.
    let r = 0;
    for (const u of this.selection) {
      if (!u.alive) continue;
      this.dummy.position.set(u.x, 0.06, u.z);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.ringMesh.setMatrixAt(r++, this.dummy.matrix);
    }
    this.ringMesh.count = r;
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  // ───────────────────────────────────────────────────────────── ввод
  private handlePointer(): void {
    const pointer = this.ctx.input.primary;
    if (!pointer) return;
    const input = this.ctx.input;
    const shift = input.isDown('ShiftLeft') || input.isDown('ShiftRight');

    if (pointer.down && !this.pointerWasDown) {
      this.pointerWasDown = true;
      if (shift) { this.issueOrder(pointer.ndc, input.isDown('ControlLeft')); return; }
      this.dragStart = pointer.ndc.clone();
      this.dragCurrent.copy(pointer.ndc);
      return;
    }

    if (pointer.down && this.dragStart) {
      this.dragCurrent.copy(pointer.ndc);
      this.updateBoxHelper();
      return;
    }

    if (!pointer.down && this.pointerWasDown) {
      this.pointerWasDown = false;
      if (this.dragStart) {
        const dragged = this.dragStart.distanceTo(pointer.ndc) > 0.012;
        // Порог отделяет клик от рамки: без него любой клик — пустая рамка.
        if (dragged) this.selectInBox(this.dragStart, pointer.ndc, shift);
        else this.selectSingle(pointer.ndc, shift);
        this.dragStart = null;
        this.hideBoxHelper();
      }
    }
  }

  private selectInBox(a: THREE.Vector2, b: THREE.Vector2, additive: boolean): void {
    // Проекция позиции каждого юнита в NDC и сравнение с прямоугольником:
    // никаких рейкастов по юнитам — это одна матрица на всех.
    this.camera.updateMatrixWorld();
    const minX = Math.min(a.x, b.x); const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y); const maxY = Math.max(a.y, b.y);

    const inBox: Unit[] = [];
    for (const u of this.units) {
      if (!u.alive || u.team !== 0) continue;
      this.tmpVec.set(u.x, 1, u.z).project(this.camera);
      if (this.tmpVec.z > 1) continue;
      if (this.tmpVec.x < minX || this.tmpVec.x > maxX) continue;
      if (this.tmpVec.y < minY || this.tmpVec.y > maxY) continue;
      inBox.push(u);
    }

    // Приоритет боевых: рамка, захватившая всех, не должна отправлять
    // «воздух» вместе с пехотой, если игрок явно тянул по пехоте.
    const ground = inBox.filter((u) => u.cls !== 'air');
    const picked = ground.length > 0 ? ground : inBox;

    this.selection = additive ? [...new Set([...this.selection, ...picked])] : picked;
    this.refreshSelection();
  }

  private selectSingle(ndc: THREE.Vector2, additive: boolean): void {
    let best: Unit | null = null;
    let bestD = 0.05;
    for (const u of this.units) {
      if (!u.alive || u.team !== 0) continue;
      this.tmpVec.set(u.x, 1, u.z).project(this.camera);
      const d = Math.hypot(this.tmpVec.x - ndc.x, this.tmpVec.y - ndc.y);
      if (d < bestD) { bestD = d; best = u; }
    }
    if (!best) { if (!additive) { this.selection = []; this.refreshSelection(); } return; }
    this.selection = additive ? [...new Set([...this.selection, best])] : [best];
    this.refreshSelection();
  }

  private issueOrder(ndc: THREE.Vector2, queued: boolean): void {
    if (this.selection.length === 0) return;
    this.raycaster.setFromCamera(ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return;

    // Флоу-филд считается ОДИН раз на приказ и переиспользуется всем отрядом.
    const ok = this.field.build(this.hit.x, this.hit.z);
    if (!ok) { this.lastOrderInfo = 'цель недостижима'; return; }

    const centroid = this.selection.reduce(
      (acc, u) => ({ x: acc.x + u.x / this.selection.length, z: acc.z + u.z / this.selection.length }),
      { x: 0, z: 0 },
    );
    const dir = { x: this.hit.x - centroid.x, z: this.hit.z - centroid.z };
    const slots = formationSlots({ x: this.hit.x, z: this.hit.z }, dir, this.selection.length);
    const assignment = assignSlots(this.selection.map((u) => ({ x: u.x, z: u.z })), slots);

    // Скорость отряда = скорость самого медленного: иначе пехота приходит
    // к бою по одному и умирает по одному.
    const slowest = Math.min(...this.selection.map((u) => CLASSES[u.cls].speed));

    this.selection.forEach((u, i) => {
      const slot = slots[assignment[i]] ?? { x: this.hit.x, z: this.hit.z };
      if (queued && u.order) u.queue.push(slot);
      else { u.order = slot; u.queue.length = 0; }
      u.speed = slowest;
    });
    this.lastOrderInfo = `${this.selection.length} юнитов, строй ${Math.ceil(Math.sqrt(this.selection.length))} в ряд`;
    this.ctx.audio.playButtonClick();
  }

  private refreshSelection(): void {
    for (const u of this.units) u.selected = false;
    for (const u of this.selection) u.selected = true;
  }

  private updateBoxHelper(): void {
    if (!this.dragStart) return;
    const toPx = (v: THREE.Vector2) => ({
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    });
    const a = toPx(this.dragStart);
    const b = toPx(this.dragCurrent);
    const st = this.boxEl.style;
    st.display = 'block';
    st.left = `${Math.min(a.x, b.x)}px`;
    st.top = `${Math.min(a.y, b.y)}px`;
    st.width = `${Math.abs(b.x - a.x)}px`;
    st.height = `${Math.abs(b.y - a.y)}px`;
  }

  private hideBoxHelper(): void {
    this.boxEl.style.display = 'none';
  }

  // ────────────────────────────────────────────────────────────── мир
  private buildTerrain(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2),
      new THREE.MeshLambertMaterial({ color: 0x40532f }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Препятствия: скалы, которые флоу-филд обязан обойти.
    const rockGeom = new THREE.DodecahedronGeometry(2.4, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x5b5750 });
    const rocks = new THREE.InstancedMesh(rockGeom, rockMat, 64);
    let n = 0;
    const seedRects = [
      { x: -12, z: 0, w: 3, h: 9 },
      { x: 14, z: -8, w: 8, h: 3 },
      { x: 6, z: 16, w: 4, h: 4 },
    ];
    for (const r of seedRects) {
      for (let i = 0; i < r.w; i++) {
        for (let j = 0; j < r.h; j++) {
          const wx = r.x + i * CELL;
          const wz = r.z + j * CELL;
          const { cx, cz } = this.field.cellOf(wx, wz);
          this.field.setBlocked(cx, cz, true);
          if (n < 64) {
            this.dummy.position.set(wx, 1, wz);
            this.dummy.rotation.set(Math.random(), Math.random(), Math.random());
            this.dummy.scale.setScalar(0.6 + Math.random() * 0.3);
            this.dummy.updateMatrix();
            rocks.setMatrixAt(n++, this.dummy.matrix);
          }
        }
      }
    }
    rocks.count = n;
    rocks.instanceMatrix.needsUpdate = true;
    rocks.castShadow = true;
    this.scene.add(rocks);

    // Отладка флоу-филда: половина багов навигации видна глазом за пять секунд.
    const pts: THREE.Vector3[] = [];
    for (let cz = 0; cz < COLS; cz += 2) {
      for (let cx = 0; cx < COLS; cx += 2) {
        const x = -MAP_HALF + (cx + 0.5) * CELL;
        const z = -MAP_HALF + (cz + 0.5) * CELL;
        pts.push(new THREE.Vector3(x, 0.2, z), new THREE.Vector3(x, 0.2, z + 1));
      }
    }
    this.fieldHelper = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x74b9ff }),
    );
    this.fieldHelper.visible = false;
    this.scene.add(this.fieldHelper);

    // Рамка выделения — DOM-слой, а не меш в сцене: в перспективной камере
    // экранный прямоугольник не выражается позицией объекта, а DOM даёт
    // пиксельно точную рамку бесплатно.
    this.boxEl = document.createElement('div');
    this.boxEl.className = 'selection-box';
    document.body.append(this.boxEl);
  }

  private buildPools(): void {
    const geom = new THREE.ConeGeometry(0.62, 1.7, 5);
    for (let team = 0; team < 2; team++) {
      const mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial(), MAX_UNITS);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.setColorAt(0, new THREE.Color(0xffffff));
      this.scene.add(mesh);
      this.teamMesh.push(mesh);
    }

    this.ringMesh = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.85, 1.05, 16),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }),
      MAX_UNITS,
    );
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 6;
    this.scene.add(this.ringMesh);
  }

  private spawnArmies(): void {
    this.units = [];
    this.selection = [];
    let id = 0;
    const roster: UnitClass[] = [
      ...Array(22).fill('infantry'), ...Array(8).fill('armored'), ...Array(6).fill('air'),
    ];
    for (let team = 0 as 0 | 1; team < 2; team++) {
      roster.forEach((cls, i) => {
        const spec = CLASSES[cls];
        const row = Math.floor(i / 9);
        const col = i % 9;
        this.units.push({
          id: id++,
          team: team as 0 | 1,
          cls,
          x: -14 + col * 3.4,
          z: team === 0 ? 26 + row * 3 : -26 - row * 3,
          hp: spec.hp, maxHp: spec.hp,
          speed: spec.speed, damage: spec.damage, range: spec.range,
          cooldown: Math.random(),
          heading: team === 0 ? Math.PI : 0,
          order: null, queue: [], selected: false, alive: true,
        });
      });
    }
  }

  private pushStatus(): void {
    const mine = this.units.filter((u) => u.team === 0 && u.alive).length;
    const foe = this.units.filter((u) => u.team === 1 && u.alive).length;
    const comp = this.selection.reduce<Record<string, number>>((acc, u) => {
      acc[u.cls] = (acc[u.cls] ?? 0) + 1; return acc;
    }, {});
    const compText = Object.entries(comp).map(([k, v]) => `${k}×${v}`).join(', ') || '—';
    this.ctx.setStatus(
      `Ваши <span class="hp">${mine}</span> · противник <b>${foe}</b>`
      + ` · выделено: ${compText}`
      + (this.lastOrderInfo ? ` · приказ: ${this.lastOrderInfo}` : '')
      + ` · пехота → авиация → бронетехника → пехота (×1.5)`,
    );
  }
}

const CLASS_COLORS: Record<UnitClass, [THREE.Color, THREE.Color]> = {
  infantry: [new THREE.Color(0x4aa3ff), new THREE.Color(0xff6b6b)],
  armored: [new THREE.Color(0x2e6da4), new THREE.Color(0xb33939)],
  air: [new THREE.Color(0x9b8cff), new THREE.Color(0xff9f43)],
};
