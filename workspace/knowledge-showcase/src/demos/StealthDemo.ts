import * as THREE from 'three';
import '../stack/bvhSetup';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  NOISE, SuspicionGauge, VISION, inVisionCone, isAudible, type GuardState,
} from '../game/stealthSensing';

const ARENA = 22;
const CONE_SEGMENTS = 24;
const EYE_Y = 1.55;
const PLAYER_SPEED = { sneak: 2.0, walk: 4.2, run: 7.0 };
/** Кадров между дорогими рейкастами одного охранника (10 Гц при 60 FPS). */
const RAY_INTERVAL = Math.round(60 / VISION.rayHz);

const STATE_COLOR: Record<GuardState, number> = {
  patrol: 0x2ecc71,
  suspicious: 0xf1c40f,
  investigating: 0xe67e22,
  alerted: 0xe74c3c,
};

interface ShadowZone { x: number; z: number; rx: number; rz: number }

class Guard {
  readonly gauge = new SuspicionGauge();
  readonly pos = new THREE.Vector3();
  facing = 0;
  waypoint = 0;
  /** Куда идти на подозрении — последняя известная позиция игрока. */
  readonly lastKnown = new THREE.Vector3();
  hasLastKnown = false;
  /** Пауза на точке маршрута, секунды. */
  wait = 0;
  visible = false;

  constructor(
    readonly root: THREE.Group,
    readonly cone: THREE.Mesh,
    readonly marker: THREE.Mesh,
    readonly path: THREE.Vector3[],
    readonly rayOffset: number,
  ) {
    this.pos.copy(path[0]);
  }
}

/**
 * Стелс: конусы зрения с перекрытием, шкала подозрения, шум и тени.
 *
 * Проверяет knowledge/threejs/stealth_and_vision_cones.md и
 * knowledge/mechanics/stealth_detection.md. Числа обнаружения живут в
 * `game/stealthSensing.ts` и проверяются головно: `npm run check:stealth`.
 *
 * Двухступенчатая проверка (дешёвый конус каждый кадр + дорогой рейкаст на
 * 10 Гц) — не оптимизация «на будущее», а условие работоспособности: наивный
 * рейкаст на каждого охранника каждый кадр съедает кадр на телефоне.
 */
export class StealthDemo implements Demo {
  readonly id = 'stealth';
  readonly title = ['👁️ Стелс и конусы зрения', '👁️ Stealth & vision cones'] as const;
  readonly hint = [
    '<b>WASD</b> движение · <b>Shift</b> красться (бесшумно) · <b>Space</b> бежать (слышно за 9 м)'
    + ' · <b>R</b> заново<br>Тени замедляют обнаружение в 2.5 раза. Дойди до жёлтой зоны, не подняв тревогу.',
    '<b>WASD</b> move · <b>Shift</b> sneak (silent) · <b>Space</b> run (heard from 9 m)'
    + ' · <b>R</b> restart<br>Shadows slow detection 2.5×. Reach the yellow zone without raising the alarm.',
  ] as const;
  readonly category = ['🧟 Выживание и стелс', '🧟 Survival & Stealth'] as const;
  readonly tags = ['стелс', 'зрение', 'конусы', 'патруль', 'тревога', 'тени', 'stealth', 'vision', 'guard', 'alarm'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 160);

  private ctx!: DemoContext;
  private guards: Guard[] = [];
  private shadows: ShadowZone[] = [];
  private occluders!: THREE.Mesh;
  private playerMesh!: THREE.Mesh;
  private readonly playerPos = new THREE.Vector3(0, 0, ARENA - 3);
  private goal = new THREE.Vector3(0, 0, -ARENA + 3);
  private goalMesh!: THREE.Mesh;

  private readonly raycaster = new THREE.Raycaster();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private frame = 0;
  private rays = 0;
  private raysPerSecond = 0;
  private coneRays = 0;
  private coneRaysPerSecond = 0;
  private noiseRadius = 0;
  private inShadow = false;
  private outcome: 'run' | 'caught' | 'escaped' = 'run';
  private elapsed = 0;
  private unsubscribe: (() => void) | null = null;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.Fog(0x0a0d14, 26, 60);

    const moon = new THREE.DirectionalLight(0xaac4ff, 1.1);
    moon.position.set(-8, 18, 6);
    this.scene.add(moon);
    this.scene.add(new THREE.HemisphereLight(0x33406a, 0x08090d, 0.7));

    this.buildLevel();
    this.buildGuards();

    this.playerMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.75, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x7fe0ff, emissive: 0x08303f, roughness: 0.5 }),
    );
    this.scene.add(this.playerMesh);

    this.goalMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.08, 20),
      new THREE.MeshBasicMaterial({ color: 0xf0c419, transparent: true, opacity: 0.55 }),
    );
    this.goalMesh.position.copy(this.goal).setY(0.05);
    this.scene.add(this.goalMesh);

    this.camera.position.set(0, 24, 18);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyR') this.restart();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    this.frame++;
    if (this.outcome !== 'run') return;
    this.elapsed += dt;

    this.movePlayer(dt);
    this.inShadow = this.shadows.some((s) =>
      Math.abs(this.playerPos.x - s.x) < s.rx && Math.abs(this.playerPos.z - s.z) < s.rz);

    for (const g of this.guards) this.updateGuard(g, dt);

    if (this.frame % 60 === 0) {
      this.raysPerSecond = this.rays;
      this.coneRaysPerSecond = this.coneRays;
      this.rays = 0;
      this.coneRays = 0;
    }

    if (this.playerPos.distanceTo(this.goal) < 1.6) {
      this.outcome = 'escaped';
      this.ctx.audio.playLevelUp();
    }
    this.pushStatus();
  }

  update(dt: number): void {
    this.playerMesh.position.set(this.playerPos.x, 0.75, this.playerPos.z);
    for (const g of this.guards) {
      g.root.position.set(g.pos.x, 0, g.pos.z);
      g.root.rotation.y = g.facing;
      const color = STATE_COLOR[g.gauge.state];
      (g.cone.material as THREE.MeshBasicMaterial).color.setHex(color);
      (g.marker.material as THREE.MeshBasicMaterial).color.setHex(color);
      g.marker.scale.setScalar(0.6 + g.gauge.value / 120);
    }
    this.goalMesh.rotation.y += dt;

    const k = 1 - Math.exp(-5 * dt);
    this.camera.position.x += (this.playerPos.x * 0.4 - this.camera.position.x) * k;
    this.camera.position.z += (this.playerPos.z * 0.4 + 18 - this.camera.position.z) * k;
    this.camera.lookAt(this.playerPos.x * 0.4, 0, this.playerPos.z * 0.4);
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ─────────────────────────────────────────────────────────────── игрок
  private movePlayer(dt: number): void {
    const input = this.ctx.input;
    const mv = input.moveVector();
    const sneaking = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const running = input.isDown('Space');

    const speed = sneaking ? PLAYER_SPEED.sneak : running ? PLAYER_SPEED.run : PLAYER_SPEED.walk;
    this.noiseRadius = mv.lengthSq() === 0 ? 0
      : sneaking ? NOISE.sneak : running ? NOISE.run : NOISE.walk;

    const nx = THREE.MathUtils.clamp(this.playerPos.x + mv.x * speed * dt, -ARENA, ARENA);
    const nz = THREE.MathUtils.clamp(this.playerPos.z + mv.y * speed * dt, -ARENA, ARENA);
    // Стены непроходимы: проверяем оси раздельно, иначе игрок залипает в углу.
    if (!this.blocked(nx, this.playerPos.z)) this.playerPos.x = nx;
    if (!this.blocked(this.playerPos.x, nz)) this.playerPos.z = nz;
  }

  private blocked(x: number, z: number): boolean {
    this.tmpA.set(x, 0.9, z);
    for (const box of this.wallBoxes) if (box.containsPoint(this.tmpA)) return true;
    return false;
  }

  // ────────────────────────────────────────────────────────────── охранники
  private updateGuard(g: Guard, dt: number): void {
    const dx = this.playerPos.x - g.pos.x;
    const dz = this.playerPos.z - g.pos.z;
    const dist = Math.hypot(dx, dz);

    // Ступень 1: скалярное произведение, каждый кадр, копейки.
    const inCone = inVisionCone(dx, dz, g.facing);

    // Ступень 2: рейкаст сквозь стены — только если ступень 1 прошла,
    // и только 10 раз в секунду. Смещение по охраннику разносит нагрузку
    // по кадрам, иначе все восемь рейкастов приходятся на один кадр.
    if (inCone && (this.frame + g.rayOffset) % RAY_INTERVAL === 0) {
      g.visible = this.hasLineOfSight(g);
      this.rays++;
    } else if (!inCone) {
      g.visible = false;
    }

    const heard = this.noiseRadius > 0 && isAudible(dist, this.noiseRadius);
    const state = g.gauge.update(dt, g.visible && inCone, dist, this.inShadow, heard);

    if (g.visible || heard) {
      g.lastKnown.copy(this.playerPos);
      g.hasLastKnown = true;
    }

    switch (state) {
      case 'alerted':
        this.moveGuard(g, this.playerPos, 5.2, dt);
        if (dist < 1.2) { this.outcome = 'caught'; this.ctx.audio.playAlarm(); }
        break;
      case 'investigating':
        if (g.hasLastKnown) {
          this.moveGuard(g, g.lastKnown, 3.6, dt);
          // Дошёл до точки и никого нет — осмотреться, а не стоять столбом.
          if (g.pos.distanceTo(g.lastKnown) < 0.8) { g.facing += dt * 1.6; g.hasLastKnown = false; }
        } else {
          g.facing += dt * 1.6;
        }
        break;
      default:
        this.patrol(g, dt);
        break;
    }

    this.rebuildCone(g);
  }

  private patrol(g: Guard, dt: number): void {
    if (g.wait > 0) {
      g.wait -= dt;
      // На паузе охранник осматривается — статичный конус читается как «спит».
      g.facing += dt * 0.9;
      return;
    }
    const target = g.path[g.waypoint];
    this.moveGuard(g, target, 2.4, dt);
    if (g.pos.distanceTo(target) < 0.5) {
      g.waypoint = (g.waypoint + 1) % g.path.length;
      g.wait = 1.4;
    }
  }

  private moveGuard(g: Guard, target: THREE.Vector3, speed: number, dt: number): void {
    const dx = target.x - g.pos.x;
    const dz = target.z - g.pos.z;
    const d = Math.hypot(dx, dz) || 1e-5;
    g.pos.x += (dx / d) * speed * dt;
    g.pos.z += (dz / d) * speed * dt;
    // Поворот головы плавный: мгновенный разворот выглядит как телепорт конуса.
    const want = Math.atan2(dx, dz);
    let diff = want - g.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.facing += THREE.MathUtils.clamp(diff, -3.5 * dt, 3.5 * dt);
  }

  /** Дорогая проверка: не мешает ли стена. Один луч на охранника. */
  private hasLineOfSight(g: Guard): boolean {
    this.tmpA.set(g.pos.x, EYE_Y, g.pos.z);
    this.tmpB.set(this.playerPos.x - g.pos.x, 1.0 - EYE_Y, this.playerPos.z - g.pos.z);
    const dist = this.tmpB.length();
    this.raycaster.set(this.tmpA, this.tmpB.normalize());
    this.raycaster.far = dist;
    // BVH стоит на слитом меше стен: без него это перебор всех треугольников.
    return this.raycaster.intersectObject(this.occluders, false).length === 0;
  }

  /**
   * Перестройка меша конуса с учётом стен.
   *
   * Буфер выделен ОДИН раз: пересоздавать `Float32BufferAttribute` каждый кадр
   * на каждого охранника — это мусор в куче и пила сборщика мусора.
   * Конусы перестраиваются по очереди, один охранник в кадр.
   */
  private rebuildCone(g: Guard): void {
    if (this.frame % this.guards.length !== this.guards.indexOf(g)) return;

    const geom = g.cone.geometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const half = VISION.halfAngle;

    // Вершины пишутся в МИРОВЫХ координатах: меш конуса лежит в сцене, а не
    // в группе охранника. Смешивать одно с другим — классическая ошибка:
    // конус либо остаётся у начала координат, либо поворачивается дважды.
    arr[0] = g.pos.x; arr[1] = 0.06; arr[2] = g.pos.z;
    for (let i = 0; i <= CONE_SEGMENTS; i++) {
      const a = g.facing - half + (i / CONE_SEGMENTS) * half * 2;
      const dirX = Math.sin(a);
      const dirZ = Math.cos(a);
      this.tmpA.set(g.pos.x, EYE_Y, g.pos.z);
      this.tmpB.set(dirX, 0, dirZ);
      this.raycaster.set(this.tmpA, this.tmpB);
      this.raycaster.far = VISION.range;
      const hit = this.raycaster.intersectObject(this.occluders, false)[0];
      this.coneRays++;
      const dist = hit ? hit.distance : VISION.range;
      const o = (i + 1) * 3;
      arr[o] = g.pos.x + dirX * dist;
      arr[o + 1] = 0.06;
      arr[o + 2] = g.pos.z + dirZ * dist;
    }
    pos.needsUpdate = true;
    geom.computeBoundingSphere();
  }

  // ──────────────────────────────────────────────────────────── уровень
  private readonly wallBoxes: THREE.Box3[] = [];

  private buildLevel(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4),
      new THREE.MeshStandardMaterial({ color: 0x232a38, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Стены одним слитым мешем: BVH строится по нему, рейкаст идёт по одному
    // объекту вместо десятка (knowledge/stack/three_mesh_bvh.md).
    const layout: Array<[number, number, number, number]> = [
      [-10, 6, 8, 1], [10, 6, 8, 1],
      [-4, -2, 1, 9], [4, -2, 1, 9],
      [-12, -10, 7, 1], [12, -10, 7, 1],
      [0, 12, 6, 1], [-16, 2, 1, 7], [16, 2, 1, 7],
    ];
    const geoms: THREE.BufferGeometry[] = [];
    for (const [x, z, hx, hz] of layout) {
      const g = new THREE.BoxGeometry(hx * 2, 3, hz * 2);
      g.translate(x, 1.5, z);
      geoms.push(g);
      this.wallBoxes.push(new THREE.Box3(
        new THREE.Vector3(x - hx - 0.34, 0, z - hz - 0.34),
        new THREE.Vector3(x + hx + 0.34, 3, z + hz + 0.34),
      ));
    }
    const merged = mergeGeometries(geoms);
    merged.computeBoundsTree({ targetLeafSize: 8 });
    this.occluders = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: 0x39445c, roughness: 0.9 }),
    );
    this.occluders.castShadow = true;
    this.scene.add(this.occluders);

    // Тени: зоны, в которых подозрение копится в 2.5 раза медленнее.
    this.shadows = [
      { x: -12, z: 10, rx: 4, rz: 3 },
      { x: 13, z: -2, rx: 3, rz: 4 },
      { x: 0, z: 2, rx: 3.5, rz: 2.5 },
      { x: -8, z: -14, rx: 4, rz: 3 },
    ];
    for (const s of this.shadows) {
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(s.rx * 2, s.rz * 2),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(s.x, 0.02, s.z);
      this.scene.add(patch);
    }
  }

  private buildGuards(): void {
    const routes: THREE.Vector3[][] = [
      [new THREE.Vector3(-14, 0, 14), new THREE.Vector3(-14, 0, 0), new THREE.Vector3(-6, 0, 0)],
      [new THREE.Vector3(14, 0, 12), new THREE.Vector3(14, 0, -6), new THREE.Vector3(6, 0, -6)],
      [new THREE.Vector3(-8, 0, -16), new THREE.Vector3(8, 0, -16), new THREE.Vector3(0, 0, -8)],
      [new THREE.Vector3(0, 0, 8), new THREE.Vector3(-10, 0, 16), new THREE.Vector3(10, 0, 16)],
    ];

    for (let i = 0; i < routes.length; i++) {
      const root = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.36, 0.8, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xb0402f, roughness: 0.75 }),
      );
      body.position.y = 0.8;
      root.add(body);

      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: STATE_COLOR.patrol }),
      );
      marker.position.y = 2.2;
      root.add(marker);

      // Буфер конуса выделяется один раз и переиспользуется.
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array((CONE_SEGMENTS + 2) * 3), 3));
      const idx: number[] = [];
      for (let s = 1; s <= CONE_SEGMENTS; s++) idx.push(0, s, s + 1);
      geom.setIndex(idx);
      const cone = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
        color: STATE_COLOR.patrol, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      // Конус живёт в мировых координатах: он уже построен с учётом поворота.
      this.scene.add(cone);

      const guard = new Guard(root, cone, marker, routes[i], i);
      this.scene.add(root);
      this.guards.push(guard);
    }
  }

  private restart(): void {
    this.playerPos.set(0, 0, ARENA - 3);
    this.outcome = 'run';
    this.elapsed = 0;
    for (const g of this.guards) {
      g.gauge.reset();
      g.pos.copy(g.path[0]);
      g.waypoint = 0;
      g.wait = 0;
      g.hasLastKnown = false;
      g.visible = false;
    }
  }

  private pushStatus(): void {
    if (this.outcome === 'escaped') {
      this.ctx.setStatus(`<b>Прошёл</b> за ${this.elapsed.toFixed(1)} с. <b>R</b> — заново.`);
      return;
    }
    if (this.outcome === 'caught') {
      this.ctx.setStatus('<b>Замечен</b> — охрана взяла. <b>R</b> — заново.');
      return;
    }
    const worst = this.guards.reduce((m, g) => Math.max(m, g.gauge.value), 0);
    const states = this.guards.map((g) => g.gauge.state[0].toUpperCase()).join('');
    this.ctx.setStatus(
      `Тревога <b>${worst.toFixed(0)}%</b> · охранники <b>${states}</b>`
      + ` · ${this.inShadow ? '<b>в тени</b> (×2.5 медленнее)' : 'на свету'}`
      + ` · шум <b>${this.noiseRadius} м</b>`
      + ` · рейкастов обнаружения/с <b>${this.raysPerSecond}</b>`
      + ` (наивно было бы ${this.guards.length * 60})`
      + ` · на отрисовку конусов <b>${this.coneRaysPerSecond}</b>`
      + ` · ${this.elapsed.toFixed(1)} с`,
    );
  }
}

/** Слияние коробок в один меш без BufferGeometryUtils: нужны только позиции. */
function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of geoms) {
    vertexCount += g.getAttribute('position').count;
    indexCount += g.getIndex()!.count;
  }
  const pos = new Float32Array(vertexCount * 3);
  const norm = new Float32Array(vertexCount * 3);
  const idx = new Uint32Array(indexCount);
  let vo = 0;
  let io = 0;
  for (const g of geoms) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const i = g.getIndex()!;
    pos.set(p.array as Float32Array, vo * 3);
    norm.set(n.array as Float32Array, vo * 3);
    for (let k = 0; k < i.count; k++) idx[io + k] = i.getX(k) + vo;
    vo += p.count;
    io += i.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
