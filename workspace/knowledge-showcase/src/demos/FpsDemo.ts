import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { mulberry32 } from '../world/bvhLevel';
// Прицеливание и проверка видимости идут через ускоренный Raycaster.
import '../stack/bvhSetup';

const ARENA = 34;
const MAX_DECALS = 48;
const PLAYER_HP = 200;
/** Токены атаки: одновременно стреляют максимум столько врагов. */
const ATTACK_TOKENS = 2;

type EnemyState = 'idle' | 'alert' | 'engage' | 'reposition' | 'dead';

interface Enemy {
  root: THREE.Group;
  material: THREE.MeshLambertMaterial;
  pos: THREE.Vector3;
  hp: number;
  state: EnemyState;
  stateTime: number;
  /** Кадры «увидел → выстрелил»: ноль читается игроком как читерство. */
  reaction: number;
  burstLeft: number;
  burstTimer: number;
  cooldown: number;
  hasToken: boolean;
  firstBurstDone: boolean;
  target: THREE.Vector3;
  flash: number;
}

interface Barrel {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  hp: number;
  /** Задержка детонации: волна взрывов вместо схлопывания в один кадр. */
  fuse: number;
  exploded: boolean;
}

/**
 * FPS: hitscan по BVH, зоны урона, ИИ с задержкой реакции и токенами атаки,
 * цепные взрывы на таймерах фиксированного шага.
 *
 * Проверяет knowledge/threejs/fps_controller_and_shooting.md и
 * knowledge/threejs/shooter_enemy_ai_and_combat.md.
 */
export class FpsDemo implements Demo {
  readonly id = 'fps';
  readonly title = ['🔫 FPS: стрельба и ИИ', '🔫 FPS: shooting and AI'] as const;
  readonly hint = [
    '<b>Клик</b> захватить мышь · <b>WASD</b> движение · <b>ЛКМ</b> огонь · <b>Shift</b> прицел · <b>R</b> перезарядка · <b>G</b> рестарт. Красные бочки детонируют цепочкой.',
    '<b>Click</b> to lock the mouse · <b>WASD</b> move · <b>LMB</b> fire · <b>Shift</b> aim · <b>R</b> reload · <b>G</b> restart. Red barrels chain-detonate.',
  ] as const;
  readonly category = ['⚔️ Экшен и боёвка', '⚔️ Action & Combat'] as const;
  readonly tags = ['шутер', 'fps', 'стрельба', 'hitscan', 'отдача', 'ии', 'бочки', 'взрывы', 'shooter', 'gun'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);

  private ctx!: DemoContext;
  private arena!: THREE.Mesh;

  private enemies: Enemy[] = [];
  private barrels: Barrel[] = [];
  private decals!: THREE.InstancedMesh;
  private decalIndex = 0;

  // Игрок
  private readonly pos = new THREE.Vector3(0, 1.7, 22);
  private yaw = Math.PI;
  private pitch = 0;
  private hp = PLAYER_HP;
  private ammo = 30;
  private reloadTimer = 0;
  private fireTimer = 0;
  private heat = 0;
  private aiming = false;

  // Оружие
  private weapon!: THREE.Group;
  private recoil = 0;
  private bob = 0;
  private muzzle!: THREE.Mesh;
  private muzzleTimer = 0;

  private hitMarkerTimer = 0;
  private killMarker = false;
  private rng = mulberry32(20240821);
  private shotsFired = 0;
  private shotsHit = 0;

  private unsubscribe: (() => void) | null = null;
  private statusTimer = 0;
  private wasDown = false;

  private readonly raycaster = new THREE.Raycaster();
  private readonly dummy = new THREE.Object3D();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly rayDir = new THREE.Vector3();

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x171a20);
    this.scene.fog = new THREE.Fog(0x171a20, 30, 110);

    const sun = new THREE.DirectionalLight(0xffe6c0, 2.2);
    sun.position.set(18, 32, 12);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0x8095b8, 0x1a1d22, 1.1));

    this.buildArena();
    this.buildWeapon();
    this.buildDecals();
    this.restart();
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyR') this.startReload();
      if (code === 'KeyG') this.restart();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    this.movePlayer(dt);
    this.updateWeaponTimers(dt);
    this.updateEnemies(dt);
    this.updateBarrels(dt);
  }

  update(dt: number, ): void {
    this.aimCamera();
    this.handleFiring(dt);
    this.animateWeapon(dt);

    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    this.muzzle.visible = this.muzzleTimer > 0;
    for (const e of this.enemies) {
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 12);
        e.material.emissive.setScalar(e.flash * 0.8);
      }
    }

    this.statusTimer += dt;
    if (this.statusTimer > 0.1) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    this.arena.geometry.disposeBoundsTree?.();
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ────────────────────────────────────────────────────────────── игрок
  private movePlayer(dt: number): void {
    const input = this.ctx.input;
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.right.set(this.forward.z, 0, -this.forward.x);

    const move = input.moveVector();
    const speed = this.aiming ? 4.2 : 8.5;
    this.tmp.set(0, 0, 0)
      .addScaledVector(this.forward, -move.y)
      .addScaledVector(this.right, move.x);
    if (this.tmp.lengthSq() > 0) {
      this.tmp.normalize().multiplyScalar(speed * dt);
      this.pos.add(this.tmp);
      this.bob += speed * dt;
    }

    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -ARENA + 1.5, ARENA - 1.5);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -ARENA + 1.5, ARENA - 1.5);
    this.pos.y = 1.7;
    this.aiming = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  }

  private aimCamera(): void {
    const input = this.ctx.input;
    if (input.isPointerLocked) {
      const d = input.consumeLockDelta();
      const sens = this.aiming ? 0.0011 : 0.0022;
      this.yaw -= d.x * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - d.y * sens, -1.45, 1.45);
    }
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch + this.recoil * 0.06, this.yaw, 0, 'YXZ');
    this.camera.fov = this.aiming ? 52 : 75;
    this.camera.updateProjectionMatrix();
  }

  private handleFiring(dt: number): void {
    const pointer = this.ctx.input.primary;
    const wantsLock = pointer?.down && !this.ctx.input.isPointerLocked;
    if (wantsLock && !this.wasDown) { this.ctx.input.requestPointerLock(); this.wasDown = true; return; }
    if (!pointer?.down) { this.wasDown = false; return; }
    this.wasDown = true;
    if (!this.ctx.input.isPointerLocked) return;

    if (this.fireTimer > 0 || this.reloadTimer > 0) return;
    if (this.ammo <= 0) { this.startReload(); return; }
    this.shoot();
  }

  private shoot(): void {
    this.ammo--;
    this.shotsFired++;
    this.fireTimer = 0.095;
    this.recoil = Math.min(1, this.recoil + 0.55);
    this.heat = Math.min(1, this.heat + 0.16);
    this.muzzleTimer = 0.045;
    this.ctx.audio.playGunshot(1.0, 0.6);
    this.ctx.addTrauma(0.05);          // маленькая: большая тряска мешает целиться

    // Разброс детерминирован от seed выстрела: игрок должен уметь выучить,
    // что первый выстрел точный.
    const spread = (this.aiming ? 0.004 : 0.012) + this.heat * 0.03;
    this.camera.getWorldDirection(this.rayDir);
    this.rayDir.applyAxisAngle(this.camera.up, gauss(this.rng) * spread);
    this.right.set(this.rayDir.z, 0, -this.rayDir.x).normalize();
    this.rayDir.applyAxisAngle(this.right, gauss(this.rng) * spread);

    // 1. Враги: отрезок против сфер зон урона — дешевле мешей и даёт
    //    стабильные хедшоты (shooter_enemy_ai_and_combat.md §1).
    const enemyHit = this.castAgainstEnemies();

    // 2. Геометрия уровня: three-mesh-bvh по слитому мешу.
    this.raycaster.set(this.pos, this.rayDir);
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const levelHit = this.raycaster.intersectObject(this.arena, false)[0];
    const barrelHit = this.castAgainstBarrels();

    const enemyDist = enemyHit ? enemyHit.dist : Infinity;
    const barrelDist = barrelHit ? barrelHit.dist : Infinity;
    const levelDist = levelHit ? levelHit.distance : Infinity;

    if (barrelDist < enemyDist && barrelDist < levelDist && barrelHit) {
      barrelHit.barrel.hp -= 40;
      if (barrelHit.barrel.hp <= 0 && barrelHit.barrel.fuse <= 0) barrelHit.barrel.fuse = 0.001;
      this.shotsHit++;
      this.hitMarkerTimer = 0.12;
      return;
    }

    if (enemyDist < levelDist && enemyHit) {
      const dmg = enemyHit.zone === 'head' ? 100 : enemyHit.zone === 'body' ? 40 : 28;
      enemyHit.enemy.hp -= dmg;
      enemyHit.enemy.flash = 1;
      this.shotsHit++;
      this.hitMarkerTimer = 0.12;
      this.killMarker = enemyHit.enemy.hp <= 0;
      this.ctx.audio.playCoinPickup();
      if (enemyHit.enemy.hp <= 0) this.killEnemy(enemyHit.enemy);
      return;
    }

    if (levelHit?.face) {
      this.placeDecal(levelHit.point, levelHit.face.normal);
      this.hitMarkerTimer = 0;
    }
  }

  private castAgainstEnemies(): { enemy: Enemy; dist: number; zone: 'head' | 'body' | 'limb' } | null {
    let best: { enemy: Enemy; dist: number; zone: 'head' | 'body' | 'limb' } | null = null;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      // Три сферы вместо геометрии модели: точность по мешу не читается
      // игроком и стоит дорого.
      const zones = [
        { c: this.tmp.copy(e.pos).setY(e.pos.y + 1.62), r: 0.26, zone: 'head' as const },
        { c: new THREE.Vector3(e.pos.x, e.pos.y + 1.0, e.pos.z), r: 0.42, zone: 'body' as const },
        { c: new THREE.Vector3(e.pos.x, e.pos.y + 0.45, e.pos.z), r: 0.36, zone: 'limb' as const },
      ];
      for (const z of zones) {
        const d = raySphere(this.pos, this.rayDir, z.c, z.r);
        if (d !== null && (!best || d < best.dist)) best = { enemy: e, dist: d, zone: z.zone };
      }
    }
    return best;
  }

  private castAgainstBarrels(): { barrel: Barrel; dist: number } | null {
    let best: { barrel: Barrel; dist: number } | null = null;
    for (const b of this.barrels) {
      if (b.exploded) continue;
      const d = raySphere(this.pos, this.rayDir, this.tmp.copy(b.pos).setY(b.pos.y + 0.6), 0.62);
      if (d !== null && (!best || d < best.dist)) best = { barrel: b, dist: d };
    }
    return best;
  }

  private startReload(): void {
    if (this.reloadTimer > 0 || this.ammo === 30) return;
    this.reloadTimer = 1.5;
    this.ctx.audio.playButtonClick();
  }

  private updateWeaponTimers(dt: number): void {
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.recoil = Math.max(0, this.recoil - dt * 4.5);
    this.heat = Math.max(0, this.heat - dt * 0.9);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.ammo = 30; this.reloadTimer = 0; }
    }
  }

  // ───────────────────────────────────────────────────────────── враги
  private updateEnemies(dt: number): void {
    let tokens = ATTACK_TOKENS;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      e.stateTime += dt;
      e.cooldown = Math.max(0, e.cooldown - dt);

      const toPlayer = this.tmp.copy(this.pos).sub(e.pos);
      const dist = toPlayer.length();
      const canSee = dist < 40 && this.hasLineOfSight(e.pos, this.pos);

      switch (e.state) {
        case 'idle':
          if (canSee) { e.state = 'alert'; e.stateTime = 0; e.reaction = 0.25 + this.rng() * 0.35; }
          break;

        case 'alert':
          // Задержка реакции: мгновенный ответ выглядит как читерство.
          if (!canSee) { e.state = 'idle'; break; }
          if (e.stateTime >= e.reaction) { e.state = 'engage'; e.stateTime = 0; e.burstLeft = 0; }
          break;

        case 'engage': {
          if (!canSee) { e.state = 'idle'; break; }
          // Токены атаки: одновременно стреляют 2-3 врага, остальные маневрируют.
          if (!e.hasToken && tokens > 0) { e.hasToken = true; tokens--; }
          else if (!e.hasToken) { this.strafe(e, dt); break; }

          if (dist > 18) this.moveTowards(e, this.pos, dt, 3.4);
          else if (dist < 7) this.moveTowards(e, this.pos, dt, -2.6);
          else this.strafe(e, dt);

          if (e.burstLeft > 0) {
            e.burstTimer -= dt;
            if (e.burstTimer <= 0) { this.enemyShoot(e); e.burstTimer = 0.12; e.burstLeft--; }
          } else if (e.cooldown <= 0) {
            e.burstLeft = 3 + Math.floor(this.rng() * 3);   // очередь 3-5
            e.burstTimer = 0;
            e.cooldown = 0.9 + this.rng() * 0.7;            // пауза между очередями
          }
          break;
        }

        default:
          break;
      }

      if (e.state !== 'engage' && e.hasToken) { e.hasToken = false; tokens++; }
      e.root.position.copy(e.pos);
      e.root.rotation.y = Math.atan2(this.pos.x - e.pos.x, this.pos.z - e.pos.z);
    }
  }

  private enemyShoot(e: Enemy): void {
    this.ctx.audio.playLaser();
    // Первая очередь по новой цели намеренно мимо: это сигнал «в тебя стреляют»
    // до потери здоровья (§3 документа).
    if (!e.firstBurstDone) { e.firstBurstDone = true; return; }
    if (this.rng() > 0.45) return;               // враги не снайперы
    this.hp = Math.max(0, this.hp - 4);
    this.ctx.addTrauma(0.12);
    if (this.hp === 0) this.restart();
  }

  private moveTowards(e: Enemy, target: THREE.Vector3, dt: number, speed: number): void {
    const dx = target.x - e.pos.x;
    const dz = target.z - e.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    e.pos.x = THREE.MathUtils.clamp(e.pos.x + (dx / len) * speed * dt, -ARENA + 2, ARENA - 2);
    e.pos.z = THREE.MathUtils.clamp(e.pos.z + (dz / len) * speed * dt, -ARENA + 2, ARENA - 2);
  }

  private strafe(e: Enemy, dt: number): void {
    const dx = this.pos.x - e.pos.x;
    const dz = this.pos.z - e.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = Math.sin(e.stateTime * 0.9) * 3.2;
    e.pos.x = THREE.MathUtils.clamp(e.pos.x + (dz / len) * side * dt, -ARENA + 2, ARENA - 2);
    e.pos.z = THREE.MathUtils.clamp(e.pos.z - (dx / len) * side * dt, -ARENA + 2, ARENA - 2);
  }

  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    this.rayDir.copy(to).sub(from);
    const dist = this.rayDir.length();
    this.rayDir.divideScalar(dist);
    this.raycaster.set(this.tmp.copy(from).setY(from.y + 1.2), this.rayDir);
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.arena, false)[0];
    return !hit || hit.distance > dist - 0.5;
  }

  private killEnemy(e: Enemy): void {
    e.state = 'dead';
    e.root.visible = false;
    e.hasToken = false;
    this.ctx.audio.playExplosion(0.25);
  }

  // ──────────────────────────────────────────────────────── цепные взрывы
  private updateBarrels(dt: number): void {
    for (const b of this.barrels) {
      if (b.exploded || b.fuse <= 0) continue;
      // Таймер живёт в фиксированном шаге, а не в setTimeout: setTimeout не
      // знает про паузу, hit-stop и смену вкладки.
      b.fuse += dt;
      if (b.fuse < 0.12) continue;
      this.explode(b);
    }
  }

  private explode(b: Barrel): void {
    b.exploded = true;
    b.mesh.visible = false;
    this.ctx.audio.playExplosion(1);
    this.ctx.addTrauma(0.5);

    const R = 7;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const d = e.pos.distanceTo(b.pos);
      if (d > R) continue;
      // Квадратичный спад: иначе взрывы либо бесполезны, либо всесильны.
      e.hp -= 160 * (1 - d / R) ** 2;
      e.flash = 1;
      if (e.hp <= 0) this.killEnemy(e);
    }
    for (const other of this.barrels) {
      if (other.exploded || other.fuse > 0) continue;
      if (other.pos.distanceTo(b.pos) <= R) other.fuse = 0.001;   // волна, а не один кадр
    }
    const dp = this.pos.distanceTo(b.pos);
    if (dp <= R) this.hp = Math.max(0, this.hp - 60 * (1 - dp / R) ** 2);
  }

  // ─────────────────────────────────────────────────────────────── сцена
  private buildArena(): void {
    const parts: THREE.BufferGeometry[] = [];
    const floor = new THREE.BoxGeometry(ARENA * 2, 1, ARENA * 2);
    floor.translate(0, -0.5, 0);
    parts.push(floor);

    for (const [x, z, w, d, h] of COVERS) {
      const box = new THREE.BoxGeometry(w, h, d);
      box.translate(x, h / 2, z);
      parts.push(box);
    }
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const wall = new THREE.BoxGeometry(sx ? 1 : ARENA * 2, 6, sz ? 1 : ARENA * 2);
      wall.translate(sx * ARENA, 3, sz * ARENA);
      parts.push(wall);
    }

    const merged = BufferGeometryUtils.mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    merged.computeVertexNormals();
    // Коллизия и прицеливание — из ТЕХ ЖЕ буферов, что и видимая геометрия.
    // BVH включает ускорение обычного THREE.Raycaster — отдельная ссылка на
    // дерево не нужна, обращений к shapecast здесь нет.
    merged.computeBoundsTree({ targetLeafSize: 10 });

    this.arena = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x4b5563 }));
    this.arena.receiveShadow = true;
    this.arena.castShadow = true;
    this.scene.add(this.arena);
  }

  private buildWeapon(): void {
    this.weapon = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.13, 0.62),
      new THREE.MeshLambertMaterial({ color: 0x2f333a }),
    );
    body.position.set(0.16, -0.14, -0.42);
    this.weapon.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x1c1f24 }),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.16, -0.11, -0.82);
    this.weapon.add(barrel);

    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffdf6b }),
    );
    this.muzzle.position.set(0.16, -0.11, -1.02);
    this.muzzle.visible = false;
    this.weapon.add(this.muzzle);

    this.camera.add(this.weapon);
    this.scene.add(this.camera);
  }

  private animateWeapon(dt: number): void {
    // Покачивание при ходьбе и «увод» при отдаче: оружие — часть камеры,
    // поэтому анимируется в её локальном пространстве.
    const sway = Math.sin(this.bob * 2.1) * 0.012;
    const bobY = Math.abs(Math.cos(this.bob * 2.1)) * 0.008;
    const aim = this.aiming ? 1 : 0;
    this.weapon.position.x = THREE.MathUtils.lerp(this.weapon.position.x, -aim * 0.16 + sway, 1 - Math.exp(-14 * dt));
    this.weapon.position.y = THREE.MathUtils.lerp(this.weapon.position.y, aim * 0.03 + bobY, 1 - Math.exp(-14 * dt));
    this.weapon.position.z = this.recoil * 0.09;
    this.weapon.rotation.x = this.recoil * 0.18;
  }

  private buildDecals(): void {
    this.decals = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.11, 8),
      new THREE.MeshBasicMaterial({ color: 0x12141a, transparent: true, opacity: 0.85, depthWrite: false }),
      MAX_DECALS,
    );
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.frustumCulled = false;
    this.decals.count = 0;
    this.scene.add(this.decals);
  }

  private placeDecal(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.dummy.position.copy(point).addScaledVector(normal, 0.01);
    this.dummy.lookAt(this.dummy.position.clone().add(normal));
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    // Кольцевой буфер: без потолка декали растут весь бой.
    this.decals.setMatrixAt(this.decalIndex % MAX_DECALS, this.dummy.matrix);
    this.decalIndex++;
    this.decals.count = Math.min(this.decalIndex, MAX_DECALS);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  private restart(): void {
    for (const e of this.enemies) e.root.removeFromParent();
    for (const b of this.barrels) b.mesh.removeFromParent();
    this.enemies = [];
    this.barrels = [];
    this.hp = PLAYER_HP;
    this.ammo = 30;
    this.reloadTimer = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.pos.set(0, 1.7, 22);
    this.rng = mulberry32(20240821);

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 14 + (i % 3) * 6;
      this.enemies.push(this.makeEnemy(Math.cos(a) * r, Math.sin(a) * r - 6));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      this.barrels.push(this.makeBarrel(Math.cos(a) * 11, Math.sin(a) * 11 - 4));
    }
  }

  private makeEnemy(x: number, z: number): Enemy {
    const root = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: 0xd9534f });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), material);
    body.position.y = 1.0;
    body.castShadow = true;
    root.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), material);
    head.position.y = 1.62;
    head.castShadow = true;
    root.add(head);
    root.position.set(x, 0, z);
    this.scene.add(root);

    return {
      root, material,
      pos: new THREE.Vector3(x, 0, z),
      hp: 120, state: 'idle', stateTime: 0, reaction: 0.4,
      burstLeft: 0, burstTimer: 0, cooldown: 0,
      hasToken: false, firstBurstDone: false,
      target: new THREE.Vector3(), flash: 0,
    };
  }

  private makeBarrel(x: number, z: number): Barrel {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10),
      new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x2a0806 }),
    );
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    return { mesh, pos: new THREE.Vector3(x, 0, z), hp: 40, fuse: 0, exploded: false };
  }

  private pushStatus(): void {
    const alive = this.enemies.filter((e) => e.state !== 'dead').length;
    const engaged = this.enemies.filter((e) => e.state === 'engage' && e.hasToken).length;
    const acc = this.shotsFired ? (this.shotsHit / this.shotsFired) * 100 : 0;
    this.ctx.setStatus(
      `HP <span class="hp">${this.hp}</span>`
      + ` · патроны <b>${this.ammo}/30</b>${this.reloadTimer > 0 ? ' (перезарядка)' : ''}`
      + ` · врагов ${alive}, стреляют ${engaged}/${ATTACK_TOKENS} (токены атаки)`
      + ` · точность ${acc.toFixed(0)} %`
      + ` · разброс ${(this.heat * 100).toFixed(0)} %`
      + (this.hitMarkerTimer > 0 ? (this.killMarker ? ' · <b>УБИТ</b>' : ' · <b>попадание</b>') : '')
      + (this.ctx.input.isPointerLocked ? '' : ' · <b>кликните, чтобы захватить мышь</b>'),
    );
  }
}

/** Пересечение луча со сферой; возвращает расстояние или null. */
function raySphere(
  origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number,
): number | null {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t < 0) return null;
  const dx = ox - dir.x * t;
  const dy = oy - dir.y * t;
  const dz = oz - dir.z * t;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > radius * radius) return null;
  return t - Math.sqrt(radius * radius - d2);
}

/** Приблизительно нормальное распределение из двух равномерных. */
function gauss(rng: () => number): number {
  return (rng() + rng() - 1);
}

const COVERS: Array<[number, number, number, number, number]> = [
  [-12, -4, 4, 2, 1.3], [10, 2, 5, 2, 1.6], [0, -14, 6, 2, 1.2],
  [-18, 10, 2, 6, 1.8], [16, -12, 2, 6, 1.5], [4, 14, 5, 2, 1.1],
];
