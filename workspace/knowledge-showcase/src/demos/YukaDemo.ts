import * as THREE from 'three';
import * as YUKA from 'yuka';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';

const FLOCK = 140;
const ARENA = 42;

/**
 * Yuka: steering-поведения, конечный автомат, восприятие и рой.
 *
 * Прямая проверка knowledge/stack/yuka_ai.md. Ключевая мысль демо: ни одна
 * строчка «векторной математики ИИ» здесь не написана руками — рой это
 * Separation + Alignment + Cohesion, погоня это Pursuit, патруль это FollowPath.
 */
export class YukaDemo implements Demo {
  readonly id = 'yuka';
  readonly title = ['🧠 Yuka: steering и автомат', '🧠 Yuka: steering and FSM'] as const;
  readonly hint = [
    '<b>WASD</b> двигать игрока · охранник патрулирует, замечает вас конусом зрения и переходит в погоню · <b>Space</b> «спрятаться» (охранник помнит последнюю позицию 4 с) · <b>1</b>/<b>2</b>/<b>3</b> поведение роя',
    '<b>WASD</b> move the player · the guard patrols, spots you with a vision cone and switches to pursuit · <b>Space</b> hide (guard remembers your last position for 4s) · <b>1</b>/<b>2</b>/<b>3</b> flock behaviour',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.5, 400);

  private ctx!: DemoContext;
  private entityManager = new YUKA.EntityManager();
  private time = new YUKA.Time();

  private player!: YUKA.MovingEntity;
  private playerMesh!: THREE.Mesh;
  private guard!: Guard;
  private guardMesh!: THREE.Group;
  private visionCone!: THREE.Mesh;

  private flock: YUKA.Vehicle[] = [];
  private flockMesh!: THREE.InstancedMesh;
  private flockMode: 'boids' | 'chase' | 'scatter' = 'boids';

  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;
  private hiding = false;

  private readonly dummy = new THREE.Object3D();
  private readonly tmp = new THREE.Vector3();

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x161d24);
    this.scene.fog = new THREE.Fog(0x161d24, 60, 170);

    const sun = new THREE.DirectionalLight(0xffeccf, 2.2);
    sun.position.set(24, 45, 18);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0x8fb4d6, 0x1a2028, 1.2));

    this.buildArena();
    this.buildPlayer();
    this.buildGuard();
    this.buildFlock();

    this.camera.position.set(0, 52, 46);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'Digit1') this.setFlockMode('boids');
      if (code === 'Digit2') this.setFlockMode('chase');
      if (code === 'Digit3') this.setFlockMode('scatter');
      if (code === 'Space') this.hiding = !this.hiding;
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  update(dt: number): void {
    // Игрок — обычная сущность Yuka: так рой и охранник видят его через те же
    // механизмы (Pursuit/Vision), а не через ссылку на «объект игрока».
    const move = this.ctx.input.moveVector();
    this.player.velocity.set(move.x * 14, 0, move.y * 14);
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -ARENA, ARENA);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -ARENA, ARENA);

    this.updatePerception();

    // ОДИН вызов на всех агентов: своего цикла `for (e of enemies) e.think()` нет.
    this.entityManager.update(this.time.update().getDelta());

    this.syncFlock();
    this.syncVisionCone();

    this.statusTimer += dt;
    if (this.statusTimer > 0.15) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ─────────────────────────────────────────────────────────────── сцена
  private buildArena(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2 + 12, ARENA * 2 + 12),
      new THREE.MeshLambertMaterial({ color: 0x2b3a2c }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Колонны: препятствия и для steering, и для проверки прямой видимости.
    const pillars = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(2.2, 2.4, 7, 8),
      new THREE.MeshLambertMaterial({ color: 0x55606b }),
      6,
    );
    PILLARS.forEach((p, i) => {
      this.dummy.position.set(p.x, 3.5, p.z);
      this.dummy.rotation.set(0, i, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      pillars.setMatrixAt(i, this.dummy.matrix);
      // Те же колонны как препятствия для ObstacleAvoidanceBehavior.
      const obstacle = new YUKA.GameEntity();
      obstacle.position.set(p.x, 0, p.z);
      obstacle.boundingRadius = 3.2;
      this.entityManager.add(obstacle);
      this.obstacles.push(obstacle);
    });
    pillars.instanceMatrix.needsUpdate = true;
    pillars.castShadow = true;
    this.scene.add(pillars);
  }

  private obstacles: YUKA.GameEntity[] = [];

  private buildPlayer(): void {
    this.playerMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.9, 1.6, 4, 10),
      new THREE.MeshLambertMaterial({ color: 0x4aa3ff, emissive: 0x0a2036 }),
    );
    this.playerMesh.castShadow = true;
    this.scene.add(this.playerMesh);

    this.player = new YUKA.MovingEntity();
    this.player.position.set(0, 1.4, 22);
    this.player.boundingRadius = 1.2;
    this.player.setRenderComponent(this.playerMesh, syncTransform);
    this.entityManager.add(this.player);
  }

  private buildGuard(): void {
    this.guardMesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.6, 6),
      new THREE.MeshLambertMaterial({ color: 0xe74c3c }),
    );
    body.castShadow = true;
    this.guardMesh.add(body);
    this.scene.add(this.guardMesh);

    this.guard = new Guard(this.player);
    this.guard.position.set(-20, 1.4, -20);
    this.guard.maxSpeed = 9;
    this.guard.maxForce = 32;
    this.guard.boundingRadius = 1.4;
    this.guard.setRenderComponent(this.guardMesh, syncTransform);

    // Патруль — FollowPath по замкнутому маршруту, а не свои waypoint-таймеры.
    const path = new YUKA.Path();
    path.loop = true;
    for (const p of PATROL) path.add(new YUKA.Vector3(p.x, 1.4, p.z));
    this.guard.patrol = new YUKA.FollowPathBehavior(path, 2.5);
    this.guard.pursuit = new YUKA.PursuitBehavior(this.player, 1.6);
    this.guard.arrive = new YUKA.ArriveBehavior(new YUKA.Vector3(), 3, 1.2);

    const avoid = new YUKA.ObstacleAvoidanceBehavior(this.obstacles);
    avoid.weight = 3;
    this.guard.steering.add(avoid);

    this.guard.vision = new YUKA.Vision(this.guard);
    this.guard.vision.fieldOfView = THREE.MathUtils.degToRad(95);
    this.guard.vision.range = 26;

    this.guard.memory = new YUKA.MemorySystem(this.guard);
    this.guard.memory.memorySpan = 4;
    // createRecord ОБЯЗАТЕЛЕН: getRecord() возвращает undefined для сущности,
    // о которой записи ещё нет, и первое же обращение к памяти падает.
    this.guard.memory.createRecord(this.player);

    this.guard.stateMachine.add('patrol', new PatrolState());
    this.guard.stateMachine.add('chase', new ChaseState());
    this.guard.stateMachine.add('search', new SearchState());
    this.guard.stateMachine.changeTo('patrol');
    this.entityManager.add(this.guard);

    this.visionCone = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd166, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.scene.add(this.visionCone);
  }

  private buildFlock(): void {
    this.flockMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.42, 1.1, 4),
      new THREE.MeshLambertMaterial({ color: 0x2ecc71 }),
      FLOCK,
    );
    this.flockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flockMesh.frustumCulled = false;
    this.scene.add(this.flockMesh);

    // Пространственное разбиение: без него поиск соседей деградирует в O(n²)
    // уже на 200 агентах (knowledge/stack/yuka_ai.md §2).
    this.entityManager.spatialIndex = new YUKA.CellSpacePartitioning(
      ARENA * 2 + 12, 20, ARENA * 2 + 12, 12, 2, 12,
    );

    for (let i = 0; i < FLOCK; i++) {
      const v = new YUKA.Vehicle();
      v.position.set((Math.random() - 0.5) * 60, 4 + Math.random() * 6, (Math.random() - 0.5) * 60);
      v.maxSpeed = 12 + Math.random() * 3;
      v.maxForce = 40;
      v.boundingRadius = 0.6;
      v.updateNeighborhood = true;
      v.neighborhoodRadius = 5;
      v.smoother = new YUKA.Smoother(12);   // сглаживание курса вместо дёрганья
      this.flock.push(v);
      this.entityManager.add(v);
    }
    this.setFlockMode('boids');
  }

  // ────────────────────────────────────────────────────────── поведение
  private setFlockMode(mode: 'boids' | 'chase' | 'scatter'): void {
    this.flockMode = mode;
    for (const v of this.flock) {
      v.steering.clear();

      // Разделение нужно во всех режимах: без него рой схлопывается в точку.
      const separation = new YUKA.SeparationBehavior();
      separation.weight = mode === 'scatter' ? 6 : 3;
      v.steering.add(separation);

      if (mode === 'boids') {
        const alignment = new YUKA.AlignmentBehavior();
        alignment.weight = 1.4;
        const cohesion = new YUKA.CohesionBehavior();
        cohesion.weight = 1;
        const wander = new YUKA.WanderBehavior(3, 2, 3);
        wander.weight = 0.6;
        v.steering.add(alignment);
        v.steering.add(cohesion);
        v.steering.add(wander);
      } else if (mode === 'chase') {
        const pursuit = new YUKA.PursuitBehavior(this.player, 1.2);
        pursuit.weight = 2.4;
        v.steering.add(pursuit);
      } else {
        const flee = new YUKA.FleeBehavior(this.player.position, 26);
        flee.weight = 3;
        v.steering.add(flee);
        const wander = new YUKA.WanderBehavior(4, 3, 4);
        wander.weight = 1;
        v.steering.add(wander);
      }
    }
    this.ctx.audio.playButtonClick();
  }

  private syncFlock(): void {
    for (let i = 0; i < this.flock.length; i++) {
      const v = this.flock[i];
      // Границы арены: Yuka сама не знает про стены мира.
      v.position.x = THREE.MathUtils.clamp(v.position.x, -ARENA, ARENA);
      v.position.z = THREE.MathUtils.clamp(v.position.z, -ARENA, ARENA);
      v.position.y = THREE.MathUtils.clamp(v.position.y, 3, 12);

      this.dummy.position.set(v.position.x, v.position.y, v.position.z);
      this.dummy.rotation.set(0, Math.atan2(v.velocity.x, v.velocity.z), 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.flockMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.flockMesh.count = this.flock.length;
    this.flockMesh.instanceMatrix.needsUpdate = true;
  }

  private syncVisionCone(): void {
    const range = this.guard.vision!.range;
    const half = this.guard.vision!.fieldOfView / 2;
    const radius = Math.tan(half) * range;
    this.visionCone.scale.set(radius, range, radius);
    this.visionCone.position.set(this.guard.position.x, 1.2, this.guard.position.z);

    const dir = new THREE.Vector3(this.guard.velocity.x, 0, this.guard.velocity.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    // Конус смотрит вдоль -Y, поэтому кладём его набок и доворачиваем по курсу.
    this.visionCone.rotation.set(Math.PI / 2, 0, 0);
    this.visionCone.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(dir.x, dir.z));
    this.visionCone.translateY(-range / 2);

    const state = this.guard.stateName;
    (this.visionCone.material as THREE.MeshBasicMaterial).color.setHex(
      state === 'chase' ? 0xff5c5c : state === 'search' ? 0xffa94d : 0xffd166,
    );
  }

  /**
   * Восприятие: угол и дальность отдаём Yuka `Vision`, а прямую видимость
   * проверяем сами по колоннам. На сложной геометрии здесь был бы луч через
   * three-mesh-bvh — он дешевле, чем MeshGeometry-препятствия Yuka
   * (knowledge/stack/yuka_ai.md §4).
   */
  private updatePerception(): void {
    const inCone = this.guard.vision!.visible(this.player.position);
    this.guard.playerVisible = !this.hiding && inCone && this.hasLineOfSight();

    if (this.guard.playerVisible) {
      // Запись в память — единственный источник «ищет там, где видел».
      const record = this.guard.memory!.getRecord(this.player);
      if (record) {
        record.timeLastSensed = this.time.getElapsed();
        record.lastSensedPosition.copy(this.player.position);
      }
    }
  }

  private hasLineOfSight(): boolean {
    const ax = this.guard.position.x, az = this.guard.position.z;
    const bx = this.player.position.x, bz = this.player.position.z;
    for (const p of PILLARS) {
      // Отрезок «охранник → игрок» против окружности колонны.
      const abx = bx - ax, abz = bz - az;
      const lenSq = abx * abx + abz * abz;
      const t = lenSq < 1e-6 ? 0
        : THREE.MathUtils.clamp(((p.x - ax) * abx + (p.z - az) * abz) / lenSq, 0, 1);
      const cx = ax + abx * t, cz = az + abz * t;
      if (Math.hypot(cx - p.x, cz - p.z) < 2.6) return false;
    }
    return true;
  }

  private pushStatus(): void {
    const record = this.guard.memory!.getRecord(this.player);
    const seenAgo = !record || record.timeLastSensed <= 0
      ? '—'
      : `${(this.time.getElapsed() - record!.timeLastSensed).toFixed(1)} с назад`;

    this.ctx.setStatus(
      `Охранник: <b>${STATE_RU[this.guard.stateName]}</b>`
      + ` · вас видит: ${this.guard.playerVisible ? '<span class="hp">да</span>' : 'нет'}`
      + ` · помнит: ${seenAgo} (memorySpan ${this.guard.memory!.memorySpan} с)`
      + ` · рой ${this.flock.length} агентов, режим <b>${MODE_RU[this.flockMode]}</b>`
      + (this.hiding ? ' · <b>вы спрятаны</b>' : ''),
    );
  }
}

// ────────────────────────────────────────────────────────── сущности Yuka

/** Охранник: Vehicle + StateMachine + Vision + MemorySystem. */
class Guard extends YUKA.Vehicle {
  stateMachine = new YUKA.StateMachine<Guard>(this);
  patrol!: YUKA.FollowPathBehavior;
  pursuit!: YUKA.PursuitBehavior;
  arrive!: YUKA.ArriveBehavior;
  playerVisible = false;
  stateName: 'patrol' | 'chase' | 'search' = 'patrol';

  constructor(readonly target: YUKA.MovingEntity) {
    super();
  }

  update(delta: number): this {
    // Только автомат: запись в память делает демо, у которого есть YUKA.Time.
    // EntityManager своего Time не хранит — брать его отсюда было бы гаданием.
    this.stateMachine.update();
    return super.update(delta);
  }
}

/**
 * enter/exit нужны не для красоты: именно там снимаются steering-поведения.
 * Самописный `switch (mode)` не снимает прошлое поведение, и NPC начинает
 * одновременно убегать и догонять — «враг дрожит на месте».
 */
class PatrolState extends YUKA.State<Guard> {
  enter(g: Guard): void { g.stateName = 'patrol'; g.steering.add(g.patrol); g.maxSpeed = 7; }
  execute(g: Guard): void { if (g.playerVisible) g.stateMachine.changeTo('chase'); }
  exit(g: Guard): void { g.steering.remove(g.patrol); }
}

class ChaseState extends YUKA.State<Guard> {
  enter(g: Guard): void { g.stateName = 'chase'; g.steering.add(g.pursuit); g.maxSpeed = 12; }
  execute(g: Guard): void { if (!g.playerVisible) g.stateMachine.changeTo('search'); }
  exit(g: Guard): void { g.steering.remove(g.pursuit); }
}

/** Поиск по последней известной позиции — то, ради чего существует MemorySystem. */
class SearchState extends YUKA.State<Guard> {
  enter(g: Guard): void {
    g.stateName = 'search';
    const record = g.memory!.getRecord(g.target);
    if (record) g.arrive.target.copy(record.lastSensedPosition);
    g.steering.add(g.arrive);
    g.maxSpeed = 9;
  }

  execute(g: Guard): void {
    if (g.playerVisible) { g.stateMachine.changeTo('chase'); return; }
    const record = g.memory!.getRecord(g.target);
    const arrived = !record || g.position.distanceTo(record.lastSensedPosition) < 3;
    if (arrived) g.stateMachine.changeTo('patrol');
  }

  exit(g: Guard): void { g.steering.remove(g.arrive); }
}

/**
 * Связка Yuka → three. `matrixAutoUpdate = false` обязателен: иначе three
 * каждый кадр пересобирает матрицу из position/quaternion и стирает то, что
 * записала Yuka — враги «стоят на месте», хотя ИИ работает.
 */
function syncTransform(entity: YUKA.GameEntity, renderComponent: unknown): void {
  const obj = renderComponent as THREE.Object3D;
  obj.matrixAutoUpdate = false;
  obj.matrix.fromArray(entity.worldMatrix.elements as unknown as number[]);
}

const PILLARS = [
  { x: -14, z: -6 }, { x: 12, z: -18 }, { x: 20, z: 10 },
  { x: -6, z: 18 }, { x: -26, z: 16 }, { x: 4, z: 2 },
];

const PATROL = [
  { x: -24, z: -24 }, { x: 24, z: -24 }, { x: 24, z: 24 }, { x: -24, z: 24 },
];

const STATE_RU: Record<string, string> = {
  patrol: 'патруль (FollowPath)',
  chase: 'погоня (Pursuit)',
  search: 'поиск по памяти (Arrive)',
};

const MODE_RU: Record<string, string> = {
  boids: 'boids (Separation+Alignment+Cohesion)',
  chase: 'погоня (Pursuit)',
  scatter: 'разбегание (Flee)',
};
