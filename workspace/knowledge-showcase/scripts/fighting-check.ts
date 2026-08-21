/**
 * Головная проверка фрейм-даты — без рендерера и без браузера.
 *
 * CRITICAL_RULES §66: боевая механика проверяется головно раньше, чем глазами.
 * Запуск: `npx tsx scripts/fighting-check.ts`
 */
import {
  MOVES, comboScaling, frameAdvantageOnBlock, frameAdvantageOnHit, punisherFor,
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

console.log('Фрейм-дата:');
for (const move of Object.values(MOVES)) {
  const onBlock = frameAdvantageOnBlock(move);
  const onHit = frameAdvantageOnHit(move);
  console.log(
    `  ${move.id.padEnd(9)} ${move.startup}/${move.active}/${move.recovery}`
    + `  урон ${String(move.damage).padStart(3)}`
    + `  блок ${onBlock > 0 ? '+' : ''}${onBlock}`
    + `  хит ${onHit > 0 ? '+' : ''}${onHit}`,
  );
}

console.log('\nПроверки:');

// Читаемость: стартап быстрее 3 кадров нечитаем, медленнее 20 — не попадает.
for (const m of Object.values(MOVES)) {
  check(`${m.id}: стартап в диапазоне 3..20`, m.startup >= 3 && m.startup <= 20, `= ${m.startup}`);
}

// Ни один приём не должен быть плюсовым на блоке настолько, чтобы зациклиться.
for (const m of Object.values(MOVES)) {
  const adv = frameAdvantageOnBlock(m);
  check(`${m.id}: преимущество на блоке < +${MOVES.light.startup}`, adv < MOVES.light.startup, `= ${adv}`);
}

// Тяжёлый приём обязан быть наказуем — иначе им можно давить бесконечно.
check('heavy наказуем на блоке', frameAdvantageOnBlock(MOVES.heavy) <= -8,
  `= ${frameAdvantageOnBlock(MOVES.heavy)}`);
check('на heavy есть чем наказать', punisherFor(MOVES.heavy) !== null);

// Затухание комбо: 10 попаданий подряд не должны убивать с полного здоровья.
let hp = 1000;
for (let i = 0; i < 10; i++) hp -= MOVES.medium.damage * comboScaling(i);
check('10 средних в комбо не убивают с 1000 HP', hp > 0, `осталось ${hp.toFixed(0)}`);
check('затухание не опускается ниже 25%', comboScaling(50) === 0.25);

// Урон за одно попадание не превышает 15% здоровья.
for (const m of Object.values(MOVES)) {
  check(`${m.id}: урон <= 15% полосы`, m.damage <= 150, `= ${m.damage}`);
}

// Hit-stop есть у каждого приёма: без него удар не имеет веса.
for (const m of Object.values(MOVES)) {
  check(`${m.id}: hit-stop >= 4 кадров`, m.hitstop >= 4, `= ${m.hitstop}`);
}

// Подбрасывает только апперкот.
const launchers = Object.values(MOVES).filter((m) => m.launch > 0).map((m) => m.id);
check('подбрасывает ровно один приём', launchers.length === 1, `= [${launchers.join(', ')}]`);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
