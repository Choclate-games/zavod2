import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { buildFighter, type FighterRig } from '../world/fighterRig';
import {
  MOVES, comboScaling, frameAdvantageOnBlock, type Move, type MoveId,
} from '../game/fightingMoves';

const ARENA_HALF = 9.5;
const START_GAP = 3.4;
const MAX_HP = 1000;
const BUFFER_FRAMES = 6;

type State =
  | 'idle' | 'walk' | 'crouch'
  | 'startup' | 'active' | 'recovery'
  | 'blockstun' | 'hitstun' | 'knockdown' | 'wakeup';

interface Box { x: number; y: number; w: number; h: number }

const HURT_STAND: Box = { x: 0, y: 0.95, w: 0.7, h: 1.9 };
const HURT_CROUCH: Box = { x: 0, y: 0.55, w: 0.8, h: 1.1 };
const PUSH_BOX: Box = { x: 0, y: 0.9, w: 0.75, h: 1.8 };

class Fighter {
  state: State = 'idle';
  stateFrame = 0;
  move: Move | null = null;
  hasHitThisMove = false;
  hp = MAX_HP;
  meter = 0;
  comboHits = 0;
  facing: 1 | -1 = 1;
  x = 0;
  y = 0;
  vy = 0;
  holdingBack = false;
  crouching = false;
  /** Буфер ввода: приём и кадр, на котором он был запрошен. */
  buffered: { id: MoveId; frame: number } | null = null;

  constructor(readonly rig: FighterRig, readonly isPlayer: boolean) {}

  get hurtbox(): Box {
    return this.crouching && this.state === 'crouch' ? HURT_CROUCH : HURT_STAND;
  }

  reset(x: number, facing: 1 | -1): void {
    this.state = 'idle';
    this.stateFrame = 0;
    this.move = null;
    this.hasHitThisMove = false;
    this.hp = MAX_HP;
    this.meter = 0;
    this.comboHits = 0;
    this.x = x;
    this.y = 0;
    this.vy = 0;
    this.facing = facing;
    this.buffered = null;
  }

  enter(state: State, frames = 0): void {
    this.state = state;
    this.stateFrame = frames;
    if (state === 'startup') this.hasHitThisMove = false;
  }

  /** Занят ли боец: во время приёма и стана новый ввод только буферизуется. */
  get busy(): boolean {
    return this.state !== 'idle' && this.state !== 'walk' && this.state !== 'crouch';
  }
}

/**
 * Файтинг: фрейм-дата, хитбоксы, hit-stop, откидывание, 2.5D камера.
 *
 * Прямая проверка knowledge/threejs/fighting_game_core.md. Вся логика идёт
 * фиксированным шагом 1/60 (fixedUpdate), визуал — в update().
 */
export class FightingDemo implements Demo {
  readonly id = 'fighting';
  readonly title = ['🥊 Файтинг: фрейм-дата', '🥊 Fighting: frame data'] as const;
  readonly hint = [
    '<b>A</b>/<b>D</b> шаги (назад = блок) · <b>S</b> присед · <b>J</b> лёгкий (4к) · <b>K</b> средний (7к) · <b>L</b> тяжёлый (14к) · <b>I</b> апперкот · <b>H</b> хитбоксы',
    '<b>A</b>/<b>D</b> walk (back = block) · <b>S</b> crouch · <b>J</b> light (4f) · <b>K</b> medium (7f) · <b>L</b> heavy (14f) · <b>I</b> uppercut · <b>H</b> hitboxes',
  ] as const;
  readonly category = ['⚔️ Экшен и боёвка', '⚔️ Action & Combat'] as const;
  readonly tags = ['файтинг', 'бой', 'фреймдата', 'хитбокс', 'комбо', 'fighting', 'framedata', 'hitbox', 'combo'] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  private ctx!: DemoContext;
  private player!: Fighter;
  private bot!: Fighter;
  private hitstop = 0;
  private frame = 0;
  private showBoxes = false;
  private boxHelpers: THREE.LineSegments[] = [];
  private boxGroup = new THREE.Group();
  private unsubscribe: (() => void) | null = null;

  // ИИ
  private botReaction = 14;      // кадров между «увидел» и «ответил»
  private botTimer = 0;
  private botIntent: MoveId | null = null;
  private roundOverFrames = 0;

  init(ctx: DemoContext): void {
    this.ctx = ctx;
    this.scene.background = new THREE.Color(0x141018);
    this.scene.fog = new THREE.Fog(0x141018, 18, 42);

    const key = new THREE.DirectionalLight(0xfff0e0, 2.4);
    key.position.set(4, 9, 8);
    key.castShadow = ctx.tier !== 'low';
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 10; key.shadow.camera.bottom = -4;
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0x7788ff, 0x221822, 0.85));

    const rim = new THREE.PointLight(0xff4488, 30, 30);
    rim.position.set(-8, 4, -6);
    this.scene.add(rim);

    this.scene.add(this.buildArena());
    this.scene.add(this.boxGroup);

    this.player = new Fighter(buildFighter(0x4aa3ff, 0xffd08a), true);
    this.bot = new Fighter(buildFighter(0xff5c5c, 0xf0c9a0), false);
    this.scene.add(this.player.rig.root, this.bot.rig.root);
    this.resetRound();

    this.camera.position.set(0, 2.6, 11);
    this.camera.lookAt(0, 1.5, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyH') { this.showBoxes = !this.showBoxes; this.boxGroup.visible = this.showBoxes; }
      if (code === 'KeyR') this.resetRound();
      const id = KEY_TO_MOVE[code];
      // Буферизуем ВСЕГДА: нажатие чуть раньше выхода из recovery должно
      // засчитаться, иначе комбо физически не собирается (§6 документа).
      if (id) this.player.buffered = { id, frame: this.frame };
    });
    this.pushStatus();
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  fixedUpdate(): void {
    this.frame++;

    // Hit-stop замораживает ОБОИХ — главный источник веса удара.
    if (this.hitstop > 0) { this.hitstop--; return; }

    if (this.roundOverFrames > 0) {
      if (--this.roundOverFrames === 0) this.resetRound();
      return;
    }

    this.readPlayerInput();
    this.thinkBot();

    this.stepFighter(this.player);
    this.stepFighter(this.bot);

    this.resolveHits(this.player, this.bot);
    this.resolveHits(this.bot, this.player);
    this.separate();
    this.faceEachOther();

    if (this.player.hp <= 0 || this.bot.hp <= 0) {
      this.roundOverFrames = 110;
      this.ctx.addTrauma(0.5);
      this.ctx.audio.playExplosion(0.6);
    }
    this.pushStatus();
  }

  update(dt: number): void {
    this.syncRig(this.player);
    this.syncRig(this.bot);
    if (this.showBoxes) this.updateBoxHelpers();

    // Камера: оба бойца всегда в кадре, поворота вокруг Y нет.
    const mid = (this.player.x + this.bot.x) / 2;
    const gap = Math.abs(this.player.x - this.bot.x);
    const targetX = THREE.MathUtils.clamp(mid, -ARENA_HALF + 4, ARENA_HALF - 4);
    const targetZ = THREE.MathUtils.clamp(8.5 + gap * 0.6, 9, 16);
    const k = 1 - Math.exp(-9 * dt);
    this.camera.position.x += (targetX - this.camera.position.x) * k;
    this.camera.position.z += (targetZ - this.camera.position.z) * k;
    this.camera.position.y += (2.5 + gap * 0.06 - this.camera.position.y) * k;
    this.camera.lookAt(targetX, 1.45, 0);
  }

  dispose(): void {
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  // ──────────────────────────────────────────────────────────── логика боя
  private readPlayerInput(): void {
    const f = this.player;
    const input = this.ctx.input;
    const back = f.facing === 1 ? 'KeyA' : 'KeyD';
    const fwd = f.facing === 1 ? 'KeyD' : 'KeyA';

    f.holdingBack = input.isDown(back);
    f.crouching = input.isDown('KeyS');

    if (f.buffered && this.frame - f.buffered.frame > BUFFER_FRAMES) f.buffered = null;

    if (!f.busy) {
      if (f.buffered) {
        this.startMove(f, f.buffered.id);
        f.buffered = null;
      } else if (f.crouching) {
        f.enter('crouch');
      } else if (input.isDown(fwd) || input.isDown(back)) {
        f.enter('walk');
        f.x += (input.isDown(fwd) ? 1 : -1) * f.facing * (input.isDown(fwd) ? 0.075 : 0.055);
      } else {
        f.enter('idle');
      }
    }
  }

  private thinkBot(): void {
    const b = this.bot;
    const p = this.player;
    const gap = Math.abs(b.x - p.x);

    if (b.busy) return;

    // Задержка реакции: мгновенный ответ читается игроком как читерство (§7).
    if (this.botTimer > 0) { this.botTimer--; }

    // Блок: бот держит блок, когда игрок в активной фазе на дистанции.
    b.holdingBack = p.state === 'startup' && gap < 2.4 && this.frame % 5 !== 0;

    if (this.botTimer > 0) return;

    if (gap > 2.6) {
      // Neutral-танец: подходим до края собственной досягаемости.
      b.enter('walk');
      b.x += (p.x > b.x ? 1 : -1) * 0.062;
      return;
    }
    if (gap < 1.2) {
      b.enter('walk');
      b.x += (p.x > b.x ? -1 : 1) * 0.05;
      return;
    }

    // Наказание: если игрок в recovery — самый быстрый приём.
    this.botIntent = p.state === 'recovery' ? 'light'
      : gap < 1.9 ? (Math.random() < 0.45 ? 'medium' : 'light')
      : 'heavy';
    this.startMove(b, this.botIntent);
    this.botTimer = this.botReaction + Math.floor(Math.random() * 10);
  }

  private startMove(f: Fighter, id: MoveId): void {
    const move = MOVES[id];
    f.move = move;
    f.enter('startup', move.startup);
    if (id === 'heavy' || id === 'uppercut') this.ctx.audio.playSwordSlash();
  }

  private stepFighter(f: Fighter): void {
    // Гравитация для подброшенных.
    if (f.y > 0 || f.vy !== 0) {
      f.vy -= 0.055;
      f.y = Math.max(0, f.y + f.vy);
      if (f.y === 0 && f.vy < 0) {
        f.vy = 0;
        f.enter('knockdown', 26);
        f.comboHits = 0;
      }
    }

    if (f.stateFrame > 0) f.stateFrame--;
    if (f.stateFrame > 0) return;

    switch (f.state) {
      case 'startup':
        f.enter('active', f.move!.active);
        break;
      case 'active':
        f.enter('recovery', f.move!.recovery);
        break;
      case 'recovery':
      case 'blockstun':
      case 'wakeup':
        f.move = null;
        f.enter('idle');
        break;
      case 'hitstun':
        f.comboHits = 0;
        f.enter('idle');
        break;
      case 'knockdown':
        f.enter('wakeup', 5);      // кадры неуязвимости на вставании
        break;
      default:
        break;
    }
    f.x = THREE.MathUtils.clamp(f.x, -ARENA_HALF, ARENA_HALF);
  }

  private resolveHits(a: Fighter, d: Fighter): void {
    if (a.state !== 'active' || a.hasHitThisMove || !a.move) return;
    if (d.state === 'wakeup') return;                       // неуязвимость на вставании

    const hit = boxWorld(a, a.move.hitbox);
    const hurt = boxWorld(d, d.hurtbox);
    if (!overlaps(hit, hurt)) return;

    a.hasHitThisMove = true;                                // один удар — одно попадание
    const blocking = d.holdingBack && d.state !== 'hitstun' && d.y === 0;

    if (blocking) {
      d.hp -= a.move.chip;
      d.enter('blockstun', a.move.blockstun);
      a.meter = Math.min(100, a.meter + 3);
      this.ctx.audio.playParryClang();
    } else {
      d.hp -= Math.round(a.move.damage * comboScaling(d.comboHits));
      d.comboHits++;
      a.meter = Math.min(100, a.meter + 7);
      d.meter = Math.min(100, d.meter + 4);
      if (a.move.launch > 0) { d.vy = a.move.launch; d.y = Math.max(d.y, 0.01); }
      d.enter('hitstun', a.move.hitstun);
      this.ctx.audio.playGunshot(0.6 + a.move.damage / 400, 0.5);
      this.ctx.addTrauma(0.12 + a.move.damage / 1200);
    }

    this.hitstop = a.move.hitstop;
    this.applyPushback(a, d, blocking ? a.move.pushback * 0.7 : a.move.pushback);
    d.hp = Math.max(0, d.hp);
  }

  /** Откидывание с переносом остатка на атакующего, когда жертва у стены. */
  private applyPushback(a: Fighter, d: Fighter, amount: number): void {
    const room = ARENA_HALF - Math.abs(d.x);
    const applied = Math.min(amount, Math.max(room, 0));
    d.x += applied * a.facing;
    a.x -= (amount - applied) * a.facing;
    a.x = THREE.MathUtils.clamp(a.x, -ARENA_HALF, ARENA_HALF);
    d.x = THREE.MathUtils.clamp(d.x, -ARENA_HALF, ARENA_HALF);
  }

  /** Pushbox: тела не проходят друг сквозь друга. */
  private separate(): void {
    const gap = Math.abs(this.player.x - this.bot.x);
    const min = PUSH_BOX.w;
    if (gap >= min) return;
    const push = (min - gap) / 2;
    const dir = this.player.x < this.bot.x ? -1 : 1;
    this.player.x = THREE.MathUtils.clamp(this.player.x + push * dir, -ARENA_HALF, ARENA_HALF);
    this.bot.x = THREE.MathUtils.clamp(this.bot.x - push * dir, -ARENA_HALF, ARENA_HALF);
  }

  /** Разворот только в нейтральных состояниях — иначе хитбокс уезжает за спину. */
  private faceEachOther(): void {
    for (const [f, o] of [[this.player, this.bot], [this.bot, this.player]] as const) {
      if (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch') {
        f.facing = o.x >= f.x ? 1 : -1;
      }
    }
  }

  private resetRound(): void {
    this.player.reset(-START_GAP / 2, 1);
    this.bot.reset(START_GAP / 2, -1);
    this.hitstop = 0;
  }

  // ──────────────────────────────────────────────────────────── визуал
  private syncRig(f: Fighter): void {
    const rig = f.rig;
    rig.root.position.set(f.x, f.y, 0);
    rig.root.rotation.y = f.facing === 1 ? 0 : Math.PI;

    const crouch = f.state === 'crouch';
    rig.torso.position.y = crouch ? 0.75 : 1.05;
    rig.torso.rotation.x = crouch ? 0.35 : 0;

    // Поза по состоянию: startup — замах, active — выпад, recovery — возврат.
    let reach = 0;
    if (f.state === 'startup') reach = -0.35;
    else if (f.state === 'active') reach = 0.95;
    else if (f.state === 'recovery') reach = 0.4;
    rig.armR.rotation.x = -reach * 1.4;
    rig.armL.rotation.x = reach * 0.4;

    if (f.state === 'hitstun') rig.torso.rotation.z = 0.25 * f.facing;
    else if (f.state === 'blockstun') rig.torso.rotation.z = 0.08 * f.facing;
    else if (f.state === 'knockdown') rig.torso.rotation.z = 1.35 * f.facing;
    else rig.torso.rotation.z = 0;

    const hurt = f.state === 'hitstun' || f.state === 'blockstun';
    rig.setFlash(hurt ? 1 : 0);
  }

  private updateBoxHelpers(): void {
    for (const h of this.boxHelpers) h.visible = false;
    let i = 0;
    const draw = (b: ReturnType<typeof boxWorld>, color: number) => {
      const helper = this.boxHelpers[i] ?? this.makeBoxHelper();
      i++;
      helper.visible = true;
      (helper.material as THREE.LineBasicMaterial).color.setHex(color);
      helper.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0);
      helper.scale.set(b.maxX - b.minX, b.maxY - b.minY, 0.8);
    };
    for (const f of [this.player, this.bot]) {
      draw(boxWorld(f, f.hurtbox), 0x33ff66);
      if (f.state === 'active' && f.move) draw(boxWorld(f, f.move.hitbox), 0xff3355);
    }
  }

  private makeBoxHelper(): THREE.LineSegments {
    const geom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const mat = new THREE.LineBasicMaterial({ color: 0x33ff66, depthTest: false });
    const seg = new THREE.LineSegments(geom, mat);
    seg.renderOrder = 999;
    this.boxGroup.add(seg);
    this.boxHelpers.push(seg);
    return seg;
  }

  private buildArena(): THREE.Group {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_HALF + 2.5, ARENA_HALF + 3.2, 0.6, 40),
      new THREE.MeshStandardMaterial({ color: 0x2b2434, roughness: 0.9 }),
    );
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    g.add(floor);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b2f4a, roughness: 0.6, emissive: 0x220a14 }),
      );
      wall.position.set(side * (ARENA_HALF + 0.6), 1.1, 0);
      wall.castShadow = true;
      g.add(wall);
    }

    // Толпа на заднем плане одним инстансированным мешем.
    const crowd = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.22, 0.5, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x1b1622, roughness: 1 }),
      140,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 140; i++) {
      const row = Math.floor(i / 35);
      dummy.position.set(-12 + (i % 35) * 0.7, 0.6 + row * 0.75, -6 - row * 1.4);
      dummy.rotation.y = Math.random() * 0.4 - 0.2;
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
    }
    crowd.instanceMatrix.needsUpdate = true;
    g.add(crowd);
    return g;
  }

  private pushStatus(): void {
    const p = this.player;
    const b = this.bot;
    const adv = p.move ? frameAdvantageOnBlock(p.move) : null;
    this.ctx.setStatus(
      `<span class="hp">Игрок ${p.hp}</span> · <span class="hp">Бот ${b.hp}</span>`
      + ` · состояние: <b>${p.state}</b>(${p.stateFrame})`
      + (adv !== null ? ` · последний приём на блоке: <b>${adv > 0 ? '+' : ''}${adv}</b> кадров` : '')
      + ` · комбо: ${b.comboHits} (урон ×${comboScaling(b.comboHits).toFixed(2)})`,
    );
  }
}

const KEY_TO_MOVE: Record<string, MoveId | undefined> = {
  KeyJ: 'light',
  KeyK: 'medium',
  KeyL: 'heavy',
  KeyI: 'uppercut',
};

interface WorldBox { minX: number; maxX: number; minY: number; maxY: number }

function boxWorld(f: Fighter, b: Box): WorldBox {
  const cx = f.x + b.x * f.facing;
  const cy = f.y + b.y;
  return { minX: cx - b.w / 2, maxX: cx + b.w / 2, minY: cy - b.h / 2, maxY: cy + b.h / 2 };
}

function overlaps(a: WorldBox, b: WorldBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
