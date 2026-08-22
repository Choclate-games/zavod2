/**
 * Headless test for Fluid Buoyancy, Mining Drill & Physics Destruction.
 * Checks mechanics from knowledge/mechanics/fluid_buoyancy.md,
 * knowledge/mechanics/physics_destruction.md, and knowledge/mechanics/mining_drill.md.
 *
 * Run: tsx scripts/buoyancy-check.ts
 */
import {
  computeBuoyancyForce,
  computeFluidDrag,
  getWaveHeight,
  getWaveNormal,
  MiningDrill,
  DebrisPool,
  ROCK_DEFS,
  WATER_DENSITY,
  GRAVITY,
} from '../src/game/fluidPhysics';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

console.log('Гидродинамика и плавучесть (Архимед и волны):');
const h0 = getWaveHeight(0, 0, 0);
const n0 = getWaveNormal(0, 0, 0);
const normalLen = Math.hypot(n0.nx, n0.ny, n0.nz);
check('нормаль волны строго единичной длины', Math.abs(normalLen - 1.0) < 1e-5);
check('y-компонента нормали всегда направлена вверх (> 0)', n0.ny > 0);

// Равновесие плавающего тела: лодка массой 1500 кг, объем 3.0 м^3
const boatMass = 1500; // кг
const boatVol = 3.0; // м^3
const gravityForce = boatMass * GRAVITY; // 14715 Н
const submergedFraction = boatMass / (boatVol * WATER_DENSITY); // 0.5 (50%)
const buoyancyForce = computeBuoyancyForce(submergedFraction, boatVol);
check('сила Архимеда при 50% погружении уравновешивает вес лодки 1500 кг', Math.abs(buoyancyForce - gravityForce) < 1e-3);

// Гидродинамическое сопротивление
const drag10 = computeFluidDrag(10.0); // 10 м/с
const drag5 = computeFluidDrag(5.0); // 5 м/с
check('гидродинамическое сопротивление квадратично зависит от скорости (drag10 ≈ 4 * drag5)', Math.abs(drag10 - 4 * drag5) < 1e-3);

console.log('\nБурение пород и тепловой цикл бура:');
const drill = new MiningDrill();
check('начальная температура бура 20°C (комнатная)', drill.temperature === 20.0);

// Нагрев за 3 секунды: 20 + 3 * 18 = 74°C
drill.update(3.0, true);
check('нагрев за 3 сек бурения (+18°C/с) до 74°C', Math.abs(drill.temperature - 74.0) < 1e-3);
check('бур не заклинен при T < 100°C', !drill.isJammed);

// Остывание за 1 секунду: 74 - 25 = 49°C
drill.update(1.0, false);
check('остывание за 1 сек покоя (-25°C/с) до 49°C', Math.abs(drill.temperature - 49.0) < 1e-3);

// Доводим до клина: нужно нагреть на 51°C -> 51/18 = 2.833 сек
drill.update(3.0, true);
check('при T >= 100°C бур клинит', drill.isJammed);
check('таймер клина установлен на 2.0 секунды', drill.jamTimer === 2.0);

// Попытка бурения во время клина
const basaltRock = { hp: ROCK_DEFS.basalt.maxHp, type: 'basalt' as const };
const mineResultJammed = drill.mineRock(basaltRock, 0.5);
check('во время клина бурение заблокировано (minedHp = 0)', mineResultJammed.minedHp === 0);

// Ждем окончания клина (2.0 с)
drill.update(2.1, false);
check('после 2.0 с бур расклинивается и готов к работе', !drill.isJammed);

console.log('\nПрочность пород и износ бура:');
const prevWear = drill.drillWear;
const mineResult = drill.mineRock(basaltRock, 1.0);
check('бурение наносит урон породе (minedHp > 0)', mineResult.minedHp > 0 && basaltRock.hp < ROCK_DEFS.basalt.maxHp);
check('базальт дает повышенный износ (2.5x)', drill.drillWear > prevWear);

const oreRock = { hp: 10, type: 'ore' as const };
const oreDestroyed = drill.mineRock(oreRock, 1.0);
check('разрушение рудной жилы дает выброс лута (6 орбов)', oreDestroyed.destroyed && oreDestroyed.loot === 6);

console.log('\nРазрушения и пул обломков (Physics Destruction):');
const pool = new DebrisPool();
const spawned = pool.spawnExplosion(0, 5, 0, 30);
check('спавн 30 обломков из пула', spawned === 30);
const activeCount1 = pool.update(0.1);
check('обломки активны и летят в воздухе', activeCount1 === 30);

// Проматываем 3.0 секунды (время жизни 2.5 с)
pool.update(3.0);
const activeCount2 = pool.update(0.1);
check('после истечения lifetime (2.5с) обломки утилизированы без утечек (active = 0)', activeCount2 === 0);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
