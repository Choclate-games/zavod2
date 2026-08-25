/**
 * Головная проверка анимаций бойца — без браузера и без WebGL.
 *
 * Три слоя, и каждый ломается молча:
 *
 * 1. **Запечённый мокап** (`bake-fight-anim.ts`). Перепутанная сторона,
 *    потерянный сустав или сдвинутая опорная высота не дают ни исключения,
 *    ни красного кадра.
 * 2. **Поза в живой игре.** Мокап — только верхний слой, половину позы даёт
 *    фрейм-дата, и по одному клипу нельзя сказать ни что джеб достаёт, ни
 *    что подсечка идёт низом. Поэтому анимации прогоняются в настоящей игре
 *    нажатием тех же клавиш, что нажал бы игрок.
 * 3. **Библиотека `assets/proc_anim/`.** Поправили позу, забыли пересобрать —
 *    и выгрузка молча разошлась с игрой.
 *
 * Глазами то же самое смотрится листами `npm run shots:anim` (Playwright).
 *
 * Запуск: `npx tsx scripts/fight-anim-check.ts`
 */
import * as THREE from 'three';
import type { DemoContext } from '../src/core/Demo';
import { FightingDemo } from '../src/demos/FightingDemo';
import { AnimDriver, FIGHT_ANIM_STATES, type AnimFighter } from '../src/game/fightAnimStates';
import type { BoxerRig } from '../src/world/boxerRig';
import {
  HIT_CLIPS, MOVE_CLIPS, STATE_CLIPS, loadFightClips, type ClipUse,
} from '../src/world/fightClips';
import { MOVES } from '../src/game/fightingMoves';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

const JOINTS = ['body', 'hips', 'waist', 'chest', 'head',
  'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'thighL', 'shinL', 'thighR', 'shinR'];

// ──────────────────────────────────────────────── 1. запечённый мокап
const clips = await loadFightClips();
console.log(`Запечено клипов: ${clips.size}`);
console.log('');
console.log('Целостность мокапа:');
check('клипы загрузились', clips.size >= 30, `= ${clips.size}`);

const used: ClipUse[] = [
  ...Object.values(MOVE_CLIPS), ...Object.values(STATE_CLIPS), ...Object.values(HIT_CLIPS),
];
for (const use of used) check(`клип «${use.clip}» есть в наборе`, clips.has(use.clip));

let badQuat = 0;
let badLen = 0;
let badRoot = 0;
for (const [name, clip] of clips) {
  if (clip.frames < 8 || clip.frames > 220) badLen++;
  if (clip.rootY.length !== clip.frames) badLen++;
  for (const j of JOINTS) {
    const t = clip.joints[j];
    if (!t || t.length !== clip.frames * 4) { badQuat++; continue; }
    for (let i = 0; i < t.length; i += 4) {
      const n = Math.hypot(t[i], t[i + 1], t[i + 2], t[i + 3]);
      if (Math.abs(n - 1) > 0.02) { badQuat++; break; }
    }
  }
  // Таз ниже метра под стойкой — это не поза, а сбой опорной высоты: именно
  // так выглядел «лежачий боец на высоте стояния». Верхняя граница щедрая:
  // `jump_kick` честно уносит таз на полметра вверх.
  if (clip.rootY.some((v) => v < -1.1 || v > 0.9)) {
    badRoot++;
    console.error(`   ${name}: rootY вне диапазона`);
  }
}
check('у всех клипов все 13 суставов и нормированные кватернионы', badQuat === 0, `сбоев ${badQuat}`);
check('длины дорожек согласованы', badLen === 0, `сбоев ${badLen}`);
check('высота таза в разумных пределах', badRoot === 0, `клипов ${badRoot}`);

// ─────────────────────────────────────────────── 2. позы в живой игре
const noop = (): void => {};
const driver = new AnimDriver();
const gameCtx = {
  renderer: null,
  tier: 'high',
  addTrauma: noop,
  setStatus: noop,
  rebuildPostFx: noop,
  audio: new Proxy({}, { get: () => noop }),
  input: {
    isDown: (code: string) => driver.isDown(code),
    moveVector: (out = new THREE.Vector2()) => out.set(0, 0),
    onKey: (down: (code: string) => void) => { driver.onKey = down; return noop; },
    // Мышь головным прогонам не нужна: приёмы вызываются клавишами.
    onPointerButton: () => noop,
    clearSubscribers: noop,
    releaseAll: noop,
    endFrame: noop,
    consumeLockDelta: (out = new THREE.Vector2()) => out.set(0, 0),
    requestPointerLock: noop,
    isPointerLocked: false,
    primary: null,
    activePointers: [],
    vehicleSnapshot: () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, pause: false }),
    vehicle: null,
  },
} as unknown as DemoContext;

const demo = new FightingDemo();
await demo.init(gameCtx);
demo.enter();
const game = demo as unknown as {
  player: AnimFighter & { rig: BoxerRig; x: number; y: number; hp: number };
  bot: AnimFighter & { x: number; hp: number };
};
const fighter = game.player;
const rig = fighter.rig;

function gameStep(): void {
  driver.step();
  // Соперника держим далеко и живым: его удары испортили бы измеряемую позу.
  game.bot.x = 6;
  game.bot.enter('idle');
  game.bot.hp = 1000;
  demo.fixedUpdate();
  demo.update(1 / 60);
}

const tmp = new THREE.Vector3();
/** Позиция узла в системе координат бойца: +Z — вперёд, X — вбок. */
const localOf = (o: THREE.Object3D): THREE.Vector3 => {
  o.getWorldPosition(tmp);
  return rig.root.worldToLocal(tmp).clone();
};

const footL = rig.root.getObjectByName('mixamorigRightFoot')!;
const footR = rig.root.getObjectByName('mixamorigLeftFoot')!;

/**
 * Насколько колено выступает ВПЕРЁД от прямой «тазобедренный сустав →
 * лодыжка», в метрах. У человека это всегда плюс: колено гнётся в одну
 * сторону. Минус — вывернутый назад сустав, и это ровно тот дефект, который
 * не ловился ничем: по высоте головы, размаху стопы и сгибу голени поза
 * выглядела правильной, а нога при этом складывалась в обратную сторону.
 */
function bulge(side: 'Right' | 'Left'): number {
  const hip = localOf(rig.root.getObjectByName(`mixamorig${side}UpLeg`)!);
  const knee = localOf(rig.root.getObjectByName(`mixamorig${side}Leg`)!);
  const ankle = localOf(rig.root.getObjectByName(`mixamorig${side}Foot`)!);
  // Считаем не «на сколько колено впереди по Z», а отступ от самой прямой
  // бедро→лодыжка: у поджатой ноги в подъёме с настила лодыжка оказывается
  // на высоте таза, и деление на разность высот даёт минус пятнадцать метров.
  const uz = ankle.z - hip.z;
  const uy = ankle.y - hip.y;
  const len = Math.hypot(uz, uy);
  // Нога сложена до предела — вопрос «в какую сторону колено» смысла не имеет.
  if (len < 0.3) return 0;
  return (uz / len) * (knee.y - hip.y) - (uy / len) * (knee.z - hip.z);
}

interface Sample {
  gloveLeadZ: number; gloveLeadX: number; gloveRearZ: number; gloveRearX: number; gloveTopY: number; headY: number; headX: number;
  footZ: number; footY: number; footLift: number; rootY: number;
  kneeBend: number; kneeBulge: number;
  /** Сгиб каждой голени по отдельности: у удара ногой стороны не равны. */
  shinL: number; shinR: number;
  tiltDeg: number;
}

/** Прогнать анимацию в игре и вернуть по каждой величине минимум и максимум. */
function play(id: string): { min: Sample; max: Sample; all: Sample[] } {
  const state = FIGHT_ANIM_STATES.find((s) => s.id === id)!;
  driver.release();
  fighter.enter('idle');
  fighter.hp = 1000;
  for (let i = 0; i < 40; i++) gameStep();
  fighter.x = -1.1;
  driver.begin(state);
  state.force?.(fighter, { hitBy: 'hook' });

  let min: Sample | null = null;
  let max: Sample | null = null;
  const all: Sample[] = [];
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3();

  for (let f = 0; f < state.frames; f++) {
    gameStep();
    rig.root.updateWorldMatrix(true, true);
    const lead = localOf(rig.gloveL);
    const rear = localOf(rig.gloveR);
    const headLocal = localOf(rig.head);
    const fl = localOf(footL);
    const fr = localOf(footR);
    const forward = fl.z > fr.z ? fl : fr;
    rig.chest.getWorldQuaternion(quat);
    up.set(0, 1, 0).applyQuaternion(quat);
    rig.head.getWorldPosition(tmp);

    const s: Sample = {
      gloveLeadZ: lead.z,
      gloveLeadX: lead.x,
      gloveRearZ: rear.z,
      gloveRearX: rear.x,
      gloveTopY: Math.max(lead.y, rear.y),
      headY: tmp.y,
      headX: headLocal.x,
      footZ: forward.z,
      footY: Math.min(fl.y, fr.y),
      // Отрыв стопы меряется по ВЕРХНЕЙ ноге: нижняя стоит на настиле весь
      // шаг, и по ней подъём всегда нулевой.
      footLift: Math.max(fl.y, fr.y),
      rootY: fighter.y,
      // Сгиб колена — ПЛЮС по X: поворот вокруг +X тянет голень назад, то
      // есть пятку к ягодице. Минус здесь означал бы колено, выгнутое в
      // обратную сторону, поэтому берём максимум, а не минимум.
      kneeBend: Math.max(rig.shinL.rotation.x, rig.shinR.rotation.x),
      kneeBulge: Math.min(bulge('Right'), bulge('Left')),
      shinL: rig.shinL.rotation.x,
      shinR: rig.shinR.rotation.x,
      tiltDeg: THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.y, -1, 1))),
    };
    all.push(s);
    if (!min || !max) { min = { ...s }; max = { ...s }; continue; }
    for (const k of Object.keys(s) as Array<keyof Sample>) {
      min[k] = Math.min(min[k], s[k]);
      max[k] = Math.max(max[k], s[k]);
    }
  }
  return { min: min!, max: max!, all };
}

console.log('');
console.log('Позы в живой игре:');

const stand = play('idle');
const standHeadY = stand.max.headY;
console.log(`  стойка: голова ${standHeadY.toFixed(2)} м, перчатка вперёд ${stand.max.gloveLeadZ.toFixed(2)} м`);

const jab = play('jab');
// Рука длиной 0.53 м из гарда (перчатка уже на 0.27 впереди) доезжает
// примерно до 0.52 — «выпад на 20 см» это и есть полностью прямой удар.
check('джеб достаёт вперёд', jab.max.gloveLeadZ > stand.max.gloveLeadZ + 0.2,
  `= ${jab.max.gloveLeadZ.toFixed(2)} при стойке ${stand.max.gloveLeadZ.toFixed(2)}`);

// Удар обязан идти ВПЕРЁД. Замер родился из апперкота: он уходил на 57 см
// вбок при 29 см вперёд, то есть боец бил мимо соперника — а все проверки
// на «перчатка ушла от стойки» при этом проходили. Смотреть надо в кадре
// попадания (максимальный вынос), а не по всей анимации: на возврате рука
// законно уходит вбок, и минимумы с максимумами по клипу это смешивают.
for (const [id, side] of [
  ['jab', 'Lead'], ['hook', 'Rear'], ['overhand', 'Rear'],
  ['uppercut', 'Rear'], ['body_shot', 'Lead'],
] as const) {
  const r = play(id);
  const zKey = `glove${side}Z` as const;
  const xKey = `glove${side}X` as const;
  let peak = 0;
  for (let i = 1; i < r.all.length; i++) if (r.all[i][zKey] > r.all[peak][zKey]) peak = i;
  const forward = r.all[peak][zKey];
  const lateral = Math.abs(r.all[peak][xKey] - r.all[0][xKey]);
  console.log(`  ${id.padEnd(10)} в кадре попадания: вперёд ${forward.toFixed(2)} м,`
    + ` вбок ${lateral.toFixed(2)} м`);
  check(`${id}: удар идёт вперёд, а не вбок`, forward > lateral + 0.15,
    `вперёд ${forward.toFixed(2)}, вбок ${lateral.toFixed(2)} м`);
}

const upper = play('uppercut');
check('апперкот поднимает перчатку выше головы', upper.max.gloveTopY > standHeadY,
  `= ${upper.max.gloveTopY.toFixed(2)} при голове ${standHeadY.toFixed(2)}`);

const sweep = play('sweep');
check('подсечка выносит ногу вперёд', sweep.max.footZ > 0.35, `= ${sweep.max.footZ.toFixed(2)}`);
check('подсечка идёт низом', sweep.min.footY < 0.25, `стопа на ${sweep.min.footY.toFixed(2)} м`);

// Удары ногами. Замер тут один и физический: стопа обязана оказаться там,
// куда бьёт хитбокс приёма. Иначе получается то, ради чего эта проверка и
// написана, — урон в голову наносит нога, поднятая до колена.
const frontKick = play('front_kick');
const round = play('roundhouse');
console.log(`  фронт-кик: стопа вперёд ${frontKick.max.footZ.toFixed(2)} м, подъём ${frontKick.max.footLift.toFixed(2)} м`);
console.log(`  хайкик:  стопа вперёд ${round.max.footZ.toFixed(2)} м, подъём ${round.max.footLift.toFixed(2)} м`);
for (const [name, r] of [['фронт-кик', frontKick], ['хайкик', round]] as const) {
  const box = MOVES[name === 'хайкик' ? 'roundhouse' : 'frontKick'].hitbox;
  check(`${name}: стопа доходит до своего хитбокса`,
    r.max.footZ > box.x - box.w / 2, `стопа ${r.max.footZ.toFixed(2)} м, коробка от ${(box.x - box.w / 2).toFixed(2)}`);
  check(`${name}: стопа на высоте своего хитбокса`,
    r.max.footLift > box.y - box.h / 2,
    `стопа ${r.max.footLift.toFixed(2)} м, коробка от ${(box.y - box.h / 2).toFixed(2)}`);
}

// Занос — то, чем удар ногой отличается от выпада. Замер прямой: в момент
// попадания (кадр максимального выноса стопы) бьющая голень уже
// распрямлена, а ДО него она была сложена заметно сильнее. Пока обе фазы
// вела одна дуга синуса, эти два числа совпадали, и фронт-кик читался как шаг.
for (const [name, r, side] of [
  ['фронт-кик', frontKick, 'shinL'], ['хайкик', round, 'shinR'],
] as const) {
  let peak = 0;
  for (let i = 1; i < r.all.length; i++) {
    if (r.all[i].footLift > r.all[peak].footLift) peak = i;
  }
  const atHit = r.all[peak][side];
  let chamber = 0;
  for (let i = 0; i < peak; i++) chamber = Math.max(chamber, r.all[i][side]);
  console.log(`  ${name}: поджим голени ${chamber.toFixed(2)} → ${atHit.toFixed(2)} рад`
    + ` к кадру попадания ${peak}`);
  check(`${name}: перед ударом нога заносится, а не выносится`, chamber > atHit + 0.5,
    `поджим ${chamber.toFixed(2)}, в попадании ${atHit.toFixed(2)} рад`);
}

// Полметра между ними — это грудь и голова. Порог 0.4, а не «сколько
// получилось»: высоту теперь задаёт мокап, и от клипа к клипу она поедет.
check('удары ногами бьют на разной высоте', round.max.footLift > frontKick.max.footLift + 0.4,
  `${round.max.footLift.toFixed(2)} против ${frontKick.max.footLift.toFixed(2)} м`);
// Удар ногой не должен выглядеть ударом руки: перчатка держится в гарде.
check('в ударе ногой перчатка не выбрасывается', round.max.gloveLeadZ < jab.max.gloveLeadZ,
  `${round.max.gloveLeadZ.toFixed(2)} против джеба ${jab.max.gloveLeadZ.toFixed(2)} м`);

// Шаг: ноги обязаны переставляться И сгибаться в колене. Прямые ноги-ножницы
// читаются как скольжение — ровно так и было, пока голени не разделили.
const walk = play('walk_forward');
check('в шаге стопа проходит вперёд-назад', walk.max.footZ - walk.min.footZ > 0.25,
  `размах ${(walk.max.footZ - walk.min.footZ).toFixed(2)} м`);
check('в шаге сгибается колено', walk.max.kneeBend > 0.35,
  `= ${walk.max.kneeBend.toFixed(2)} рад`);
check('в шаге стопа отрывается от настила', walk.max.footLift - walk.min.footLift > 0.08,
  `подъём ${(walk.max.footLift - walk.min.footLift).toFixed(2)} м`);

const crouch = play('crouch');
check('присед опускает голову хотя бы на 20 см', standHeadY - crouch.min.headY > 0.2,
  `= ${(standHeadY - crouch.min.headY).toFixed(2)} м`);

// Уклон уводит голову вбок. Он же тринадцать кадров жил один кадр — тогда
// этот замер показывал ноль.
const slip = play('slip');
// Считаем отклонение от стойки в любую сторону: уклон по `KeyZ` уводит
// голову в плюс по X, и «минимум» тут ничего не показывает.
const slipShift = Math.max(
  Math.abs(slip.max.headX - stand.max.headX),
  Math.abs(slip.min.headX - stand.min.headX),
);
check('уклон уводит голову вбок', slipShift > 0.12, `= ${slipShift.toFixed(2)} м`);

const jump = play('jump');
check('прыжок поднимает бойца', jump.max.rootY > 1.6, `= ${jump.max.rootY.toFixed(2)} м`);
check('в прыжке боец не переворачивается', jump.max.tiltDeg < 50,
  `наклон корпуса ${jump.max.tiltDeg.toFixed(0)}°`);
check('в прыжке ноги поджаты', jump.max.kneeBend > 0.8, `голень ${jump.max.kneeBend.toFixed(2)} рад`);

const getup = play('get_up');
check('подъём начинается на настиле', getup.min.headY < 1.1, `= ${getup.min.headY.toFixed(2)}`);
check('подъём заканчивается в стойке', getup.max.headY > 1.4, `= ${getup.max.headY.toFixed(2)}`);

// Ни одна анимация не должна ронять бойца под настил или ставить на голову.
let sunk = '';
const backKnee: string[] = [];
for (const state of FIGHT_ANIM_STATES) {
  const r = play(state.id);
  if (r.min.footY < -0.06) sunk = `${state.id} (стопа ${r.min.footY.toFixed(2)})`;
  if (state.id !== 'get_up' && r.min.headY < 0.3) sunk = `${state.id} (голова ${r.min.headY.toFixed(2)})`;
  // Порог не нулевой: у прямой ноги колено лежит на самой линии, и там
  // гуляют миллиметры округления. Сантиметр назад — уже сломанный сустав.
  if (r.min.kneeBulge < -0.01) backKnee.push(`${state.id} (${r.min.kneeBulge.toFixed(3)} м)`);
}
check('ни одна анимация не проваливает бойца под настил', sunk === '', sunk);
check('ни в одной анимации колено не выгибается назад', backKnee.length === 0,
  backKnee.join(', '));

// ──────────────────────────────────────────────────────────── 2б. рэгдолл
// Нокдаун проверяется отдельно, потому что позы его не видят вовсе: боец в
// это время не позируется, им распоряжается физика. Ровно здесь и жил баг,
// который не ловил ни один замер — руки и ноги не были сшиты с телом, и
// корпус падал, а ноги оставались стоять на настиле.
console.log('');
console.log('Рэгдолл:');
{
  const kd = game as unknown as {
    knockDown(f: unknown, dir: 1 | -1): void;
    player: { ragdoll: {
      counts: { parts: number; joints: number; tendons: number };
      lowestPoint: number;
    } | null;
      lastHitZone: string; lastHitPower: number };
  };
  driver.release();
  fighter.enter('idle');
  fighter.hp = 1000;
  for (let i = 0; i < 40; i++) gameStep();

  const heel = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());
  const before = heel(footL);

  const headBone = rig.root.getObjectByName('mixamorigHead') ?? rig.head;
  // Ссылки берутся ДО нокдауна: подграфы костей переезжают под holder-ы
  // рэгдолла, и `rig.root.getObjectByName` их там уже не находит.
  const knees = (['Right', 'Left'] as const).map((sd) => ({
    hip: rig.root.getObjectByName(`mixamorig${sd}UpLeg`)!,
    knee: rig.root.getObjectByName(`mixamorig${sd}Leg`)!,
    ankle: rig.root.getObjectByName(`mixamorig${sd}Foot`)!,
    driver: sd === 'Right' ? rig.thighL : rig.thighR,
  }));

  /**
   * Сгиб колена со знаком, рад. Ось шарнира — боковая ось персонажа, и
   * берётся она у драйвера бедра: у драйверов оси совпадают с осями
   * персонажа, а сам таз в полёте крутится как хочет. Плюс — сгиб в
   * человеческую сторону, минус — колено выгнулось назад.
   */
  const kneeBendNow = (k: typeof knees[number]): number => {
    const p = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const thighDir = p(k.knee).sub(p(k.hip)).normalize();
    const shinDir = p(k.ankle).sub(p(k.knee)).normalize();
    const axis = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(k.driver.getWorldQuaternion(new THREE.Quaternion()));
    const sin = new THREE.Vector3().crossVectors(thighDir, shinDir).dot(axis);
    return Math.atan2(sin, thighDir.dot(shinDir));
  };

  kd.player.lastHitZone = 'head';
  kd.player.lastHitPower = 40;
  kd.knockDown(kd.player, 1);
  const counts = kd.player.ragdoll!.counts;
  // Двенадцать тел — двенадцать костей из `ragdollBones()`, связей на одну
  // меньше: у головы родителя нет, она корень дерева. Плюс две пружины-
  // связки вдоль позвоночника, их считаем отдельно, иначе первая же
  // добавленная связка сломала бы замер связности.
  check('все части рэгдолла сшиты суставами', counts.joints === counts.parts - 1,
    `${counts.joints} суставов на ${counts.parts} тел`);
  check('конечности разбиты по суставам', counts.parts >= 12, `тел ${counts.parts}`);
  check('позвоночник и конечности держат связки', counts.tendons === 8, `связок ${counts.tendons}`);

  // Меряем, пока боец лежит: `standUp` срабатывает сам, как только тела
  // успокоились, и на 150-м кадре он уже снова в стойке.
  // Куча тряпья и лежащий человек различаются длиной: рост 1.78 м, лёжа от
  // головы до стопы по горизонтали остаётся хотя бы метр. Мерить надо
  // ВНУТРИ рэгдолла: `standUp` срабатывает сам, и после него замер
  // относится уже к анимации подъёма, а не к тому, как боец лежал.
  const flat = (o: THREE.Object3D) => {
    const v = heel(o);
    return new THREE.Vector2(v.x, v.z);
  };
  const spreadNow = () => Math.max(
    flat(headBone).distanceTo(flat(footL)),
    flat(headBone).distanceTo(flat(footR)),
  );

  let lowestHead = 9;
  let footShift = 0;
  let gap = 0;
  let worstKnee = 9;
  let frames = 0;
  let spread = 0;
  let maxSpread = 0;
  let lastHead = 9;
  let sank = 9;
  let restSank = 9;
  for (let i = 0; i < 150 && kd.player.ragdoll; i++) {
    gameStep();
    // Всё, что меряется, — только пока рэгдолл жив. `standUp` срабатывает
    // ВНУТРИ шага, возвращает кости в риг и ставит позу подъёма; замер,
    // сделанный после этого, относится уже к анимации, а не к физике, и
    // «голова в конце» превращалась из 0.25 м в 0.68 м на ровном месте.
    if (!kd.player.ragdoll) break;
    frames++;
    spread = spreadNow();
    maxSpread = Math.max(maxSpread, spread);
    lastHead = heel(headBone).y;
    restSank = kd.player.ragdoll.lowestPoint;
    sank = Math.min(sank, restSank);
    lowestHead = Math.min(lowestHead, lastHead);
    footShift = Math.max(footShift, Math.abs(heel(footL).x - before.x));
    gap = Math.max(gap, heel(footL).distanceTo(heel(rig.body)));
    for (const k of knees) worstKnee = Math.min(worstKnee, kneeBendNow(k));
  }
  console.log(`  кадров в рэгдолле ${frames}, разброс тела ${spread.toFixed(2)} м`
    + ` (максимум ${maxSpread.toFixed(2)}), худшее колено ${worstKnee.toFixed(2)} рад`);
  console.log(`  в конце рэгдолла голова на ${lastHead.toFixed(2)} м,`
    + ` ниже всего тела опускались до ${sank.toFixed(3)} м,`
    + ` в покое ${restSank.toFixed(3)} м`);
  check('в нокдауне падает и голова', lowestHead < 0.8, `ниже всего ${lowestHead.toFixed(2)} м`);
  // Порог 0.2, а не «сколько получилось»: нокдаун идёт через решатель
  // физики, и от прогона к прогону стопа проезжает 0.30 ± 0.05 м. С
  // несшитой ногой (та самая ошибка, ради которой замер написан) она
  // сдвигалась на 0.02 м, так что запас различения тут пятнадцатикратный —
  // а порог, поставленный впритык к типичному значению, просто мигал бы.
  check('в нокдауне ноги едут вместе с телом', footShift > 0.2,
    `стопа сдвинулась на ${footShift.toFixed(2)} м`);
  check('ноги не отрываются от таза', gap < 1.3, `стопа в ${gap.toFixed(2)} м от таза`);
  // Три замера вместо одного «рэгдолл создался». Они и есть разница между
  // человеком, которого сбили, и мешком, который сдулся на месте.
  //
  // Куча и лежащий различаются длиной: рост 1.78 м, и в какой-то момент
  // падения тело обязано вытянуться хотя бы на метр по горизонтали. Пока
  // конечности были цельными досками без шарниров, разброс не доходил и до
  // 0.8 м — боец складывался на своём месте.
  check('в нокдауне тело вытягивается', maxSpread > 1.1,
    `максимальный разброс ${maxSpread.toFixed(2)} м`);
  // Сидящая кукла — вторая типовая беда рэгдолла, и на картинке она
  // выглядит хуже кучи. Голова лежащего человека — это 0.2–0.3 м, сидящего
  // — 0.9. Замер берётся в последнем кадре рэгдолла: дальше уже подъём.
  check('в нокдауне боец ложится, а не садится', lastHead < 0.5,
    `голова в конце ${lastHead.toFixed(2)} м`);
  // И физика не должна оставлять тела под настилом. У поз такой замер был с
  // самого начала, у рэгдолла его не было вовсе.
  //
  // Порогов два, и это не перестраховка. В КАДРЕ УДАРА о настил тело
  // законно оказывается ниже пола: падая с 1.6 м, оно набирает 5.6 м/с,
  // то есть 9.3 см за тик при 60 Гц, и контакт разбирается уже после того,
  // как коробка проехала этот шаг. CCD тут не помогает — она ловит
  // проскок насквозь, а не проникновение на треть собственной толщины.
  // Настоящая поломка — это тело, которое ОСТАЛОСЬ под полом; её и ловит
  // второй порог, по последнему кадру.
  check('рэгдолл не проваливается сквозь настил', sank > -0.12,
    `в момент удара ниже всего ${sank.toFixed(3)} м`);
  check('улёгшийся рэгдолл лежит НА настиле', restSank > -0.02,
    `в покое ниже всего ${restSank.toFixed(3)} м`);
  // Колено не выгибается назад и в рэгдолле тоже. Это тот же физический
  // факт, что и в позах, но обеспечивает его не код анимации, а предел
  // шарнира: без него шаровой сустав пускал голень вперёд сквозь бедро.
  check('в нокдауне колено не выгибается назад', worstKnee > -0.25,
    `худший сгиб ${worstKnee.toFixed(2)} рад`);
}

demo.exit();
demo.dispose();

// ─────────────────────────────── 3. библиотека процедурных анимаций
console.log('');
console.log('Библиотека процедурных анимаций:');
{
  const fs = await import('node:fs');
  const dir = 'C:/Users/Eduard/Desktop/zavod2/assets/proc_anim';
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  check('клипы выгружены', files.length >= FIGHT_ANIM_STATES.length,
    `${files.length} файлов на ${FIGHT_ANIM_STATES.length} анимаций`);

  let bad = 0;
  let stale = 0;
  for (const state of FIGHT_ANIM_STATES) {
    const file = `${dir}/${state.id}.json`;
    if (!fs.existsSync(file)) { bad++; console.error(`   нет файла ${state.id}.json`); continue; }
    const clip = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      frames: number; fps: number; rootY: number[]; joints: Record<string, number[]>;
    };
    if (clip.frames !== state.frames || clip.fps !== 60) { stale++; continue; }
    if (clip.rootY.length !== clip.frames) { bad++; continue; }
    for (const j of JOINTS) {
      const track = clip.joints[j];
      if (!track || track.length !== clip.frames * 4) { bad++; break; }
      for (let i = 0; i < track.length; i += 4) {
        const n = Math.hypot(track[i], track[i + 1], track[i + 2], track[i + 3]);
        if (Math.abs(n - 1) > 0.02) { bad++; i = track.length; }
      }
    }
  }
  check('все дорожки на месте и нормированы', bad === 0, `сбоев ${bad}`);
  check('длительности совпадают с игрой', stale === 0,
    `${stale} клипов разошлось — нужен npm run make:proc-anim`);

  // Длительности могут совпадать, а содержимое быть от старой сборки: поза
  // менялась, а число кадров нет. Поэтому проверяем ещё и знак ног прямо в
  // файлах — в приседе и прыжке колено обязано быть согнуто вперёд, и это
  // ровно то, что было сломано. Кватернион поворота вокруг X: у бедра x < 0
  // (колено вперёд), у голени x > 0 (пятка к ягодице).
  const legSign: string[] = [];
  for (const id of ['crouch', 'jump']) {
    const file = `${dir}/${id}.json`;
    if (!fs.existsSync(file)) continue;
    const clip = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      joints: Record<string, number[]>;
    };
    const axis = (joint: string, pick: 'min' | 'max'): number => {
      const track = clip.joints[joint] ?? [];
      const xs: number[] = [];
      for (let i = 0; i < track.length; i += 4) xs.push(track[i]);
      return pick === 'min' ? Math.min(...xs) : Math.max(...xs);
    };
    if (axis('thighL', 'min') > -0.05) legSign.push(`${id}: бедро не выносится вперёд`);
    if (axis('shinL', 'max') < 0.1) legSign.push(`${id}: колено не сгибается`);
  }
  check('в выгрузке колени согнуты вперёд', legSign.length === 0, legSign.join(', '));
}

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
