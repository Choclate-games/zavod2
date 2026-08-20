import { CollectionData, VoxelCoord, VoxelModelData } from '../core/Types';

// Color Palette Constants
const C = {
  // Food colors
  DONUT_DOUGH: 0xd4a373,
  DONUT_PINK: 0xff69b4,
  SPRINKLE_BLUE: 0x00d2d3,
  SPRINKLE_YELLOW: 0xffe66d,
  SPRINKLE_WHITE: 0xffffff,
  APPLE_RED: 0xe63946,
  APPLE_DARK: 0xc1121f,
  STEM_BROWN: 0x582f0e,
  LEAF_GREEN: 0x38b000,
  MELON_GREEN_DARK: 0x2d6a4f,
  MELON_GREEN_LIGHT: 0x74c69d,
  MELON_WHITE: 0xf8f9fa,
  MELON_RED: 0xef233c,
  SEED_BLACK: 0x1a1a1a,
  BUN_TOP: 0xe09f3e,
  BURGER_MEAT: 0x6f1d1b,
  BURGER_CHEESE: 0xffb703,
  BURGER_LETTUCE: 0x55a630,
  BURGER_TOMATO: 0xd90429,
  
  // Toy colors
  DUCK_YELLOW: 0xffd166,
  DUCK_ORANGE: 0xf77f00,
  DUCK_EYE: 0x000000,
  GAMEPAD_BODY: 0x3a0ca3,
  GAMEPAD_DPAD: 0x212529,
  GAMEPAD_BTNS: 0xf72585,
  GAMEPAD_HANDLES: 0x4361ee,
  RUBIK_RED: 0xd90429,
  RUBIK_BLUE: 0x0077b6,
  RUBIK_WHITE: 0xf8f9fa,
  RUBIK_YELLOW: 0xffea00,
  RUBIK_GREEN: 0x38b000,
  RUBIK_ORANGE: 0xfb8500,
  RUBIK_BLACK: 0x111111,
  CAR_BODY: 0x00b4d8,
  CAR_WHEEL: 0x222222,
  CAR_GLASS: 0xade8f4,
  CAR_LIGHT: 0xffd166,

  // Tech colors
  PHONE_BODY: 0x1e1e24,
  PHONE_SCREEN: 0x00f2fe,
  PHONE_CAMERA: 0x4cc9f0,
  CASSETTE_PLASTIC: 0x343a40,
  CASSETTE_LABEL: 0xff006e,
  CASSETTE_REEL: 0xf8f9fa,
  ARCADE_CABINET: 0x7209b7,
  ARCADE_MARQUEE: 0x4cc9f0,
  ARCADE_SCREEN: 0x3a0ca3,
  ARCADE_JOYSTICK: 0xff0054,
  ROBOT_METAL: 0x90e0ef,
  ROBOT_EARS: 0x0077b6,
  ROBOT_EYES: 0x00f5d4,
  ROBOT_MOUTH: 0xf72585,

  // Treasures colors
  DIAMOND_CYAN: 0x00f5d4,
  DIAMOND_DEEP: 0x01baef,
  DIAMOND_LIGHT: 0xe0fbfc,
  CROWN_GOLD: 0xffd700,
  CROWN_RUBY: 0xd90429,
  CROWN_EMERALD: 0x2ec4b6,
  TOWER_STONE_DARK: 0x495057,
  TOWER_STONE_LIGHT: 0x6c757d,
  TOWER_ROOF: 0x9b2226,
  TOWER_WOOD: 0x7f4f24,
  ROCKET_WHITE: 0xf8f9fa,
  ROCKET_RED: 0xe63946,
  ROCKET_FINS: 0x1d3557,
  ROCKET_FIRE: 0xffa200
};

// Procedural 3D Matrix Helpers
function createDonut(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const R = 7.5; // Major radius
  const r = 3.2; // Minor tube radius
  
  for (let x = -11; x <= 11; x++) {
    for (let z = -11; z <= 11; z++) {
      for (let y = -4; y <= 4; y++) {
        const distFromCenter = Math.sqrt(x * x + z * z);
        const tubeDist = Math.sqrt(Math.pow(distFromCenter - R, 2) + y * y);
        if (tubeDist <= r) {
          let color = C.DONUT_DOUGH;
          // Glaze on top
          if (y >= 0 && tubeDist <= r + 0.3) {
            color = C.DONUT_PINK;
            // Sprinkles
            const hash = (Math.sin(x * 12.9898 + z * 78.233 + y * 45.164) * 43758.5453) % 1;
            if (hash > 0.82) color = C.SPRINKLE_YELLOW;
            else if (hash > 0.70) color = C.SPRINKLE_BLUE;
            else if (hash > 0.60) color = C.SPRINKLE_WHITE;
          }
          list.push({ x, y: y + 4, z, color });
        }
      }
    }
  }
  return list;
}

function createApple(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const radius = 7.5;

  for (let x = -8; x <= 8; x++) {
    for (let z = -8; z <= 8; z++) {
      for (let y = -8; y <= 8; y++) {
        // Apple apple-like shape
        const r = Math.sqrt(x * x + z * z + (y * 0.9) * (y * 0.9));
        // Dimples at top and bottom
        const topIndent = (y > 4) ? Math.exp(-((x*x + z*z)/6)) * 3 : 0;
        const botIndent = (y < -5) ? Math.exp(-((x*x + z*z)/6)) * 2 : 0;

        if (r <= radius - topIndent - botIndent) {
          let color = (x + y + z) % 3 === 0 ? C.APPLE_DARK : C.APPLE_RED;
          list.push({ x, y: y + 8, z, color });
        }
      }
    }
  }

  // Stem
  for (let y = 6; y <= 11; y++) {
    list.push({ x: 0, y: y + 8, z: 0, color: C.STEM_BROWN });
  }
  // Leaf
  for (let lx = 1; lx <= 3; lx++) {
    list.push({ x: lx, y: 10 + 8, z: 1, color: C.LEAF_GREEN });
    list.push({ x: lx, y: 11 + 8, z: 0, color: C.LEAF_GREEN });
  }

  return list;
}

function createWatermelon(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  // Triangular slice
  const radius = 10;
  const depth = 5;

  for (let z = -depth; z <= depth; z++) {
    for (let x = -radius; x <= radius; x++) {
      for (let y = 0; y <= radius; y++) {
        const dist = Math.sqrt(x * x + y * y);
        // Angle between 25 and 155 deg
        if (dist <= radius && y >= Math.abs(x) * 0.5) {
          let color = C.MELON_RED;
          if (dist >= radius - 1) {
            color = (x + z) % 2 === 0 ? C.MELON_GREEN_DARK : C.MELON_GREEN_LIGHT;
          } else if (dist >= radius - 2.2) {
            color = C.MELON_WHITE;
          } else {
            // Seeds
            if ((x * 7 + y * 13 + z * 5) % 17 === 0 && dist < radius - 3.5) {
              color = C.SEED_BLACK;
            }
          }
          list.push({ x, y, z, color });
        }
      }
    }
  }
  return list;
}

function createBurger(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const R = 8;

  for (let y = -7; y <= 8; y++) {
    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist > R) continue;

        let color = 0;
        if (y <= -5) {
          // Bottom bun
          if (dist <= R - 0.5) color = C.BUN_TOP;
        } else if (y === -4 || y === -3) {
          // Patty
          if (dist <= R + 0.5) color = C.BURGER_MEAT;
        } else if (y === -2) {
          // Cheese
          if (Math.abs(x) <= R + 0.5 && Math.abs(z) <= R + 0.5) color = C.BURGER_CHEESE;
        } else if (y === -1 || y === 0) {
          // Tomato
          if (dist <= R - 1) color = C.BURGER_TOMATO;
        } else if (y === 1) {
          // Lettuce
          if (dist <= R + (Math.sin(x * 3) + Math.cos(z * 3) > 0 ? 1 : 0)) color = C.BURGER_LETTUCE;
        } else if (y >= 2) {
          // Top bun dome
          const topDomeRadius = Math.sqrt(Math.max(0, (6 * 6) - Math.pow(y - 2, 2)));
          if (dist <= topDomeRadius * 1.3) {
            color = C.BUN_TOP;
            // Sesame seeds on top
            if (y >= 5 && (x * 3 + z * 5) % 7 === 0) color = C.SPRINKLE_WHITE;
          }
        }

        if (color !== 0) {
          list.push({ x, y: y + 7, z, color });
        }
      }
    }
  }
  return list;
}

function createRubberDuck(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  // Body (ellipsoid)
  for (let x = -5; x <= 5; x++) {
    for (let y = -4; y <= 3; y++) {
      for (let z = -7; z <= 5; z++) {
        const d = (x * x) / 25 + (y * y) / 16 + (z * z) / 49;
        if (d <= 1.0) {
          list.push({ x, y: y + 4, z, color: C.DUCK_YELLOW });
        }
      }
    }
  }
  // Head
  for (let x = -3; x <= 3; x++) {
    for (let y = 3; y <= 9; y++) {
      for (let z = 1; z <= 7; z++) {
        const d = (x * x) / 9 + ((y - 6) * (y - 6)) / 9 + ((z - 4) * (z - 4)) / 9;
        if (d <= 1.0) {
          let color = C.DUCK_YELLOW;
          // Eyes
          if (y === 6 && (x === -2 || x === 2) && z === 6) color = C.DUCK_EYE;
          list.push({ x, y: y + 4, z, color });
        }
      }
    }
  }
  // Beak
  for (let x = -2; x <= 2; x++) {
    for (let y = 4; y <= 5; y++) {
      for (let z = 7; z <= 10; z++) {
        list.push({ x, y: y + 4, z, color: C.DUCK_ORANGE });
      }
    }
  }
  // Wings
  for (let y = 0; y <= 2; y++) {
    for (let z = -4; z <= 2; z++) {
      list.push({ x: -6, y: y + 4, z, color: C.DUCK_YELLOW });
      list.push({ x: 6, y: y + 4, z, color: C.DUCK_YELLOW });
    }
  }
  return list;
}

function createGamepad(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -10; x <= 10; x++) {
    for (let z = -5; z <= 5; z++) {
      for (let y = -2; y <= 2; y++) {
        // Handle shapes
        const inLeftHandle = Math.sqrt(Math.pow(x + 7, 2) + Math.pow(z + 1, 2)) <= 4.5;
        const inRightHandle = Math.sqrt(Math.pow(x - 7, 2) + Math.pow(z + 1, 2)) <= 4.5;
        const inCenter = Math.abs(x) <= 6 && Math.abs(z) <= 3.5;

        if (inLeftHandle || inRightHandle || inCenter) {
          let color = C.GAMEPAD_BODY;
          // Top surfaces decoration
          if (y === 2) {
            // D-Pad on left
            if ((Math.abs(x + 5) <= 2 && Math.abs(z) <= 0.8) || (Math.abs(x + 5) <= 0.8 && Math.abs(z) <= 2)) {
              color = C.GAMEPAD_DPAD;
            }
            // Action buttons on right
            if (Math.abs(x - 5) <= 2 && Math.abs(z) <= 2 && (Math.abs(x - 5) === 1.5 || Math.abs(z) === 1.5)) {
              color = C.GAMEPAD_BTNS;
            }
          }
          list.push({ x, y: y + 2, z, color });
        }
      }
    }
  }
  return list;
}

function createRubikCube(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const s = 4; // Subcube size
  const gap = 1;

  const faces = [
    C.RUBIK_WHITE,  // +Y (top)
    C.RUBIK_YELLOW, // -Y (bottom)
    C.RUBIK_RED,    // +X (right)
    C.RUBIK_ORANGE, // -X (left)
    C.RUBIK_BLUE,   // +Z (front)
    C.RUBIK_GREEN   // -Z (back)
  ];

  for (let cx = -1; cx <= 1; cx++) {
    for (let cy = -1; cy <= 1; cy++) {
      for (let cz = -1; cz <= 1; cz++) {
        // Subcube bounds
        const minX = cx * (s + gap) - s / 2;
        const maxX = minX + s;
        const minY = cy * (s + gap) - s / 2;
        const maxY = minY + s;
        const minZ = cz * (s + gap) - s / 2;
        const maxZ = minZ + s;

        for (let x = minX; x < maxX; x++) {
          for (let y = minY; y < maxY; y++) {
            for (let z = minZ; z < maxZ; z++) {
              let color = C.RUBIK_BLACK;
              if (cy === 1 && y === maxY - 1) color = faces[0];
              else if (cy === -1 && y === minY) color = faces[1];
              else if (cx === 1 && x === maxX - 1) color = faces[2];
              else if (cx === -1 && x === minX) color = faces[3];
              else if (cz === 1 && z === maxZ - 1) color = faces[4];
              else if (cz === -1 && z === minZ) color = faces[5];

              list.push({ x: Math.round(x), y: Math.round(y + 8), z: Math.round(z), color });
            }
          }
        }
      }
    }
  }
  return list;
}

function createToyCar(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  // Body
  for (let x = -5; x <= 5; x++) {
    for (let z = -9; z <= 9; z++) {
      for (let y = 0; y <= 6; y++) {
        // Cabin
        const isCabin = y >= 3 && Math.abs(x) <= 4 && z >= -3 && z <= 4;
        const isHood = y <= 3 && Math.abs(x) <= 5;

        if (isCabin || isHood) {
          let color = C.CAR_BODY;
          if (isCabin && (Math.abs(x) === 4 || z === -3 || z === 4)) {
            color = C.CAR_GLASS;
          }
          // Headlights
          if (y === 2 && Math.abs(x) === 4 && z === 9) color = C.CAR_LIGHT;
          list.push({ x, y, z, color });
        }
      }
    }
  }
  // Wheels
  const wheelPositions = [
    [-6, 0, 5], [6, 0, 5],
    [-6, 0, -5], [6, 0, -5]
  ];
  wheelPositions.forEach(([wx, wy, wz]) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dy) + Math.abs(dz) <= 3) {
            list.push({ x: wx + dx, y: wy + dy, z: wz + dz, color: C.CAR_WHEEL });
          }
        }
      }
    }
  });
  return list;
}

function createSmartphone(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -6; x <= 6; x++) {
    for (let y = -11; y <= 11; y++) {
      for (let z = -1; z <= 1; z++) {
        let color = C.PHONE_BODY;
        // Front screen
        if (z === 1 && Math.abs(x) <= 5 && Math.abs(y) <= 9) {
          color = (Math.abs(x) + Math.abs(y)) % 2 === 0 ? C.PHONE_SCREEN : 0x00c6ff;
        }
        // Camera bump on back
        if (z === -1 && x <= -3 && y >= 7) {
          color = C.PHONE_CAMERA;
        }
        list.push({ x, y: y + 11, z, color });
      }
    }
  }
  return list;
}

function createCassette(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -10; x <= 10; x++) {
    for (let y = -6; y <= 6; y++) {
      for (let z = -2; z <= 2; z++) {
        let color = C.CASSETTE_PLASTIC;
        // Label
        if (Math.abs(z) === 2 && Math.abs(x) <= 8 && Math.abs(y) <= 4) {
          color = C.CASSETTE_LABEL;
        }
        // Reel holes
        const inReel1 = Math.sqrt(Math.pow(x + 4, 2) + y * y) <= 2;
        const inReel2 = Math.sqrt(Math.pow(x - 4, 2) + y * y) <= 2;
        if (inReel1 || inReel2) {
          if (Math.sqrt(Math.pow(x + 4, 2) + y * y) <= 0.8 || Math.sqrt(Math.pow(x - 4, 2) + y * y) <= 0.8) {
            continue; // Hole
          }
          color = C.CASSETTE_REEL;
        }
        list.push({ x, y: y + 6, z, color });
      }
    }
  }
  return list;
}

function createArcadeCabinet(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -6; x <= 6; x++) {
    for (let z = -6; z <= 6; z++) {
      for (let y = 0; y <= 18; y++) {
        let inCab = false;
        if (y <= 7) inCab = z >= -5 && z <= 5; // Base
        else if (y <= 13) inCab = z >= -5 && z <= 3; // Control deck & screen
        else inCab = z >= -5 && z <= 5; // Marquee top

        if (inCab) {
          let color = C.ARCADE_CABINET;
          // Screen
          if (y >= 8 && y <= 12 && z === 2 && Math.abs(x) <= 4) {
            color = C.ARCADE_SCREEN;
          }
          // Marquee
          if (y >= 15 && y <= 17 && z === 5 && Math.abs(x) <= 4) {
            color = C.ARCADE_MARQUEE;
          }
          list.push({ x, y, z, color });
        }
      }
    }
  }
  return list;
}

function createRobotHead(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -6; x <= 6; x++) {
    for (let y = -6; y <= 6; y++) {
      for (let z = -6; z <= 6; z++) {
        let color = C.ROBOT_METAL;
        // Eyes
        if (z === 6 && (Math.abs(x - 3) <= 1 || Math.abs(x + 3) <= 1) && Math.abs(y - 1) <= 1) {
          color = C.ROBOT_EYES;
        }
        // Mouth
        if (z === 6 && Math.abs(x) <= 3 && y === -3) {
          color = C.ROBOT_MOUTH;
        }
        list.push({ x, y: y + 6, z, color });
      }
    }
  }
  // Antenna
  for (let y = 7; y <= 11; y++) {
    list.push({ x: 0, y: y + 6, z: 0, color: C.ROBOT_EARS });
  }
  list.push({ x: 0, y: 12 + 6, z: 0, color: C.ROBOT_EYES });
  return list;
}

function createDiamond(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const maxR = 9;
  for (let y = -9; y <= 6; y++) {
    const r = y <= 0 ? (y + 9) * (maxR / 9) : maxR - (y * (maxR / 8));
    for (let x = -maxR; x <= maxR; x++) {
      for (let z = -maxR; z <= maxR; z++) {
        const dist = Math.abs(x) + Math.abs(z); // Octagonal / diamond facet
        if (dist <= r * 1.3) {
          let color = C.DIAMOND_CYAN;
          if (dist > r * 0.8) color = C.DIAMOND_LIGHT;
          else if (y < -3) color = C.DIAMOND_DEEP;
          list.push({ x, y: y + 9, z, color });
        }
      }
    }
  }
  return list;
}

function createCrown(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const R = 8;
  for (let y = 0; y <= 8; y++) {
    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist >= R - 1.5 && dist <= R + 0.5) {
          // Points
          const angle = Math.atan2(z, x);
          const spikes = Math.sin(angle * 5) * 3.5 + 4.5;
          if (y <= spikes) {
            let color = C.CROWN_GOLD;
            // Gem inlays
            if (y === 2 && (Math.round(angle * 5) % 2 === 0)) {
              color = (x + z) % 2 === 0 ? C.CROWN_RUBY : C.CROWN_EMERALD;
            }
            list.push({ x, y, z, color });
          }
        }
      }
    }
  }
  return list;
}

function createCastleTower(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y <= 16; y++) {
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        const dist = Math.sqrt(x * x + z * z);
        let valid = false;
        let color = (x + y + z) % 2 === 0 ? C.TOWER_STONE_DARK : C.TOWER_STONE_LIGHT;

        if (y <= 12 && dist <= 4.5) {
          valid = true;
          // Door
          if (y <= 4 && z === 4 && Math.abs(x) <= 1) color = C.TOWER_WOOD;
        } else if (y >= 13 && y <= 15 && dist <= 5.5) {
          // Battlements
          valid = (y <= 13) || ((Math.abs(x) === 5 || Math.abs(z) === 5) && (x + z) % 2 === 0);
        }

        if (valid) {
          list.push({ x, y, z, color });
        }
      }
    }
  }
  return list;
}

function createRocket(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y <= 18; y++) {
    const r = y >= 12 ? Math.max(0, 4 - (y - 12) * 0.8) : 4;
    for (let x = -6; x <= 6; x++) {
      for (let z = -6; z <= 6; z++) {
        const dist = Math.sqrt(x * x + z * z);
        let color = 0;

        if (dist <= r) {
          color = y >= 12 ? C.ROCKET_RED : C.ROCKET_WHITE;
          // Porthole window
          if (y === 9 && z >= 3 && Math.abs(x) <= 1) color = C.DIAMOND_CYAN;
        }
        // Rocket fins at base
        if (y <= 5 && ((Math.abs(x) >= 3 && Math.abs(x) <= 6 && Math.abs(z) <= 1) || (Math.abs(z) >= 3 && Math.abs(z) <= 6 && Math.abs(x) <= 1))) {
          color = C.ROCKET_FINS;
        }

        if (color !== 0) {
          list.push({ x, y, z, color });
        }
      }
    }
  }
  return list;
}

function createCrystalCluster(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -8; x <= 8; x++) {
    for (let y = 0; y <= 15; y++) {
      for (let z = -6; z <= 6; z++) {
        const crystalA = Math.abs(x) <= Math.max(1, 5 - Math.floor(y / 4)) && Math.abs(z) <= 2;
        const crystalB = Math.abs(x - 4) <= Math.max(1, 3 - Math.floor(y / 5)) && Math.abs(z + 2) <= 2 && y >= 3;
        if (crystalA || crystalB) {
          list.push({ x, y, z, color: y % 3 === 0 ? C.DIAMOND_LIGHT : C.DIAMOND_CYAN });
        }
      }
    }
  }
  return list;
}

function createGear(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -10; x <= 10; x++) {
    for (let y = 0; y <= 5; y++) {
      for (let z = -10; z <= 10; z++) {
        const radius = Math.sqrt(x * x + z * z);
        const tooth = Math.abs(x) > 8 || Math.abs(z) > 8;
        if ((radius <= 7 || (radius <= 10 && tooth)) && radius > 2.2) {
          list.push({ x, y, z, color: y === 5 ? C.CROWN_GOLD : C.TOWER_STONE_LIGHT });
        }
      }
    }
  }
  return list;
}

function createSatellite(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let y = 0; y <= 8; y++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.abs(x) <= 3 && Math.abs(z) <= 3) {
          list.push({ x, y, z, color: y === 8 ? C.PHONE_SCREEN : C.ROBOT_METAL });
        }
      }
    }
  }
  for (let x = -10; x <= 10; x++) {
    for (let y = 2; y <= 5; y++) {
      list.push({ x, y, z: 5, color: C.DIAMOND_CYAN });
      list.push({ x, y, z: -5, color: C.DIAMOND_CYAN });
    }
  }
  return list;
}

function createTemple(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y <= 15; y++) {
    const half = Math.max(2, 8 - Math.floor(y / 3));
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        if (Math.abs(x) === half || Math.abs(z) === half || y < 2) {
          list.push({ x, y, z, color: y >= 13 ? C.TOWER_ROOF : C.TOWER_STONE_LIGHT });
        }
      }
    }
  }
  return list;
}

// 20 rich voxel models grouped into 5 collections
export const COLLECTIONS_DATA: CollectionData[] = [
  {
    id: 'food_fruits',
    nameRu: 'Вкусняшки & Фрукты',
    nameEn: 'Food & Fruits',
    icon: '🍩',
    requiredCompletedCount: 0,
    models: [
      {
        id: 'donut',
        nameRu: 'Пончик с глазурью',
        nameEn: 'Glazed Donut',
        icon: '🍩',
        collectionId: 'food_fruits',
        gridSize: [24, 12, 24],
        voxels: createDonut(),
        baseVoxelValue: 1.0,
        hardness: 1.0
      },
      {
        id: 'apple',
        nameRu: 'Сочное Яблоко',
        nameEn: 'Juicy Apple',
        icon: '🍎',
        collectionId: 'food_fruits',
        gridSize: [20, 24, 20],
        voxels: createApple(),
        baseVoxelValue: 1.2,
        hardness: 1.1
      },
      {
        id: 'watermelon',
        nameRu: 'Долька Арбуза',
        nameEn: 'Watermelon Slice',
        icon: '🍉',
        collectionId: 'food_fruits',
        gridSize: [24, 14, 14],
        voxels: createWatermelon(),
        baseVoxelValue: 1.4,
        hardness: 1.15
      },
      {
        id: 'burger',
        nameRu: 'Двойной Бургер',
        nameEn: 'Double Burger',
        icon: '🍔',
        collectionId: 'food_fruits',
        gridSize: [20, 18, 20],
        voxels: createBurger(),
        baseVoxelValue: 1.6,
        hardness: 1.2
      }
    ]
  },
  {
    id: 'toys_retro',
    nameRu: 'Игрушки & Ретро',
    nameEn: 'Toys & Retro',
    icon: '🎮',
    requiredCompletedCount: 4,
    models: [
      {
        id: 'duck',
        nameRu: 'Резиновая Уточка',
        nameEn: 'Rubber Duck',
        icon: '🐥',
        collectionId: 'toys_retro',
        gridSize: [16, 18, 22],
        voxels: createRubberDuck(),
        baseVoxelValue: 2.0,
        hardness: 1.25
      },
      {
        id: 'gamepad',
        nameRu: 'Ретро-Геймпад',
        nameEn: 'Retro Gamepad',
        icon: '🎮',
        collectionId: 'toys_retro',
        gridSize: [24, 8, 14],
        voxels: createGamepad(),
        baseVoxelValue: 2.3,
        hardness: 1.3
      },
      {
        id: 'rubik',
        nameRu: 'Кубик Рубика',
        nameEn: 'Rubik Cube',
        icon: '🎲',
        collectionId: 'toys_retro',
        gridSize: [18, 18, 18],
        voxels: createRubikCube(),
        baseVoxelValue: 2.6,
        hardness: 1.4
      },
      {
        id: 'car',
        nameRu: 'Игрушечная Машинка',
        nameEn: 'Toy Car',
        icon: '🚗',
        collectionId: 'toys_retro',
        gridSize: [16, 12, 22],
        voxels: createToyCar(),
        baseVoxelValue: 3.0,
        hardness: 1.5
      }
    ]
  },
  {
    id: 'gadgets_tech',
    nameRu: 'Гаджеты & Техника',
    nameEn: 'Gadgets & Tech',
    icon: '📱',
    requiredCompletedCount: 8,
    models: [
      {
        id: 'phone',
        nameRu: 'Неоновый Смартфон',
        nameEn: 'Neon Smartphone',
        icon: '📱',
        collectionId: 'gadgets_tech',
        gridSize: [14, 26, 6],
        voxels: createSmartphone(),
        baseVoxelValue: 3.8,
        hardness: 1.6
      },
      {
        id: 'cassette',
        nameRu: 'Аудиокассета',
        nameEn: 'Audio Cassette',
        icon: '📼',
        collectionId: 'gadgets_tech',
        gridSize: [24, 16, 8],
        voxels: createCassette(),
        baseVoxelValue: 4.2,
        hardness: 1.7
      },
      {
        id: 'arcade',
        nameRu: 'Аркадный Автомат',
        nameEn: 'Arcade Cabinet',
        icon: '🕹️',
        collectionId: 'gadgets_tech',
        gridSize: [16, 22, 16],
        voxels: createArcadeCabinet(),
        baseVoxelValue: 4.8,
        hardness: 1.8
      },
      {
        id: 'robot',
        nameRu: 'Голова Робота',
        nameEn: 'Robot Head',
        icon: '🤖',
        collectionId: 'gadgets_tech',
        gridSize: [16, 22, 16],
        voxels: createRobotHead(),
        baseVoxelValue: 5.5,
        hardness: 1.9
      }
    ]
  },
  {
    id: 'treasures_art',
    nameRu: 'Сокровища & Здания',
    nameEn: 'Treasures & Art',
    icon: '💎',
    requiredCompletedCount: 12,
    models: [
      {
        id: 'diamond',
        nameRu: 'Алмазный Кристалл',
        nameEn: 'Diamond Crystal',
        icon: '💎',
        collectionId: 'treasures_art',
        gridSize: [20, 20, 20],
        voxels: createDiamond(),
        baseVoxelValue: 6.5,
        hardness: 2.0
      },
      {
        id: 'crown',
        nameRu: 'Золотая Корона',
        nameEn: 'Golden Crown',
        icon: '👑',
        collectionId: 'treasures_art',
        gridSize: [20, 14, 20],
        voxels: createCrown(),
        baseVoxelValue: 7.5,
        hardness: 2.1
      },
      {
        id: 'castle',
        nameRu: 'Замковая Башня',
        nameEn: 'Castle Tower',
        icon: '🏰',
        collectionId: 'treasures_art',
        gridSize: [14, 22, 14],
        voxels: createCastleTower(),
        baseVoxelValue: 8.5,
        hardness: 2.2
      },
      {
        id: 'rocket',
        nameRu: 'Космическая Ракета',
        nameEn: 'Space Rocket',
        icon: '🚀',
        collectionId: 'treasures_art',
        gridSize: [16, 24, 16],
        voxels: createRocket(),
        baseVoxelValue: 10.0,
        hardness: 2.4
      }
    ]
  },
  {
    id: 'industrial_extras',
    nameRu: 'Индустриальные испытания',
    nameEn: 'Industrial Trials',
    icon: '⚙️',
    requiredCompletedCount: 16,
    models: [
      {
        id: 'crystal_cluster',
        nameRu: 'Кристальный Кластер',
        nameEn: 'Crystal Cluster',
        icon: '🔷',
        collectionId: 'industrial_extras',
        gridSize: [18, 18, 14],
        voxels: createCrystalCluster(),
        baseVoxelValue: 11.5,
        hardness: 2.6
      },
      {
        id: 'steel_gear',
        nameRu: 'Стальной Механизм',
        nameEn: 'Steel Gear',
        icon: '⚙️',
        collectionId: 'industrial_extras',
        gridSize: [22, 8, 22],
        voxels: createGear(),
        baseVoxelValue: 13.0,
        hardness: 2.8
      },
      {
        id: 'satellite',
        nameRu: 'Орбитальный Спутник',
        nameEn: 'Orbital Satellite',
        icon: '🛰️',
        collectionId: 'industrial_extras',
        gridSize: [22, 10, 12],
        voxels: createSatellite(),
        baseVoxelValue: 15.0,
        hardness: 3.0
      },
      {
        id: 'temple',
        nameRu: 'Древний Храм',
        nameEn: 'Ancient Temple',
        icon: '🏛️',
        collectionId: 'industrial_extras',
        gridSize: [18, 18, 18],
        voxels: createTemple(),
        baseVoxelValue: 18.0,
        hardness: 3.2
      }
    ]
  }
];

export function getAllModels(): VoxelModelData[] {
  const list: VoxelModelData[] = [];
  COLLECTIONS_DATA.forEach((col) => {
    col.models.forEach((m) => list.push(m));
  });
  return list;
}

export function getModelById(id: string): VoxelModelData | undefined {
  return getAllModels().find((m) => m.id === id);
}
