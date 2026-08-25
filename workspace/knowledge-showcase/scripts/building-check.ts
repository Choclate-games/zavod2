/**
 * Headless test for Grid & Base Building logic.
 * Checks mechanics from knowledge/mechanics/grid_building.md,
 * knowledge/mechanics/base_building.md, and knowledge/patterns/builder_defense_loop.md.
 *
 * Run: tsx scripts/building-check.ts
 */
import {
  BaseBuildingSystem,
  CELL_SIZE,
  PYLON_LINK_RADIUS,
  snapToGrid,
  worldToGrid,
  gridToWorld,
} from '../src/game/gridBuilding';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

console.log('Сетка и привязка (Snap-to-Grid):');
check('snapToGrid: 0.1 -> 0', snapToGrid(0.1) === 0);
check('snapToGrid: 1.2 -> 2', snapToGrid(1.2) === 2);
check('snapToGrid: -1.9 -> -2', snapToGrid(-1.9) === -2);
check('worldToGrid: 4.0 -> 2', worldToGrid(4.0) === 2);
check('gridToWorld: 3 -> 6.0', gridToWorld(3) === 6.0);

console.log('\nВалидация постройки и ресурсы:');
const sys = new BaseBuildingSystem();
sys.scrap = 50;

check('ядро базы спавнится в центре', sys.getStructureAt(0, 0)?.type === 'core');
check('CanPlace на свободную клетку: true', sys.canPlace('turret', 1, 0).ok);
check('CanPlace на занятую клетку (0, 0): false', !sys.canPlace('turret', 0, 0).ok);
check('CanPlace за пределами сетки: false', !sys.canPlace('turret', 99, 0).ok);

const turret = sys.placeStructure('turret', 1, 0);
check('турель успешно размещена', turret !== null && turret.type === 'turret');
check('ресурсы списаны (50 - 35 = 15)', sys.scrap === 15);
check('повторная постройка невозможна из-за нехватки ресурсов (15 < 35)', !sys.canPlace('turret', 2, 0).ok);

console.log('\nЭнергосеть (Pylon Power Flow BFS):');
check('турель рядом с ядром (dist 2м <= 8м) запитана', turret?.isPowered === true);
check('баланс энергии: произведено 20, потреблено 5', sys.totalPowerProduced === 20 && sys.totalPowerConsumed === 5);

// Ставим далекую турель
sys.scrap = 500;
const farTurret = sys.placeStructure('turret', 8, 0); // worldX = 16m (> 8m from core)
check('далекая турель без пилона (16м от ядра) НЕ запитана', farTurret?.isPowered === false);

// Протягиваем цепь пилонов: (3, 0) -> (6, 0)
const p1 = sys.placeStructure('pylon', 3, 0); // worldX = 6m (от ядра 6м <= 8м)
const p2 = sys.placeStructure('pylon', 6, 0); // worldX = 12m (от p1 6м <= 8м, до farTurret 4м <= 8м)
check('цепь пилонов замкнулась: далекая турель теперь запитана', farTurret?.isPowered === true);
check('потребление энергии возросло до 10 (2 турели по 5)', sys.totalPowerConsumed === 10);

// Снос промежуточного пилона (разрыв цепи)
const demoRes = sys.demolish(3, 0);
check('снос пилона вернул 75% стоимости (15 * 0.75 = 11)', demoRes?.refunded === 11);
check('после разрыва цепи далекая турель потеряла питание', farTurret?.isPowered === false);
check('турель у ядра осталась запитанной', turret?.isPowered === true);

console.log('\nСнос и разрушение построек:');
check('ядро нельзя снести', sys.demolish(0, 0) === null);
const wall = sys.placeStructure('wall', -2, 0);
const destroyed = sys.damageStructure(wall!.id, 300);
check('урон разрушил стену (HP 250 - 300 <= 0)', destroyed && sys.getStructureAt(-2, 0) === undefined);

console.log('\nВлияние построек на пути NPC (A* / BFS обход преград):');
// Путь от (-4, 0) к ядру (0, 0)
const stepDirect = sys.findNextStep(-4, 0, 0, 0);
check('свободный путь: шаг вперед к ядру (-3, 0)', stepDirect.gx === -3 && stepDirect.gz === 0);

// Перегораживаем прямой путь стенами на x = -2
sys.placeStructure('wall', -2, 0);
sys.placeStructure('wall', -2, 1);
sys.placeStructure('wall', -2, -1);

const stepDetour = sys.findNextStep(-4, 0, 0, 0);
check('при перекрытии стены NPC обходит преграду (смещается по z)', stepDetour.gz !== 0 || stepDetour.gx !== -2);

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
