import * as THREE from 'three';
import type { LevelConfig } from './levels';
import { LEVELS } from './levels';

/**
 * Terrain shape and geometry, free of renderer dependency, so the exact same buffers
 * can be built in a head-less physics harness as in the game.
 */
export const TERRAIN = {
  halfWidth: 32,
  roadHalfWidth: 4.6,
  startZ: -16,
  endZ: 340,
  segmentsX: 48,
  segmentLength: 1.2,
};

let activeLevel: LevelConfig = LEVELS[0];

export function setLevel(config: LevelConfig): void {
  activeLevel = config;
  TERRAIN.endZ = config.length + 26;
}

export function getActiveLevel(): LevelConfig {
  return activeLevel;
}

/**
 * Water ford / puddle intensity at (x, z), ranging from 0.0 to 1.0.
 */
export function getWaterIntensity(x: number, z: number): number {
  const roadFactor = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 0, TERRAIN.roadHalfWidth + 1.5);
  if (roadFactor <= 0.01) return 0;
  if (!activeLevel.waterZones || activeLevel.waterZones.length === 0) return 0;

  let maxZoneWater = 0;
  for (const zone of activeLevel.waterZones) {
    if (z >= zone.startZ - 6 && z <= zone.endZ + 6) {
      const blendIn = THREE.MathUtils.smoothstep(z, zone.startZ - 4, zone.startZ + 8);
      const blendOut = 1 - THREE.MathUtils.smoothstep(z, zone.endZ - 8, zone.endZ + 4);
      const zoneWater = blendIn * blendOut * (zone.depth / 0.5);
      if (zoneWater > maxZoneWater) maxZoneWater = zoneWater;
    }
  }

  return THREE.MathUtils.clamp(maxZoneWater * roadFactor, 0, 1);
}

/**
 * Mud intensity at any (x, z) coordinate, ranging from 0.0 (firm dry road) to 1.0 (deep thick mud pit).
 */
export function getMudIntensity(x: number, z: number): number {
  const roadFactor = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 0, TERRAIN.roadHalfWidth + 1.2);
  if (roadFactor <= 0.01) return 0;

  let maxZoneMud = 0;
  for (const zone of activeLevel.mudZones) {
    if (z >= zone.startZ - 10 && z <= zone.endZ + 10) {
      const blendIn = THREE.MathUtils.smoothstep(z, zone.startZ - 6, zone.startZ + 10);
      const blendOut = 1 - THREE.MathUtils.smoothstep(z, zone.endZ - 10, zone.endZ + 6);
      const zoneMud = blendIn * blendOut * zone.intensity;
      if (zoneMud > maxZoneMud) maxZoneMud = zoneMud;
    }
  }

  if (maxZoneMud <= 0) return 0;

  // Natural spatial variation (deep ruts and puddle pools)
  const rutPattern = 0.75 + 0.25 * Math.sin(z * 0.35 + x * 0.9) + 0.15 * Math.sin(z * 1.1);
  return THREE.MathUtils.clamp(maxZoneMud * roadFactor * rutPattern, 0, 1);
}

/**
 * Height of the road driving surface with natural topography, bumps, moguls, potholes,
 * washboard corrugations, muddy depressions, and water fords tailored to the active level.
 */
export function roadHeightAt(z: number, x = 0): number {
  // Village spawn area (z <= 10) is flat level ground
  const ramp = THREE.MathUtils.smoothstep(z, 10, 24);
  if (ramp <= 0) return 0;

  const len = activeLevel.length;
  const normZ = z / len;

  // Macro elevation profile tailored to level hills amplitude
  const macro =
    activeLevel.hillsAmp * (
      1.3 * Math.sin(normZ * Math.PI * 2.8 - 0.2) +
      0.7 * Math.sin(normZ * Math.PI * 5.2 + 0.8) +
      0.35 * Math.cos(normZ * Math.PI * 1.5)
    );

  // Level bumps & moguls
  const bumpFactor = THREE.MathUtils.smoothstep(z, 28, 42) * (1 - THREE.MathUtils.smoothstep(z, len - 24, len - 8));
  const normX = THREE.MathUtils.clamp(x / TERRAIN.roadHalfWidth, -1, 1);
  const bumps = bumpFactor * (
    activeLevel.bumpAmp * Math.sin(z * activeLevel.bumpFreq + 0.4) +
    (activeLevel.bumpAmp * 0.5) * Math.sin(z * (activeLevel.bumpFreq * 1.9)) +
    activeLevel.camberAmp * Math.cos(z * 0.38) * normX // Cross-slope roll to test cargo balance!
  );

  // Sunken mud dips where mud is intense
  let mudDip = 0;
  for (const zone of activeLevel.mudZones) {
    if (z >= zone.startZ - 6 && z <= zone.endZ + 6) {
      const factor = THREE.MathUtils.smoothstep(z, zone.startZ - 4, zone.startZ + 12) *
                     (1 - THREE.MathUtils.smoothstep(z, zone.endZ - 12, zone.endZ + 4));
      mudDip -= factor * (0.6 * zone.intensity + 0.18 * Math.sin(z * 0.32 + x * 0.7));
    }
  }

  // Sunken water ford dips
  let waterDip = 0;
  if (activeLevel.waterZones) {
    for (const zone of activeLevel.waterZones) {
      if (z >= zone.startZ - 4 && z <= zone.endZ + 4) {
        const factor = THREE.MathUtils.smoothstep(z, zone.startZ - 3, zone.startZ + 8) *
                       (1 - THREE.MathUtils.smoothstep(z, zone.endZ - 8, zone.endZ + 3));
        waterDip -= factor * (zone.depth + 0.08 * Math.sin(z * 0.4 + x * 0.6));
      }
    }
  }

  return ramp * (macro + bumps + mudDip + waterDip);
}


/**
 * Full valley terrain height including road, roadside verges, ditches, and rolling forested hills.
 */
export function heightAt(x: number, z: number): number {
  const clampedX = THREE.MathUtils.clamp(x, -TERRAIN.roadHalfWidth, TERRAIN.roadHalfWidth);
  const roadY = roadHeightAt(z, clampedX);
  const distOutside = Math.max(0, Math.abs(x) - TERRAIN.roadHalfWidth);

  // Roadside verge (first 1.8m outside road)
  const vergeRise = Math.min(distOutside * 0.5, 0.9);

  // Rolling forest hills spanning the wide valley
  const hillDist = Math.max(0, distOutside - 1.2);
  const hillWaves =
    0.22 * hillDist +
    0.06 * hillDist * Math.sin(z * 0.038 + x * 0.04) +
    0.04 * hillDist * Math.cos(z * 0.08 - x * 0.03);

  // Clearings for Village (z < 28) and Sawmill (z > activeLevel.length - 20)
  const villageFlat = THREE.MathUtils.smoothstep(z, 14, 32);
  const sawmillFlat = 1 - THREE.MathUtils.smoothstep(z, activeLevel.length - 24, activeLevel.length - 6);
  const clearingFactor = villageFlat * (z > activeLevel.length * 0.5 ? sawmillFlat : 1);

  return roadY + vergeRise + hillWaves * (0.3 + 0.7 * clearingFactor);
}

/**
 * Builds the one continuous ribbon of terrain vertices spanning the 64m wide valley.
 * Vertex colors represent deep mud pits, packed dirt road, grassy verges, forest floor, and rocks.
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

  const deepMud = new THREE.Color(0x382618);
  const wetDirt = new THREE.Color(0x573e28);
  const dirtRoad = new THREE.Color(0x826c50);
  const gravelEdge = new THREE.Color(0x6e6753);
  const lushGrass = new THREE.Color(0x4c733c);
  const forestGround = new THREE.Color(0x34532b);
  const rock = new THREE.Color(0x5c584f);
  const tint = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = heightAt(x, z);
    position.setY(i, y);

    const absX = Math.abs(x);
    const mud = getMudIntensity(x, z);

    if (absX <= TERRAIN.roadHalfWidth) {
      // Road surface: blend between packed dirt and dark wet mud
      tint.copy(dirtRoad).lerp(wetDirt, mud * 0.7).lerp(deepMud, mud * mud);
    } else if (absX <= TERRAIN.roadHalfWidth + 2.0) {
      // Roadside shoulder / verge
      const vergeFactor = (absX - TERRAIN.roadHalfWidth) / 2.0;
      tint.copy(gravelEdge).lerp(lushGrass, vergeFactor);
      if (mud > 0.1) tint.lerp(wetDirt, mud * 0.5);
    } else {
      // Forest hills & rocky outcrops
      const hillDist = absX - TERRAIN.roadHalfWidth - 2.0;
      const forestFactor = THREE.MathUtils.clamp(hillDist / 6.0, 0, 1);
      tint.copy(lushGrass).lerp(forestGround, forestFactor);
      // Rock tint on steeper high points
      if (y > roadHeightAt(z) + 3.2) {
        tint.lerp(rock, 0.4);
      }
    }

    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

