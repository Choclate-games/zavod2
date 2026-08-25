/**
 * Головная проверка RTS: флоу-филд, строй, таблица урона — без рендерера.
 *
 * knowledge/threejs/rts_selection_and_command.md §4-6.
 * Запуск: `npx tsx scripts/rts-check.ts`
 */
import { FlowField, assignSlots, damageMultiplier, formationSlots, type Vec2 } from '../src/game/flowField';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

// ─────────────────────────────────────────────────────────── флоу-филд
const COLS = 40;
const field = new FlowField(COLS, COLS, 2, -40, -40);

// Стена поперёк карты с одним проходом: классический тест обхода.
for (let cz = 0; cz < COLS - 6; cz++) field.setBlocked(20, cz, true);

const targetX = 24;
const targetZ = 24;
console.log('Флоу-филд: 40×40 клеток, стена с проходом сверху');
check('поле строится', field.build(targetX, targetZ));

const startX = -30;
const startZ = 24;
check('старт достижим (путь в обход стены найден)', field.reachable(startX, startZ));

// Проходим по полю от старта: должны дойти до цели, не застряв.
let x = startX;
let z = startZ;
const step: Vec2 = { x: 0, z: 0 };
let steps = 0;
let stuck = false;
while (Math.hypot(x - targetX, z - targetZ) > 2 && steps < 4000) {
  field.sample(x, z, step);
  if (step.x === 0 && step.z === 0) { stuck = true; break; }
  x += step.x * 0.4;
  z += step.z * 0.4;
  steps++;
}
console.log(`  путь пройден за ${steps} шагов, финиш (${x.toFixed(1)}, ${z.toFixed(1)})`);
check('юнит дошёл до цели по полю', !stuck && steps < 4000, stuck ? 'застрял' : `шагов ${steps}`);
check('путь не проходит сквозь стену', steps > 60,
  `= ${steps} (прямой путь был бы короче)`);

// Цель внутри препятствия должна съезжать на ближайшую свободную клетку.
check('цель в стене не ломает приказ', field.build(0, 0) === true);

// Полностью замурованная область недостижима, но и не роняет расчёт.
const sealed = new FlowField(10, 10, 1, 0, 0);
for (let i = 0; i < 10; i++) { sealed.setBlocked(i, 5, true); }
sealed.build(5.5, 8.5);
check('за стеной без прохода клетки помечены недостижимыми', !sealed.reachable(5.5, 2.5));

// ──────────────────────────────────────────────────────────────── строй
const slots = formationSlots({ x: 10, z: 0 }, { x: 1, z: 0 }, 9, 2);
check('слотов ровно по числу юнитов', slots.length === 9);

const uniq = new Set(slots.map((s) => `${s.x.toFixed(3)}|${s.z.toFixed(3)}`));
check('слоты не совпадают', uniq.size === 9, `уникальных: ${uniq.size}`);

const spread = Math.max(...slots.map((s) => Math.hypot(s.x - 10, s.z))) ;
check('строй компактен', spread < 4, `= ${spread.toFixed(2)}`);

// Назначение по близости: юниты не должны перекрещиваться.
const units: Vec2[] = [{ x: 0, z: -3 }, { x: 0, z: 0 }, { x: 0, z: 3 }];
const targets: Vec2[] = [{ x: 10, z: -3 }, { x: 10, z: 0 }, { x: 10, z: 3 }];
const assignment = assignSlots(units, targets);
check('каждый юнит получил слот', assignment.every((a) => a >= 0), `= ${assignment}`);
check('слоты не дублируются', new Set(assignment).size === assignment.length);
check('назначение по близости не перекрещивается',
  assignment[0] === 0 && assignment[1] === 1 && assignment[2] === 2, `= ${assignment}`);

// Юнитов больше, чем слотов — не должно падать.
const overflow = assignSlots([{ x: 0, z: 0 }, { x: 1, z: 0 }], [{ x: 5, z: 0 }]);
check('нехватка слотов не роняет назначение', overflow.filter((a) => a >= 0).length === 1,
  `= ${overflow}`);

// ─────────────────────────────────────────────────────── таблица урона
check('бронетехника бьёт пехоту сильнее', damageMultiplier('armored', 'infantry') === 1.5);
check('пехота плохо бьёт броню', damageMultiplier('infantry', 'armored') === 0.5);
check('авиация бьёт броню сильнее', damageMultiplier('air', 'armored') === 1.5);
check('броня плохо достаёт авиацию', damageMultiplier('armored', 'air') === 0.5);
check('свой против своего — нейтрально',
  (['infantry', 'armored', 'air'] as const).every((c) => damageMultiplier(c, c) === 1.0));

// Камень-ножницы-бумага: у каждого класса есть и жертва, и хищник.
for (const cls of ['infantry', 'armored', 'air'] as const) {
  const others = (['infantry', 'armored', 'air'] as const).filter((c) => c !== cls);
  check(`${cls}: есть кого бить и кого бояться`,
    others.some((o) => damageMultiplier(cls, o) > 1) && others.some((o) => damageMultiplier(o, cls) > 1));
}

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
