import * as THREE from 'three';
import { init as initRecast, Crowd, NavMeshQuery, type NavMesh, type CrowdAgent } from 'recast-navigation';
import { threeToSoloNavMesh, NavMeshHelper } from '@recast-navigation/three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';

const AGENTS = 48;
const AGENT_RADIUS = 0.5;
const AGENT_HEIGHT = 1.8;
const CS = 0.25;
const CH = 0.25;

/**
 * recast-navigation: навмеш из мешей сцены и толпа с обходом друг друга.
 *
 * Прямая проверка knowledge/stack/recast_navigation.md. Своего A* здесь нет и
 * быть не может: сетка не знает про высоты и наклоны, а путь всё равно нужно
 * сглаживать — это ровно то, что Detour делает корректно из коробки.
 */
export class RecastDemo implements Demo {
  readonly id = 'recast';
  readonly title = ['🧭 Навигация NPC (recast)', '🧭 NPC navigation (recast)'] as const;
  readonly hint = [
    '<b>ЛКМ</b> отправить толпу в точку · <b>N</b> показать навмеш · <b>R</b> разбросать агентов · толпа сама обходит препятствия и друг друга',
    '<b>LMB</b> send the crowd to a point · <b>N</b> show the navmesh · <b>R</b> scatter agents · the crowd avoids obstacles and each other',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);

  private ctx!: DemoContext;
  private navMesh: NavMesh | null = null;
  private query: NavMeshQuery | null = null;
  private crowd: Crowd | null = null;
  private agents: CrowdAgent[] = [];
  private helper: THREE.Object3D | null = null;

  private agentMesh!: THREE.InstancedMesh;
  private marker!: THREE.Mesh;
  private buildMs = 0;
  private lastTargetOk = true;
  private pointerHandled = false;
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;

  private readonly dummy = new THREE.Object3D();
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();

  async init(ctx: DemoContext): Promise<void> {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x1b2029);
    this.scene.fog = new THREE.Fog(0x1b2029, 70, 200);

    const sun = new THREE.DirectionalLight(0xffe9c4, 2.2);
    sun.position.set(28, 46, 20);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0x9ab4d8, 0x22252c, 1.2));

    const walkable = this.buildLevel();

    // WASM грузится один раз и ТОЛЬКО в игре, которой навигация действительно
    // нужна: иначе это лишний мегабайт на старте (stack/README.md §3).
    await initRecast();

    const t0 = performance.now();
    // walkableHeight/Climb/Radius задаются В ЯЧЕЙКАХ, а не в метрах — главная
    // ловушка Recast. Ошибка выглядит как «NPC не проходят в дверь».
    const result = threeToSoloNavMesh(walkable, {
      cs: CS,
      ch: CH,
      walkableSlopeAngle: 45,
      walkableHeight: Math.ceil(AGENT_HEIGHT / CH),
      walkableClimb: Math.floor(0.4 / CH),
      walkableRadius: Math.ceil(AGENT_RADIUS / CS),
      maxEdgeLen: 12,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    });
    this.buildMs = performance.now() - t0;

    if (!result.success || !result.navMesh) {
      ctx.setStatus('Не удалось построить навмеш');
      return;
    }
    this.navMesh = result.navMesh;
    this.query = new NavMeshQuery(this.navMesh);
    this.crowd = new Crowd(this.navMesh, { maxAgents: AGENTS, maxAgentRadius: AGENT_RADIUS * 1.5 });

    this.buildAgentPool();
    this.scatter();

    this.camera.position.set(0, 46, 44);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyN') void this.toggleHelper();
      if (code === 'KeyR') this.scatter();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  update(dt: number): void {
    this.handlePointer();

    if (this.crowd) {
      // Трёхаргументная форма: фиксированный шаг + интерполяция. При ней
      // читается interpolatedPosition; agent.position() в этом режиме не
      // обновляется — стандартная причина «NPC телепортируются рывками».
      this.crowd.update(1 / 60, dt, 5);
      this.syncAgents();
    }

    this.statusTimer += dt;
    if (this.statusTimer > 0.2) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    // WASM-память не собирается сборщиком мусора JS.
    this.crowd?.destroy();
    this.navMesh?.destroy();
    this.crowd = null;
    this.navMesh = null;
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ────────────────────────────────────────────────────────────── уровень
  private buildLevel(): THREE.Mesh[] {
    const walkable: THREE.Mesh[] = [];

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(70, 1, 70),
      new THREE.MeshLambertMaterial({ color: 0x3a4450 }),
    );
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    walkable.push(ground);

    // Стены с проходами: без препятствий демо ничего не доказывает — толпа
    // пошла бы по прямой и без всякого навмеша.
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x6b7280 });
    const walls: Array<[number, number, number, number]> = [
      [-10, -6, 2, 34], [14, 8, 2, 30], [0, 22, 40, 2], [0, -24, 30, 2],
    ];
    for (const [x, z, w, d] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), wallMat);
      wall.position.set(x, 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      walkable.push(wall);
    }

    // Пандус: наклон 45° — граница проходимости, ровно то, чего не знает
    // самописный A* по сетке.
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 16), wallMat);
    ramp.position.set(22, 2.6, -8);
    ramp.rotation.x = -0.42;
    ramp.receiveShadow = true;
    this.scene.add(ramp);
    walkable.push(ramp);

    const platform = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), wallMat);
    platform.position.set(26, 5.4, 4);
    platform.receiveShadow = true;
    this.scene.add(platform);
    walkable.push(platform);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 20),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71, side: THREE.DoubleSide, depthTest: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 8;
    this.marker.visible = false;
    this.scene.add(this.marker);

    return walkable;
  }

  private buildAgentPool(): void {
    this.agentMesh = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(AGENT_RADIUS, AGENT_HEIGHT - AGENT_RADIUS * 2, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x4aa3ff }),
      AGENTS,
    );
    this.agentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.agentMesh.frustumCulled = false;
    this.scene.add(this.agentMesh);
  }

  private scatter(): void {
    if (!this.crowd || !this.query) return;
    for (const agent of this.agents) this.crowd.removeAgent(agent);
    this.agents = [];

    for (let i = 0; i < AGENTS; i++) {
      const { randomPoint } = this.query.findRandomPoint();
      const agent = this.crowd.addAgent(randomPoint, {
        radius: AGENT_RADIUS,
        height: AGENT_HEIGHT,
        maxAcceleration: 22,
        maxSpeed: 5.5,
        collisionQueryRange: 2.5,
        pathOptimizationRange: 6,
        // separationWeight: 0 даёт слипшуюся кашу, > 4 — толпу, которая
        // разбегается от цели.
        separationWeight: 1.6,
      });
      this.agents.push(agent);
    }
  }

  private handlePointer(): void {
    const pointer = this.ctx.input.primary;
    if (!pointer?.down) { this.pointerHandled = false; return; }
    if (this.pointerHandled || !this.query || !this.crowd) return;
    this.pointerHandled = true;

    this.raycaster.setFromCamera(pointer.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return;

    // Любая внешняя координата проходит через findClosestPoint: точка в 5 см
    // над полом даёт success: false, и NPC «отказываются идти» без причины.
    const { success, point } = this.query.findClosestPoint(this.hit);
    this.lastTargetOk = success;
    if (!success) return;

    for (const agent of this.agents) agent.requestMoveTarget(point);
    this.marker.position.set(point.x, point.y + 0.1, point.z);
    this.marker.visible = true;
    this.ctx.audio.playButtonClick();
  }

  private syncAgents(): void {
    for (let i = 0; i < this.agents.length; i++) {
      const p = this.agents[i].interpolatedPosition;
      this.dummy.position.set(p.x, p.y + AGENT_HEIGHT / 2, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.agentMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.agentMesh.count = this.agents.length;
    this.agentMesh.instanceMatrix.needsUpdate = true;
  }

  private async toggleHelper(): Promise<void> {
    if (!this.navMesh) return;
    if (this.helper) { this.helper.visible = !this.helper.visible; return; }
    // Половина багов навигации видна глазом за пять секунд: дыры под мостом,
    // отсутствие покрытия у стен, «острова» без связи.
    this.helper = new NavMeshHelper(this.navMesh);
    this.helper.position.y += 0.08;
    this.scene.add(this.helper);
  }

  private pushStatus(): void {
    const moving = this.agents.filter((a) => {
      const v = a.velocity();
      return Math.hypot(v.x, v.z) > 0.15;
    }).length;

    this.ctx.setStatus(
      `Навмеш построен за <b>${this.buildMs.toFixed(0)} мс</b>`
      + ` (cs ${CS}, walkableRadius ${Math.ceil(AGENT_RADIUS / CS)} ячеек = ${AGENT_RADIUS} м)`
      + ` · агентов <span class="hp">${this.agents.length}</span>, в движении ${moving}`
      + (this.lastTargetOk ? '' : ' · <b>точка вне навмеша</b>')
      + ' · <b>N</b> — показать навмеш',
    );
  }
}
