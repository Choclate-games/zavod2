/**
 * Головная проверка ближнего боя и рэгдолла — без рендерера и без браузера.
 *
 * CRITICAL_RULES §66. Здесь ловятся ровно те баги, которых не видно глазом:
 * связка, которая не собирается из-за окна отмены на кадр позже, парирование,
 * которое нельзя успеть, и рэгдолл, разрывающий суставы от импульса.
 *
 * Rapier работает в Node без изменений (`-compat` несёт WASM в JS), поэтому
 * физика трупа проверяется по-настоящему, а не «на модели».
 *
 * Запуск: `npx tsx scripts/melee-check.ts`
 */
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {
  COMBO, COMBO_LINGER, ENEMY_SWING, INPUT_BUFFER, MeleeFighter, PARRY, RIPOSTE,
  inSwingArc, parryResult, staggerFrames, staggerScaling,
} from '../src/game/meleeCombat';
import { Ragdoll } from '../src/world/ragdoll';

let failed = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

/** Прогнать бойца N кадров, нажимая удар на кадрах из `presses`. */
function simulate(presses: readonly number[], frames: number): Array<{ frame: number; id: string }> {
  const f = new MeleeFighter(200);
  const log: Array<{ frame: number; id: string }> = [];
  const set = new Set(presses);
  for (let i = 0; i < frames; i++) {
    if (set.has(i)) f.requestAttack(i);
    if (f.tick(i)) log.push({ frame: i, id: f.swing!.id });
  }
  return log;
}

console.log('Фрейм-дата связки:');
for (const s of COMBO) {
  console.log(
    `  ${s.id.padEnd(8)} ${s.startup}/${s.active}/${s.recovery}`
    + `  урон ${String(s.damage).padStart(3)}`
    + `  отмена с ${s.cancelFrom === Infinity ? '—' : s.cancelFrom}`
    + `  hit-stop ${s.hitstop}`,
  );
}
console.log(`  ${ENEMY_SWING.id.padEnd(8)} ${ENEMY_SWING.startup}/${ENEMY_SWING.active}/${ENEMY_SWING.recovery}  (замах врага)`);

console.log('\nЧитаемость приёмов:');
for (const s of [...COMBO, RIPOSTE]) {
  check(`${s.id}: стартап 3..20 кадров`, s.startup >= 3 && s.startup <= 20, `= ${s.startup}`);
  check(`${s.id}: есть активные кадры`, s.active >= 3, `= ${s.active}`);
  check(`${s.id}: hit-stop >= 4 кадров`, s.hitstop >= 4, `= ${s.hitstop}`);
}
// Замах врага обязан быть длиннее окна идеального парирования с запасом на
// реакцию человека (~180 мс = 11 кадров), иначе парирование — лотерея.
check('замах врага парируем: startup >= 22 кадра',
  ENEMY_SWING.startup >= 22, `= ${ENEMY_SWING.startup}`);

console.log('\nСвязка:');
// Жмём кнопку часто: связка обязана пройти все три удара по порядку.
const spam = simulate([0, 12, 20, 30, 40, 50, 60, 70, 80, 86, 92], 240);
const firstThree = spam.slice(0, 3).map((e) => e.id);
check('три нажатия дают три РАЗНЫХ удара по порядку',
  firstThree.join(',') === COMBO.map((s) => s.id).join(','), `= [${firstThree.join(', ')}]`);

// Отмена восстановления реально экономит кадры: связка быстрее, чем три
// отдельных приёма подряд. Если окна отмены не работают, разницы не будет.
const chained = spam[2].frame - spam[0].frame;
const sequential = (COMBO[0].startup + COMBO[0].active + COMBO[0].recovery)
  + (COMBO[1].startup + COMBO[1].active + COMBO[1].recovery);
check('отмена восстановления ускоряет связку', chained < sequential,
  `связка ${chained} кадров против ${sequential} без отмены`);

// Четвёртое нажатие после финишного удара начинает связку заново.
const fourth = spam[3];
check('после финишера связка начинается сначала',
  fourth !== undefined && fourth.id === COMBO[0].id, `= ${fourth?.id}`);

// Пауза дольше COMBO_LINGER сбрасывает связку.
const paused = simulate([0, 0 + 200], 400);
check('пауза дольше памяти связки сбрасывает её на первый удар',
  paused.length === 2 && paused[1].id === COMBO[0].id, `= ${paused[1]?.id}`);

// Буфер ввода: нажатие ДО открытия окна отмены не теряется.
const early = new MeleeFighter(200);
early.requestAttack(0);
early.tick(0);                                   // пошёл первый удар
const cancelOpensAt = COMBO[0].startup + COMBO[0].active + COMBO[0].cancelFrom;
let secondStarted = -1;
for (let i = 1; i < 120; i++) {
  // Жмём за 3 кадра до открытия окна — внутри буфера INPUT_BUFFER.
  if (i === cancelOpensAt - 3) early.requestAttack(i);
  if (early.tick(i) && secondStarted < 0) secondStarted = i;
}
check(`нажатие за 3 кадра до окна отмены засчитывается (буфер ${INPUT_BUFFER})`,
  secondStarted > 0 && secondStarted <= cancelOpensAt + 1,
  `начался на кадре ${secondStarted}, окно открылось на ${cancelOpensAt}`);

// Нажатие сильно раньше буфера — теряется (иначе можно «зажать» связку).
const tooEarly = new MeleeFighter(200);
tooEarly.requestAttack(0);
tooEarly.tick(0);
tooEarly.requestAttack(1);
let started = 0;
for (let i = 1; i < 60; i++) if (tooEarly.tick(i)) started++;
check('нажатие вне буфера не запускает второй удар', started === 0, `запусков: ${started}`);

console.log('\nПарирование:');
check('кадр 0 — идеальное', parryResult(0) === 'perfect');
check(`кадр ${PARRY.perfect - 1} — ещё идеальное`, parryResult(PARRY.perfect - 1) === 'perfect');
check(`кадр ${PARRY.perfect} — уже блок`, parryResult(PARRY.perfect) === 'block');
check(`кадр ${PARRY.block} — стойка не спасает`, parryResult(PARRY.block) === 'none');
check('у стойки есть уязвимый хвост', PARRY.total > PARRY.block);
// Парирование недоступно во время приёма — иначе оно отменяет любой промах.
const busy = new MeleeFighter(200);
busy.requestAttack(0);
busy.tick(0);
check('парировать во время приёма нельзя', busy.requestParry() === false);
// Риспост открывается и закрывается.
const riposter = new MeleeFighter(200);
riposter.grantRiposte(30);
riposter.requestAttack(1);
riposter.tick(1);
check('после идеального парирования идёт риспост', riposter.swing?.id === RIPOSTE.id,
  `= ${riposter.swing?.id}`);

console.log('\nУрон и стан:');
check('затухание урона по стану не ниже 35%', staggerScaling(99) === 0.35);
check('первый удар без затухания', staggerScaling(0) === 1);
// Связка из трёх ударов не должна убивать врага волны 1 (110 HP) мгновенно…
let hp = 110;
COMBO.forEach((s, i) => { hp -= s.damage * staggerScaling(i); });
check('полная связка не убивает врага волны 1 с запасом', hp > -20 && hp < 40,
  `осталось ${hp.toFixed(0)} HP`);
// …но стан от удара обязан быть короче, чем восстановление атакующего плюс
// стартап следующего: иначе враг «встаёт» ровно под удар и это бесконечный лок.
for (const s of COMBO) {
  const st = staggerFrames(s.damage);
  check(`${s.id}: стан ${st} кадров короче полного цикла приёма`,
    st < s.startup + s.active + s.recovery, `= ${st}`);
}

console.log('\nСектор поражения:');
const swing = COMBO[0];
check('цель прямо перед бойцом — попадание', inSwingArc(0, 1.5, 0, swing, 0.42));
check('цель за спиной — промах', inSwingArc(0, -1.5, 0, swing, 0.42) === false);
check('цель дальше досягаемости — промах', inSwingArc(0, 9, 0, swing, 0.42) === false);
// Ровно по краю арки — попадание; чуть за краем — нет.
const edge = swing.arc - 0.02;
check('цель у края арки — попадание',
  inSwingArc(Math.sin(edge) * 1.5, Math.cos(edge) * 1.5, 0, swing, 0.42));
const past = swing.arc + 0.08;
check('цель за краем арки — промах',
  inSwingArc(Math.sin(past) * 1.5, Math.cos(past) * 1.5, 0, swing, 0.42) === false);
// Поворот бойца поворачивает сектор — иначе арка «прибита» к осям мира.
check('сектор поворачивается вместе с бойцом',
  inSwingArc(1.5, 0, Math.PI / 2, swing, 0.42));

console.log('\nРэгдолл на Rapier:');
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -19.6, z: 0 });
world.timestep = 1 / 60;
const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(
  RAPIER.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0)
    .setFriction(0.9).setCollisionGroups((0x0001 << 16) | 0x0008),
  ground,
);

// Импульс намеренно чудовищный: клампа не будет — суставы разорвёт.
const doll = new Ragdoll(world, {
  position: new THREE.Vector3(0, 0, 0),
  facing: 0.7,
  suit: 0xff0000,
  skin: 0xffcc99,
  impulse: new THREE.Vector3(400, 0, 260),
  impulseBone: 'head',
});

let settledAt = -1;
for (let i = 0; i < 900; i++) {
  world.step();
  if (settledAt < 0 && doll.settled) settledAt = i;
}
doll.sync();
console.log(`  (остаточная скорость после 15 c: ${doll.maxSpeed().toFixed(4)} м/с)`);

let bad: string | null = null;
let maxSpan = 0;
const pelvis = doll.pelvisPosition();
doll.group.traverse((o) => {
  const p = o.position;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    bad = `${o.name || o.type} → (${p.x}, ${p.y}, ${p.z})`;
  }
  if (o !== doll.group) maxSpan = Math.max(maxSpan, p.distanceTo(pelvis));
});
check('в трансформах рэгдолла нет NaN', bad === null, bad ?? '');
check('рэгдолл не провалился сквозь пол', pelvis.y > -0.4, `таз на y = ${pelvis.y.toFixed(2)}`);
check('суставы не разорвало: тела в пределах 1.3 м от таза', maxSpan < 1.3,
  `максимум ${maxSpan.toFixed(2)} м`);
check('рэгдолл засыпает за 15 секунд', settledAt >= 0 && settledAt < 900,
  settledAt < 0 ? 'не уснул' : `на кадре ${settledAt}`);
console.log(`  (уснул на кадре ${settledAt}, ${(settledAt / 60).toFixed(1)} c; разлёт ${maxSpan.toFixed(2)} м)`);

// Освобождение: WASM-память не собирается сборщиком мусора JS.
doll.dispose();
check('dispose не падает и снимает тела', world.bodies.len() === 1,
  `тел в мире: ${world.bodies.len()}`);
world.free();

console.log(`\nПамять связки: ${COMBO_LINGER} кадров, буфер ввода: ${INPUT_BUFFER} кадров.`);
console.log(failed === 0 ? 'Все проверки пройдены.' : `Провалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
