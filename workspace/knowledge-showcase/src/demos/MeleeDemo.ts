import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { buildFighter, type FighterRig } from '../world/fighterRig';
import { Ragdoll } from '../world/ragdoll';
import {
  COMBO, ENEMY_SWING, MeleeFighter, PARRY, inSwingArc, parryResult,
  staggerFrames, staggerScaling, BLOCK_CHIP, type Swing,
} from '../game/meleeCombat';

const ARENA_R = 13;
const PLAYER_SPEED = 5.4;
const ENEMY_SPEED = 3.1;
const BODY_R = 0.42;
/** Одновременно бьёт максимум столько врагов — остальные кружат. */
const ATTACK_TOKENS = 2;
const MAX_RAGDOLLS = 6;
/** Секунд, после которых уснувший труп убирается. */
const RAGDOLL_TTL = 14;

type EnemyMood = 'approach' | 'circle' | 'commit';

class Actor {
  readonly combat: MeleeFighter;
  readonly pos = new THREE.Vector3();
  facing = 0;
  /** Остаток доводки текущего приёма, метры. */
  lunge = 0;
  mood: EnemyMood = 'approach';
  /** Кадров до следующего решения ИИ. */
  think = 0;
  /** Направление кружения: 1 / -1. */
  orbit: 1 | -1 = 1;
  hasToken = false;

  constructor(readonly rig: FighterRig, hp: number, readonly id: number) {
    this.combat = new MeleeFighter(hp);
  }
}

/**
 * Слэшер: связки, парирование, hit-stop и рэгдолл на Rapier.
 *
 * Проверяет knowledge/threejs/melee_combat_and_ragdoll.md и
 * knowledge/mechanics/ragdoll.md. Живые бойцы двигаются кинематически по
 * автомату состояний — физика включается только для трупа. Смешивать одно с
 * другим («живой враг на рэгдолле, которым мы рулим силами») дороже и
 * непредсказуемее, чем оба подхода по отдельности.
 *
 * Hit-stop реализован счётчиком кадров, а не `setTimeout`: таймер реального
 * времени не знает ни про паузу, ни про свёрнутую вкладку, ни про то, что
 * логика идёт фиксированным шагом — и на 30 FPS даёт другую длительность.
 */
export class MeleeDemo implements Demo {
  readonly id = 'melee';
  readonly title = ['⚔️ Слэшер и рэгдолл', '⚔️ Slasher & ragdoll'] as const;
  readonly hint = [
    '<b>WASD</b> движение · <b>J</b>/ЛКМ удар (связка из 3) · <b>K</b> парирование'
    + ' · <b>Tab</b> захват цели · <b>R</b> заново<br>'
    + 'Парируй за 6 кадров до удара — откроется риспост (85 урона). Связка не сбрасывается 22 кадра.',
    '<b>WASD</b> move · <b>J</b>/LMB attack (3-hit combo) · <b>K</b> parry'
    + ' · <b>Tab</b> lock on · <b>R</b> restart<br>'
    + 'Parry within 6 frames of the blow to open a riposte (85 dmg). Combo lingers for 22 frames.',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);

  private ctx!: DemoContext;
  private world!: RAPIER.World;
  private player!: Actor;
  private enemies: Actor[] = [];
  private ragdolls: Ragdoll[] = [];
  private frame = 0;
  private hitstop = 0;
  private lockTarget: Actor | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastParry: 'perfect' | 'block' | '—' = '—';
  private kills = 0;
  private wave = 1;
  private readonly tmp = new THREE.Vector3();
  private camTarget = new THREE.Vector3(0, 1.2, 0);

  async init(ctx: DemoContext): Promise<void> {
    this.ctx = ctx;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -19.6, z: 0 });
    this.world.timestep = 1 / 60;

    // Пол под рэгдоллы: единственное, что физике здесь нужно от арены.
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARENA_R + 4, 0.5, ARENA_R + 4)
        .setTranslation(0, -0.5, 0)
        .setFriction(0.9)
        // membership «земля», фильтр «рэгдолл»: см. world/ragdoll.ts.
        .setCollisionGroups((0x0001 << 16) | 0x0008),
      ground,
    );

    this.scene.background = new THREE.Color(0x0f1218);
    this.scene.fog = new THREE.Fog(0x0f1218, 22, 52);
    this.buildLights(ctx);
    this.scene.add(this.buildArena());

    this.player = new Actor(buildFighter(0x63b3ff, 0xffd8ac), 220, 0);
    this.player.rig.armR.add(buildSword(0xe8f0f4, 0xf0b429));
    this.scene.add(this.player.rig.root);

    this.spawnWave();
    this.camera.position.set(0, 8.5, 11);
    this.camera.lookAt(0, 1.2, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyJ') this.player.combat.requestAttack(this.frame);
      if (code === 'KeyK') this.tryParry();
      if (code === 'Tab') this.cycleLock();
      if (code === 'KeyR') this.restart();
    });
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(dt: number): void {
    this.frame++;

    // Hit-stop замораживает ВСЁ, включая физику трупов: иначе кадр веса
    // удара выглядит так, будто мир завис, а трупы продолжают ехать.
    if (this.hitstop > 0) { this.hitstop--; return; }

    // ЛКМ читается удержанием — но приём запускается по буферу, поэтому
    // автоатаки не будет: `requestAttack` только ставит метку кадра.
    if (this.ctx.input.primary?.down) this.player.combat.requestAttack(this.frame);

    this.stepPlayer(dt);
    this.stepEnemies(dt);

    this.resolveSwing(this.player, this.enemies);
    for (const e of this.enemies) this.resolveSwing(e, [this.player]);

    this.separate();
    this.world.step();
    this.stepRagdolls(dt);

    if (this.enemies.length === 0) { this.wave++; this.spawnWave(); }
    if (!this.player.combat.alive) this.restart();
    if (this.frame % 6 === 0) this.pushStatus();
  }

  update(dt: number): void {
    this.syncRig(this.player);
    for (const e of this.enemies) this.syncRig(e);
    for (const r of this.ragdolls) r.sync();

    // Камера над плечом, но с фиксированным углом: в арене с четырьмя
    // врагами свободная орбита прячет того, кто заходит со спины.
    const p = this.player.pos;
    this.camTarget.lerp(this.tmp.set(p.x, 1.2, p.z), 1 - Math.exp(-7 * dt));
    const k = 1 - Math.exp(-6 * dt);
    this.camera.position.x += (this.camTarget.x - this.camera.position.x) * k;
    this.camera.position.y += (this.camTarget.y + 7.4 - this.camera.position.y) * k;
    this.camera.position.z += (this.camTarget.z + 9.6 - this.camera.position.z) * k;
    this.camera.lookAt(this.camTarget);
  }

  dispose(): void {
    for (const r of this.ragdolls) r.dispose();
    this.ragdolls.length = 0;
    disposeObject(this.scene as unknown as THREE.Object3D);
    this.world.free();
  }

  // ─────────────────────────────────────────────────────────────── игрок
  private tryParry(): void {
    if (this.player.combat.requestParry()) this.ctx.audio.playButtonClick();
  }

  private cycleLock(): void {
    if (this.enemies.length === 0) { this.lockTarget = null; return; }
    const i = this.lockTarget ? this.enemies.indexOf(this.lockTarget) : -1;
    this.lockTarget = this.enemies[(i + 1) % this.enemies.length];
  }

  private stepPlayer(dt: number): void {
    const a = this.player;
    const c = a.combat;
    if (c.tick(this.frame)) this.ctx.audio.playSwordSlash();

    // Захват цели пережил свою цель — снимаем.
    if (this.lockTarget && !this.enemies.includes(this.lockTarget)) this.lockTarget = null;

    const mv = this.ctx.input.moveVector();
    // Во время приёма ходить нельзя — иначе кадры не имеют цены и любой
    // промах отменяется шагом назад.
    const canMove = c.state === 'idle';
    if (canMove && mv.lengthSq() > 0) {
      a.pos.x += mv.x * PLAYER_SPEED * dt;
      a.pos.z += mv.y * PLAYER_SPEED * dt;
      if (!this.lockTarget) a.facing = Math.atan2(mv.x, mv.y);
    }
    if (this.lockTarget) {
      a.facing = Math.atan2(this.lockTarget.pos.x - a.pos.x, this.lockTarget.pos.z - a.pos.z);
    }
    this.applyLunge(a, dt);
    this.clampToArena(a);
  }

  // ─────────────────────────────────────────────────────────────── враги
  private stepEnemies(dt: number): void {
    // Токены атаки: без них четыре врага бьют одновременно и бой становится
    // лотереей. Это тот же приём, что в FpsDemo (knowledge §«окружение»).
    let tokens = ATTACK_TOKENS;
    for (const e of this.enemies) {
      if (e.combat.state === 'startup' || e.combat.state === 'active') { e.hasToken = true; tokens--; }
      else e.hasToken = false;
    }

    const p = this.player;
    for (const e of this.enemies) {
      e.combat.tick(this.frame);
      if (e.combat.state === 'stagger' || e.combat.state === 'dead') { this.applyLunge(e, dt); continue; }

      const dx = p.pos.x - e.pos.x;
      const dz = p.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) || 1e-6;
      e.facing = Math.atan2(dx, dz);

      if (e.combat.busy) { this.applyLunge(e, dt); continue; }

      if (e.think > 0) e.think--;
      const inRange = dist < ENEMY_SWING.reach + BODY_R - 0.15;

      if (inRange && tokens > 0 && e.think === 0) {
        e.combat.start(ENEMY_SWING);
        e.lunge = ENEMY_SWING.lunge;
        tokens--;
        e.think = 40 + Math.floor(Math.random() * 50);
        e.mood = 'commit';
      } else if (dist > 2.4) {
        e.mood = 'approach';
        e.pos.x += (dx / dist) * ENEMY_SPEED * dt;
        e.pos.z += (dz / dist) * ENEMY_SPEED * dt;
      } else {
        // Кружение: враг без токена не стоит столбом и не толкается в спину.
        e.mood = 'circle';
        const ox = -dz / dist * e.orbit;
        const oz = dx / dist * e.orbit;
        e.pos.x += ox * ENEMY_SPEED * 0.55 * dt;
        e.pos.z += oz * ENEMY_SPEED * 0.55 * dt;
        if (this.frame % 90 === 0 && Math.random() < 0.4) e.orbit = (e.orbit === 1 ? -1 : 1);
      }
      this.applyLunge(e, dt);
      this.clampToArena(e);
    }
  }

  // ───────────────────────────────────────────────────────────── попадания
  private resolveSwing(attacker: Actor, targets: Actor[]): void {
    const c = attacker.combat;
    if (c.state !== 'active' || !c.swing) return;
    const swing = c.swing;

    for (const t of targets) {
      if (!t.combat.alive || c.hitThisSwing.has(t.id)) continue;
      const dx = t.pos.x - attacker.pos.x;
      const dz = t.pos.z - attacker.pos.z;
      if (!inSwingArc(dx, dz, attacker.facing, swing, BODY_R)) continue;

      c.hitThisSwing.add(t.id);
      this.landHit(attacker, t, swing, dx, dz);
    }
  }

  private landHit(attacker: Actor, target: Actor, swing: Swing, dx: number, dz: number): void {
    const tc = target.combat;

    if (tc.state === 'parry') {
      const result = parryResult(tc.parryFrame);
      if (result === 'perfect') {
        this.lastParry = 'perfect';
        tc.grantRiposte();
        // Атакующего отбрасывает в стан — окно для ответа реально существует.
        attacker.combat.stagger(staggerFrames(30));
        this.hitstop = 12;
        this.ctx.addTrauma(0.35);
        this.ctx.audio.playParryClang();
        return;
      }
      if (result === 'block') {
        this.lastParry = 'block';
        tc.hp -= Math.round(swing.damage * BLOCK_CHIP);
        this.hitstop = Math.max(this.hitstop, 3);
        this.ctx.audio.playParryClang();
        return;
      }
      // result === 'none': хвост стойки — удар проходит как обычный.
    }

    const dmg = Math.round(swing.damage * staggerScaling(tc.staggerHits));
    tc.hp -= dmg;
    this.hitstop = Math.max(this.hitstop, swing.hitstop);
    this.ctx.addTrauma(0.08 + swing.damage / 900);
    this.ctx.audio.playGunshot(0.5 + swing.damage / 260, 0.45);

    if (tc.hp <= 0) {
      this.killActor(target, dx, dz, swing);
      return;
    }
    tc.stagger(staggerFrames(dmg));
    // Отброс: жертву отодвигает по направлению удара, а не «в сторону мира».
    const len = Math.hypot(dx, dz) || 1;
    target.pos.x += (dx / len) * swing.knockback * 0.045;
    target.pos.z += (dz / len) * swing.knockback * 0.045;
    this.clampToArena(target);
  }

  private killActor(target: Actor, dx: number, dz: number, swing: Swing): void {
    target.combat.kill();
    const len = Math.hypot(dx, dz) || 1;
    const impulse = new THREE.Vector3((dx / len) * swing.knockback, 0, (dz / len) * swing.knockback);

    const ragdoll = new Ragdoll(this.world, {
      position: target.pos.clone(),
      facing: target.facing,
      suit: 0xd0523f,
      skin: 0xe8b98a,
      impulse,
      impulseBone: swing.damage > 50 ? 'head' : 'chest',
    });
    this.scene.add(ragdoll.group);
    this.ragdolls.push(ragdoll);
    if (this.ragdolls.length > MAX_RAGDOLLS) this.ragdolls.shift()!.dispose();

    target.rig.root.removeFromParent();
    this.enemies = this.enemies.filter((e) => e !== target);
    if (this.lockTarget === target) this.lockTarget = null;
    this.kills++;
    this.ctx.addTrauma(0.22);
  }

  private stepRagdolls(dt: number): void {
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const r = this.ragdolls[i];
      r.age += dt;
      // Убираем только уснувшие: труп, растворившийся в полёте, читается
      // как баг. Уснувший при этом больше не стоит ни кадра решателя.
      if (r.age > RAGDOLL_TTL && r.settled) {
        r.dispose();
        this.ragdolls.splice(i, 1);
      }
    }
  }

  /** Доводка приёма: боец сам едет вперёд на замахе и активных кадрах. */
  private applyLunge(a: Actor, dt: number): void {
    const c = a.combat;
    if (c.swing && (c.state === 'startup' || c.state === 'active')) {
      if (a.lunge <= 0) a.lunge = c.swing.lunge;
      const total = (c.swing.startup + c.swing.active) / 60;
      const move = Math.min(a.lunge, (c.swing.lunge / total) * dt);
      a.lunge -= move;
      a.pos.x += Math.sin(a.facing) * move;
      a.pos.z += Math.cos(a.facing) * move;
    } else {
      a.lunge = 0;
    }
  }

  /** Тела не проходят друг сквозь друга — иначе враги слипаются в одного. */
  private separate(): void {
    const all = [this.player, ...this.enemies];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = BODY_R * 2;
        if (d >= min || d < 1e-5) continue;
        const push = (min - d) / 2;
        a.pos.x -= (dx / d) * push;
        a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push;
        b.pos.z += (dz / d) * push;
      }
    }
    for (const a of all) this.clampToArena(a);
  }

  private clampToArena(a: Actor): void {
    const d = Math.hypot(a.pos.x, a.pos.z);
    if (d > ARENA_R) {
      a.pos.x = (a.pos.x / d) * ARENA_R;
      a.pos.z = (a.pos.z / d) * ARENA_R;
    }
  }

  // ─────────────────────────────────────────────────────────── сцена и визуал
  private spawnWave(): void {
    const count = Math.min(2 + this.wave, 5);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + this.wave;
      const e = new Actor(buildFighter(0xc94f3d, 0xe8b98a), 100 + this.wave * 10, 100 + this.frame + i);
      e.pos.set(Math.sin(ang) * 9, 0, Math.cos(ang) * 9);
      e.orbit = i % 2 === 0 ? 1 : -1;
      e.think = 30 + i * 12;
      e.rig.armR.add(buildSword(0x9aa6ad, 0x6b4a2a));
      this.scene.add(e.rig.root);
      this.enemies.push(e);
    }
  }

  private restart(): void {
    for (const e of this.enemies) e.rig.root.removeFromParent();
    this.enemies = [];
    for (const r of this.ragdolls) r.dispose();
    this.ragdolls = [];
    this.player.combat.reset();
    this.player.pos.set(0, 0, 0);
    this.lockTarget = null;
    this.hitstop = 0;
    this.kills = 0;
    this.wave = 1;
    this.spawnWave();
  }

  private syncRig(a: Actor): void {
    const rig = a.rig;
    const c = a.combat;
    rig.root.position.copy(a.pos);
    rig.root.rotation.y = a.facing;

    // Поза читается по состоянию: игрок должен видеть замах ДО удара,
    // иначе парировать нечего (knowledge/mechanics/frame_data_combat.md).
    let armR = 0;
    let lean = 0;
    switch (c.state) {
      case 'startup': armR = -1.9; lean = -0.15; break;
      case 'active': armR = 1.1; lean = 0.28; break;
      case 'recovery': armR = 0.45; lean = 0.12; break;
      case 'parry': armR = -0.6; lean = -0.05; break;
      case 'stagger': armR = 0.2; lean = -0.4; break;
      default: break;
    }
    rig.armR.rotation.x = armR;
    rig.armL.rotation.x = -armR * 0.25;
    rig.torso.rotation.x = lean;
    rig.torso.rotation.z = c.state === 'stagger' ? 0.3 : 0;

    // Подсветка: белая — окно идеального парирования, красная — получил урон.
    const perfect = c.state === 'parry' && c.parryFrame < PARRY.perfect;
    rig.setFlash(perfect ? 0.8 : c.state === 'stagger' ? 1 : 0);
  }

  private buildLights(ctx: DemoContext): void {
    const key = new THREE.DirectionalLight(0xffe6c4, 2.2);
    key.position.set(6, 14, 8);
    key.castShadow = ctx.tier !== 'low';
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -18; key.shadow.camera.right = 18;
    key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0x4a6ea8, 0x1a1418, 0.9));
  }

  private buildArena(): THREE.Group {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_R + 1.5, ARENA_R + 2, 0.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.95 }),
    );
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    g.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_R, 0.12, 6, 64),
      new THREE.MeshStandardMaterial({ color: 0xf0a020, emissive: 0x4a2c00, roughness: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    // Колонны — одним инстансированным мешем: 8 объектов не стоят 8 draw call.
    const pillars = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.62, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }),
      8,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      dummy.position.set(Math.sin(a) * (ARENA_R + 2.6), 2.75, Math.cos(a) * (ARENA_R + 2.6));
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
    }
    pillars.instanceMatrix.needsUpdate = true;
    pillars.castShadow = true;
    g.add(pillars);
    return g;
  }

  private pushStatus(): void {
    const c = this.player.combat;
    const step = c.swing ? c.swing.id : '—';
    this.ctx.setStatus(
      `<span class="hp">HP ${Math.max(0, c.hp)}/${c.maxHp}</span>`
      + ` · волна <b>${this.wave}</b> · врагов <b>${this.enemies.length}</b> · убито <b>${this.kills}</b>`
      + ` · приём <b>${step}</b> (${c.state}, ${c.timer})`
      + ` · связка <b>${c.linger > 0 ? c.stepIndex + 1 : 0}</b>/${COMBO.length}`
      + (c.riposteWindow > 0 ? ` · <b>РИСПОСТ ${c.riposteWindow}</b>` : '')
      + ` · парри: ${this.lastParry} · трупов ${this.ragdolls.length}`,
    );
  }
}

/** Процедурный меч: лезвие, гарда, рукоять. Никаких .gltf. */
function buildSword(blade: number, guard: number): THREE.Group {
  const sword = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: blade, metalness: 0.9, roughness: 0.18 });
  const guardMat = new THREE.MeshStandardMaterial({ color: guard, metalness: 0.7, roughness: 0.4 });

  const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.02), bladeMat);
  b.position.y = -0.95;
  b.castShadow = true;
  sword.add(b);

  const gd = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.06), guardMat);
  gd.position.y = -0.42;
  sword.add(gd);

  // Меч висит в кисти: группа руки вращается в плече, меч едет вместе с ней.
  sword.position.set(0, -0.62, 0.05);
  sword.rotation.x = Math.PI;
  return sword;
}
