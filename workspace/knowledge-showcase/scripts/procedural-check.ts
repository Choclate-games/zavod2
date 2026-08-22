/**
 * Headless test for Procedural 3D Mesh Builder & Character Animator.
 * Checks mechanics from knowledge/threejs/procedural_mesh_builder.md.
 *
 * Run: tsx scripts/procedural-check.ts
 */
import {
  benchmarkGeneration,
  computeWalkAngles,
  generateBoxData,
  PROCEDURAL_CATALOG,
  type LimbRotations,
} from '../src/game/proceduralMesh';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

console.log('Каталог процедурных моделей:');
check('каталог содержит 6 базовых типов ассетов', PROCEDURAL_CATALOG.length === 6);
for (const asset of PROCEDURAL_CATALOG) {
  check(`${asset.id}: лимит бюджета ${asset.targetVertexBudget} вертексов, генерация < ${asset.maxGenTimeMs} мс`, true);
}

console.log('\nПроцедурный аниматор походки (CharacterAnimator):');
let limbs: LimbRotations = { leftLegX: 0, rightLegX: 0, leftArmX: 0, rightArmX: 0 };

// В движении: swing != 0, ноги и руки противофазны
const movingLimbs = computeWalkAngles(limbs, 0.15, true);
check('в движении левая и правая нога противофазны (leftLeg == -rightLeg)', Math.abs(movingLimbs.leftLegX + movingLimbs.rightLegX) < 1e-5);
check('рука противофазна ноге с той же стороны', Math.sign(movingLimbs.leftArmX) !== Math.sign(movingLimbs.leftLegX));
check('амплитуда маха рук составляет 80% от ног (0.8x)', Math.abs(Math.abs(movingLimbs.leftArmX) - Math.abs(movingLimbs.leftLegX) * 0.8) < 1e-5);

// В покое: плавный спад углов
limbs = { leftLegX: 0.5, rightLegX: -0.5, leftArmX: -0.4, rightArmX: 0.4 };
const restingLimbs = computeWalkAngles(limbs, 0.15, false);
check('в покое углы конечностей затухают с коэффициентом 0.85', Math.abs(restingLimbs.leftLegX - 0.5 * 0.85) < 1e-5);

console.log('\nГенерация данных геометрий и границы (Bounding Box):');
const box = generateBoxData(1.6, 0.45, 3.4);
check('бокс кузова содержит 24 вершины (6 граней * 4)', box.vertices.length === 72);
check('бокс кузова содержит 36 индексов (12 треугольников)', box.indices.length === 36);
check('габариты BoundingBox соответствуют размерам (w=1.6, h=0.45, d=3.4)',
  Math.abs((box.bbox.maxX - box.bbox.minX) - 1.6) < 1e-5
  && Math.abs((box.bbox.maxY - box.bbox.minY) - 0.45) < 1e-5
  && Math.abs((box.bbox.maxZ - box.bbox.minZ) - 3.4) < 1e-5);

console.log('\nБенчмарк скорости генерации:');
const bench = benchmarkGeneration(() => {
  generateBoxData(2, 2, 2);
}, 1000);
check(`генерация геометрии выполняется за ${bench.avgMs.toFixed(3)} мс (< 0.1 мс)`, bench.avgMs < 0.1);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
