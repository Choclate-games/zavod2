import * as THREE from 'three';
import type { GeometryBVH, MeshBVH } from 'three-mesh-bvh';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { buildCanyon, mulberry32 } from '../world/bvhLevel';
// Ставит расширения BVH на прототипы three. После этого ОБЫЧНЫЙ Raycaster
// ускоряется автоматически для мешей с computeBoundsTree().
import '../stack/bvhSetup';


const BENCH_RAYS = 400;
const CAPSULE_RADIUS = 0.55;
const GRAVITY = -22;

/**
 * three-mesh-bvh: ускоренный рейкаст по тяжёлой статике и капсульный контроллер.
 *
 * Демо намеренно даёт переключатель BVH: разница в миллисекундах на одном и том
 * же меше — самый честный аргумент против «упростим уровень до коробок».
 */
export class BvhDemo implements Demo {
  readonly id = 'bvh';
  readonly title = ['🎯 BVH: рейкаст и капсула', '🎯 BVH: raycast and capsule'] as const;
  readonly hint = [
    '<b>WASD</b> ходьба по мешу (капсула через shapecast) · <b>Space</b> прыжок · <b>ЛКМ</b> выстрел-отметина · <b>B</b> включить/выключить BVH · <b>V</b> показать дерево',
    '<b>WASD</b> walk the mesh (capsule via shapecast) · <b>Space</b> jump · <b>LMB</b> shoot a decal · <b>B</b> toggle BVH · <b>V</b> show the tree',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);

  private ctx!: DemoContext;
  private level!: THREE.Mesh;
  private bvh: GeometryBVH | undefined;
  private bvhEnabled = true;
  private triangles = 0;

  private decals!: THREE.InstancedMesh;
  private decalCount = 0;
  private readonly maxDecals = 64;

  // Капсульный контроллер
  private readonly playerPos = new THREE.Vector3(0, 12, 26);
  private readonly velocity = new THREE.Vector3();
  private grounded = false;
  private yaw = Math.PI;
  private pitch = -0.15;

  private benchMs = 0;
  private benchLabel = '';
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;

  private readonly raycaster = new THREE.Raycaster();
  private readonly dummy = new THREE.Object3D();
  private readonly segment = new THREE.Line3(
    new THREE.Vector3(0, CAPSULE_RADIUS, 0),
    new THREE.Vector3(0, 1.75 - CAPSULE_RADIUS, 0),
  );
  private readonly tmpBox = new THREE.Box3();
  private readonly tmpSeg = new THREE.Line3();
  private readonly tmpVecA = new THREE.Vector3();
  private readonly tmpVecB = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x1a1520);
    this.scene.fog = new THREE.Fog(0x1a1520, 60, 220);

    const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
    sun.position.set(40, 60, -20);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0x6d7fd6, 0x2a1d18, 1.2));

    const { geometry, triangles } = buildCanyon();
    this.triangles = triangles;

    // Строим BVH НА ЭКРАНЕ ЗАГРУЗКИ, а не при первом выстреле: 100k треугольников
    // — это десятки миллисекунд, и первый клик дал бы фриз.
    geometry.computeBoundsTree({ targetLeafSize: 12 });
    this.bvh = geometry.boundsTree;

    this.level = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
      color: 0x8a6f5c, vertexColors: false,
    }));
    this.level.receiveShadow = true;
    this.level.castShadow = true;
    this.scene.add(this.level);

    this.decals = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.35, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }),
      this.maxDecals,
    );
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.frustumCulled = false;
    this.decals.count = 0;
    this.scene.add(this.decals);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyB') this.toggleBvh();
      if (code === 'KeyV') this.toggleHelper();
      if (code === 'Space' && this.grounded) { this.velocity.y = 9; this.grounded = false; }
      if (code === 'KeyR') { this.playerPos.set(0, 12, 26); this.velocity.set(0, 0, 0); }
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    this.stepPlayer(dt);
    this.benchmark();
  }

  update(dt: number): void {
    this.aimCamera(dt);
    this.handleShooting();
    this.statusTimer += dt;
    if (this.statusTimer > 0.2) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    this.level.geometry.disposeBoundsTree?.();     // рядом с dispose геометрии
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ───────────────────────────────────────────────── капсульный контроллер
  private stepPlayer(dt: number): void {
    const input = this.ctx.input;
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.right.set(this.forward.z, 0, -this.forward.x);

    const move = input.moveVector();
    const speed = 9;
    this.velocity.x = (this.forward.x * -move.y + this.right.x * move.x) * speed;
    this.velocity.z = (this.forward.z * -move.y + this.right.z * move.x) * speed;
    this.velocity.y += GRAVITY * dt;

    this.playerPos.addScaledVector(this.velocity, dt);
    this.grounded = this.resolveCapsule();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;

    if (this.playerPos.y < -40) { this.playerPos.set(0, 12, 26); this.velocity.set(0, 0, 0); }
  }

  /**
   * Выталкивание капсулы из геометрии через shapecast — эталонный приём из
   * официального примера characterMovement (knowledge/stack/three_mesh_bvh.md §4).
   */
  private resolveCapsule(): boolean {
    // Приведение к MeshBVH обязательно: у GeometryBVH колбэк intersectsTriangle
    // помечен deprecated и не типизирован (см. three-mesh-bvh/src/index.d.ts).
    const bvh = this.level.geometry.boundsTree as MeshBVH | undefined;
    if (!bvh) return false;                       // с выключенным BVH ходьба невозможна

    // Уровень стоит в начале координат без поворота, поэтому мировые координаты
    // совпадают с локальными. В общем случае здесь нужна matrixWorld.invert().
    this.tmpSeg.copy(this.segment);
    this.tmpSeg.start.add(this.playerPos);
    this.tmpSeg.end.add(this.playerPos);
    this.tmpBox.setFromPoints([this.tmpSeg.start, this.tmpSeg.end]).expandByScalar(CAPSULE_RADIUS);

    let grounded = false;
    const triPoint = this.tmpVecA;
    const capPoint = this.tmpVecB;

    bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(this.tmpBox),
      intersectsTriangle: (tri) => {
        const dist = tri.closestPointToSegment(this.tmpSeg, triPoint, capPoint);
        if (dist < CAPSULE_RADIUS) {
          const depth = CAPSULE_RADIUS - dist;
          const dir = capPoint.sub(triPoint).normalize();
          this.tmpSeg.start.addScaledVector(dir, depth);
          this.tmpSeg.end.addScaledVector(dir, depth);
          if (dir.y > 0.5) grounded = true;       // выталкивает вверх => это пол
        }
        return false;
      },
    });

    this.playerPos.copy(this.tmpSeg.start).sub(this.segment.start);
    return grounded;
  }

  private aimCamera(dt: number): void {
    const input = this.ctx.input;
    if (input.isPointerLocked) {
      const d = input.consumeLockDelta();
      this.yaw -= d.x * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - d.y * 0.0022, -1.2, 0.9);
    }
    // Камера от третьего лица: видно и капсулу, и геометрию, по которой она ходит.
    const dist = 6.5;
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const target = this.playerPos.clone().addScaledVector(dir, -dist).add(new THREE.Vector3(0, 2.2, 0));
    this.camera.position.lerp(target, 1 - Math.exp(-12 * dt));
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
  }

  private handleShooting(): void {
    const pointer = this.ctx.input.primary;
    if (!pointer?.down || this.shotHandled) { if (!pointer?.down) this.shotHandled = false; return; }
    this.shotHandled = true;

    this.raycaster.setFromCamera(pointer.ndc, this.camera);
    // firstHitOnly: останавливаемся на первом попадании и не аллоцируем массив
    // всех пересечений — для пуль и прицела всегда так.
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.level, false)[0];
    if (!hit) return;

    this.dummy.position.copy(hit.point).addScaledVector(hit.face!.normal, 0.02);
    this.dummy.lookAt(this.dummy.position.clone().add(hit.face!.normal));
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.decals.setMatrixAt(this.decalCount % this.maxDecals, this.dummy.matrix);
    this.decalCount++;
    // Кольцевой буфер: без потолка декали растут всю сессию.
    this.decals.count = Math.min(this.decalCount, this.maxDecals);
    this.decals.instanceMatrix.needsUpdate = true;
    this.ctx.audio.playGunshot(1.2, 0.4);
    this.ctx.addTrauma(0.06);
  }

  private shotHandled = false;

  // ─────────────────────────────────────────────────────────── бенчмарк
  private readonly benchRay = new THREE.Raycaster();
  private benchSeed = mulberry32(7);

  /**
   * Честный A/B: те же лучи по тому же мешу, разница только в наличии BVH.
   * Именно эта цифра отвечает на вопрос «а нужен ли нам BVH».
   */
  private benchmark(): void {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const rng = this.benchSeed;
    const start = performance.now();

    for (let i = 0; i < BENCH_RAYS; i++) {
      origin.set((rng() - 0.5) * 90, 25 + rng() * 15, (rng() - 0.5) * 90);
      dir.set(rng() - 0.5, -1, rng() - 0.5).normalize();
      this.benchRay.set(origin, dir);
      (this.benchRay as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
      this.benchRay.intersectObject(this.level, false);
    }

    // Экспоненциальное сглаживание: мгновенное число прыгает и нечитаемо.
    const ms = performance.now() - start;
    this.benchMs = this.benchMs === 0 ? ms : this.benchMs * 0.9 + ms * 0.1;
    this.benchLabel = this.bvhEnabled ? 'BVH' : 'перебор';
  }

  private toggleBvh(): void {
    this.bvhEnabled = !this.bvhEnabled;
    // Снимаем ссылку, а не пересобираем дерево: acceleratedRaycast сам
    // откатывается на встроенный перебор, когда boundsTree отсутствует.
    this.level.geometry.boundsTree = this.bvhEnabled ? this.bvh : undefined;
    this.benchMs = 0;
    if (!this.bvhEnabled) this.ctx.audio.playAlarm();
  }

  private helper: THREE.Object3D | null = null;

  private async toggleHelper(): Promise<void> {
    if (this.helper) {
      this.helper.visible = !this.helper.visible;
      return;
    }
    const { BVHHelper } = await import('three-mesh-bvh');
    this.helper = new BVHHelper(this.level, 12);
    this.scene.add(this.helper);
  }

  private pushStatus(): void {
    const perRay = (this.benchMs / BENCH_RAYS) * 1000;
    this.ctx.setStatus(
      `Треугольников в меше: <b>${this.triangles.toLocaleString('ru')}</b>`
      + ` · ${BENCH_RAYS} лучей за кадр: <span class="hp">${this.benchMs.toFixed(2)} мс</span>`
      + ` (${perRay.toFixed(1)} мкс на луч, режим <b>${this.benchLabel}</b>)`
      + ` · на земле: ${this.grounded ? 'да' : 'нет'}`
      + (this.bvhEnabled ? '' : ' · <b>BVH выключен — ходьба недоступна, капсула требует shapecast</b>'),
    );
  }
}
