/**
 * Procedural 3D Mesh generator specifications, animator math & benchmark calculations.
 * Pure TS module (independent of Three.js).
 * Implements knowledge/threejs/procedural_mesh_builder.md.
 */

export interface ProceduralAssetDef {
  id: string;
  name: string;
  category: 'character' | 'vehicle' | 'prop' | 'foliage' | 'collectible';
  targetVertexBudget: number;
  maxGenTimeMs: number;
}

export const PROCEDURAL_CATALOG: ProceduralAssetDef[] = [
  { id: 'character', name: 'Low-Poly Adventurer', category: 'character', targetVertexBudget: 500, maxGenTimeMs: 2.0 },
  { id: 'car', name: 'Low-Poly Sedan', category: 'vehicle', targetVertexBudget: 400, maxGenTimeMs: 2.0 },
  { id: 'tree', name: 'Stylized Pine & Crown Tree', category: 'foliage', targetVertexBudget: 350, maxGenTimeMs: 2.0 },
  { id: 'crate', name: 'Reinforced Cargo Crate', category: 'prop', targetVertexBudget: 200, maxGenTimeMs: 1.5 },
  { id: 'coin', name: 'Golden Chamfered Coin', category: 'collectible', targetVertexBudget: 150, maxGenTimeMs: 1.0 },
  { id: 'crystal', name: 'Pylon Power Crystal', category: 'collectible', targetVertexBudget: 120, maxGenTimeMs: 1.0 },
];

export interface LimbRotations {
  leftLegX: number;
  rightLegX: number;
  leftArmX: number;
  rightArmX: number;
}

/**
 * Procedural walk cycle animation math.
 * Calculates limb angles based on walkTime and isMoving state.
 */
export function computeWalkAngles(
  current: LimbRotations,
  walkTime: number,
  isMoving: boolean,
  speed = 10.0,
  maxSwing = 0.7,
): LimbRotations {
  if (isMoving) {
    const swing = Math.sin(walkTime * speed) * maxSwing;
    return {
      leftLegX: swing,
      rightLegX: -swing,
      leftArmX: -swing * 0.8,
      rightArmX: swing * 0.8,
    };
  } else {
    // Smooth decay to neutral stance
    return {
      leftLegX: current.leftLegX * 0.85,
      rightLegX: current.rightLegX * 0.85,
      leftArmX: current.leftArmX * 0.85,
      rightArmX: current.rightArmX * 0.85,
    };
  }
}

/**
 * Raw box geometry vertex generator (for testing vertex counts & bounds without WebGL).
 */
export function generateBoxData(w: number, h: number, d: number): {
  vertices: number[];
  indices: number[];
  bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
} {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  const vertices = [
    // Front face
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
    // Back face
    -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd, hw, -hh, -hd,
    // Top face
    -hw, hh, -hd, -hw, hh, hd, hw, hh, hd, hw, hh, -hd,
    // Bottom face
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    // Right face
    hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, hw, -hh, hd,
    // Left face
    -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
  ];

  const indices = [
    0, 1, 2, 0, 2, 3, // front
    4, 5, 6, 4, 6, 7, // back
    8, 9, 10, 8, 10, 11, // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
  ];

  return {
    vertices,
    indices,
    bbox: { minX: -hw, maxX: hw, minY: -hh, maxY: hh, minZ: -hd, maxZ: hd },
  };
}

/**
 * Measures execution time of procedural mesh generation.
 */
export function benchmarkGeneration(generator: () => void, iterations = 100): { totalMs: number; avgMs: number } {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    generator();
  }
  const totalMs = performance.now() - t0;
  return {
    totalMs,
    avgMs: totalMs / iterations,
  };
}
