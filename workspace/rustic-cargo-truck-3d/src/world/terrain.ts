import * as THREE from 'three';

/**
 * Terrain shape and geometry, free of any renderer dependency, so the exact same buffers
 * can be built in a head-less physics harness as in the game.
 */

export const TERRAIN = {
  halfWidth: 9,
  roadHalfWidth: 5.4,
  startZ: -12,
  endZ: 326,
  segmentsX: 24,
  segmentLength: 1.5,
} as const;

/** Height of the driving surface along the route, flat for the first metres so the truck spawns level. */
export function roadHeightAt(z: number): number {
  const ramp = THREE.MathUtils.smoothstep(z, TERRAIN.startZ, TERRAIN.startZ + 14);
  return ramp * (0.42 * Math.sin(z * 0.047 + 1.1) + 0.22 * Math.sin(z * 0.15) + 0.11 * Math.sin(z * 0.31 + 0.7));
}

/** Terrain height including the grass banks that keep the truck on the road. */
export function heightAt(x: number, z: number): number {
  const outside = Math.max(0, Math.abs(x) - TERRAIN.roadHalfWidth);
  return roadHeightAt(z) + Math.min(outside * outside * 0.55, 3.2);
}

/**
 * One continuous ribbon of vertices, tinted per-vertex so the packed dirt road and the grass
 * verges share a single draw call. The collider is built from these same buffers, which is why
 * there are no seams or ledges anywhere on the route.
 */
export function buildTerrainGeometry(): THREE.BufferGeometry {
  const segmentsZ = Math.round((TERRAIN.endZ - TERRAIN.startZ) / TERRAIN.segmentLength);
  const geometry = new THREE.PlaneGeometry(
    TERRAIN.halfWidth * 2,
    TERRAIN.endZ - TERRAIN.startZ,
    TERRAIN.segmentsX,
    segmentsZ,
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, (TERRAIN.startZ + TERRAIN.endZ) / 2);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const dirt = new THREE.Color(0x877050);
  const grass = new THREE.Color(0x5f7f4d);
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, heightAt(x, z));
    const grassiness = THREE.MathUtils.smoothstep(Math.abs(x), TERRAIN.roadHalfWidth - 1.1, TERRAIN.roadHalfWidth + 0.6);
    tint.copy(dirt).lerp(grass, grassiness);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
