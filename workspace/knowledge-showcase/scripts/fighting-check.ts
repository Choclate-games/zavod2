/**
 * Головная проверка фрейм-даты — без рендерера и без браузера.
 *
 * CRITICAL_RULES §66: боевая механика проверяется головно раньше, чем глазами.
 * Запуск: `npx tsx scripts/fighting-check.ts`
 */
import {
  MOVES, canCancel, comboScaling, frameAdvantageOnBlock, frameAdvantageOnHit,
  punisherFor, reach, resolveCancel, resolveInput, staminaScale, whiffsAgainst,
  type Limb, type MoveId, type Stance, type Strength,
} from '../src/game/fightingMoves';

let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

const ALL = Object.values(MOVES);
/** Самый быстрый приём в наборе: им меряется, что наказуемо, а что нет. */
const FASTEST = ALL.reduce((a, b) => (b.startup < a.startup ? b : a));

console.log('Фрейм-дата:');
for (const move of ALL) {
  const onBlock = frameAdvantageOnBlock(move);
  const onHit = frameAdvantageOnHit(move);
  console.log(
    `  ${move.id.padEnd(9)} ${move.hand.padEnd(4)} ${move.target.padEnd(4)}`
    + ` ${move.startup}/${move.active}/${move.recovery}`
    + `  урон ${String(move.damage).padStart(3)}`
    + `  блок ${onBlock > 0 ? '+' : ''}${onBlock}`
    + `  хит ${onHit > 0 ? '+' : ''}${onHit}`,
  );
}

console.log('\nПроверки:');

// Читаемость: стартап быстрее 3 кадров нечитаем, медленнее 20 — не попадает.
for (const m of ALL) {
  check(`${m.id}: стартап в диапазоне 3..20`, m.startup >= 3 && m.startup <= 20, `= ${m.startup}`);
}

// Ни один приём не должен быть плюсовым на блоке настолько, чтобы зациклиться.
for (const m of ALL) {
  const adv = frameAdvantageOnBlock(m);
  check(`${m.id}: преимущество на блоке < +${FASTEST.startup}`, adv < FASTEST.startup, `= ${adv}`);
}

// Тяжёлый приём обязан быть наказуем — иначе им можно давить бесконечно.
check('overhand наказуем на блоке', frameAdvantageOnBlock(MOVES.overhand) <= -8,
  `= ${frameAdvantageOnBlock(MOVES.overhand)}`);
check('на overhand есть чем наказать', punisherFor(MOVES.overhand) !== null);

// Затухание комбо: 10 попаданий подряд не должны убивать с полного здоровья.
let hp = 1000;
for (let i = 0; i < 10; i++) hp -= MOVES.hook.damage * comboScaling(i);
check('10 хуков в комбо не убивают с 1000 HP', hp > 0, `осталось ${hp.toFixed(0)}`);
check('затухание не опускается ниже 25%', comboScaling(50) === 0.25);

// Урон за одно попадание не превышает 15% здоровья.
for (const m of ALL) {
  check(`${m.id}: урон <= 15% полосы`, m.damage <= 150, `= ${m.damage}`);
}

// Hit-stop есть у каждого приёма: без него удар не имеет веса.
for (const m of ALL) {
  check(`${m.id}: hit-stop >= 4 кадров`, m.hitstop >= 4, `= ${m.hitstop}`);
}

// Подбрасывает только апперкот.
const launchers = ALL.filter((m) => m.launch > 0).map((m) => m.id);
check('подбрасывает ровно один приём', launchers.length === 1, `= [${launchers.join(', ')}]`);

// ─────────────────────────────────────────────────────────── связки
// Отмены не должны замыкаться в кольцо: иначе одна связка длится вечно.
for (const m of ALL) {
  for (const into of m.cancelInto) {
    check(`${m.id} → ${into}: отмена ведёт в существующий приём`, into in MOVES);
    check(`${m.id} → ${into}: отмена не в себя`, into !== m.id);
  }
}
const cycle = (start: MoveId, seen: Set<MoveId>): boolean => {
  if (seen.has(start)) return true;
  seen.add(start);
  return MOVES[start].cancelInto.some((n) => cycle(n, new Set(seen)));
};
check('в цепочках отмен нет цикла', !ALL.some((m) => cycle(m.id, new Set())));
check('джеб отменяется в хук', canCancel(MOVES.jab, 'hook'));
check('оверхенд ни во что не отменяется', MOVES.overhand.cancelInto.length === 0);

// Связка jab → hook → overhand должна успевать: отмена съедает recovery,
// значит второй приём стартует внутри hitstun первого.
let stun = MOVES.jab.hitstun - MOVES.jab.active;
check('jab → hook попадает в hitstun', stun >= MOVES.hook.startup, `окно ${stun}, нужно ${MOVES.hook.startup}`);
stun = MOVES.hook.hitstun - MOVES.hook.active;
check('hook → overhand попадает в hitstun', stun >= MOVES.overhand.startup,
  `окно ${stun}, нужно ${MOVES.overhand.startup}`);

// ─────────────────────────────────────────────────── зоны и защита
check('есть приём по корпусу', ALL.some((m) => m.target === 'body'));
check('присед пропускает удар в голову', whiffsAgainst(MOVES.jab, 'crouch'));
check('присед не спасает от корпуса', !whiffsAgainst(MOVES.body, 'crouch'));
check('уклон уводит голову', whiffsAgainst(MOVES.overhand, 'slip'));

// ─────────────────────────────────────────────── воздух: прыжок и анти-эйр
// Прыжок обязан быть решением, а не бесплатным проходом. Значит: обычные
// приёмы летящего не берут, анти-эйр берёт, а низкий приём под ним проходит.
check('есть приёмы, выполняемые в прыжке', ALL.some((m) => m.air));
check('есть низкий приём, сбивающий с ног',
  ALL.some((m) => m.height === 'low' && m.knocksDown));
check('обычный удар не достаёт летящего', whiffsAgainst(MOVES.jab, 'air'));
check('апперкот — анти-эйр', !whiffsAgainst(MOVES.uppercut, 'air'));
check('подсечка не достаёт летящего', whiffsAgainst(MOVES.sweep, 'air'));
check('подсечка не уходит под приседом', !whiffsAgainst(MOVES.sweep, 'crouch'));
check('удар в прыжке достаёт и сидящего', !whiffsAgainst(MOVES.airKick, 'crouch'));
for (const m of ALL.filter((m) => m.air)) {
  // Приём в воздухе должен успеть отработать до приземления (~48 кадров).
  const total = m.startup + m.active + m.recovery;
  check(`${m.id}: укладывается в полёт (< 48 кадров)`, total < 48, `= ${total}`);
  check(`${m.id}: активная фаза длинная (>= 5 кадров)`, m.active >= 5, `= ${m.active}`);
  check(`${m.id}: не разгоняется шагом с земли`, m.advance === 0);
}
// Сбивающих с ног приёмов должно быть немного, иначе бой — сплошные падения.
const knockers = ALL.filter((m) => m.knocksDown).map((m) => m.id);
check('сбивают с ног 1–3 приёма', knockers.length >= 1 && knockers.length <= 3,
  `= [${knockers.join(', ')}]`);

// ─────────────────────────────────────────────────────── выносливость
check('полная выносливость не штрафует', staminaScale(100, 100) === 1);
check('пустая выносливость режет не больше 45%', staminaScale(0, 100) >= 0.55);
for (const m of ALL) {
  check(`${m.id}: цена в выносливости 1..20`, m.stamina >= 1 && m.stamina <= 20, `= ${m.stamina}`);
}
// Гард ломается, но не мгновенно: блок серии из трёх тяжёлых съедает бак.
const guardBurn = MOVES.overhand.guardDamage * 3;
check('три оверхенда в блок ломают гард (100 ед.)', guardBurn >= 60 && guardBurn <= 100, `= ${guardBurn}`);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
