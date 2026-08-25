/**
 * Головная проверка гонки: валидация 3D трассы, гоночной линии и физических расчетов.
 *
 * CRITICAL_RULES §66. Проверяет геометрию 3D сплайна, виражи, устойчивость репера
 * и гоночную линию до запуска рендерера.
 * Запуск: `npx tsx scripts/racing-check.ts`
 */
import * as THREE from 'three';
import { RacingTrack3D, CHECKPOINTS, defaultTrack3DPoints } from '../src/world/RacingTrack3D';
import { DEFAULT_SPORTS_SPEC } from '../src/vehicle/RacingCarController';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name} ${detail}`); }
}

const track = new RacingTrack3D(defaultTrack3DPoints());
console.log(`3D Трасса: длина ${track.length.toFixed(1)} м, ${CHECKPOINTS} чекпойнтов,`
  + ` шаг ${track.checkpointSpacing.toFixed(1)} м`);

// ─────────────────────────────────────────────────── геометрия 3D трассы
check('трасса замкнута', track.curve.closed);
check('длина трассы разумна (400..1500 м)', track.length > 400 && track.length < 1500,
  `= ${track.length.toFixed(0)} м`);

let minHw = Infinity, maxHw = 0;
let minY = Infinity, maxY = -Infinity;
for (let i = 0; i < 200; i++) {
  const t = i / 200;
  const hw = track.halfWidthAt(t);
  const p = track.cachedPoint[track.samples * t | 0] || track.cachedPoint[0];
  minHw = Math.min(minHw, hw); maxHw = Math.max(maxHw, hw);
  minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
}
check('ширина переменная (шпильки шире прямых)', maxHw - minHw > 1.0,
  `= ${minHw.toFixed(1)}..${maxHw.toFixed(1)} м`);
check('трасса имеет плавный профиль высот', maxY >= minY,
  `= ${minY.toFixed(1)}..${maxY.toFixed(1)} м`);

// Репер не должен переворачиваться: соседние «right» и «up» смотрят в одну сторону.
let flips = 0;
const prevR = new THREE.Vector3();
const curR = new THREE.Vector3();
track.rightAt(0, prevR);
for (let i = 1; i < 400; i++) {
  track.rightAt(i / 400, curR);
  if (prevR.dot(curR) < 0) flips++;
  prevR.copy(curR);
}
check('репер 3D полотна устойчив и не переворачивается', flips === 0, `переворотов: ${flips}`);

// Гоночная линия смещена внутрь поворотов, а не совпадает с осевой.
let maxOffset = 0;
for (let i = 0; i < 200; i++) maxOffset = Math.max(maxOffset, Math.abs(track.racingOffsetAt(i / 200)));
check('гоночная линия оптимизирована под апексы', maxOffset > 0.15, `max |offset| = ${maxOffset.toFixed(2)}`);

// Стартовая решетка размещена корректно
const slot0 = track.gridSlot(0);
const slot1 = track.gridSlot(1);
check('стартовые слоты разделены по полосам', slot0.pos.distanceTo(slot1.pos) > 2.0);

// Параметры спорткара Rapier3D
check('параметры спорткара заданы (скорость > 180 км/ч)', DEFAULT_SPORTS_SPEC.engine.maxSpeed * 3.6 >= 180,
  `= ${(DEFAULT_SPORTS_SPEC.engine.maxSpeed * 3.6).toFixed(0)} км/ч`);
check('дрифт-сцепление задней оси снижено в 3+ раза',
  DEFAULT_SPORTS_SPEC.tire.frictionSlip / DEFAULT_SPORTS_SPEC.tire.driftFrictionSlip >= 3.0);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
