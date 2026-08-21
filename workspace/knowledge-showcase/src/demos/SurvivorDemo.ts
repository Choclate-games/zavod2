import * as THREE from 'three';
import { createWorld, addEntity, removeEntity, addComponent, query } from 'bitecs';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { SpatialGrid } from '../game/towerDefense';
import {
  RunState, hordeAt, makeRng, ringCapacity, xpForKill, type UpgradeCard,
} from '../game/survivorRun';

const ARENA = 34;
const MAX_ENEMIES = 1200;
const MAX_GEMS = 600;
const MAX_BULLETS = 400;
/** Радиус спавна вокруг игрока: за краем экрана, но не слишком далеко. */
const SPAWN_R = 26;
const ENEMY_R = 0.42;
const CONTACT_DPS = 9;
const GRID_CELL = 2.5;

/**
 * Рой и выживание: орда на bitECS, авто-атака, кристаллы опыта, карточки.
 *
 * Проверяет knowledge/stack/bitecs.md, knowledge/mechanics/wave_survival.md,
 * knowledge/mechanics/upgrade_choices.md, knowledge/patterns/survivor_loop.md.
 * Числа забега (кривая опыта, пул карт, эскалация орды) живут в
 * `game/survivorRun.ts` и проверяются головно: `npm run check:survivor`.
 *
 * Здесь ECS оправдан ровно тем, ради чего он и нужен: полторы тысячи
 * одинаковых сущностей, ноль объектов на кадр, ноль работы сборщику мусора.
 */
export class SurvivorDemo implements Demo {
  readonly id = 'survivor';
  readonly title = ['🐦 Рой и выживание', '🐦 Horde survival'] as const;
  readonly hint = [
    '<b>WASD</b> движение · стрельба и клинки автоматические · <b>1</b>/<b>2</b>/<b>3</b> выбор карты'
    + ' · <b>R</b> заново<br>Забег останавливается на выборе карты — это и есть окно решения игрока.',
    '<b>WASD</b> move · auto-fire and blades · <b>1</b>/<b>2</b>/<b>3</b> pick a card'
    + ' · <b>R</b> restart<br>The run pauses on level-up — that pause is the decision window.',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.5, 200);

  private ctx!: DemoContext;
  private world!: SurvivorWorld;
  private C!: SurvivorComponents;
  private run = new RunState(makeRng(Date.now() & 0xffff));
  private rng = makeRng(99);

  private readonly playerPos = new THREE.Vector3();
  private playerMesh!: THREE.Mesh;
  private enemyMesh!: THREE.InstancedMesh;
  private eliteMesh!: THREE.InstancedMesh;
  private gemMesh!: THREE.InstancedMesh;
  private bulletMesh!: THREE.InstancedMesh;
  private blades: THREE.Mesh[] = [];
  private bladeRoot = new THREE.Group();

  private readonly grid = new SpatialGrid<number>(GRID_CELL);
  private readonly scratch: number[] = [];
  private readonly dummy = new THREE.Object3D();

  private spawnDebt = 0;
  private fireCooldown = 0;
  private bladeAngle = 0;
  private hand: UpgradeCard[] = [];
  private dead = false;
  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.C = makeComponents();
    this.world = createWorld<SurvivorWorldShape>({ components: this.C });

    this.scene.background = new THREE.Color(0x10141c);
    this.scene.fog = new THREE.Fog(0x10141c, 30, 62);

    const key = new THREE.DirectionalLight(0xfff0d8, 2.0);
    key.position.set(8, 20, 6);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0x5570b0, 0x141018, 1.0));

    this.scene.add(this.buildArena());

    this.playerMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 0.7, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x0a2a44, roughness: 0.5 }),
    );
    this.playerMesh.position.y = 0.75;
    this.scene.add(this.playerMesh);
    this.scene.add(this.bladeRoot);

    // Три инстансированных меша на всю орду: 1200 врагов — это 1 draw call,
    // а не 1200 объектов сцены (knowledge/stack/bitecs.md §4).
    this.enemyMesh = makeInstanced(
      new THREE.CapsuleGeometry(ENEMY_R, 0.55, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0xc0453a, roughness: 0.85 }),
      MAX_ENEMIES,
    );
    this.eliteMesh = makeInstanced(
      new THREE.CapsuleGeometry(ENEMY_R * 1.5, 0.8, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0xe0a020, emissive: 0x402000, roughness: 0.6 }),
      Math.floor(MAX_ENEMIES / 3),
    );
    this.gemMesh = makeInstanced(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshStandardMaterial({ color: 0x66ff99, emissive: 0x1a5533 }),
      MAX_GEMS,
    );
    this.bulletMesh = makeInstanced(
      new THREE.SphereGeometry(0.13, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }),
      MAX_BULLETS,
    );
    this.scene.add(this.enemyMesh, this.eliteMesh, this.gemMesh, this.bulletMesh);

    this.camera.position.set(0, 26, 17);
    this.camera.lookAt(0, 0, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyR') this.restart();
      if (this.hand.length > 0) {
        const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
        if (idx >= 0 && idx < this.hand.length) this.pickCard(idx);
      }
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    // Выбор карты замораживает забег. Это не «пауза для удобства»: без неё
    // игрок читает три описания под наступающей ордой и выбирает вслепую
    // (knowledge/mechanics/upgrade_choices.md).
    if (this.hand.length > 0 || this.dead) return;

    this.run.time += dt;
    const horde = hordeAt(this.run.time);

    this.movePlayer(dt);
    this.spawnEnemies(dt, horde.spawnRate, horde.hp, horde.eliteShare);
    this.rebuildGrid();
    this.moveEnemies(dt, horde.speed);
    this.autoFire(dt);
    this.stepBullets(dt);
    this.spinBlades(dt);
    this.collectGems(dt);

    const s = this.run.stats;
    if (s.regen > 0) this.run.hp = Math.min(s.maxHp, this.run.hp + s.regen * dt);
    if (this.run.hp <= 0) { this.dead = true; this.ctx.audio.playExplosion(0.8); }

    if (this.run.pendingLevels > 0 && this.hand.length === 0) this.offerCards();
  }

  update(dt: number): void {
    this.syncInstances();
    this.playerMesh.position.set(this.playerPos.x, 0.75, this.playerPos.z);
    this.bladeRoot.position.copy(this.playerMesh.position);

    // Камера строго сверху-сзади без поворота: в survivor-игре важно видеть,
    // с какой стороны накатывает орда, а не красивый ракурс.
    const k = 1 - Math.exp(-8 * dt);
    this.camera.position.x += (this.playerPos.x - this.camera.position.x) * k;
    this.camera.position.z += (this.playerPos.z + 17 - this.camera.position.z) * k;
    this.camera.lookAt(this.playerPos.x, 0, this.playerPos.z);

    this.statusTimer += dt;
    if (this.statusTimer > 0.1) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ──────────────────────────────────────────────────────────── игрок
  private movePlayer(dt: number): void {
    const mv = this.ctx.input.moveVector();
    const speed = this.run.stats.moveSpeed;
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x + mv.x * speed * dt, -ARENA, ARENA);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z + mv.y * speed * dt, -ARENA, ARENA);
  }

  private autoFire(dt: number): void {
    const s = this.run.stats;
    this.fireCooldown -= dt;
    if (this.fireCooldown > 0) return;
    this.fireCooldown += 1 / s.fireRate;

    // Цели: ближайшие враги. Ищем через сетку, а не перебором 1200 штук.
    const near = this.grid.query(this.playerPos.x, this.playerPos.z, 14, this.scratch);
    if (near.length === 0) return;
    const { Pos } = this.C;
    // Частичная сортировка по расстоянию: нужны только `projectiles` штук.
    const targets: number[] = [];
    for (let n = 0; n < s.projectiles; n++) {
      let best = -1;
      let bestD = Infinity;
      for (const eid of near) {
        if (targets.includes(eid)) continue;
        const dx = Pos.x[eid] - this.playerPos.x;
        const dz = Pos.z[eid] - this.playerPos.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = eid; }
      }
      if (best < 0) break;
      targets.push(best);
    }
    for (const eid of targets) this.spawnBullet(Pos.x[eid], Pos.z[eid], s.damage);
    if (targets.length > 0) this.ctx.audio.playLaser();
  }

  private spinBlades(dt: number): void {
    const s = this.run.stats;
    if (this.blades.length !== s.orbitals) this.rebuildBlades();
    if (s.orbitals === 0) return;

    this.bladeAngle += dt * 3.2;
    const radius = 2.2 * s.area;
    const { Pos, Enemy } = this.C;
    const hitR = radius + ENEMY_R + 0.35;
    const innerR = radius - ENEMY_R - 0.35;

    for (let i = 0; i < this.blades.length; i++) {
      const a = this.bladeAngle + (i / this.blades.length) * Math.PI * 2;
      this.blades[i].position.set(Math.cos(a) * radius, 0.7, Math.sin(a) * radius);
      this.blades[i].rotation.y = -a;
    }

    // Клинок бьёт всех, кто в кольце и в его секторе. Урон в секунду делится
    // на кадры — иначе на 60 FPS клинок наносит в 60 раз больше, чем задумано.
    const near = this.grid.query(this.playerPos.x, this.playerPos.z, hitR, this.scratch);
    const perFrame = s.orbitDamage * 2 * dt;
    for (const eid of near) {
      const dx = Pos.x[eid] - this.playerPos.x;
      const dz = Pos.z[eid] - this.playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > hitR || d < innerR) continue;
      Enemy.hp[eid] -= perFrame;
      if (Enemy.hp[eid] <= 0) this.killEnemy(eid, dx, dz);
    }
  }

  private rebuildBlades(): void {
    for (const b of this.blades) { b.geometry.dispose(); b.removeFromParent(); }
    this.blades = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, metalness: 0.9, roughness: 0.2 });
    for (let i = 0; i < this.run.stats.orbitals; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.16), mat);
      this.bladeRoot.add(blade);
      this.blades.push(blade);
    }
  }

  // ──────────────────────────────────────────────────────────── орда
  private spawnEnemies(dt: number, rate: number, hp: number, eliteShare: number): void {
    this.spawnDebt += rate * dt;
    const { Pos, Enemy } = this.C;
    while (this.spawnDebt >= 1) {
      this.spawnDebt -= 1;
      // Потолок пула: молча пропускаем спавн, а не растим массивы.
      if (query(this.world, [Enemy]).length >= MAX_ENEMIES) { this.spawnDebt = 0; return; }
      const eid = addEntity(this.world);
      addComponent(this.world, eid, Pos);
      addComponent(this.world, eid, Enemy);
      const a = this.rng() * Math.PI * 2;
      Pos.x[eid] = this.playerPos.x + Math.cos(a) * SPAWN_R;
      Pos.z[eid] = this.playerPos.z + Math.sin(a) * SPAWN_R;
      const elite = this.rng() < eliteShare;
      Enemy.elite[eid] = elite ? 1 : 0;
      Enemy.hp[eid] = hp * (elite ? 4 : 1);
    }
  }

  private rebuildGrid(): void {
    const { Pos, Enemy } = this.C;
    this.grid.clear();
    for (const eid of query(this.world, [Enemy])) this.grid.insert(Pos.x[eid], Pos.z[eid], eid);
  }

  private moveEnemies(dt: number, speed: number): void {
    const { Pos, Enemy } = this.C;
    let contact = 0;
    for (const eid of query(this.world, [Enemy])) {
      const dx = this.playerPos.x - Pos.x[eid];
      const dz = this.playerPos.z - Pos.z[eid];
      const d = Math.hypot(dx, dz) || 1e-5;
      const v = speed * (Enemy.elite[eid] ? 0.8 : 1);
      Pos.x[eid] += (dx / d) * v * dt;
      Pos.z[eid] += (dz / d) * v * dt;
      if (d < 0.9) contact++;
    }
    // Урон от касания считается по числу прижавшихся, а не «по первому»:
    // иначе стоять в толпе безопаснее, чем встретить одного врага.
    if (contact > 0) this.run.hp -= CONTACT_DPS * Math.min(contact, 8) * dt * 0.25;
  }

  private killEnemy(eid: number, dx: number, dz: number): void {
    const { Enemy, Pos, Gem } = this.C;
    const elite = Enemy.elite[eid] === 1;
    const x = Pos.x[eid];
    const z = Pos.z[eid];
    removeEntity(this.world, eid);
    this.run.kills++;
    void dx; void dz;
    if (query(this.world, [Gem]).length < MAX_GEMS) {
      const gid = addEntity(this.world);
      addComponent(this.world, gid, Pos);
      addComponent(this.world, gid, Gem);
      Pos.x[gid] = x;
      Pos.z[gid] = z;
      Gem.value[gid] = xpForKill(elite);
    }
  }

  // ──────────────────────────────────────────────────────────── снаряды
  private spawnBullet(tx: number, tz: number, damage: number): void {
    const { Pos, Bullet } = this.C;
    if (query(this.world, [Bullet]).length >= MAX_BULLETS) return;
    const eid = addEntity(this.world);
    addComponent(this.world, eid, Pos);
    addComponent(this.world, eid, Bullet);
    Pos.x[eid] = this.playerPos.x;
    Pos.z[eid] = this.playerPos.z;
    const dx = tx - this.playerPos.x;
    const dz = tz - this.playerPos.z;
    const d = Math.hypot(dx, dz) || 1;
    Bullet.vx[eid] = (dx / d) * 26;
    Bullet.vz[eid] = (dz / d) * 26;
    Bullet.life[eid] = 1.2;
    Bullet.dmg[eid] = damage;
  }

  private stepBullets(dt: number): void {
    const { Pos, Bullet, Enemy } = this.C;
    const hitR = ENEMY_R + 0.25;
    for (const eid of query(this.world, [Bullet])) {
      Pos.x[eid] += Bullet.vx[eid] * dt;
      Pos.z[eid] += Bullet.vz[eid] * dt;
      Bullet.life[eid] -= dt;
      if (Bullet.life[eid] <= 0) { removeEntity(this.world, eid); continue; }

      const near = this.grid.query(Pos.x[eid], Pos.z[eid], hitR, this.scratch);
      for (const target of near) {
        const dx = Pos.x[target] - Pos.x[eid];
        const dz = Pos.z[target] - Pos.z[eid];
        if (dx * dx + dz * dz > hitR * hitR) continue;
        Enemy.hp[target] -= Bullet.dmg[eid];
        removeEntity(this.world, eid);
        if (Enemy.hp[target] <= 0) this.killEnemy(target, dx, dz);
        break;
      }
    }
  }

  // ──────────────────────────────────────────────────────────── опыт
  private collectGems(dt: number): void {
    const { Pos, Gem } = this.C;
    const magnet = this.run.stats.magnet;
    let gained = 0;
    for (const eid of query(this.world, [Gem])) {
      const dx = this.playerPos.x - Pos.x[eid];
      const dz = this.playerPos.z - Pos.z[eid];
      const d = Math.hypot(dx, dz) || 1e-5;
      if (d < 0.6) {
        gained += Gem.value[eid];
        removeEntity(this.world, eid);
        continue;
      }
      if (d < magnet) {
        // Притяжение ускоряется по мере приближения — «магнит», а не «лифт».
        const pull = 6 + (1 - d / magnet) * 14;
        Pos.x[eid] += (dx / d) * pull * dt;
        Pos.z[eid] += (dz / d) * pull * dt;
      }
    }
    if (gained > 0) {
      const levels = this.run.addXp(gained);
      if (levels > 0) this.ctx.audio.playLevelUp();
      else this.ctx.audio.playCoinPickup();
    }
  }

  private offerCards(): void {
    this.hand = this.run.draw(3);
    // Пул исчерпан — уровни всё равно капают, но выбирать нечего.
    if (this.hand.length === 0) { this.run.pendingLevels = 0; return; }
    this.ctx.audio.playLevelUp();
    this.pushStatus();
  }

  private pickCard(idx: number): void {
    this.run.take(this.hand[idx]);
    this.hand = [];
    this.ctx.audio.playButtonClick();
  }

  private restart(): void {
    for (const eid of query(this.world, [this.C.Enemy])) removeEntity(this.world, eid);
    for (const eid of query(this.world, [this.C.Gem])) removeEntity(this.world, eid);
    for (const eid of query(this.world, [this.C.Bullet])) removeEntity(this.world, eid);
    this.run = new RunState(makeRng(Date.now() & 0xffff));
    this.playerPos.set(0, 0, 0);
    this.hand = [];
    this.dead = false;
    this.spawnDebt = 0;
    this.fireCooldown = 0;
    this.rebuildBlades();
  }

  // ──────────────────────────────────────────────────────────── визуал
  private syncInstances(): void {
    const { Pos, Enemy, Gem, Bullet } = this.C;
    let normal = 0;
    let elite = 0;
    for (const eid of query(this.world, [Enemy])) {
      const isElite = Enemy.elite[eid] === 1;
      const mesh = isElite ? this.eliteMesh : this.enemyMesh;
      const i = isElite ? elite++ : normal++;
      if (i >= mesh.count) continue;
      this.dummy.position.set(Pos.x[eid], isElite ? 0.85 : 0.62, Pos.z[eid]);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    // `count` вместо скрытия лишних инстансов: рисуем ровно живых.
    this.enemyMesh.count = normal;
    this.eliteMesh.count = elite;
    this.enemyMesh.instanceMatrix.needsUpdate = true;
    this.eliteMesh.instanceMatrix.needsUpdate = true;

    let g = 0;
    for (const eid of query(this.world, [Gem])) {
      if (g >= MAX_GEMS) break;
      this.dummy.position.set(Pos.x[eid], 0.3, Pos.z[eid]);
      this.dummy.rotation.set(0, performance.now() * 0.002, 0);
      this.dummy.scale.setScalar(Gem.value[eid] > 1 ? 1.6 : 1);
      this.dummy.updateMatrix();
      this.gemMesh.setMatrixAt(g++, this.dummy.matrix);
    }
    this.gemMesh.count = g;
    this.gemMesh.instanceMatrix.needsUpdate = true;

    let b = 0;
    for (const eid of query(this.world, [Bullet])) {
      if (b >= MAX_BULLETS) break;
      this.dummy.position.set(Pos.x[eid], 0.8, Pos.z[eid]);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.bulletMesh.setMatrixAt(b++, this.dummy.matrix);
    }
    this.bulletMesh.count = b;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
  }

  private buildArena(): THREE.Group {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2 + 12, ARENA * 2 + 12, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);

    // Сетка вместо текстуры: даёт ощущение движения, не стоит ни байта.
    const grid = new THREE.GridHelper(ARENA * 2, 34, 0x33405a, 0x232c3c);
    grid.position.y = 0.01;
    g.add(grid);
    return g;
  }

  private pushStatus(): void {
    const r = this.run;
    const s = r.stats;
    const m = Math.floor(r.time / 60);
    const sec = Math.floor(r.time % 60);
    const alive = query(this.world, [this.C.Enemy]).length;

    if (this.dead) {
      this.ctx.setStatus(
        `<b>Забег окончен</b> — ${m}:${String(sec).padStart(2, '0')}, уровень ${r.level},`
        + ` убито ${r.kills}. <b>R</b> — заново.`,
      );
      return;
    }
    if (this.hand.length > 0) {
      const cards = this.hand
        .map((c, i) => `<b>${i + 1}</b>. ${c.title[0]} — ${c.text[0]}`)
        .join(' &nbsp;·&nbsp; ');
      this.ctx.setStatus(`<b>Уровень ${r.level}!</b> Выбери карту: ${cards}`);
      return;
    }
    this.ctx.setStatus(
      `<span class="hp">HP ${Math.max(0, Math.round(r.hp))}/${s.maxHp}</span>`
      + ` · ${m}:${String(sec).padStart(2, '0')}`
      + ` · уровень <b>${r.level}</b> (${r.xp}/${r.xpNeeded})`
      + ` · убито <b>${r.kills}</b> · на экране <b>${alive}</b>`
      + ` · DPS <b>${Math.round(r.singleTargetDps)}</b>`
      + ` · клинков ${s.orbitals} (кольцо ${ringCapacity(s)})`,
    );
  }
}

function makeInstanced(
  geom: THREE.BufferGeometry, mat: THREE.Material, count: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;   // позиции меняются каждый кадр, bbox бесполезен
  mesh.count = 0;
  return mesh;
}

/**
 * Компоненты bitECS 0.4: типизированные массивы фиксированной длины.
 *
 * `defineComponent` в 0.4 больше не существует — компонент это просто объект
 * с массивами, индексируемыми по `eid` (knowledge/stack/bitecs.md §1).
 */
function makeComponents() {
  const cap = MAX_ENEMIES + MAX_GEMS + MAX_BULLETS + 16;
  return {
    Pos: { x: new Float32Array(cap), z: new Float32Array(cap) },
    Enemy: { hp: new Float32Array(cap), elite: new Uint8Array(cap) },
    Gem: { value: new Uint8Array(cap) },
    Bullet: {
      vx: new Float32Array(cap), vz: new Float32Array(cap),
      life: new Float32Array(cap), dmg: new Float32Array(cap),
    },
  };
}

type SurvivorComponents = ReturnType<typeof makeComponents>;
interface SurvivorWorldShape { components: SurvivorComponents }
type SurvivorWorld = ReturnType<typeof createWorld<SurvivorWorldShape>>;
