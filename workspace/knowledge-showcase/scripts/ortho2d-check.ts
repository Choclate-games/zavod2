/**
 * Headless test for Orthographic 2D, Swipe Slicer & Evidence Board Deduction.
 * Checks mechanics from knowledge/threejs/orthographic_2d_and_pointer_input.md
 * and knowledge/mechanics/evidence_board.md.
 *
 * Run: tsx scripts/ortho2d-check.ts
 */
import {
  computeOrthoBounds,
  evaluateQuadraticBezier,
  EvidenceGraphSystem,
  segmentHitsCircle,
  WORLD_HEIGHT,
} from '../src/game/ortho2dEvidence';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

console.log('Ортографическая камера и границы мира:');
const bounds16_9 = computeOrthoBounds(1920, 1080);
check('высота мира строго равна 20 единиц', (bounds16_9.top - bounds16_9.bottom) === WORLD_HEIGHT);
check('при 16:9 ширина мира равна 20 * (16/9) ≈ 35.56', Math.abs((bounds16_9.right - bounds16_9.left) - (20 * 16 / 9)) < 1e-3);

const boundsMobile = computeOrthoBounds(1080, 1920); // 9:16 portrait
check('на вертикальном мобильном экране высота остается 20 единиц', (boundsMobile.top - boundsMobile.bottom) === WORLD_HEIGHT);
check('ширина подстраивается под аспект (20 * 9 / 16 = 11.25)', Math.abs((boundsMobile.right - boundsMobile.left) - 11.25) < 1e-3);

console.log('\nСвайп-слайсер (пересечение отрезка с окружностью):');
// Круг в (5, 5) радиусом 1.0
check('прямой свайп через центр круга (0, 5) -> (10, 5): попадание', segmentHitsCircle(0, 5, 10, 5, 5, 5, 1.0));
check('касательный свайп (0, 6) -> (10, 6): попадание', segmentHitsCircle(0, 6, 10, 6, 5, 5, 1.0));
check('свайп мимо цели (0, 7) -> (10, 7): промах', !segmentHitsCircle(0, 7, 10, 7, 5, 5, 1.0));
check('короткий свайп, не дошедший до цели (0, 5) -> (3, 5): промах', !segmentHitsCircle(0, 5, 3, 5, 5, 5, 1.0));

console.log('\nПровисание нити Безье (Quadratic Bezier Catenary):');
const p0 = { x: 0, y: 0 };
const p2 = { x: 10, y: 0 };
const sag = 10 * 0.18; // 1.8
const p1 = { x: 5, y: -sag };

const startPt = evaluateQuadraticBezier(p0, p1, p2, 0);
const midPt = evaluateQuadraticBezier(p0, p1, p2, 0.5);
const endPt = evaluateQuadraticBezier(p0, p1, p2, 1);

check('начало кривой совпадает с p0', startPt.x === 0 && startPt.y === 0);
check('конец кривой совпадает с p2', endPt.x === 10 && endPt.y === 0);
check('середина кривой провисает вниз (y < 0)', midPt.y < 0 && midPt.x === 5);

console.log('\nДоска улик и детективная дедукция (Evidence Board Graph):');
const board = new EvidenceGraphSystem();
check('на доске есть 6 улик', board.clues.size === 6);
check('начальный ресурс «Внимание детектива» = 100', board.detectiveFocus === 100);

// Соединяем верную пару (Следы <-> Садовник)
const r1 = board.connectClues('muddy_footprints', 'suspect_gardener');
check('верная дедукция принята', r1.success && r1.isValid);
check('счетчик найденных зацепок увеличился (1 / 3)', board.deductionsFound === 1);
check('внимание не потеряно', board.detectiveFocus === 100);

// Соединяем ложную пару (Следы <-> Разбитое окно)
const r2 = board.connectClues('muddy_footprints', 'broken_window');
check('ложная связь зафиксирована как неверная', r2.success && !r2.isValid);
check('за ложную связь списано 25 очков внимания (100 -> 75)', board.detectiveFocus === 75);

// Повторное соединение той же пары
const r3 = board.connectClues('muddy_footprints', 'suspect_gardener');
check('дублирование существующей связи отклонено', !r3.success);

// Дособираем все верные связи
board.connectClues('torn_black_fabric', 'suspect_butler');
board.connectClues('broken_window', 'crowbar_weapon');
check('все 3 ключевые улики раскрыты', board.deductionsFound === board.totalValidDeductions);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
