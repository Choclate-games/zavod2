/**
 * Головной прогон живого матча — без браузера и без WebGL.
 *
 * `fighting-check.ts` проверяет таблицу приёмов, `smoke-check.ts` — что демо не
 * падает. Ни одна из этих проверок не заметила бы главный баг вкладки: бот
 * держал дистанцию 2.2 м, а самый длинный удар доставал на 1.83 — фрейм-дата
 * была корректной, исключений не было, и при этом за 90 секунд боя не
 * происходило ровно ничего. Ловится это только прогоном матча с подсчётом
 * попаданий.
 *
 * Запуск: `npx tsx scripts/fighting-sim-check.ts`
 */
import * as THREE from 'three';
import type { DemoContext } from '../src/core/Demo';
import { FightingDemo } from '../src/demos/FightingDemo';
import { MOVES, reach } from '../src/game/fightingMoves';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

const TICKS = 5400;          // 90 секунд боя
const noop = (): void => {};
let tick = 0;
let keyHandler: ((code: string) => void) | null = null;
let status = '';

/**
 * «Игрок»: подходит, бьёт по кругу всеми приёмами, иногда уклоняется.
 * Не мастер, но и не мешок — примерно так играет человек в первый раз.
 */
const ctx = {
  renderer: null,
  tier: 'high',
  addTrauma: noop,
  setStatus: (s: string) => { status = s; },
  rebuildPostFx: noop,
  audio: new Proxy({}, { get: () => noop }),
  input: {
    isDown: (code: string) => code === 'KeyD' && (tick % 240) < 60,
    moveVector: (out = new THREE.Vector2()) => out.set(0, 0),
    onKey: (down: (code: string) => void) => { keyHandler = down; return noop; },
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

console.log('Досягаемость приёмов (метры от центра бойца):');
for (const m of Object.values(MOVES)) {
  console.log(`  ${m.id.padEnd(9)} ${reach(m).toFixed(2)}`);
}
const longest = Math.max(...Object.values(MOVES).map((m) => reach(m)));

const demo = new FightingDemo();
await demo.init(ctx);
demo.enter();

const KEYS = ['KeyJ', 'KeyK', 'KeyL', 'KeyI', 'KeyU', 'KeyO'];
let hits = 0;
let ragdollTicks = 0;
let knockdowns = 0;
let minHeadY = 99;
let maxTiltDeg = 0;
let maxGapWhileAttacking = 0;
let maxJumpY = 0;
let crossUps = 0;
let airAttacks = 0;
let getupFrames = 0;
let sideOrder = 0;
/** Высота головы в первом и последнем кадре подъёма — по ней видно, встаёт ли боец. */
let getupStartHead = 0;
let getupEndHead = 0;
let prevHp: [number, number] = [1, 1];
let prevKd: [number, number] = [0, 0];

const state = demo as unknown as {
  player: Record<string, any>;
  bot: Record<string, any>;
  world: { bodies: { len(): number } };
};
const bodiesAtStart = state.world.bodies.len();
const head = new THREE.Vector3();
const up = new THREE.Vector3();
const chestQuat = new THREE.Quaternion();

for (tick = 0; tick < TICKS; tick++) {
  if (tick % 17 === 0) keyHandler?.(KEYS[(tick / 17) % KEYS.length | 0]);
  if (tick % 400 === 200) keyHandler?.('KeyZ');
  // Прыгаем регулярно, и часть прыжков — с зажатым «вперёд»: без движения
  // в прыжке кросс-ап не проверяется вообще.
  if (tick % 60 === 10 || tick % 240 === 30) keyHandler?.('Space');
  demo.fixedUpdate(1 / 60);
  demo.update(1 / 60, 0);

  const p = state.player;
  const b = state.bot;
  if (p.hp < prevHp[0] || b.hp < prevHp[1]) hits++;
  prevHp = [p.hp, b.hp];
  knockdowns += Math.max(0, p.knockdowns - prevKd[0]) + Math.max(0, b.knockdowns - prevKd[1]);
  prevKd = [p.knockdowns, b.knockdowns];

  if (b.state === 'active' && !b.move?.air) {
    maxGapWhileAttacking = Math.max(maxGapWhileAttacking, Math.abs(p.x - b.x));
  }

  // Воздух: высота прыжка, удары с воздуха, смена сторон над соперником.
  maxJumpY = Math.max(maxJumpY, p.y, b.y);
  if (p.state === 'active' && p.move?.air) airAttacks++;
  for (const f of [p, b]) {
    if (f.state !== 'getup') continue;
    getupFrames++;
    f.rig.root.updateWorldMatrix(true, true);
    f.rig.head.getWorldPosition(head);
    // Первый кадр подъёма боец обязан быть внизу, последний — уже в стойке.
    if (f.stateFrame > 36) getupStartHead = head.y;
    if (f.stateFrame <= 1) getupEndHead = head.y;
  }
  const order = Math.sign(p.x - b.x);
  if (order !== 0 && sideOrder !== 0 && order !== sideOrder && (p.y > 0.5 || b.y > 0.5)) crossUps++;
  if (order !== 0) sideOrder = order;

  for (const f of [p, b]) {
    if (!f.ragdoll) continue;
    ragdollTicks++;
    f.rig.root.updateWorldMatrix(true, true);
    f.rig.head.getWorldPosition(head);
    minHeadY = Math.min(minHeadY, head.y);
    // Наклон корпуса к вертикали: «упал» — это про поворот, а не про то,
    // что голова оказалась строго ниже таза (на спине они на одной высоте).
    f.rig.chest.getWorldQuaternion(chestQuat);
    up.set(0, 1, 0).applyQuaternion(chestQuat);
    maxTiltDeg = Math.max(maxTiltDeg, THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.y, -1, 1))));
  }
}

console.log('\nМатч 90 секунд:');
console.log(`  попаданий: ${hits} · нокдаунов: ${knockdowns} · тиков в рэгдолле: ${ragdollTicks}`);
console.log(`  прыжки: высота ${maxJumpY.toFixed(2)} м · ударов с воздуха ${airAttacks}`
  + ` · перепрыгиваний ${crossUps} · кадров подъёма ${getupFrames}`);
console.log(`  ${status.replace(/<[^>]+>/g, '').replace(/<br>/g, ' ')}`);

console.log('\nПроверки:');
// Главная: бой вообще идёт. 90 секунд — это минимум 40 разменов даже у новичка.
check('бой идёт: больше 40 попаданий за 90 секунд', hits > 40, `= ${hits}`);
// Бот не должен бить с дистанции, с которой физически не достаёт.
check('бот не машет из-за пределов досягаемости',
  maxGapWhileAttacking <= longest + 0.35, `= ${maxGapWhileAttacking.toFixed(2)} при досягаемости ${longest.toFixed(2)}`);
check('за матч случился хотя бы один нокдаун', knockdowns >= 1, `= ${knockdowns}`);
check('рэгдолл действительно падает (голова ниже 0.6 м)', minHeadY < 0.6, `= ${minHeadY.toFixed(2)}`);
check('в рэгдолле корпус заваливается больше чем на 45°', maxTiltDeg > 45,
  `= ${maxTiltDeg.toFixed(0)}°`);
// ───────────────────────────────────────────────────────────── воздух
check('прыжок поднимает бойца выше 1.6 м', maxJumpY > 1.6, `= ${maxJumpY.toFixed(2)}`);
check('удары с воздуха проходят', airAttacks > 0, `= ${airAttacks}`);
// Кросс-ап — главный смысл прыжка: соперника можно перескочить.
check('через соперника можно перепрыгнуть', crossUps > 0, `= ${crossUps}`);
// Подъём с настила должен занимать кадры, а не один тик.
check('после рэгдолла есть фаза подъёма', getupFrames > 30, `= ${getupFrames}`);
check('подъём начинается с настила (голова ниже 1.1 м)', getupStartHead > 0 && getupStartHead < 1.1,
  `= ${getupStartHead.toFixed(2)}`);
check('подъём заканчивается в стойке (голова выше 1.5 м)', getupEndHead > 1.5,
  `= ${getupEndHead.toFixed(2)}`);

check('оба бойца остались в ринге', Math.abs(state.player.x) < 4.3 && Math.abs(state.bot.x) < 4.3,
  `= ${state.player.x.toFixed(2)} / ${state.bot.x.toFixed(2)}`);

// Утечки: тела рэгдоллов и вылетевшие капы обязаны убираться. Считать надо
// после того, как последний упавший встал, — иначе восемь костей активного
// рэгдолла читаются как утечка.
for (let i = 0; i < 900 && (state.player.ragdoll || state.bot.ragdoll); i++) {
  demo.fixedUpdate(1 / 60);
  demo.update(1 / 60, 0);
}
const bodiesNow = state.world.bodies.len();
// Допуск — вылетевшие капы: их держат на настиле не больше трёх.
check('физические тела не копятся', bodiesNow <= bodiesAtStart + 3,
  `было ${bodiesAtStart}, стало ${bodiesNow}`);

let bad: string | null = null;
demo.scene.traverse((o) => {
  const v = o.position;
  if (!bad && !Number.isFinite(v.x + v.y + v.z)) bad = o.name || o.type;
});
check('нет NaN в трансформах', bad === null, bad ?? '');

demo.exit();
demo.dispose();
check('dispose не падает', true);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
