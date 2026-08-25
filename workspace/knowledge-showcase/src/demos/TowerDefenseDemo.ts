import * as THREE from 'three';
import { createWorld, addEntity, removeEntity, addComponent, query } from 'bitecs';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  ENEMIES, TOWERS, PRIORITIES, START_GOLD, START_LIVES, SELL_RATIO,
  applyArmor, buildWave, pickTarget, spawnOrder, upgradeCost, upgradedDamage,
  SpatialGrid, type EnemyKind, type Priority, type TowerKind, type Wave, type TargetCandidate,
} from '../game/towerDefense';

const MAX_ENEMIES = 400;
const MAX_PROJECTILES = 400;
const CELL = 4;
const GRID_HALF = 9;
const BUILD_GAP = 10;      // секунд между волнами

interface Tower {
  kind: TowerKind;
  level: number;
  priority: Priority;
  gx: number;
  gz: number;
  x: number;
  z: number;
  cooldown: number;
  targetEid: number;
  mesh: THREE.Group;
}

/**
 * Tower defense на bitECS: враги и снаряды — компоненты и один InstancedMesh,
 * а не отдельные меши и не физические тела.
 *
 * Проверяет knowledge/threejs/tower_defense_core.md и knowledge/stack/bitecs.md
 * одновременно: 300 врагов и 400 снарядов дают два draw call.
 */
export class TowerDefenseDemo implements Demo {
  readonly id = 'td';
  readonly title = ['🗼 Tower Defense (bitECS)', '🗼 Tower Defense (bitECS)'] as const;
  readonly hint = [
    '<b>ЛКМ</b> построить / выбрать · <b>1</b>/<b>2</b>/<b>3</b> пулемёт / мортира / лазер · <b>T</b> приоритет цели · <b>U</b> улучшить · <b>X</b> продать · <b>Space</b> волна досрочно',
    '<b>LMB</b> build / select · <b>1</b>/<b>2</b>/<b>3</b> gun / cannon / laser · <b>T</b> target priority · <b>U</b> upgrade · <b>X</b> sell · <b>Space</b> call wave early',
  ] as const;
  readonly category = ['🧠 Стратегия и AI', '🧠 Strategy & AI'] as const;
  readonly tags = ['башни', 'tower defense', 'bitecs', 'ecs', 'волны', 'апгрейды', 'instanced mesh'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);

  private ctx!: DemoContext;
  private world!: TdWorld;
  private C!: TdComponents;

  private path!: THREE.CatmullRomCurve3;
  private pathLength = 0;
  private pathPoints: THREE.Vector3[] = [];

  private towers: Tower[] = [];
  private towerAt = new Map<number, Tower>();
  private selected: Tower | null = null;
  private buildKind: TowerKind = 'gun';

  private gold = START_GOLD;
  private lives = START_LIVES;
  private waveIndex = 0;
  private wave: Wave | null = null;
  private queue: EnemyKind[] = [];
  private spawnTimer = 0;
  private gapTimer = BUILD_GAP;
  private message = '';
  private messageTimer = 0;

  private enemyMesh!: THREE.InstancedMesh;
  private projMesh!: THREE.InstancedMesh;
  private ghost!: THREE.Mesh;
  private rangeRing!: THREE.Mesh;
  private grid = new SpatialGrid<TargetCandidate>(CELL * 2);
  private scratch: TargetCandidate[] = [];

  private readonly dummy = new THREE.Object3D();
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hitPoint = new THREE.Vector3();
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.world = createWorld<TdWorldShape>({ components: makeComponents() });
    this.C = this.world.components;

    this.scene.background = new THREE.Color(0x1d2630);
    this.scene.fog = new THREE.Fog(0x1d2630, 60, 170);
    const sun = new THREE.DirectionalLight(0xffe9c9, 2.4);
    sun.position.set(20, 40, 18);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0x93b7d6, 0x20242a, 1.3));

    this.buildPath();
    this.buildField();
    this.buildPools();

    this.camera.position.set(0, 52, 46);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'Digit1') this.buildKind = 'gun';
      if (code === 'Digit2') this.buildKind = 'cannon';
      if (code === 'Digit3') this.buildKind = 'laser';
      if (code === 'KeyT' && this.selected) {
        const i = PRIORITIES.indexOf(this.selected.priority);
        this.selected.priority = PRIORITIES[(i + 1) % PRIORITIES.length];
        this.selected.targetEid = -1;
        this.say(`Приоритет: ${this.selected.priority}`);
      }
      if (code === 'KeyU' && this.selected) this.upgrade(this.selected);
      if (code === 'KeyX' && this.selected) this.sell(this.selected);
      if (code === 'Space' && !this.wave) this.startWave(true);
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    this.handlePointer();

    if (this.wave) this.spawnSystem(dt);
    else if ((this.gapTimer -= dt) <= 0) this.startWave(false);

    this.movementSystem(dt);
    this.rebuildGrid();
    this.towerSystem(dt);
    this.projectileSystem(dt);
    if (this.flashTimer > 0 && (this.flashTimer -= dt) <= 0) this.damageFlash.visible = false;
    this.messageTimer = Math.max(0, this.messageTimer - dt);
  }

  update(dt: number): void {
    this.renderSystem();
    this.statusTimer += dt;
    if (this.statusTimer > 0.1) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ─────────────────────────────────────────────────────────── системы
  private spawnSystem(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const kind = this.queue.shift();
    if (kind === undefined) {
      this.wave = null;
      this.gapTimer = BUILD_GAP;
      this.gold += 25 + this.waveIndex * 4;      // бонус за пережитую волну
      this.say('Волна отбита');
      return;
    }
    this.spawnTimer = this.wave!.interval;
    this.spawnEnemy(kind);
  }

  private spawnEnemy(kind: EnemyKind): void {
    const { Enemy, Pos } = this.C;
    if (query(this.world, [Enemy]).length >= MAX_ENEMIES) return;   // потолок: не спавним
    const spec = ENEMIES[kind];
    const eid = addEntity(this.world);
    addComponent(this.world, eid, Enemy);
    addComponent(this.world, eid, Pos);
    Enemy.dist[eid] = 0;
    Enemy.hp[eid] = spec.hp * (1 + this.waveIndex * 0.06);
    Enemy.maxHp[eid] = Enemy.hp[eid];
    Enemy.speed[eid] = spec.speed;
    Enemy.armor[eid] = spec.armor;
    Enemy.flying[eid] = spec.flying ? 1 : 0;
    Enemy.bounty[eid] = spec.bounty;
    Enemy.kind[eid] = KIND_INDEX[kind];
    this.writePathPos(eid, 0);
  }

  private movementSystem(dt: number): void {
    const { Enemy } = this.C;
    for (const eid of query(this.world, [Enemy])) {
      // Прогресс хранится В МЕТРАХ вдоль пути: «сколько осталось до базы» и
      // приоритет целей считаются в метрах (§1 документа).
      Enemy.dist[eid] += Enemy.speed[eid] * dt;
      if (Enemy.dist[eid] >= this.pathLength) {
        this.lives--;                     // утечка снимает жизнь, а не заканчивает игру
        this.ctx.audio.playAlarm();
        this.ctx.addTrauma(0.25);
        removeEntity(this.world, eid);
        continue;
      }
      this.writePathPos(eid, Enemy.dist[eid]);
    }
  }

  private rebuildGrid(): void {
    const { Enemy, Pos } = this.C;
    this.grid.clear();
    for (const eid of query(this.world, [Enemy])) {
      const c: TargetCandidate = {
        eid,
        dist: Enemy.dist[eid],
        hp: Enemy.hp[eid],
        flying: Enemy.flying[eid] === 1,
        d2: 0,
      };
      this.grid.insert(Pos.x[eid], Pos.z[eid], c);
    }
  }

  private towerSystem(dt: number): void {
    const { Pos } = this.C;
    for (const tower of this.towers) {
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;

      const spec = TOWERS[tower.kind];
      // Опрос только соседних ячеек, а не всех врагов: 40 башен × 300 врагов
      // перебором — это 12 000 проверок в кадр.
      const near = this.grid.query(tower.x, tower.z, spec.range, this.scratch);
      for (const c of near) {
        const dx = Pos.x[c.eid] - tower.x;
        const dz = Pos.z[c.eid] - tower.z;
        c.d2 = dx * dx + dz * dz;
      }

      const target = pickTarget(tower.priority, spec.range, spec.hitsAir, near, tower.targetEid);
      tower.targetEid = target;
      if (target < 0) continue;

      tower.cooldown = 1 / spec.fireRate;
      const dmg = upgradedDamage(spec, tower.level);
      if (spec.projectileSpeed === 0) {
        this.damage(target, dmg, spec.pierce);
        this.tracer(tower, target);
      } else {
        this.spawnProjectile(tower, target, dmg);
      }
      // Башня доворачивается к цели: без этого стрельба «из спины» читается как баг.
      tower.mesh.rotation.y = Math.atan2(Pos.x[target] - tower.x, Pos.z[target] - tower.z);
    }
  }

  private projectileSystem(dt: number): void {
    const { Proj, Pos, Enemy } = this.C;
    for (const eid of query(this.world, [Proj])) {
      const targetEid = Proj.target[eid];
      // Цель умерла — снаряд летит в последнюю известную точку, а не исчезает.
      if (Enemy.hp[targetEid] > 0) {
        Proj.tx[eid] = Pos.x[targetEid];
        Proj.tz[eid] = Pos.z[targetEid];
      }
      const dx = Proj.tx[eid] - Pos.x[eid];
      const dz = Proj.tz[eid] - Pos.z[eid];
      const dist = Math.hypot(dx, dz);
      const step = Proj.speed[eid] * dt;
      if (dist <= step) {
        this.splash(Proj.tx[eid], Proj.tz[eid], Proj.splash[eid], Proj.damage[eid], Proj.pierce[eid]);
        removeEntity(this.world, eid);
        continue;
      }
      Pos.x[eid] += (dx / dist) * step;
      Pos.z[eid] += (dz / dist) * step;
      Proj.life[eid] -= dt;
      if (Proj.life[eid] <= 0) removeEntity(this.world, eid);
    }
  }

  private renderSystem(): void {
    const { Enemy, Pos, Proj } = this.C;
    let i = 0;
    for (const eid of query(this.world, [Enemy])) {
      const hurt = Enemy.hp[eid] / Enemy.maxHp[eid];
      const scale = 0.7 + (Enemy.kind[eid] === KIND_INDEX.shield ? 0.5 : 0);
      this.dummy.position.set(Pos.x[eid], Enemy.flying[eid] ? 2.6 : 0.7, Pos.z[eid]);
      this.dummy.scale.setScalar(scale * (0.75 + hurt * 0.25));
      this.dummy.rotation.y = Enemy.dist[eid] * 0.4;
      this.dummy.updateMatrix();
      this.enemyMesh.setMatrixAt(i, this.dummy.matrix);
      this.enemyMesh.setColorAt(i, ENEMY_COLORS[Enemy.kind[eid]]);
      i++;
    }
    // count вместо обнуления матрицы: нулевая матрица оставляет вырожденные
    // треугольники в вершинном шейдере.
    this.enemyMesh.count = i;
    this.enemyMesh.instanceMatrix.needsUpdate = true;
    if (this.enemyMesh.instanceColor) this.enemyMesh.instanceColor.needsUpdate = true;

    let j = 0;
    for (const eid of query(this.world, [Proj])) {
      this.dummy.position.set(Pos.x[eid], 1.4, Pos.z[eid]);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.projMesh.setMatrixAt(j++, this.dummy.matrix);
    }
    this.projMesh.count = j;
    this.projMesh.instanceMatrix.needsUpdate = true;
  }

  // ───────────────────────────────────────────────────────── действия
  private damage(eid: number, amount: number, pierce: number): void {
    const { Enemy } = this.C;
    if (Enemy.hp[eid] <= 0) return;
    Enemy.hp[eid] -= applyArmor(amount, Enemy.armor[eid], pierce);
    if (Enemy.hp[eid] <= 0) {
      this.gold += Enemy.bounty[eid];       // доход за убийство, не по таймеру
      removeEntity(this.world, eid);
    }
  }

  private splash(x: number, z: number, radius: number, damage: number, pierce: number): void {
    const { Pos } = this.C;
    if (radius <= 0) return;
    const near = this.grid.query(x, z, radius, this.scratch);
    for (const c of near) {
      const dx = Pos.x[c.eid] - x;
      const dz = Pos.z[c.eid] - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      // Квадратичный спад: иначе гранаты либо бесполезны, либо всесильны.
      const falloff = (1 - d / radius) ** 2;
      this.damage(c.eid, damage * falloff, pierce);
    }
    this.ctx.audio.playExplosion(0.25);
  }

  private spawnProjectile(tower: Tower, targetEid: number, damage: number): void {
    const { Proj, Pos } = this.C;
    if (query(this.world, [Proj]).length >= MAX_PROJECTILES) return;
    const spec = TOWERS[tower.kind];
    const eid = addEntity(this.world);
    addComponent(this.world, eid, Proj);
    addComponent(this.world, eid, Pos);
    Pos.x[eid] = tower.x; Pos.z[eid] = tower.z;
    Proj.target[eid] = targetEid;
    Proj.tx[eid] = Pos.x[targetEid];
    Proj.tz[eid] = Pos.z[targetEid];
    Proj.speed[eid] = spec.projectileSpeed;
    Proj.damage[eid] = damage;
    Proj.splash[eid] = spec.splash;
    Proj.pierce[eid] = spec.pierce;
    Proj.life[eid] = 4;
  }

  private tracer(tower: Tower, targetEid: number): void {
    const { Pos } = this.C;
    // Hitscan: урон уже применён, трассер живёт 0.05 с в общем пуле линий.
    this.damageFlash.position.set(Pos.x[targetEid], 1.2, Pos.z[targetEid]);
    this.damageFlash.visible = true;
    this.flashTimer = 0.05;
  }

  private upgrade(tower: Tower): void {
    const spec = TOWERS[tower.kind];
    const cost = upgradeCost(spec, tower.level);
    if (this.gold < cost) { this.say('Не хватает золота'); return; }
    this.gold -= cost;
    tower.level++;
    tower.mesh.scale.setScalar(1 + tower.level * 0.12);
    this.ctx.audio.playLevelUp();
    this.say(`Улучшено до ур. ${tower.level + 1}`);
  }

  /** Возврат 70 %: достаточно исправлять ошибки, мало — перестраивать под каждую волну. */
  private sell(tower: Tower): void {
    const spent = TOWERS[tower.kind].cost
      + Array.from({ length: tower.level }, (_, i) => upgradeCost(TOWERS[tower.kind], i))
        .reduce((a, b) => a + b, 0);
    this.gold += Math.round(spent * SELL_RATIO);
    this.towers = this.towers.filter((t) => t !== tower);
    this.towerAt.delete(tower.gx * 1000 + tower.gz);
    tower.mesh.removeFromParent();
    this.selected = null;
    this.say(`Продано за ${Math.round(spent * SELL_RATIO)}`);
  }

  private startWave(early: boolean): void {
    this.waveIndex++;
    this.wave = buildWave(this.waveIndex);
    this.queue = spawnOrder(this.wave);
    this.spawnTimer = 0;
    if (early) {
      this.gold += this.wave.earlyBonus;
      this.say(`Досрочный вызов: +${this.wave.earlyBonus} золота`);
    } else if (this.wave.newThreat) {
      this.say(`Новая угроза: ${THREAT_RU[this.wave.newThreat]}`);
    }
  }

  private say(text: string): void {
    this.message = text;
    this.messageTimer = 2.5;
  }

  // ───────────────────────────────────────────────────────────── ввод
  private handlePointer(): void {
    const pointer = this.ctx.input.primary;
    if (!pointer) return;
    this.raycaster.setFromCamera(pointer.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) return;

    const gx = Math.round(this.hitPoint.x / CELL);
    const gz = Math.round(this.hitPoint.z / CELL);
    const key = gx * 1000 + gz;
    const valid = this.canBuild(gx, gz);

    this.ghost.position.set(gx * CELL, 0.6, gz * CELL);
    this.ghost.visible = !this.towerAt.has(key);
    (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(valid ? 0x2ecc71 : 0xe74c3c);

    // Призрак показывает радиус ДО подтверждения: игрок не должен покупать вслепую.
    const existing = this.towerAt.get(key);
    const showFor = existing ?? null;
    this.rangeRing.visible = true;
    const range = showFor ? TOWERS[showFor.kind].range : TOWERS[this.buildKind].range;
    this.rangeRing.position.set(gx * CELL, 0.08, gz * CELL);
    this.rangeRing.scale.setScalar(range);

    if (!pointer.down) { this.pointerHandled = false; return; }
    if (this.pointerHandled) return;
    this.pointerHandled = true;

    if (existing) { this.selected = existing; this.say(`Выбрана башня (${existing.priority})`); return; }
    if (!valid) { this.say('Здесь строить нельзя'); return; }
    this.place(gx, gz);
  }

  private pointerHandled = false;

  private canBuild(gx: number, gz: number): boolean {
    if (Math.abs(gx) > GRID_HALF || Math.abs(gz) > GRID_HALF) return false;
    if (this.towerAt.has(gx * 1000 + gz)) return false;
    // Клетка на маршруте: башня не может стоять на дороге.
    const p = new THREE.Vector3(gx * CELL, 0, gz * CELL);
    for (const q of this.pathPoints) {
      if (q.distanceToSquared(p) < 9) return false;
    }
    return this.gold >= TOWERS[this.buildKind].cost;
  }

  private place(gx: number, gz: number): void {
    const spec = TOWERS[this.buildKind];
    this.gold -= spec.cost;
    const mesh = buildTowerMesh(this.buildKind);
    mesh.position.set(gx * CELL, 0, gz * CELL);
    this.scene.add(mesh);
    const tower: Tower = {
      kind: this.buildKind, level: 0, priority: 'first',
      gx, gz, x: gx * CELL, z: gz * CELL,
      cooldown: 0, targetEid: -1, mesh,
    };
    this.towers.push(tower);
    this.towerAt.set(gx * 1000 + gz, tower);
    this.selected = tower;
    this.ctx.audio.playButtonClick();
  }

  // ────────────────────────────────────────────────────────────── мир
  private damageFlash!: THREE.Mesh;
  private flashTimer = 0;

  private buildPath(): void {
    const pts = [
      new THREE.Vector3(-38, 0, -32), new THREE.Vector3(-16, 0, -30),
      new THREE.Vector3(-8, 0, -12), new THREE.Vector3(-24, 0, 2),
      new THREE.Vector3(-10, 0, 20), new THREE.Vector3(12, 0, 22),
      new THREE.Vector3(20, 0, 4), new THREE.Vector3(6, 0, -14),
      new THREE.Vector3(18, 0, -28), new THREE.Vector3(38, 0, -30),
    ];
    this.path = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    this.pathLength = this.path.getLength();
    this.pathPoints = this.path.getSpacedPoints(120);
  }

  private buildField(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshLambertMaterial({ color: 0x2f4034 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Дорога — та же кривая, что задаёт прогресс врагов.
    const road = new THREE.Mesh(
      new THREE.TubeGeometry(this.path, 160, 1.8, 4, false),
      new THREE.MeshLambertMaterial({ color: 0x6b5b45 }),
    );
    road.position.y = 0.05;
    road.scale.y = 0.08;
    this.scene.add(road);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.4, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x3498db, emissive: 0x0d2b45 }),
    );
    base.position.copy(this.path.getPointAt(1)).setY(1.5);
    base.castShadow = true;
    this.scene.add(base);

    const gridHelper = new THREE.GridHelper(GRID_HALF * 2 * CELL, GRID_HALF * 2, 0x44586b, 0x33414f);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.8, 1.2, CELL * 0.8),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.35 }),
    );
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    // Один круг радиуса — радиусы всех башен сразу превращают поле в кашу.
    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0x74b9ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false }),
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.renderOrder = 5;
    this.rangeRing.visible = false;
    this.scene.add(this.rangeRing);

    this.damageFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe66d }),
    );
    this.damageFlash.visible = false;
    this.scene.add(this.damageFlash);
  }

  private buildPools(): void {
    this.enemyMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.7, 1.6, 5),
      new THREE.MeshLambertMaterial(),
      MAX_ENEMIES,
    );
    this.enemyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyMesh.frustumCulled = false;   // иначе орда исчезает целиком
    this.enemyMesh.castShadow = false;
    this.enemyMesh.setColorAt(0, ENEMY_COLORS[0]);
    this.scene.add(this.enemyMesh);

    this.projMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.28, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
      MAX_PROJECTILES,
    );
    this.projMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projMesh.frustumCulled = false;
    this.scene.add(this.projMesh);
  }

  private writePathPos(eid: number, dist: number): void {
    const { Pos } = this.C;
    const p = this.path.getPointAt(Math.min(0.9999, dist / this.pathLength));
    Pos.x[eid] = p.x;
    Pos.z[eid] = p.z;
  }

  private pushStatus(): void {
    const { Enemy, Proj } = this.C;
    const enemies = query(this.world, [Enemy]).length;
    const projectiles = query(this.world, [Proj]).length;
    const sel = this.selected
      ? ` · выбрана: ${this.selected.kind} ур.${this.selected.level + 1}, цель «${this.selected.priority}»,`
        + ` улучшить ${upgradeCost(TOWERS[this.selected.kind], this.selected.level)}`
      : '';
    const next = this.wave
      ? `волна ${this.waveIndex} идёт (${this.queue.length} в очереди)`
      : `волна ${this.waveIndex + 1} через ${this.gapTimer.toFixed(1)} с — <b>Space</b> досрочно`;

    this.ctx.setStatus(
      `<span class="hp">${this.gold} золота</span> · жизни <b>${this.lives}</b>`
      + ` · ${next}`
      + ` · строим <b>${this.buildKind}</b> (${TOWERS[this.buildKind].cost})`
      + ` · врагов ${enemies}, снарядов ${projectiles} в 2 draw call`
      + sel
      + (this.messageTimer > 0 ? ` · <b>${this.message}</b>` : ''),
    );
  }
}

// ───────────────────────────────────────────────────── bitECS компоненты

/**
 * SoA-компоненты: типизированные массивы фиксированной длины под предсказуемый
 * максимум. Это и есть источник «нулевого GC» — за всю волну не создаётся ни
 * одного объекта (knowledge/stack/bitecs.md §1).
 */
function makeComponents() {
  const N = MAX_ENEMIES + MAX_PROJECTILES + 16;
  return {
    Pos: { x: new Float32Array(N), z: new Float32Array(N) },
    Enemy: {
      dist: new Float32Array(N), hp: new Float32Array(N), maxHp: new Float32Array(N),
      speed: new Float32Array(N), armor: new Float32Array(N),
      flying: new Uint8Array(N), bounty: new Float32Array(N), kind: new Uint8Array(N),
    },
    Proj: {
      target: new Int32Array(N), tx: new Float32Array(N), tz: new Float32Array(N),
      speed: new Float32Array(N), damage: new Float32Array(N),
      splash: new Float32Array(N), pierce: new Float32Array(N), life: new Float32Array(N),
    },
  };
}
type TdComponents = ReturnType<typeof makeComponents>;
// createWorld<T> просто переносит свойства переданного объекта на мир,
// поэтому типизируется именно форма контейнера, а не набор компонентов.
type TdWorldShape = { components: TdComponents };
type TdWorld = ReturnType<typeof createWorld<TdWorldShape>>;

const KIND_INDEX: Record<EnemyKind, number> = { grunt: 0, runner: 1, shield: 2, flyer: 3, healer: 4 };
const ENEMY_COLORS = [
  new THREE.Color(0xe74c3c), new THREE.Color(0xf1c40f), new THREE.Color(0x95a5a6),
  new THREE.Color(0x9b59b6), new THREE.Color(0x2ecc71),
];
const THREAT_RU: Record<EnemyKind, string> = {
  grunt: 'пехота', runner: 'бегуны', shield: 'броня', flyer: 'воздух', healer: 'лекарь',
};

function buildTowerMesh(kind: TowerKind): THREE.Group {
  const g = new THREE.Group();
  const colors: Record<TowerKind, number> = { gun: 0x3498db, cannon: 0xe67e22, laser: 0x9b59b6 };
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.6, 1.1, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a5568 }),
  );
  base.position.y = 0.55;
  base.castShadow = true;
  g.add(base);

  // Ствол — ребёнок башни: одна группа, одна степень свободы (CRITICAL_RULES §55).
  const turret = new THREE.Group();
  turret.position.y = 1.15;
  g.add(turret);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.7, 1.1),
    new THREE.MeshLambertMaterial({ color: colors[kind] }),
  );
  head.castShadow = true;
  turret.add(head);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, kind === 'cannon' ? 1.8 : 1.3, 6),
    new THREE.MeshLambertMaterial({ color: 0x2d3436 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = kind === 'cannon' ? 0.9 : 0.7;
  turret.add(barrel);
  return g;
}
