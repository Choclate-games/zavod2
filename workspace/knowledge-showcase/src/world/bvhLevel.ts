import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Процедурный «каньон» — намеренно тяжёлая статичная геометрия для BVH-демо.
 *
 * knowledge/stack/three_mesh_bvh.md §1: вся статика сливается в ОДИН меш, и BVH
 * строится по нему. Отдельный BVH на каждый камень смысла не имеет — рейкаст всё
 * равно перебирает объекты.
 */
export function buildCanyon(): { geometry: THREE.BufferGeometry; triangles: number } {
  const parts: THREE.BufferGeometry[] = [];

  // Дно: displaced-плоскость, а не плоский квад — иначе BVH нечего ускорять.
  const floor = new THREE.PlaneGeometry(120, 120, 140, 140);
  floor.rotateX(-Math.PI / 2);
  displace(floor, (x, z) => {
    const ridge = Math.sin(x * 0.06) * Math.cos(z * 0.05) * 2.2;
    const bumps = Math.sin(x * 0.31 + z * 0.17) * 0.45;
    return ridge + bumps;
  });
  parts.push(floor);

  // Скалы: низкополигональные, но их много — суммарно десятки тысяч треугольников.
  const rng = mulberry32(1337);
  for (let i = 0; i < 90; i++) {
    const r = 4 + rng() * 9;
    const rock = new THREE.IcosahedronGeometry(r, 2);
    jitter(rock, rng, r * 0.16);
    const angle = rng() * Math.PI * 2;
    const dist = 14 + rng() * 44;
    rock.translate(Math.cos(angle) * dist, r * (0.15 + rng() * 0.4), Math.sin(angle) * dist);
    parts.push(rock);
  }

  // Арки: то, ради чего в демо есть вертикальность.
  for (let i = 0; i < 6; i++) {
    const arch = new THREE.TorusGeometry(9, 1.7, 10, 26, Math.PI);
    arch.rotateX(Math.PI / 2);
    arch.rotateZ(Math.PI);
    const a = (i / 6) * Math.PI * 2;
    arch.translate(Math.cos(a) * 30, 0, Math.sin(a) * 30);
    parts.push(arch);
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('mergeGeometries failed');

  // Центрирование: далеко смещённые координаты теряют точность во float32 и
  // дают промахи луча (§5 документа).
  merged.center();
  merged.computeVertexNormals();

  const triangles = (merged.getIndex()?.count ?? merged.getAttribute('position').count) / 3;
  return { geometry: merged, triangles };
}

function displace(geom: THREE.BufferGeometry, fn: (x: number, z: number) => number): void {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, fn(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
}

function jitter(geom: THREE.BufferGeometry, rng: () => number, amount: number): void {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng() - 0.5) * amount,
      pos.getY(i) + (rng() - 0.5) * amount * 0.6,
      pos.getZ(i) + (rng() - 0.5) * amount,
    );
  }
  pos.needsUpdate = true;
}

/** Детерминированный ГСЧ: уровень обязан быть одинаковым при каждом запуске. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
