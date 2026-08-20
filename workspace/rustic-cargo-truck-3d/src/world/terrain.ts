import * as THREE from 'three';
import type { ForkConfig, LevelConfig } from './levels';
import { LEVELS } from './levels';

/**
 * Terrain shape and geometry, free of renderer dependency, so the exact same buffers
 * can be built in a head-less physics harness as in the game.
 */
export const TERRAIN = {
  halfWidth: 52,
  roadHalfWidth: 4.0,
  startZ: -16,
  endZ: 340,
  segmentsX: 80,
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
 * Calculates raw road center lateral offset (X) based on level curvature.
 */
function rawRoadCenterX(z: number): number {
  const amp = activeLevel.curveAmp ?? 3.5;
  const freq = activeLevel.curveFreq ?? 0.035;
  const seed = (activeLevel.id * 1.61803398875) % 10;
  return (
    amp * Math.sin(z * freq + seed) +
    (amp * 0.42) * Math.sin(z * (freq * 2.2) + seed * 2.1) +
    (amp * 0.18) * Math.cos(z * (freq * 0.75) - seed * 1.4)
  );
}

/**
 * Main road center lateral offset (X) at coordinate Z.
 * Smoothly transitions from flat/straight in the village (z <= 16) and sawmill exit (z >= len - 16).
 */
export function mainRoadCenterX(z: number): number {
  if (z <= 16) return 0;
  const len = activeLevel.length;
  if (z >= len - 16) {
    const exitRamp = THREE.MathUtils.smoothstep(z, len - 16, len);
    const rawX = rawRoadCenterX(len - 16);
    return rawX * (1 - exitRamp);
  }
  const entryRamp = THREE.MathUtils.smoothstep(z, 16, 36);
  return entryRamp * rawRoadCenterX(z);
}

export interface ActiveForkInfo {
  fork: ForkConfig;
  splitFactor: number;
  leftCX: number;
  rightCX: number;
}

/**
 * Returns active fork configuration and branch centers at coordinate Z if inside a fork zone.
 */
export function getActiveFork(z: number): ActiveForkInfo | null {
  if (!activeLevel.forks || activeLevel.forks.length === 0) return null;
  for (const fork of activeLevel.forks) {
    if (z >= fork.startZ && z <= fork.endZ) {
      const len = fork.endZ - fork.startZ;
      const blend = Math.min(26, len * 0.28);
      const blendIn = THREE.MathUtils.smoothstep(z, fork.startZ, fork.startZ + blend);
      const blendOut = 1 - THREE.MathUtils.smoothstep(z, fork.endZ - blend, fork.endZ);
      const splitFactor = blendIn * blendOut;
      const mcx = mainRoadCenterX(z);
      return {
        fork,
        splitFactor,
        leftCX: mcx + fork.leftOffset * splitFactor,
        rightCX: mcx + fork.rightOffset * splitFactor,
      };
    }
  }
  return null;
}

export interface RoadProximity {
  distToRoad: number;
  closestCX: number;
  branch: 'main' | 'left' | 'right';
  splitFactor: number;
  forkConfig: ForkConfig | null;
}

/**
 * Computes lateral distance from any world (x, z) to the closest drivable road centerline.
 */
export function getRoadProximity(x: number, z: number): RoadProximity {
  const forkInfo = getActiveFork(z);
  if (!forkInfo || forkInfo.splitFactor <= 0.01) {
    const cx = mainRoadCenterX(z);
    return {
      distToRoad: Math.abs(x - cx),
      closestCX: cx,
      branch: 'main',
      splitFactor: 0,
      forkConfig: null,
    };
  }

  const dLeft = Math.abs(x - forkInfo.leftCX);
  const dRight = Math.abs(x - forkInfo.rightCX);
  if (dLeft < dRight) {
    return {
      distToRoad: dLeft,
      closestCX: forkInfo.leftCX,
      branch: 'left',
      splitFactor: forkInfo.splitFactor,
      forkConfig: forkInfo.fork,
    };
  } else {
    return {
      distToRoad: dRight,
      closestCX: forkInfo.rightCX,
      branch: 'right',
      splitFactor: forkInfo.splitFactor,
      forkConfig: forkInfo.fork,
    };
  }
}

/**
 * Water ford / puddle intensity at (x, z), ranging from 0.0 to 1.0.
 */
export function getWaterIntensity(x: number, z: number): number {
  const prox = getRoadProximity(x, z);
  const roadFactor = 1 - THREE.MathUtils.smoothstep(prox.distToRoad, 0, TERRAIN.roadHalfWidth + 1.5);
  if (roadFactor <= 0.01) return 0;

  let maxZoneWater = 0;
  if (activeLevel.waterZones && activeLevel.waterZones.length > 0) {
    for (const zone of activeLevel.waterZones) {
      if (z >= zone.startZ - 6 && z <= zone.endZ + 6) {
        const blendIn = THREE.MathUtils.smoothstep(z, zone.startZ - 4, zone.startZ + 8);
        const blendOut = 1 - THREE.MathUtils.smoothstep(z, zone.endZ - 8, zone.endZ + 4);
        const zoneWater = blendIn * blendOut * (zone.depth / 0.5);
        if (zoneWater > maxZoneWater) maxZoneWater = zoneWater;
      }
    }
  }

  // Branch-specific water on fork branches
  if (prox.forkConfig && prox.splitFactor > 0.01) {
    const branchWaterDepth = (prox.branch === 'left' ? prox.forkConfig.leftWaterDepth : prox.forkConfig.rightWaterDepth) ?? 0;
    const effectiveBranchWater = (branchWaterDepth / 0.5) * prox.splitFactor;
    if (effectiveBranchWater > maxZoneWater) maxZoneWater = effectiveBranchWater;
  }

  return THREE.MathUtils.clamp(maxZoneWater * roadFactor, 0, 1);
}

/**
 * Mud intensity at any (x, z) coordinate, ranging from 0.0 (firm dry road) to 1.0 (deep thick mud pit).
 */
export function getMudIntensity(x: number, z: number): number {
  const prox = getRoadProximity(x, z);
  const roadFactor = 1 - THREE.MathUtils.smoothstep(prox.distToRoad, 0, TERRAIN.roadHalfWidth + 1.2);
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

  // Branch-specific mud on fork branches
  if (prox.forkConfig && prox.splitFactor > 0.01) {
    const branchMud = (prox.branch === 'left' ? prox.forkConfig.leftMudIntensity : prox.forkConfig.rightMudIntensity) ?? 0;
    const effectiveBranchMud = branchMud * prox.splitFactor;
    if (effectiveBranchMud > maxZoneMud) maxZoneMud = effectiveBranchMud;
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
export function roadHeightAt(z: number, x?: number): number {
  const evalX = x !== undefined ? x : mainRoadCenterX(z);
  const prox = getRoadProximity(evalX, z);

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
  const normRelX = THREE.MathUtils.clamp((evalX - prox.closestCX) / TERRAIN.roadHalfWidth, -1, 1);

  let bumpAmp = activeLevel.bumpAmp;
  let branchElev = 0;
  if (prox.forkConfig && prox.splitFactor > 0.01) {
    if (prox.branch === 'left') {
      if (prox.forkConfig.leftBumpsAmp !== undefined) bumpAmp += prox.forkConfig.leftBumpsAmp * prox.splitFactor;
      if (prox.forkConfig.leftElevation !== undefined) branchElev += prox.forkConfig.leftElevation * prox.splitFactor;
    } else if (prox.branch === 'right') {
      if (prox.forkConfig.rightBumpsAmp !== undefined) bumpAmp += prox.forkConfig.rightBumpsAmp * prox.splitFactor;
      if (prox.forkConfig.rightElevation !== undefined) branchElev += prox.forkConfig.rightElevation * prox.splitFactor;
    }
  }

  const bumps = bumpFactor * (
    bumpAmp * Math.sin(z * activeLevel.bumpFreq + 0.4) +
    (bumpAmp * 0.5) * Math.sin(z * (activeLevel.bumpFreq * 1.9)) +
    activeLevel.camberAmp * Math.cos(z * 0.38) * normRelX // Cross-slope roll
  );

  // Sunken mud dips
  let mudDip = 0;
  for (const zone of activeLevel.mudZones) {
    if (z >= zone.startZ - 6 && z <= zone.endZ + 6) {
      const factor = THREE.MathUtils.smoothstep(z, zone.startZ - 4, zone.startZ + 12) *
                     (1 - THREE.MathUtils.smoothstep(z, zone.endZ - 12, zone.endZ + 4));
      mudDip -= factor * (0.6 * zone.intensity + 0.18 * Math.sin(z * 0.32 + evalX * 0.7));
    }
  }
  if (prox.forkConfig && prox.splitFactor > 0.01) {
    const branchMud = prox.branch === 'left' ? (prox.forkConfig.leftMudIntensity ?? 0) : (prox.forkConfig.rightMudIntensity ?? 0);
    if (branchMud > 0) {
      mudDip -= prox.splitFactor * branchMud * 0.5;
    }
  }

  // Sunken water ford dips
  let waterDip = 0;
  if (activeLevel.waterZones) {
    for (const zone of activeLevel.waterZones) {
      if (z >= zone.startZ - 4 && z <= zone.endZ + 4) {
        const factor = THREE.MathUtils.smoothstep(z, zone.startZ - 3, zone.startZ + 8) *
                       (1 - THREE.MathUtils.smoothstep(z, zone.endZ - 8, zone.endZ + 3));
        waterDip -= factor * (zone.depth + 0.08 * Math.sin(z * 0.4 + evalX * 0.6));
      }
    }
  }
  if (prox.forkConfig && prox.splitFactor > 0.01) {
    const branchWater = prox.branch === 'left' ? (prox.forkConfig.leftWaterDepth ?? 0) : (prox.forkConfig.rightWaterDepth ?? 0);
    if (branchWater > 0) {
      waterDip -= prox.splitFactor * branchWater * 0.8;
    }
  }

  return ramp * (macro + bumps + mudDip + waterDip + branchElev);
}

/**
 * Full valley terrain height including road, roadside verges, ditches, and rolling forested hills.
 */
export function heightAt(x: number, z: number): number {
  const prox = getRoadProximity(x, z);
  const roadY = roadHeightAt(z, x);
  const distOutside = Math.max(0, prox.distToRoad - TERRAIN.roadHalfWidth);

  // Roadside verge (first 1.8m outside road)
  const vergeRise = Math.min(distOutside * 0.5, 0.9);

  // Rolling forest hills spanning the wide valley
  const hillDist = Math.max(0, distOutside - 1.2);
  const hillWaves =
    0.22 * hillDist +
    0.06 * hillDist * Math.sin(z * 0.038 + x * 0.04) +
    0.04 * hillDist * Math.cos(z * 0.08 - x * 0.03);

  // Physical divider island / mountain ridge between fork branches
  let medianIsland = 0;
  const forkInfo = getActiveFork(z);
  if (forkInfo && forkInfo.splitFactor > 0.05) {
    const minBranchX = Math.min(forkInfo.leftCX, forkInfo.rightCX);
    const maxBranchX = Math.max(forkInfo.leftCX, forkInfo.rightCX);
    const islandLeft = minBranchX + TERRAIN.roadHalfWidth + 1.2;
    const islandRight = maxBranchX - TERRAIN.roadHalfWidth - 1.2;
    if (x >= islandLeft && x <= islandRight && islandRight > islandLeft) {
      const normBetween = (x - islandLeft) / (islandRight - islandLeft);
      const dome = Math.sin(normBetween * Math.PI);
      medianIsland = dome * (4.2 + 1.2 * Math.sin(z * 0.08)) * forkInfo.splitFactor;
    }
  }

  // Clearings for Village (z < 28) and Sawmill (z > activeLevel.length - 20)
  const villageFlat = THREE.MathUtils.smoothstep(z, 14, 32);
  const sawmillFlat = 1 - THREE.MathUtils.smoothstep(z, activeLevel.length - 24, activeLevel.length - 6);
  const clearingFactor = villageFlat * (z > activeLevel.length * 0.5 ? sawmillFlat : 1);

  return roadY + vergeRise + hillWaves * (0.3 + 0.7 * clearingFactor) + medianIsland;
}

/**
 * Builds the one continuous ribbon of terrain vertices spanning the 104m wide valley.
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
  const sandstone = new THREE.Color(0xa38c64);
  const tint = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = heightAt(x, z);
    position.setY(i, y);

    const prox = getRoadProximity(x, z);
    const distToRoad = prox.distToRoad;
    const mud = getMudIntensity(x, z);

    if (distToRoad <= TERRAIN.roadHalfWidth) {
      // Road surface: blend between packed dirt, sandstone (on high dry branches), and dark wet mud
      if (prox.forkConfig && prox.splitFactor > 0.2) {
        const branchElev = prox.branch === 'left' ? (prox.forkConfig.leftElevation ?? 0) : (prox.forkConfig.rightElevation ?? 0);
        if (branchElev > 1.0 && mud < 0.1) {
          tint.copy(sandstone);
        } else {
          tint.copy(dirtRoad).lerp(wetDirt, mud * 0.7).lerp(deepMud, mud * mud);
        }
      } else {
        tint.copy(dirtRoad).lerp(wetDirt, mud * 0.7).lerp(deepMud, mud * mud);
      }
    } else if (distToRoad <= TERRAIN.roadHalfWidth + 2.0) {
      // Roadside shoulder / verge
      const vergeFactor = (distToRoad - TERRAIN.roadHalfWidth) / 2.0;
      tint.copy(gravelEdge).lerp(lushGrass, vergeFactor);
      if (mud > 0.1) tint.lerp(wetDirt, mud * 0.5);
    } else {
      // Forest hills & rocky outcrops
      const hillDist = distToRoad - TERRAIN.roadHalfWidth - 2.0;
      const forestFactor = THREE.MathUtils.clamp(hillDist / 6.0, 0, 1);
      tint.copy(lushGrass).lerp(forestGround, forestFactor);
      // Rock tint on steeper high points
      if (y > roadHeightAt(z, x) + 2.8) {
        tint.lerp(rock, 0.5);
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

