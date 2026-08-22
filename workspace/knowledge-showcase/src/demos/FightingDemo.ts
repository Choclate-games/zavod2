import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import {
  BOXER_BODY_Y, BOXER_HEAD_Y, boxerYaw, buildBoxer, resetPose, type BoxerRig,
} from '../world/boxerRig';
import { BoxerRagdoll } from '../world/boxerRagdoll';
import {
  MOVES, canCancel, comboScaling, frameAdvantageOnBlock, reach, staminaScale, whiffsAgainst,
  type Defense, type Move, type MoveId,
} from '../game/fightingMoves';

/**
 * Файтинг: фрейм-дата поверх Rapier3D, процедурные боксёры, рэгдолл-нокдаун.
 *
 * Разделение, вокруг которого построена вкладка (knowledge §0 и §8):
 *
 * * **Бой детерминирован и живёт в кадрах.** Хитбоксы, стан, откидывание,
 *   отмены — целочисленная логика на 60 Гц, ноль физики. Иначе одна и та же
 *   связка проходит на одном устройстве и не проходит на другом.
 * * **Мир физичен.** Перемещение бойцов идёт через `KinematicCharacterController`
 *   Rapier: канаты, углы ринга и второй боец — настоящие коллайдеры, а
 *   табурет с ведром в углу разлетаются от того, что их пнули. Это ровно
 *   тот случай, когда физика добавляет, ничего не отнимая у детерминизма.
 * * **Нокдаун отдаёт бойца физике целиком.** Рэгдолл собирается из настоящих
 *   мешей персонажа (`world/boxerRagdoll.ts`), а не из капсул-заменителей:
 *   двое бойцов крупным планом — подмена была бы видна сразу.
 *
 * Модель боксёра — `world/boxerRig.ts`, подход взят из проекта PunchBox:
 * сегментированный позвоночник, руки через плечо → локоть, лицо по seed,
 * синяки, проявляющиеся там, куда били.
 */

/** Половина ринга по X до канатов, метры. */
const RING_HALF = 4.15;
/** Половина ринга по Z: бойцы дерутся в плоскости, канаты нужны рэгдоллу. */
const RING_DEPTH = 3.2;
const MAX_HP = 1000;
const MAX_STAMINA = 100;
const BUFFER_FRAMES = 6;
const START_GAP = 2.6;
/** Капсула бойца: полувысота цилиндра + радиус. */
const CAP_HALF = 0.62;
const CAP_RADIUS = 0.28;
const TICK = 1 / 60;

/**
 * Воздух. Числа подобраны так, чтобы прыжок читался и был решением:
 * подъём 2.1 м, полёт ~0.8 с (48 кадров) — соперник успевает поставить
 * анти-эйр, но не успевает уйти в другой конец ринга.
 */
const GRAVITY = 26;
const JUMP_V = 10.4;
/** Горизонтальная скорость прыжка вперёд/назад, м/с. */
const AIR_SPEED = 4.6;
/** Выше этой высоты бойцы проходят друг сквозь друга — это и есть кросс-ап. */
const CROSS_UP_Y = 0.8;
/** Кадры приседа перед прыжком: без них прыжок неуязвим и неотличим от телепорта. */
const JUMPSQUAT = 4;
/** Кадры приземления: прыжок обязан быть наказуем. */
const LANDING = 6;
/** Шаги: вперёд быстрее, чем назад — отступать стоит темпа. */
const WALK_FWD = 0.085;
const WALK_BACK = 0.062;
/** Рывок: двойное нажатие в сторону. Метров за кадр и сколько кадров. */
const DASH_SPEED = 0.16;
const DASH_FRAMES = 9;
/** Окно двойного нажатия, кадры. */
const DOUBLE_TAP = 14;
/** Подъём с настила: столько кадров боец встаёт и неуязвим. */
const GETUP_FRAMES = 40;
/** Минимум секунд в рэгдолле, даже если тело уже улеглось. */
const RAGDOLL_MIN_AGE = 1.6;
/**
 * Кадры после подъёма, в которые сбить с ног нельзя — только оглушить.
 * Без этого окна подсечка и нога с воздуха роняют бойца бесконечно: он
 * встаёт и тут же ложится обратно, а матч превращается в слайд-шоу.
 */
const KNOCKDOWN_GRACE = 70;

const GROUP_GROUND = 0x0001;
const GROUP_FIGHTER = 0x0002;
const GROUP_RAGDOLL = 0x0008;
const GROUP_PROP = 0x0010;
const groups = (membership: number, filter: number): number => (membership << 16) | filter;
const GROUND_GROUPS = groups(GROUP_GROUND, GROUP_FIGHTER | GROUP_RAGDOLL | GROUP_PROP);
const FIGHTER_GROUPS = groups(GROUP_FIGHTER, GROUP_GROUND | GROUP_FIGHTER | GROUP_PROP);
/** Тот же боец в высоком прыжке: канаты и реквизит видит, соперника — нет. */
const FIGHTER_AIR_GROUPS = groups(GROUP_FIGHTER, GROUP_GROUND | GROUP_PROP);
const PROP_GROUPS = groups(GROUP_PROP, GROUP_GROUND | GROUP_FIGHTER | GROUP_PROP | GROUP_RAGDOLL);

type State =
  | 'idle' | 'walk' | 'dash' | 'crouch' | 'slip'
  | 'jumpsquat' | 'air' | 'landing'
  | 'startup' | 'active' | 'recovery'
  | 'blockstun' | 'guardbreak' | 'hitstun' | 'airhit'
  | 'knockdown' | 'getup' | 'ko';

interface Box { x: number; y: number; w: number; h: number }

/** Пот летит с блока и корпуса, кровь — с головы. */
type SprayKind = 'sweat' | 'blood';

const HURT_STAND: Box = { x: 0, y: 1.0, w: 0.62, h: 1.72 };
const HURT_CROUCH: Box = { x: 0, y: 0.6, w: 0.74, h: 1.05 };
/** В полёте боец поджимает ноги: коробка короче и выше основания. */
const HURT_AIR: Box = { x: 0, y: 0.85, w: 0.66, h: 1.3 };
/** Ширина «толкающего» тела: столько между центрами бойцов минимум. */
const PUSH_WIDTH = 0.7;

class Fighter {
  state: State = 'idle';
  /** Кадров осталось в текущем состоянии. */
  stateFrame = 0;
  move: Move | null = null;
  /** Кадров прошло с начала приёма — по ним анимируется удар. */
  moveElapsed = 0;
  moveTotal = 1;
  hasHitThisMove = false;
  hp = MAX_HP;
  stamina = MAX_STAMINA;
  comboHits = 0;
  /** Накопленный урон по зонам: по нему проявляются синяки. */
  wear = { head: 0, body: 0 };
  facing: 1 | -1 = 1;
  x = 0;
  y = 0;
  vy = 0;
  /** Горизонтальный импульс от удара, гасится за несколько кадров. */
  kb = 0;
  holdingBack = false;
  crouching = false;
  slip: 0 | -1 | 1 = 0;
  /** Горизонтальная скорость в полёте, м/с. Задаётся один раз на взлёте. */
  airVx = 0;
  /** Один удар за прыжок: иначе воздух становится сильнее земли. */
  airAttackUsed = false;
  /** Куда прыгаем: задаётся в приседе перед взлётом. */
  jumpDir: -1 | 0 | 1 = 0;
  /** Попаданий в текущем жонглировании — своя, более жёсткая шкала затухания. */
  juggle = 0;
  /** Рывок: направление и оставшиеся кадры. */
  dashDir: -1 | 0 | 1 = 0;
  /** Сейчас капсула проходит сквозь соперника (высокий прыжок). */
  passingThrough = false;
  /** Кадры, в которые бойца нельзя снова сбить с ног. */
  kdGrace = 0;
  /** Последнее нажатие в сторону — для распознавания двойного тапа. */
  lastTap: { dir: -1 | 1; frame: number } | null = null;
  /**
   * Поставить позу мгновенно, без интерполяции. Нужно ровно в одном месте:
   * первый кадр после рэгдолла, когда боец лежит и не должен «всплывать»
   * в стойку из прошлого кадра.
   */
  poseSnap = false;
  knockdowns = 0;
  buffered: { id: MoveId; frame: number } | null = null;
  /** Приём, из которого разрешена отмена прямо сейчас (окно после попадания). */
  cancelFrom: Move | null = null;
  cancelWindow = 0;
  /** Последний удар: нужен рэгдоллу, чтобы толкнуть правильную кость. */
  lastHitZone: 'head' | 'body' = 'head';
  lastHitPower = 0;
  /** Куда летел последний пропущенный удар: по нему толкается рэгдолл. */
  lastHitDir: 1 | -1 = 1;
  ragdoll: BoxerRagdoll | null = null;

  // Физика перемещения
  body!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;

  // Визуальные величины, живущие в кадровом времени (не в логическом)
  flash = 0;
  headSnap = 0;
  weave = Math.random() * 10;

  constructor(readonly rig: BoxerRig, readonly isPlayer: boolean) {}

  get hurtbox(): Box {
    if (this.airborne) return HURT_AIR;
    return this.state === 'crouch' ? HURT_CROUCH : HURT_STAND;
  }

  get defense(): Defense {
    if (this.airborne) return 'air';
    if (this.state === 'crouch') return 'crouch';
    if (this.state === 'slip') return 'slip';
    return 'stand';
  }

  /** В воздухе — включая удар в прыжке и полёт от пропущенного удара. */
  get airborne(): boolean {
    return this.state === 'air' || this.state === 'airhit'
      || (this.move?.air === true && this.state !== 'landing');
  }

  /** Свободен ли боец на земле: новый ввод либо идёт в дело, либо в буфер. */
  get busy(): boolean {
    return this.state !== 'idle' && this.state !== 'walk'
      && this.state !== 'crouch' && this.state !== 'slip';
  }

  /** В полёте можно ударить ровно один раз. */
  get canAirAttack(): boolean {
    return this.state === 'air' && !this.airAttackUsed;
  }

  get down(): boolean {
    return this.state === 'knockdown' || this.state === 'ko';
  }

  enter(state: State, frames = 0): void {
    this.state = state;
    this.stateFrame = frames;
    if (state === 'startup') this.hasHitThisMove = false;
  }

  reset(x: number, facing: 1 | -1): void {
    this.state = 'idle';
    this.stateFrame = 0;
    this.move = null;
    this.moveElapsed = 0;
    this.hp = MAX_HP;
    this.stamina = MAX_STAMINA;
    this.comboHits = 0;
    this.wear.head = 0;
    this.wear.body = 0;
    this.x = x;
    this.y = 0;
    this.vy = 0;
    this.kb = 0;
    this.facing = facing;
    this.buffered = null;
    this.cancelFrom = null;
    this.knockdowns = 0;
    this.flash = 0;
    this.headSnap = 0;
    this.airVx = 0;
    this.airAttackUsed = false;
    this.jumpDir = 0;
    this.juggle = 0;
    this.dashDir = 0;
    this.lastTap = null;
    this.kdGrace = 0;
  }
}

export class FightingDemo implements Demo {
  readonly id = 'fighting';
  readonly title = ['🥊 Файтинг: фрейм-дата', '🥊 Fighting: frame data'] as const;
  readonly hint = [
    '<b>A</b>/<b>D</b> шаги (назад = блок, двойное нажатие — рывок) · <b>Space</b> прыжок (в прыжке можно'
    + ' перескочить соперника) · <b>S</b> присед · <b>Z</b>/<b>C</b> уклон<br>'
    + '<b>J</b> джеб · <b>K</b> хук · <b>L</b> оверхенд · <b>I</b> апперкот (анти-эйр) · <b>U</b> по корпусу'
    + ' · <b>O</b> подсечка. В прыжке те же кнопки дают удар и ногу с воздуха<br>'
    + 'Связки — отменой по попаданию: джеб → хук → оверхенд. <b>H</b> хитбоксы · <b>R</b> заново',
    '<b>A</b>/<b>D</b> walk (back = block, double tap = dash) · <b>Space</b> jump (you can cross over)'
    + ' · <b>S</b> crouch · <b>Z</b>/<b>C</b> slip<br>'
    + '<b>J</b> jab · <b>K</b> hook · <b>L</b> overhand · <b>I</b> uppercut (anti-air) · <b>U</b> body shot'
    + ' · <b>O</b> sweep. In the air the same keys give an air punch and an air kick<br>'
    + 'Chain by cancelling on hit: jab → hook → overhand. <b>H</b> hitboxes · <b>R</b> restart',
  ] as const;
  readonly category = ['⚔️ Экшен и боёвка', '⚔️ Action & Combat'] as const;
  readonly tags = [
    'файтинг', 'бокс', 'бой', 'фреймдата', 'хитбокс', 'комбо', 'рэгдолл', 'rapier3d',
    'fighting', 'boxing', 'framedata', 'hitbox', 'combo', 'ragdoll',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  private ctx!: DemoContext;
  private world!: RAPIER.World;
  private controller!: RAPIER.KinematicCharacterController;
  private player!: Fighter;
  private bot!: Fighter;
  private hitstop = 0;
  private frame = 0;
  private showBoxes = false;
  private boxHelpers: THREE.LineSegments[] = [];
  private readonly boxGroup = new THREE.Group();
  private unsubscribe: (() => void) | null = null;

  // Реквизит и мелкая физика
  private props: Array<{ body: RAPIER.RigidBody; mesh: THREE.Object3D }> = [];
  /** Вылетевшие капы живут до конца раунда — иначе за бой их набирается горсть. */
  private debris: Array<{ body: RAPIER.RigidBody; mesh: THREE.Object3D }> = [];
  private sweat: Array<{ body: RAPIER.RigidBody; mesh: THREE.Mesh; life: number; kind: SprayKind }> = [];
  private sweatCursor = 0;

  // ИИ
  /**
   * Кадров между «увидел» и «ответил». На 13 бот наказывал вообще каждое
   * восстановление и выигрывал у человека почти всегда. Идеальный бот не
   * сложный, а несправедливый (knowledge §7).
   */
  private botReaction = 15;
  private botTimer = 0;
  /** Импульс «наезда» камеры на попадании, 0..1. */
  private hitPunch = 0;
  /** Крупная надпись в HUD: FIGHT! / НОКДАУН / НОКАУТ. */
  private announce = '';
  private announceFrames = 0;
  private roundOverFrames = 0;
  /** Кадр, на котором запросили прыжок. Ноль — не запрашивали. */
  private jumpBuffered = 0;
  private lastAdvantage: number | null = null;

  /** Замедление на нокдауне: 1 — обычная скорость. */
  private timeScale = 1;
  private readonly tmp = new THREE.Vector3();

  async init(ctx: DemoContext): Promise<void> {
    this.ctx = ctx;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -19.6, z: 0 });
    this.world.timestep = TICK;

    // offset — зазор, который контроллер оставляет до препятствия. Ноль здесь
    // означает вечные микроконтакты и дрожание у канатов.
    this.controller = this.world.createCharacterController(0.02);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.enableAutostep(0.2, 0.1, true);
    this.controller.setSlideEnabled(true);

    this.scene.background = new THREE.Color(0x0b0910);
    this.scene.fog = new THREE.Fog(0x0b0910, 16, 46);
    this.buildLights(ctx);
    this.scene.add(this.buildRing());
    this.scene.add(this.boxGroup);
    this.boxGroup.visible = false;

    this.player = this.spawnFighter({
      skin: 0xd9a271, trunks: 0x2f7fd6, gloves: 0x2a5ea8, hair: 0x2c1f18,
      build: 0.45, face: 3, hairStyle: 0, lowDetail: ctx.tier === 'low',
    }, true);
    this.bot = this.spawnFighter({
      skin: 0x8a5a3b, trunks: 0xc0392b, gloves: 0x8e2f26, hair: 0x120d0a,
      build: 0.75, face: 7, hairStyle: 4, lowDetail: ctx.tier === 'low',
    }, false);

    this.buildProps();
    this.buildSweatPool(ctx.tier === 'low' ? 8 : 20);
    this.resetRound();

    this.camera.position.set(0, 2.8, 8.2);
    this.camera.lookAt(0, 1.3, 0);
  }

  enter(): void {
    this.unsubscribe = this.ctx.input.onKey((code) => {
      if (code === 'KeyH') { this.showBoxes = !this.showBoxes; this.boxGroup.visible = this.showBoxes; }
      if (code === 'KeyR') this.resetRound();
      if (code === 'KeyZ') this.trySlip(this.player, -1);
      if (code === 'KeyC') this.trySlip(this.player, 1);
      if (code === 'Space' || code === 'KeyW') this.jumpBuffered = this.frame;
      if (code === 'KeyA') this.registerTap(this.player, -1);
      if (code === 'KeyD') this.registerTap(this.player, 1);
      const id = KEY_TO_MOVE[code];
      // Буферизуем ВСЕГДА: нажатие чуть раньше выхода из recovery должно
      // засчитаться, иначе связка физически не собирается (§6 документа).
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

    // Hit-stop замораживает ВСЁ, включая физику: иначе кадр «веса» удара
    // выглядит так, будто завис только боец, а мир поехал дальше.
    if (this.hitstop > 0) { this.hitstop--; return; }

    if (this.roundOverFrames > 0) {
      this.stepWorld();
      if (--this.roundOverFrames === 0) this.resetRound();
      return;
    }

    this.readPlayerInput();
    this.thinkBot();

    this.stepFighter(this.player);
    this.stepFighter(this.bot);

    this.resolveHits(this.player, this.bot);
    this.resolveHits(this.bot, this.player);
    this.faceEachOther();
    this.moveFighter(this.player);
    this.moveFighter(this.bot);

    this.stepWorld();

    if (this.player.state === 'ko' || this.bot.state === 'ko') {
      if (this.roundOverFrames === 0) {
        this.roundOverFrames = 190;
        this.ctx.addTrauma(0.6);
        this.ctx.audio.playExplosion(0.55);
        this.say(this.player.state === 'ko' ? 'НОКАУТ — БОТ ПОБЕДИЛ' : 'НОКАУТ — ИГРОК ПОБЕДИЛ', 190);
      }
    }
    if (this.announceFrames > 0 && --this.announceFrames === 0) this.announce = '';
    if (this.frame % 3 === 0) this.pushStatus();
  }

  update(dt: number): void {
    const scaled = dt * this.timeScale;
    this.timeScale += ((this.roundOverFrames > 0 ? 0.45 : 1) - this.timeScale) * (1 - Math.exp(-4 * dt));

    for (const f of [this.player, this.bot]) {
      if (f.ragdoll) {
        f.ragdoll.age += dt;
        f.ragdoll.sync();
      } else {
        this.poseRig(f, scaled);
      }
      f.flash = Math.max(0, f.flash - dt * 6);
      f.rig.setFlash(f.flash);
      f.rig.setDamage(Math.min(1, f.wear.head / 520), Math.min(1, f.wear.body / 520));
    }

    for (const p of this.props) this.syncBody(p.body, p.mesh);
    for (const p of this.debris) this.syncBody(p.body, p.mesh);
    for (const s of this.sweat) {
      if (s.life <= 0) continue;
      s.life -= dt;
      this.syncBody(s.body, s.mesh);
      if (s.life <= 0) s.mesh.visible = false;
    }

    if (this.showBoxes) this.updateBoxHelpers();
    this.updateCamera(dt);
  }

  dispose(): void {
    for (const f of [this.player, this.bot]) f.ragdoll?.dispose();
    disposeObject(this.scene as unknown as THREE.Object3D);
    this.world.free();
  }

  // ─────────────────────────────────────────────────────────── ввод игрока
  private readPlayerInput(): void {
    const f = this.player;
    const input = this.ctx.input;
    if (f.down) return;
    const back = f.facing === 1 ? 'KeyA' : 'KeyD';
    const fwd = f.facing === 1 ? 'KeyD' : 'KeyA';

    // В воздухе блока нет — это и есть цена прыжка.
    f.holdingBack = input.isDown(back) && !f.airborne;
    f.crouching = input.isDown('KeyS') && !f.airborne;

    if (f.buffered && this.frame - f.buffered.frame > BUFFER_FRAMES) f.buffered = null;
    if (this.jumpBuffered && this.frame - this.jumpBuffered > BUFFER_FRAMES) this.jumpBuffered = 0;

    // Воздух: ровно один удар за прыжок, и он выбирается из наземной кнопки.
    if (f.canAirAttack && f.buffered) {
      const airId = AIR_VERSION[f.buffered.id];
      f.buffered = null;
      if (airId && f.stamina >= MOVES[airId].stamina) {
        f.airAttackUsed = true;
        this.startMove(f, airId);
      }
      return;
    }
    // Пока летим или приземляемся — ввод только копится.
    if (f.airborne || f.state === 'jumpsquat' || f.state === 'landing' || f.state === 'dash') return;

    // Отмена в связку: приём можно прервать сразу после попадания.
    if (f.buffered && f.cancelWindow > 0 && f.cancelFrom
      && canCancel(f.cancelFrom, f.buffered.id) && f.stamina >= MOVES[f.buffered.id].stamina) {
      this.startMove(f, f.buffered.id);
      f.buffered = null;
      return;
    }

    if (f.busy) return;

    if (f.buffered) {
      const move = MOVES[f.buffered.id];
      if (f.stamina >= move.stamina) {
        this.startMove(f, f.buffered.id);
        f.buffered = null;
        return;
      }
      f.buffered = null;
    }

    // Прыжок читается из буфера, а не из удержания: иначе зажатый Space
    // превращает бойца в мячик.
    if (this.jumpBuffered) {
      this.jumpBuffered = 0;
      f.jumpDir = input.isDown(fwd) ? f.facing : (input.isDown(back) ? -f.facing : 0) as -1 | 0 | 1;
      f.enter('jumpsquat', JUMPSQUAT);
      return;
    }

    if (f.crouching) { f.enter('crouch'); return; }

    if (f.dashDir !== 0) {
      f.enter('dash', DASH_FRAMES);
      return;
    }

    if (input.isDown(fwd) || input.isDown(back)) {
      f.enter('walk');
      f.x += (input.isDown(fwd) ? WALK_FWD : -WALK_BACK) * f.facing;
      return;
    }
    f.enter('idle');
  }

  /**
   * Двойное нажатие в сторону — рывок. Считается по событиям клавиатуры, а не
   * по удержанию: удержание уже занято ходьбой, и отличить «иду» от «рванул»
   * можно только по второму нажатию в окне.
   */
  private registerTap(f: Fighter, dir: -1 | 1): void {
    const prev = f.lastTap;
    if (prev && prev.dir === dir && this.frame - prev.frame <= DOUBLE_TAP && !f.busy && !f.airborne) {
      f.dashDir = dir;
      f.lastTap = null;
      this.ctx.audio.playDash();
      return;
    }
    f.lastTap = { dir, frame: this.frame };
  }

  private trySlip(f: Fighter, dir: 1 | -1): void {
    if (f.busy || f.stamina < 6) return;
    f.slip = dir;
    f.stamina -= 6;
    f.enter('slip', 13);
  }

  // ────────────────────────────────────────────────────────────────── ИИ
  private thinkBot(): void {
    const b = this.bot;
    const p = this.player;
    if (b.down) return;
    const gap = Math.abs(b.x - p.x);

    // Удар в прыжке решается отдельно: в воздухе времени на раздумья нет.
    if (b.canAirAttack) {
      if (gap < 2.4 && b.vy < 2.5) {
        b.airAttackUsed = true;
        this.startMove(b, gap < 1.4 ? 'airKick' : 'airPunch');
      }
      return;
    }
    if (b.airborne || b.state === 'jumpsquat' || b.state === 'landing') return;

    // Блок держится, пока игрок замахивается: реакция не мгновенная,
    // иначе бот читается как читер (§7).
    b.holdingBack = p.state === 'startup' && gap < 2.2 && this.frame % 7 !== 0;

    if (b.busy) return;

    // Анти-эйр обрабатывается ВНЕ таймера реакции, но с окном: летящего
    // соперника надо встречать, иначе прыжок становится бесплатным входом.
    // Промахнуться бот тоже обязан — апперкот стоит 26 кадров восстановления.
    if (p.airborne && gap < 1.9 && p.vy < 4 && b.stamina >= MOVES.uppercut.stamina) {
      if (Math.random() < 0.55) { this.startMove(b, 'uppercut'); this.botTimer = 14; return; }
    }

    if (this.botTimer > 0) { this.botTimer--; return; }

    // Уклон от тяжёлого: единственный случай, когда бот тратит выносливость зря.
    if (p.state === 'startup' && p.move && p.move.startup >= 9 && gap < 2.0 && Math.random() < 0.4) {
      this.trySlip(b, Math.random() < 0.5 ? -1 : 1);
      this.botTimer = 20;
      return;
    }

    // Дистанция считается из фрейм-даты, а не подбирается константой: бот
    // держался на 2.2 м, когда его самый длинный удар достаёт на 1.8 — бой
    // превращался в переглядывание, и это не видно ни по одной проверке,
    // кроме прогона живого матча.
    const best = reach(MOVES.overhand);
    const jabRange = reach(MOVES.jab);
    if (gap > best) {
      // Издалека бот либо подходит, либо запрыгивает — прыжок соперника
      // должен быть не только его инструментом.
      if (gap > 3.2 && Math.random() < 0.035) {
        b.jumpDir = (p.x > b.x ? 1 : -1) as 1 | -1;
        b.enter('jumpsquat', JUMPSQUAT);
        return;
      }
      b.enter('walk');
      b.x += (p.x > b.x ? 1 : -1) * WALK_FWD * 0.8;
      return;
    }
    if (gap < 0.95) {
      b.enter('walk');
      b.x += (p.x > b.x ? -1 : 1) * WALK_BACK;
      return;
    }

    // Наказание, давление на гард, подсечка против блока — по ситуации.
    // Из кандидатов остаются только те приёмы, которые с этой дистанции
    // физически достают.
    let intent: MoveId;
    if (p.state === 'recovery') intent = 'hook';                 // окно наказания
    else if (p.state === 'crouch') intent = 'sweep';
    else if (p.holdingBack) intent = Math.random() < 0.45 ? 'body' : (Math.random() < 0.5 ? 'sweep' : 'overhand');
    else if (gap < jabRange * 0.8) intent = Math.random() < 0.35 ? 'uppercut' : 'jab';
    else intent = Math.random() < 0.5 ? 'jab' : 'hook';

    if (reach(MOVES[intent]) < gap) intent = 'overhand';
    if (b.stamina < MOVES[intent].stamina) intent = 'jab';
    if (b.stamina >= MOVES[intent].stamina) this.startMove(b, intent);
    // Устал — реагирует медленнее: усталость видно по поведению, не только по полосе.
    const fatigue = Math.round((1 - b.stamina / MAX_STAMINA) * 12);
    this.botTimer = this.botReaction + fatigue + Math.floor(Math.random() * 9);
  }

  // ──────────────────────────────────────────────────────── боевая логика
  private startMove(f: Fighter, id: MoveId): void {
    const move = MOVES[id];
    f.move = move;
    f.moveElapsed = 0;
    f.moveTotal = move.startup + move.active + move.recovery;
    f.stamina = Math.max(0, f.stamina - move.stamina);
    f.cancelWindow = 0;
    f.cancelFrom = null;
    f.enter('startup', move.startup);
    if (move.stamina >= 13) this.ctx.audio.playSwordSlash();
  }

  private stepFighter(f: Fighter): void {
    if (f.state === 'ko') return;

    if (f.state === 'knockdown') {
      // Встаём, только когда тело улеглось: подъём из полёта выглядит как баг.
      if (f.ragdoll && f.ragdoll.age > RAGDOLL_MIN_AGE && (f.ragdoll.settled || f.ragdoll.age > 3.2)) {
        this.standUp(f);
      }
      return;
    }

    if (f.cancelWindow > 0) f.cancelWindow--;
    if (f.kdGrace > 0) f.kdGrace--;
    if (f.moveTotal > 0 && f.move) f.moveElapsed++;

    // Полёт интегрируется здесь, до автомата состояний: приземление — это
    // событие логики (можно ли действовать), а не деталь рендера.
    if (f.y > 0 || f.vy !== 0) {
      f.vy -= GRAVITY * TICK;
      f.y += f.vy * TICK;
      f.x += f.airVx * TICK;
      if (f.y <= 0) {
        const crashed = f.state === 'airhit';
        f.y = 0;
        f.vy = 0;
        f.airVx = 0;
        f.airAttackUsed = false;
        f.move = null;
        // Сбитый в воздухе не приземляется на ноги — он падает. Отсюда и
        // берётся большая часть рэгдоллов в матче.
        if (crashed) { this.knockDown(f, f.lastHitDir); return; }
        f.enter('landing', LANDING);
        return;
      }
    }

    // Выносливость восстанавливается только когда боец не бьёт.
    const resting = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';
    f.stamina = Math.min(MAX_STAMINA, f.stamina + (resting ? 0.42 : 0.08));

    // Вход в дистанцию: замах несёт бойца вперёд. Без этого удар достаёт
    // только вплотную, и оба стоят на расстоянии, где ничего не происходит.
    if (f.state === 'startup' && f.move && f.move.advance > 0 && !f.move.air) {
      f.x += (f.move.advance / f.move.startup) * f.facing;
    }
    if (f.state === 'dash') f.x += f.dashDir * DASH_SPEED;

    if (f.stateFrame > 0) f.stateFrame--;
    if (f.stateFrame > 0) return;

    switch (f.state) {
      case 'jumpsquat':
        // Взлёт: направление зафиксировано в приседе и в полёте не меняется.
        f.vy = JUMP_V;
        f.y = 0.01;
        f.airVx = f.jumpDir * AIR_SPEED;
        f.airAttackUsed = false;
        f.enter('air');
        this.ctx.audio.playDash();
        break;
      case 'dash':
        f.dashDir = 0;
        f.enter('idle');
        break;
      case 'landing':
        f.enter('idle');
        break;
      case 'startup':
        f.enter('active', f.move!.active);
        break;
      case 'active':
        f.enter('recovery', f.move!.recovery);
        break;
      case 'recovery': {
        const wasAir = f.move?.air === true;
        f.move = null;
        f.enter(wasAir && f.y > 0 ? 'air' : 'idle');
        break;
      }
      case 'blockstun':
      case 'guardbreak':
      case 'getup':
        f.move = null;
        f.enter('idle');
        break;
      case 'hitstun':
        f.comboHits = 0;
        f.enter('idle');
        break;
      case 'slip':
        f.slip = 0;
        f.enter('idle');
        break;
      default:
        break;
    }
  }

  private resolveHits(a: Fighter, d: Fighter): void {
    if (a.state !== 'active' || a.hasHitThisMove || !a.move) return;
    if (d.state === 'getup' || d.down) return;                  // неуязвимость на вставании

    const hit = boxWorld(a, a.move.hitbox);
    const hurt = boxWorld(d, d.hurtbox);
    if (!overlaps(hit, hurt)) return;
    // Присед, уклон и высота уводят удар: приём проходит мимо, кадры
    // восстановления остаются — это и есть цена промаха.
    if (whiffsAgainst(a.move, d.defense)) { a.hasHitThisMove = true; return; }

    a.hasHitThisMove = true;
    const zone = a.move.target;
    const power = staminaScale(a.stamina, MAX_STAMINA);
    // В воздухе блока нет вообще: прыгнул — принял.
    const blocking = !d.airborne
      && (d.holdingBack || d.state === 'crouch') && d.state !== 'hitstun'
      && !(zone === 'body' && d.holdingBack && d.state !== 'crouch' && Math.random() < 0.35);

    // Окно отмены: только по контакту, только вперёд по цепочке.
    a.cancelFrom = a.move;
    a.cancelWindow = a.move.active + 8;
    d.lastHitDir = a.facing;

    if (blocking) {
      d.hp -= a.move.chip;
      d.stamina = Math.max(0, d.stamina - a.move.guardDamage);
      if (d.stamina <= 0) {
        // Гард сломан: длинный стан вместо короткого — вот за что качают темп.
        d.enter('guardbreak', 26);
        d.stamina = 12;
        this.ctx.audio.playAlarm();
      } else {
        d.enter('blockstun', a.move.blockstun);
        this.ctx.audio.playParryClang();
      }
      this.spawnSpray(d, zone, 2, 'sweat');
      this.hitstop = Math.max(3, a.move.hitstop - 2);
      this.applyPushback(a, d, a.move.pushback * 16);
      return;
    }

    // Жонглирование: попадания по летящему затухают быстрее обычного комбо,
    // иначе один подброс = вся полоса здоровья.
    const juggleScale = d.airborne ? Math.max(0.3, 1 - d.juggle * 0.22) : 1;
    const dmg = Math.round(a.move.damage * comboScaling(d.comboHits) * power * juggleScale);
    d.hp = Math.max(0, d.hp - dmg);
    d.comboHits++;
    if (d.airborne) d.juggle++;
    d.wear[zone] += dmg;
    d.lastHitZone = zone;
    d.lastHitPower = dmg;
    d.flash = 1;
    d.headSnap = zone === 'head' ? 1 : 0.3;
    d.stamina = Math.max(0, d.stamina - (zone === 'body' ? a.move.guardDamage : 3));

    this.ctx.audio.playGunshot(0.55 + a.move.damage / 380, 0.55);
    this.ctx.addTrauma(0.12 + a.move.damage / 900);
    this.hitstop = a.move.hitstop;
    // Кровь на голову, брызги пота — на корпус. Дешёвая, но мгновенно
    // читаемая разница между «попал» и «попал жёстко».
    this.spawnSpray(d, zone, zone === 'head' ? 6 : 4, zone === 'head' ? 'blood' : 'sweat');
    this.hitPunch = Math.min(1, this.hitPunch + 0.35 + a.move.damage / 500);

    const launched = a.move.launch > 0;
    if (launched || d.airborne) {
      // Подброс и добивание в воздухе: жертва уходит в неуправляемый полёт и
      // приземляется рэгдоллом.
      d.vy = launched ? Math.max(d.vy, a.move.launch * 24) : Math.max(d.vy, 3.4);
      d.y = Math.max(d.y, 0.05);
      d.airVx = a.facing * (1.4 + a.move.pushback * 6);
      d.move = null;
      d.enter('airhit');
    } else if (a.move.knocksDown && d.kdGrace === 0) {
      // Подсечка и нога в прыжке валят сразу: это то, ради чего они есть.
      d.enter('hitstun', a.move.hitstun);
      this.knockDown(d, a.facing);
      return;
    } else {
      d.enter('hitstun', a.move.hitstun);
      this.applyPushback(a, d, a.move.pushback * 26);
    }

    if (d.hp <= 0) this.knockDown(d, a.facing);
  }

  /**
   * Откидывание с отскоком от канатов. У стены жертве некуда лететь — импульс
   * возвращается ей же назад: угол ринга становится опасным местом, и это
   * следствие кода, а не отдельная «стеновая» механика.
   */
  private applyPushback(a: Fighter, d: Fighter, amount: number): void {
    const dir = a.facing;
    const room = RING_HALF - 0.25 - Math.abs(d.x);
    if (room < 0.35 && amount > 3) {
      d.kb -= dir * amount * 0.45;
      a.kb -= dir * amount * 0.3;          // атакующего отбрасывает от канатов
      this.ctx.addTrauma(0.15);
      this.ctx.audio.playParryClang();
      return;
    }
    d.kb += dir * amount;
  }

  private knockDown(f: Fighter, dir: 1 | -1): void {
    if (f.ragdoll) return;
    f.knockdowns++;
    f.enter('knockdown', 0);
    f.move = null;
    f.juggle = 0;
    f.comboHits = 0;
    f.y = 0;
    f.vy = 0;
    f.airVx = 0;

    // Капа вылетает отдельным телом — деталь, по которой нокдаун читается
    // раньше, чем сработает полоса здоровья.
    this.spawnMouthguard(f, dir);

    const impulse = this.tmp.set(
      dir * (7 + f.lastHitPower * 0.05),
      f.lastHitZone === 'head' ? 5.5 : 2.0,
      (Math.random() - 0.5) * 2.5,
    ).clone();
    f.ragdoll = new BoxerRagdoll(this.world, this.scene, f.rig, {
      impulse,
      hitBone: f.lastHitZone === 'head' ? 'head' : 'waist',
    });
    this.ctx.addTrauma(0.45);
    this.hitPunch = 1;
    this.ctx.audio.playExplosion(0.35);
    this.say(f.isPlayer ? 'НОКДАУН ИГРОКА' : 'НОКДАУН БОТА', 150);
  }

  /** Короткое объявление в HUD: раунд должен иметь голос. */
  private say(text: string, frames: number): void {
    this.announce = text;
    this.announceFrames = frames;
  }

  private standUp(f: Fighter): void {
    // Куда упал — оттуда и встаёт: иначе боец «телепортируется» к старому X.
    f.ragdoll!.hipsPosition(this.tmp);
    f.x = THREE.MathUtils.clamp(this.tmp.x, -RING_HALF + 0.4, RING_HALF - 0.4);
    f.ragdoll!.dispose();
    f.ragdoll = null;
    resetPose(f.rig);
    f.rig.mouthguard.visible = true;
    f.y = 0;
    f.vy = 0;
    f.kb = 0;
    f.airVx = 0;
    f.juggle = 0;
    // Первый кадр подъёма ставится без интерполяции: иначе боец на глазах
    // «всплывает» из настила в стойку и обратно вниз.
    f.poseSnap = true;

    // Три нокдауна — технический нокаут. Иначе раунд не кончается никогда.
    if (f.knockdowns >= 3 || f.hp <= 0) {
      f.enter('ko', 0);
      f.hp = 0;
      return;
    }
    f.hp = Math.max(f.hp, 240);
    f.stamina = Math.max(f.stamina, 45);
    f.kdGrace = KNOCKDOWN_GRACE;
    f.enter('getup', GETUP_FRAMES);
    this.ctx.audio.playLevelUp();
  }

  /** Разворот только в нейтральных состояниях — иначе хитбокс уезжает за спину. */
  private faceEachOther(): void {
    for (const [f, o] of [[this.player, this.bot], [this.bot, this.player]] as const) {
      if (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch') {
        f.facing = o.x >= f.x ? 1 : -1;
      }
    }
  }

  // ───────────────────────────────────────────────── перемещение через Rapier
  /**
   * Логика насчитала желаемое смещение — Rapier решает, можно ли туда.
   * Канаты, угол ринга и второй боец здесь настоящие коллайдеры, поэтому
   * «прижать к канатам» — не проверка `Math.abs(x) > 4`, а физический факт.
   */
  private moveFighter(f: Fighter): void {
    if (f.ragdoll) {
      // Тело упало и едет по настилу — капсула едет с ним, иначе соперник
      // натыкается на невидимого стоящего бойца там, где никого уже нет.
      f.ragdoll.hipsPosition(this.tmp);
      f.x = THREE.MathUtils.clamp(this.tmp.x, -RING_HALF + 0.3, RING_HALF - 0.3);
      f.body.setNextKinematicTranslation({ x: f.x, y: CAP_RADIUS, z: 0 });
      return;
    }

    // Кросс-ап: выше пояса капсулы перестают видеть друг друга, и через
    // соперника можно перепрыгнуть. Без этого прыжок упирается в невидимую
    // стену ровно там, где начинается самое интересное.
    const passThrough = f.y > CROSS_UP_Y;
    if (passThrough !== f.passingThrough) {
      f.passingThrough = passThrough;
      f.collider.setCollisionGroups(passThrough ? FIGHTER_AIR_GROUPS : FIGHTER_GROUPS);
    }

    const current = f.body.translation();
    const desiredX = (f.x - current.x) + f.kb * TICK;
    f.kb *= 0.82;
    if (Math.abs(f.kb) < 0.01) f.kb = 0;

    const target = { x: desiredX, y: (f.y + CAP_HALF + CAP_RADIUS) - current.y, z: -current.z };
    this.controller.computeColliderMovement(f.collider, target, undefined, undefined,
      (c) => c !== f.collider);
    const mv = this.controller.computedMovement();

    const next = {
      x: current.x + mv.x,
      y: Math.max(CAP_HALF + CAP_RADIUS, current.y + mv.y),
      z: 0,
    };
    f.body.setNextKinematicTranslation(next);
    // Логическая координата — то, что физика РАЗРЕШИЛА, а не то, что хотелось.
    f.x = next.x;

    // Второй слой: pushbox по фрейм-дате. Контроллер разводит капсулы, но
    // хитбоксы считаются по плоским коробкам, и они должны совпадать.
    // В воздухе pushbox выключен — иначе кросс-ап не состоится.
    if (this.player.y > CROSS_UP_Y || this.bot.y > CROSS_UP_Y) return;
    const gap = this.player.x - this.bot.x;
    if (Math.abs(gap) < PUSH_WIDTH) {
      const push = (PUSH_WIDTH - Math.abs(gap)) / 2 * Math.sign(gap || 1);
      this.player.x += push;
      this.bot.x -= push;
    }
  }

  private stepWorld(): void {
    this.world.step();
  }

  // ────────────────────────────────────────────────────────────── анимация
  /**
   * Поза собирается как «цель + приближение», а не как готовый клип: каждое
   * состояние объявляет, куда должны приехать плечи, локти, корпус и голова,
   * а рендер-кадр доезжает туда экспоненциально. Так переход из любого
   * состояния в любое другое всегда плавный, и не нужен ни один .glb.
   */
  private poseRig(f: Fighter, dt: number): void {
    const rig = f.rig;
    const d = rig.defaults;
    // poseSnap — единственный кадр, когда поза ставится мгновенно: сразу
    // после рэгдолла боец лежит, и «доезжать» туда из стойки нечему.
    const k = f.poseSnap ? 1 : 1 - Math.exp(-16 * dt);
    f.poseSnap = false;

    rig.root.position.set(f.x, f.y, 0);
    rig.root.rotation.y = boxerYaw(f.facing);

    // Цели: стартуем от стойки покоя.
    let bodyRotX = d.bodyRot.x;
    let bodyRotY = d.bodyRot.y;
    let bodyRotZ = d.bodyRot.z;
    let bodyPosX = d.bodyPos.x;
    let bodyPosY = d.bodyPos.y;
    let hipsY = d.hipsY;
    let headRotX = d.headRot.x;
    let headRotZ = d.headRot.z;
    const shL = d.shoulderL.clone();
    const elL = d.elbowL.clone();
    const shR = d.shoulderR.clone();
    const elR = d.elbowR.clone();
    let thighL = 0;
    let thighR = 0;
    let shinBend = 0;

    // Постоянное покачивание: боксёр не стоит столбом ни одного кадра.
    // В воздухе и на подъёме его нет — там телом распоряжается не боец.
    f.weave += dt * (f.state === 'idle' ? 1.7 : 0.9);
    const w = f.weave;
    const sway = f.airborne || f.state === 'getup' ? 0 : 1;
    bodyRotZ += Math.sin(w) * 0.055 * sway;
    bodyRotX += Math.sin(w * 2) * 0.028 * sway;
    bodyRotY += Math.sin(w * 0.7) * 0.05 * sway;
    headRotX += Math.sin(w * 2 + 0.8) * 0.035 * sway;
    bodyPosY += Math.sin(w * 2.1) * 0.018 * sway;

    // Усталость: гард опускается сам собой — по силуэту видно, что бак пуст.
    const tired = 1 - staminaScale(f.stamina, MAX_STAMINA);
    shL.x += tired * 0.5;
    shR.x += tired * 0.5;
    bodyRotX += tired * 0.12;

    switch (f.state) {
      case 'walk': {
        const stride = Math.sin(w * 5) * 0.4;
        thighL = stride;
        thighR = -stride;
        bodyPosY -= 0.02;
        break;
      }
      case 'dash':
        // Рывок: корпус уходит вперёд по направлению, ноги в широком шаге.
        bodyRotX = 0.34 * f.dashDir * f.facing;
        bodyPosY -= 0.06;
        thighL = 0.7 * f.dashDir * f.facing;
        thighR = -0.5 * f.dashDir * f.facing;
        break;
      case 'jumpsquat':
        // Присед перед взлётом — телеграф прыжка. Без него боец «выстреливает».
        bodyRotX = 0.42;
        bodyPosY -= 0.2;
        hipsY -= 0.24;
        thighL = thighR = 0.8;
        shinBend = -0.9;
        break;
      case 'air': {
        // В полёте ноги поджаты, гард поднят. Ноги разводятся к вершине и
        // выпрямляются на спуске — по позе видно, куда боец летит.
        const up = THREE.MathUtils.clamp(f.vy / JUMP_V, -1, 1);
        bodyRotX = 0.2 - up * 0.25;
        thighL = 1.15 - up * 0.35;
        thighR = 0.75 + up * 0.25;
        shinBend = -1.35 + up * 0.4;
        hipsY -= 0.05;
        shL.x -= 0.15;
        shR.x -= 0.15;
        break;
      }
      case 'landing':
        // Гашение удара о настил: колени принимают вес.
        bodyRotX = 0.45;
        bodyPosY -= 0.24;
        hipsY -= 0.26;
        thighL = thighR = 0.95;
        shinBend = -1.05;
        break;
      case 'airhit':
        // Сбит в воздухе: тело раскрыто, руки в стороны — «потерял контроль».
        bodyRotX = -0.6;
        bodyRotZ = 0.4 * f.lastHitDir;
        headRotX = -0.5;
        thighL = -0.5;
        thighR = -0.2;
        shinBend = -0.3;
        shL.set(-2.2, 0.6, 0.7);
        shR.set(-2.2, -0.6, -0.7);
        elL.set(-0.4, 0, 0);
        elR.set(-0.4, 0, 0);
        break;
      case 'crouch':
        bodyRotX = 0.5;
        bodyPosY -= 0.22;
        hipsY -= 0.26;
        headRotX = -0.35;
        thighL = thighR = 0.85;
        shinBend = -0.95;
        shL.set(-1.0, 0.3, 0.4);
        elL.set(-2.0, 0, 0.4);
        shR.set(-1.0, -0.3, -0.4);
        elR.set(-2.0, 0, -0.4);
        break;
      case 'slip': {
        const s = f.slip || 1;
        bodyRotZ = 0.45 * s;
        bodyRotY = d.bodyRot.y + 0.25 * s;
        bodyRotX = 0.14;
        bodyPosX = -0.14 * s;
        bodyPosY -= 0.12;
        headRotZ = -0.35 * s;
        break;
      }
      case 'blockstun':
      case 'guardbreak': {
        const broken = f.state === 'guardbreak';
        bodyRotX = broken ? -0.2 : 0.16;
        bodyPosX = -0.06;
        shL.set(broken ? -0.2 : -0.85, 0.25, broken ? 0.7 : 0.32);
        elL.set(broken ? -0.7 : -1.95, 0, 0.4);
        shR.set(broken ? -0.2 : -0.85, -0.25, broken ? -0.7 : -0.32);
        elR.set(broken ? -0.7 : -1.95, 0, -0.4);
        break;
      }
      case 'hitstun': {
        const t = f.stateFrame / Math.max(1, f.move?.hitstun ?? 16);
        if (f.lastHitZone === 'body') {
          // Удар по корпусу складывает пополам, а не откидывает голову.
          bodyRotX = 0.62;
          bodyPosY -= 0.14;
          hipsY -= 0.1;
          thighL = thighR = 0.5;
          shinBend = -0.5;
          shL.set(-1.1, 0.5, 0.5);
          shR.set(-1.1, -0.5, -0.5);
        } else {
          headRotX = -0.55 * f.headSnap;
          bodyRotX = -0.3;
          bodyRotZ = 0.22;
          bodyPosX = -0.1;
          shL.x += 0.5;
          shR.x += 0.5;
        }
        f.headSnap = Math.max(0, f.headSnap - dt * 2.5);
        bodyRotZ += Math.sin(t * 30) * 0.05;
        break;
      }
      case 'startup':
      case 'active':
      case 'recovery': {
        const move = f.move!;
        if (move.air) {
          // Ноги в ударе с воздуха: нога вылетает вперёд-вниз, вторая поджата.
          const t = THREE.MathUtils.clamp((f.moveElapsed - move.startup) / move.active, 0, 1);
          thighL = lerp(1.2, move.id === 'airKick' ? -0.5 : 0.9, t);
          thighR = 0.9;
          shinBend = lerp(-1.3, move.id === 'airKick' ? -0.15 : -1.0, t);
          hipsY -= 0.05;
        }
        this.posePunch(move, f.moveElapsed, { shL, elL, shR, elR }, (rx, ry, py) => {
          bodyRotX += rx; bodyRotY = d.bodyRot.y + ry; bodyPosY += py;
        });
        break;
      }
      case 'getup': {
        // Подъём с настила: первые две трети боец ещё внизу, в последней
        // трети распрямляется. Без этой фазы он телепортируется из лежачего
        // рэгдолла в стойку за один кадр — то, что и выглядело сломанным.
        const t = 1 - f.stateFrame / GETUP_FRAMES;      // 0 — лежит, 1 — встал
        const rise = THREE.MathUtils.smoothstep(t, 0.25, 1);
        bodyRotX = lerp(1.35, 0.05, rise);
        bodyPosY -= lerp(0.62, 0.0, rise);
        hipsY -= lerp(0.7, 0.0, rise);
        thighL = lerp(1.7, 0, rise);
        thighR = lerp(1.35, 0, rise);
        shinBend = lerp(-1.9, 0, rise);
        headRotX = lerp(-0.5, 0, rise);
        shL.set(lerp(-0.15, d.shoulderL.x, rise), 0.35, lerp(0.9, d.shoulderL.z, rise));
        shR.set(lerp(-0.15, d.shoulderR.x, rise), -0.35, lerp(-0.9, d.shoulderR.z, rise));
        elL.set(lerp(-0.5, d.elbowL.x, rise), 0, d.elbowL.z);
        elR.set(lerp(-0.5, d.elbowR.x, rise), 0, d.elbowR.z);
        break;
      }
      default:
        break;
    }

    // Приближение к цели. Один и тот же коэффициент на всё тело — поза не
    // «распадается» на конечности, живущие с разной скоростью.
    rig.body.rotation.x += (bodyRotX - rig.body.rotation.x) * k;
    rig.body.rotation.y += (bodyRotY - rig.body.rotation.y) * k;
    rig.body.rotation.z += (bodyRotZ - rig.body.rotation.z) * k;
    rig.body.position.x += (bodyPosX - rig.body.position.x) * k;
    rig.body.position.y += (bodyPosY - rig.body.position.y) * k;
    rig.hips.position.y += (hipsY - rig.hips.position.y) * k;
    rig.head.rotation.x += (headRotX - rig.head.rotation.x) * k;
    rig.head.rotation.z += (headRotZ - rig.head.rotation.z) * k;
    lerpEuler(rig.shoulderL.rotation, shL, k);
    lerpEuler(rig.elbowL.rotation, elL, k);
    lerpEuler(rig.shoulderR.rotation, shR, k);
    lerpEuler(rig.elbowR.rotation, elR, k);
    rig.thighL.rotation.x += (thighL - rig.thighL.rotation.x) * k;
    rig.thighR.rotation.x += (thighR - rig.thighR.rotation.x) * k;
    rig.shinL.rotation.x += (shinBend - rig.shinL.rotation.x) * k;
    rig.shinR.rotation.x += (shinBend - rig.shinR.rotation.x) * k;

    // Squash & stretch: перчатка растягивается на выпаде, грудь — на замахе.
    const restore = 1 - Math.exp(-10 * dt);
    const punching = f.state === 'active' && f.move;
    const lead = f.move?.hand === 'lead';
    for (const [glove, isLead] of [[rig.gloveL, true], [rig.gloveR, false]] as const) {
      const target = punching && lead === isLead ? 1.28 : 1;
      glove.scale.x += (target - glove.scale.x) * restore;
      glove.scale.y = glove.scale.x;
      glove.scale.z = glove.scale.x;
    }
    const chestTarget = punching ? 1.14 : 1;
    rig.chest.scale.z += (chestTarget - rig.chest.scale.z) * restore;
  }

  /**
   * Дуга удара из фрейм-даты, а не из клипа: замах занимает ровно `startup`
   * кадров, выпад — `active`, возврат — `recovery`. Поменяли число в
   * `fightingMoves.ts` — анимация поехала за ним, рассинхрона не бывает.
   */
  private posePunch(
    move: Move,
    elapsed: number,
    arms: { shL: THREE.Euler; elL: THREE.Euler; shR: THREE.Euler; elR: THREE.Euler },
    body: (rotX: number, rotY: number, posY: number) => void,
  ): void {
    const s = move.startup;
    const a = move.active;
    const r = move.recovery;
    let extend: number;
    if (elapsed <= s) {
      // Замах: рука уходит НАЗАД. Без этого удар не читается по кадрам.
      extend = -0.22 * Math.sin((elapsed / Math.max(1, s)) * Math.PI / 2);
    } else if (elapsed <= s + a) {
      extend = (elapsed - s) / Math.max(1, a);
      extend = -0.22 + 1.32 * Math.sin(extend * Math.PI / 2);
    } else {
      const p = (elapsed - s - a) / Math.max(1, r);
      extend = 1.1 * (1 - Math.min(1, p));
    }

    const lead = move.hand === 'lead';
    // Ведущая рука — левая в этой стойке; задняя тянет за собой корпус.
    const sh = lead ? arms.shL : arms.shR;
    const el = lead ? arms.elL : arms.elR;
    const sign = lead ? 1 : -1;
    const t = Math.max(0, extend);

    switch (move.id) {
      case 'uppercut':
        // Апперкот идёт снизу: плечо раскрывается, локоть складывается сильнее.
        sh.set(lerp(sh.x, -0.2, t), lerp(sh.y, sign * 0.18, t), lerp(sh.z, -sign * 0.08, t));
        el.set(lerp(el.x, -2.7, t), 0, el.z);
        body(0.1 * t, -sign * 0.3 * t, 0.06 * t);
        break;
      case 'hook':
        // Хук — горизонтальная дуга: работает Y плеча, а не выпрямление руки.
        sh.set(lerp(sh.x, -1.35, t), lerp(sh.y, sign * 0.75, t), lerp(sh.z, -sign * 0.35, t));
        el.set(lerp(el.x, -1.05, t), 0, el.z);
        body(0.14 * t, -sign * 0.6 * t, 0);
        break;
      case 'body':
        // По корпусу: тот же выпад, но ниже и с подседом.
        sh.set(lerp(sh.x, -1.0, t), lerp(sh.y, sign * 0.2, t), lerp(sh.z, -sign * 0.12, t));
        el.set(lerp(el.x, -0.45, t), 0, el.z);
        body(0.34 * t, -sign * 0.35 * t, -0.12 * t);
        break;
      default:
        // Прямой: плечо вперёд, локоть распрямляется в ноль.
        sh.set(lerp(sh.x, -1.5, t), lerp(sh.y, sign * 0.04, t), lerp(sh.z, -sign * 0.04, t));
        el.set(lerp(el.x, -0.1, t), 0, el.z);
        body(0.18 * t, -sign * 0.45 * t, 0);
        break;
    }
  }

  // ────────────────────────────────────────────────────────────── камера
  private updateCamera(dt: number): void {
    const mid = (this.player.x + this.bot.x) / 2;
    const gap = Math.abs(this.player.x - this.bot.x);
    const ko = this.roundOverFrames > 0;

    // На нокдауне камера ныряет к упавшему: событие раунда должно
    // сниматься иначе, чем размен в нейтрали.
    const air = Math.max(this.player.y, this.bot.y);
    let targetX = THREE.MathUtils.clamp(mid, -RING_HALF + 1.6, RING_HALF - 1.6);
    // Камера ведёт прыжок: иначе боец улетает за верхнюю границу кадра.
    let targetY = 1.2 + air * 0.45;
    let dist = THREE.MathUtils.clamp(6.4 + gap * 0.75 + air * 0.35, 6.4, 12);
    let height = 2.75 + gap * 0.06 + air * 0.3;

    if (ko) {
      const downed = this.player.state === 'ko' || this.player.ragdoll ? this.player : this.bot;
      if (downed.ragdoll) {
        downed.ragdoll.hipsPosition(this.tmp);
        targetX = THREE.MathUtils.clamp(this.tmp.x, -RING_HALF, RING_HALF);
        targetY = 0.75;
      }
      dist = 5.0;
      height = 1.9;
    }

    // Наезд на попадании: короткий импульс приближения вместо честного
    // зума. Кадр «клюёт» вперёд на удар и сам возвращается назад.
    this.hitPunch = Math.max(0, this.hitPunch - dt * 2.6);
    dist -= this.hitPunch * 1.1;

    const k = 1 - Math.exp(-(ko ? 3.5 : 9) * dt);
    this.camera.position.x += (targetX * 0.85 - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (dist - this.camera.position.z) * k;
    this.camera.lookAt(targetX, targetY, 0);
  }

  // ──────────────────────────────────────────────────────────── сцена
  private buildLights(ctx: DemoContext): void {
    // Свет над рингом: один жёсткий ключ сверху даёт боксёрскую тень под ноги.
    const key = new THREE.DirectionalLight(0xfff2dd, 2.6);
    key.position.set(2.5, 9, 5);
    key.castShadow = ctx.tier !== 'low';
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -3;
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0x5566aa, 0x151018, 0.7));

    // Контровой свет ринга рисует силуэт, а не перекрашивает бойца. На
    // интенсивности 26 боксёр становился синим с одной стороны и красным с
    // другой — цвет кожи и трусов переставал читаться вовсе.
    for (const [x, color] of [[-6, 0xff5a7c], [6, 0x5a8dff]] as const) {
      const rim = new THREE.PointLight(color, 9, 22);
      rim.position.set(x, 3.6, -4.5);
      this.scene.add(rim);
    }
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.5);
    fill.position.set(-3, 4, 7);
    this.scene.add(fill);
  }

  private buildRing(): THREE.Group {
    const g = new THREE.Group();
    const world = this.world;

    // Настил ринга.
    const canvasMesh = new THREE.Mesh(
      new THREE.BoxGeometry(RING_HALF * 2 + 1.4, 0.4, RING_DEPTH * 2 + 1.4),
      new THREE.MeshStandardMaterial({ color: 0x2a2740, roughness: 0.95 }),
    );
    canvasMesh.position.y = -0.2;
    canvasMesh.receiveShadow = true;
    g.add(canvasMesh);

    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(RING_HALF * 2 + 2.2, 0.5, RING_DEPTH * 2 + 2.2),
      new THREE.MeshStandardMaterial({ color: 0x16121f, roughness: 1 }),
    );
    apron.position.y = -0.62;
    g.add(apron);

    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(RING_HALF + 0.7, 0.2, RING_DEPTH + 0.7)
        .setTranslation(0, -0.2, 0)
        .setFriction(0.95)
        .setCollisionGroups(GROUND_GROUPS),
      ground,
    );

    // Канаты: видимые тонкие цилиндры + невидимая стена за ними. Стена нужна
    // потому, что капсула бойца иначе просто пролезает В ЗАЗОР между канатами.
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.5 });
    // Канат со стороны камеры режет кадр ровно по поясу бойцов, поэтому он
    // полупрозрачный: ринг читается, бой не перекрыт.
    const nearRopeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e2d4, roughness: 0.5, transparent: true, opacity: 0.22, depthWrite: false,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9b1d3a, roughness: 0.4, metalness: 0.3 });
    const sides: Array<[number, number, number, number]> = [
      [RING_HALF, 0, 0.08, RING_DEPTH],
      [-RING_HALF, 0, 0.08, RING_DEPTH],
      [0, RING_DEPTH, RING_HALF, 0.08],
      [0, -RING_DEPTH, RING_HALF, 0.08],
    ];
    for (const [x, z, hx, hz] of sides) {
      for (const y of [0.45, 0.85, 1.25]) {
        const near = z > 0;
        const rope = new THREE.Mesh(
          new THREE.BoxGeometry(hx * 2, 0.05, hz * 2),
          near ? nearRopeMat : ropeMat,
        );
        rope.position.set(x, y, z);
        rope.castShadow = !near;
        rope.renderOrder = near ? 3 : 0;
        g.add(rope);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, 0.025, hz)
            .setTranslation(x, y, z)
            .setRestitution(0.4)
            .setCollisionGroups(GROUND_GROUPS),
          body,
        );
      }
      // Невидимая стена для бойцов.
      const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(Math.max(hx, 0.05), 1.4, Math.max(hz, 0.05))
          .setTranslation(x, 1.4, z)
          .setCollisionGroups(groups(GROUP_GROUND, GROUP_FIGHTER)),
        wall,
      );
    }

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 10), postMat);
        post.position.set(sx * RING_HALF, 0.85, sz * RING_DEPTH);
        post.castShadow = true;
        g.add(post);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        world.createCollider(
          RAPIER.ColliderDesc.cylinder(0.85, 0.09)
            .setTranslation(sx * RING_HALF, 0.85, sz * RING_DEPTH)
            .setCollisionGroups(GROUND_GROUPS),
          body,
        );
      }
    }

    // Трибуна одним инстансированным мешем: 180 зрителей стоят один draw call.
    const count = 180;
    const crowd = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.2, 0.44, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x191426, roughness: 1 }),
      count,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 45);
      dummy.position.set(-11 + (i % 45) * 0.5, 0.4 + row * 0.7, -6.5 - row * 1.3);
      dummy.rotation.y = Math.random() * 0.4 - 0.2;
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
    }
    crowd.instanceMatrix.needsUpdate = true;
    g.add(crowd);
    return g;
  }

  private spawnFighter(look: Parameters<typeof buildBoxer>[0], isPlayer: boolean): Fighter {
    const rig = buildBoxer(look);
    this.scene.add(rig.root);
    const f = new Fighter(rig, isPlayer);

    // Кинематическое тело: физика его не двигает, но оно физически мешает
    // другому бойцу и толкает динамический реквизит.
    f.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, CAP_HALF + CAP_RADIUS, 0),
    );
    f.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAP_HALF, CAP_RADIUS)
        .setFriction(0.5)
        .setCollisionGroups(FIGHTER_GROUPS),
      f.body,
    );
    return f;
  }

  /** Табурет и ведро в углу: живая физика, которую можно снести бойцом. */
  private buildProps(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.6 });

    const addProp = (
      mesh: THREE.Object3D, half: THREE.Vector3, pos: THREE.Vector3, mass: number,
    ): void => {
      mesh.castShadow = true;
      this.scene.add(mesh);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(pos.x, pos.y, pos.z)
          .setLinearDamping(0.25)
          .setAngularDamping(0.6),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
          .setMass(mass)
          .setFriction(0.7)
          .setRestitution(0.1)
          .setCollisionGroups(PROP_GROUPS),
        body,
      );
      this.props.push({ body, mesh });
    };

    for (const sx of [-1, 1]) {
      const stool = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), woodMat);
      addProp(stool, new THREE.Vector3(0.18, 0.21, 0.18),
        new THREE.Vector3(sx * (RING_HALF - 0.55), 0.22, -RING_DEPTH + 0.5), 4);

      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 10), metalMat);
      addProp(bucket, new THREE.Vector3(0.14, 0.13, 0.14),
        new THREE.Vector3(sx * (RING_HALF - 0.95), 0.14, -RING_DEPTH + 0.65), 2);
    }
  }

  /**
   * Два пула брызг: пот и кровь. Разные материалы вместо одного с
   * перекраской — цвет материала общий на все инстансы, и перекраска на лету
   * перекрасила бы уже летящие капли.
   */
  private buildSweatPool(count: number): void {
    this.buildSprayPool('sweat', count, 0.022, 0xcfe4ff, 0.7);
    this.buildSprayPool('blood', Math.round(count * 0.7), 0.026, 0xa5121b, 0.95);
  }

  private buildSprayPool(
    kind: SprayKind, count: number, radius: number, color: number, opacity: number,
  ): void {
    const geom = new THREE.SphereGeometry(radius, 6, 5);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.2, transparent: true, opacity,
    });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, -10, 0).setLinearDamping(0.1),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius).setMass(0.02).setRestitution(0.2)
          .setCollisionGroups(groups(GROUP_PROP, GROUP_GROUND)),
        body,
      );
      body.sleep();
      this.sweat.push({ body, mesh, life: 0, kind });
    }
  }

  private spawnSpray(f: Fighter, zone: 'head' | 'body', count: number, kind: SprayKind): void {
    const pool = this.sweat.filter((s) => s.kind === kind);
    if (pool.length === 0) return;
    const y = zone === 'head' ? BOXER_HEAD_Y : BOXER_BODY_Y;
    for (let i = 0; i < count; i++) {
      const s = pool[this.sweatCursor % pool.length];
      this.sweatCursor++;
      s.body.setTranslation({ x: f.x + f.facing * -0.1, y: f.y + y * (f.airborne ? 0.8 : 1), z: 0 }, true);
      s.body.setLinvel({
        x: -f.facing * (1 + Math.random() * 2.5),
        y: 1.5 + Math.random() * 2,
        z: (Math.random() - 0.5) * 2.5,
      }, true);
      s.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      s.body.wakeUp();
      s.mesh.visible = true;
      s.life = 1.4;
    }
  }

  private spawnMouthguard(f: Fighter, dir: number): void {
    f.rig.mouthguard.getWorldPosition(this.tmp);
    f.rig.mouthguard.visible = false;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.025, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x8d2b2b, roughness: 0.4 }),
    );
    mesh.position.copy(this.tmp);
    this.scene.add(mesh);

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.tmp.x, this.tmp.y, this.tmp.z)
        .setLinearDamping(0.05),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.045, 0.013, 0.01).setMass(0.05).setRestitution(0.35)
        .setCollisionGroups(PROP_GROUPS),
      body,
    );
    body.setLinvel({ x: dir * 4.5, y: 3.2, z: (Math.random() - 0.5) * 2 }, true);
    body.setAngvel({ x: 8, y: 5, z: 3 }, true);
    this.debris.push({ body, mesh });
    // За долгий бой нокдаунов набирается десяток: держим на настиле только
    // последние три капы, остальные убираем вместе с их телами.
    while (this.debris.length > 3) {
      const old = this.debris.shift()!;
      this.world.removeRigidBody(old.body);
      disposeObject(old.mesh);
    }
  }

  private syncBody(body: RAPIER.RigidBody, object: THREE.Object3D): void {
    const p = body.translation();
    const r = body.rotation();
    object.position.set(p.x, p.y, p.z);
    object.quaternion.set(r.x, r.y, r.z, r.w);
  }

  private resetRound(): void {
    for (const d of this.debris) {
      this.world.removeRigidBody(d.body);
      disposeObject(d.mesh);
    }
    this.debris.length = 0;
    for (const [f, x, facing] of [
      [this.player, -START_GAP / 2, 1], [this.bot, START_GAP / 2, -1],
    ] as const) {
      f.ragdoll?.dispose();
      f.ragdoll = null;
      resetPose(f.rig);
      f.rig.mouthguard.visible = true;
      f.reset(x, facing);
      f.body.setTranslation({ x, y: CAP_HALF + CAP_RADIUS, z: 0 }, true);
      f.body.setNextKinematicTranslation({ x, y: CAP_HALF + CAP_RADIUS, z: 0 });
    }
    this.hitstop = 0;
    this.roundOverFrames = 0;
    this.timeScale = 1;
    this.hitPunch = 0;
    this.lastAdvantage = null;
    this.say('БОЙ!', 90);
  }

  // ────────────────────────────────────────────────────── отладка хитбоксов
  private updateBoxHelpers(): void {
    for (const h of this.boxHelpers) h.visible = false;
    let i = 0;
    const draw = (b: WorldBox, color: number): void => {
      const helper = this.boxHelpers[i] ?? this.makeBoxHelper();
      i++;
      helper.visible = true;
      (helper.material as THREE.LineBasicMaterial).color.setHex(color);
      helper.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0);
      helper.scale.set(b.maxX - b.minX, b.maxY - b.minY, 0.8);
    };
    for (const f of [this.player, this.bot]) {
      if (f.ragdoll) continue;
      draw(boxWorld(f, f.hurtbox), f.state === 'slip' || f.state === 'crouch' ? 0x33ffee : 0x33ff66);
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

  private pushStatus(): void {
    const p = this.player;
    const b = this.bot;
    if (p.move) this.lastAdvantage = frameAdvantageOnBlock(p.move);
    const adv = this.lastAdvantage;
    this.ctx.setStatus(
      `<span class="hp">Игрок</span> ${bar(p.hp, MAX_HP)} ${p.hp}`
      + ` · выносл. ${bar(p.stamina, MAX_STAMINA)}`
      + ` · нокдауны ${p.knockdowns}<br>`
      + `<span class="hp">Бот</span> ${bar(b.hp, MAX_HP)} ${b.hp}`
      + ` · выносл. ${bar(b.stamina, MAX_STAMINA)}`
      + ` · нокдауны ${b.knockdowns}<br>`
      + (this.announce ? `<b>${this.announce}</b> · ` : '')
      + `состояние: <b>${p.state}</b>(${p.stateFrame})`
      + (p.y > 0.05 ? ` · высота ${p.y.toFixed(1)} м` : '')
      + (p.juggle > 0 ? ` · жонгл ×${p.juggle}` : '')
      + (p.move ? ` · приём: <b>${p.move.label[0]}</b> ${p.move.startup}/${p.move.active}/${p.move.recovery}` : '')
      + (p.cancelWindow > 0 ? ' · <b>отмена открыта</b>' : '')
      + (adv !== null ? ` · на блоке <b>${adv > 0 ? '+' : ''}${adv}</b> кадров` : '')
      + ` · комбо ${b.comboHits} (урон ×${comboScaling(b.comboHits).toFixed(2)})`,
    );
  }
}

const KEY_TO_MOVE: Record<string, MoveId | undefined> = {
  KeyJ: 'jab',
  KeyK: 'hook',
  KeyL: 'overhand',
  KeyI: 'uppercut',
  KeyU: 'body',
  KeyO: 'sweep',
};

/**
 * Та же кнопка в воздухе даёт воздушный приём. Отдельные «воздушные кнопки» —
 * лишний ряд в раскладке ради двух приёмов; игрок и так знает, что в прыжке
 * всё работает иначе.
 */
const AIR_VERSION: Partial<Record<MoveId, MoveId>> = {
  jab: 'airPunch',
  body: 'airPunch',
  hook: 'airKick',
  overhand: 'airKick',
  uppercut: 'airKick',
  sweep: 'airKick',
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

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function lerpEuler(target: THREE.Euler, goal: THREE.Euler, k: number): void {
  target.x += (goal.x - target.x) * k;
  target.y += (goal.y - target.y) * k;
  target.z += (goal.z - target.z) * k;
}

/** Полоса из блоков: HUD здесь — одна строка текста, графики в нём нет. */
function bar(value: number, max: number): string {
  const filled = Math.round(THREE.MathUtils.clamp(value / max, 0, 1) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
