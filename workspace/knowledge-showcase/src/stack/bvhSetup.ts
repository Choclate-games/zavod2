import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

/**
 * Установка расширений three-mesh-bvh — ОДИН раз на приложение.
 *
 * knowledge/stack/three_mesh_bvh.md §1. Модуль существует отдельно намеренно:
 * если ставить расширения внутри какого-то одного демо, остальные начинают
 * зависеть от того, был ли тот модуль загружен. В браузере это «работает»
 * (реестр вкладок импортирует всё), а в головном прогоне падает с
 * `computeBoundsTree is not a function` — что и случилось на самом деле.
 *
 * Импортируйте этот модуль везде, где вызываете `computeBoundsTree()` или
 * рассчитываете на ускоренный `Raycaster`.
 */
let installed = false;

export function installBvh(): void {
  if (installed) return;
  installed = true;
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

// Побочный эффект при импорте: пропустить вызов невозможно.
installBvh();
