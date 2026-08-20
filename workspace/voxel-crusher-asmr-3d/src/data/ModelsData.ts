import { CollectionData, VoxelCoord, VoxelModelData } from '../core/Types';

// Color Palette Constants
export const C = {
  // Food & Organic
  DONUT_DOUGH: 0xd4a373,
  DONUT_PINK: 0xff69b4,
  SPRINKLE_BLUE: 0x00d2d3,
  SPRINKLE_YELLOW: 0xffe66d,
  SPRINKLE_WHITE: 0xffffff,
  APPLE_RED: 0xe63946,
  APPLE_DARK: 0xc1121f,
  STEM_BROWN: 0x582f0e,
  LEAF_GREEN: 0x38b000,
  LEAF_DARK: 0x1b4332,
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
  ICE_CREAM_WHITE: 0xfff0f5,
  ICE_CREAM_PINK: 0xff85a1,
  CONE_WAFFLE: 0xddb892,
  PIZZA_CRUST: 0xd4a373,
  PIZZA_CHEESE: 0xffbe0b,
  PEPPERONI: 0x9e2a2b,
  BANANA_YELLOW: 0xffea00,
  BANANA_TIP: 0x582f0e,
  SAUSAGE_RED: 0xd00000,
  MUSTARD_YELLOW: 0xffba08,
  CAKE_CHOCO: 0x4a2810,
  CHEESE_GOLD: 0xffc300,
  CHEESE_HOLE: 0xe85d04,

  // Toys & Plastic
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
  TEDDY_BROWN: 0x9c6644,
  TEDDY_SNOUT: 0xddb892,
  TRAIN_RED: 0xd90429,
  TRAIN_BLACK: 0x212529,
  HORSE_WOOD: 0xb07d62,
  GUN_CYAN: 0x00f5d4,
  GUN_ORANGE: 0xff5400,
  YOYO_NEON: 0x7209b7,
  PYRAMID_VIOLET: 0x7b2cbf,

  // Tech & Cyber
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
  CYBER_PURPLE: 0x9d4edd,
  CYBER_BLUE: 0x48cae4,
  DRONE_DARK: 0x1b263b,
  CHIP_GREEN: 0x007f5f,

  // Minerals & Treasures
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
  ROCKET_FIRE: 0xffa200,
  GOLD_SHINE: 0xffe169,
  RUBY_BRIGHT: 0xff0054,
  EMERALD_BRIGHT: 0x52b788,
  SAPPHIRE_BLUE: 0x03045e,
  OBSIDIAN_PURPLE: 0x240046,

  // Nature & Elements
  FIRE_ORANGE: 0xff7b00,
  FIRE_YELLOW: 0xffea00,
  ICE_BLUE: 0xa2d2ff,
  LAVA_RED: 0xd00000,
  POISON_GREEN: 0x70e000,
  EARTH_BROWN: 0x6c584c,
  BONE_WHITE: 0xf8f9fa,
  SLIME_GREEN: 0x80b918,
  GHOST_AQUA: 0x80ffdb,
  VOID_DARK: 0x10002b
};

// Procedural Voxel Shape Builders
function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, color: number): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        list.push({ x, y, z, color });
      }
    }
  }
  return list;
}

function sphere(radius: number, color: number, yOffset = 0): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const rCeil = Math.ceil(radius);
  for (let x = -rCeil; x <= rCeil; x++) {
    for (let y = -rCeil; y <= rCeil; y++) {
      for (let z = -rCeil; z <= rCeil; z++) {
        if (x * x + y * y + z * z <= radius * radius) {
          list.push({ x, y: y + yOffset, z, color });
        }
      }
    }
  }
  return list;
}

function cylinder(radius: number, height: number, color: number, yOffset = 0): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const rCeil = Math.ceil(radius);
  for (let y = 0; y < height; y++) {
    for (let x = -rCeil; x <= rCeil; x++) {
      for (let z = -rCeil; z <= rCeil; z++) {
        if (x * x + z * z <= radius * radius) {
          list.push({ x, y: y + yOffset, z, color });
        }
      }
    }
  }
  return list;
}

function torus(majorR: number, minorR: number, color: number, yOffset = 0): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const maxSpan = Math.ceil(majorR + minorR);
  const hSpan = Math.ceil(minorR);
  for (let x = -maxSpan; x <= maxSpan; x++) {
    for (let z = -maxSpan; z <= maxSpan; z++) {
      for (let y = -hSpan; y <= hSpan; y++) {
        const d = Math.sqrt(x * x + z * z);
        const tubeDist = Math.sqrt(Math.pow(d - majorR, 2) + y * y);
        if (tubeDist <= minorR) {
          list.push({ x, y: y + yOffset, z, color });
        }
      }
    }
  }
  return list;
}

function pyramid(baseHalf: number, height: number, color: number, yOffset = 0): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y < height; y++) {
    const half = Math.max(0, Math.round(baseHalf * (1 - y / height)));
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        list.push({ x, y: y + yOffset, z, color });
      }
    }
  }
  return list;
}

// -------------------------------------------------------------
// Level Creators (100 Unique Levels)
// -------------------------------------------------------------

// Collection 1: Food & Fruits (Levels 1 - 10)
function createDonut(): VoxelCoord[] {
  const list = torus(6.5, 2.8, C.DONUT_DOUGH, 4);
  list.forEach((v) => {
    if (v.y >= 4) {
      v.color = C.DONUT_PINK;
      if ((v.x * 13 + v.z * 19) % 7 === 0) v.color = C.SPRINKLE_YELLOW;
      else if ((v.x * 7 + v.z * 11) % 5 === 0) v.color = C.SPRINKLE_BLUE;
    }
  });
  return list;
}

function createApple(): VoxelCoord[] {
  const list = sphere(6.5, C.APPLE_RED, 7);
  list.push(...cylinder(0.6, 4, C.STEM_BROWN, 13));
  list.push(...box(1, 3, 14, 15, 0, 1, C.LEAF_GREEN));
  return list;
}

function createWatermelon(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -8; x <= 8; x++) {
    for (let y = 0; y <= 9; y++) {
      for (let z = -4; z <= 4; z++) {
        const dist = Math.sqrt(x * x + y * y);
        if (dist <= 8.5 && y >= Math.abs(x) * 0.45) {
          let col = C.MELON_RED;
          if (dist >= 7.8) col = C.MELON_GREEN_DARK;
          else if (dist >= 6.8) col = C.MELON_WHITE;
          else if ((x * 5 + y * 7 + z * 3) % 13 === 0) col = C.SEED_BLACK;
          list.push({ x, y, z, color: col });
        }
      }
    }
  }
  return list;
}

function createBurger(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...cylinder(6.5, 2, C.BUN_TOP, 0));
  list.push(...cylinder(7.0, 2, C.BURGER_MEAT, 2));
  list.push(...box(-6, 6, 4, 4, -6, 6, C.BURGER_CHEESE));
  list.push(...cylinder(6.0, 1, C.BURGER_TOMATO, 5));
  list.push(...cylinder(6.8, 1, C.BURGER_LETTUCE, 6));
  list.push(...cylinder(6.5, 3, C.BUN_TOP, 7));
  list.push(...cylinder(5.0, 2, C.BUN_TOP, 10));
  return list;
}

function createIceCream(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  // Cone
  for (let y = 0; y <= 8; y++) {
    const r = (y / 8) * 4.5;
    list.push(...cylinder(r, 1, C.CONE_WAFFLE, y));
  }
  // Scoops
  list.push(...sphere(4.8, C.ICE_CREAM_PINK, 11));
  list.push(...sphere(3.5, C.ICE_CREAM_WHITE, 15));
  list.push({ x: 0, y: 19, z: 0, color: C.CROWN_RUBY });
  return list;
}

function createPizza(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -8; x <= 8; x++) {
    for (let z = 0; z <= 12; z++) {
      if (Math.abs(x) <= (12 - z) * 0.7) {
        let col = C.PIZZA_CHEESE;
        if (z <= 2) col = C.PIZZA_CRUST;
        else if ((x * 7 + z * 11) % 9 === 0) col = C.PEPPERONI;
        list.push({ x, y: 0, z, color: col });
        list.push({ x, y: 1, z, color: col });
      }
    }
  }
  return list;
}

function createBanana(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y <= 14; y++) {
    const curveX = Math.sin((y / 14) * Math.PI) * 4;
    const r = Math.sin((y / 14) * Math.PI) * 2.2 + 0.8;
    const col = y === 0 || y === 14 ? C.BANANA_TIP : C.BANANA_YELLOW;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (dx * dx + dz * dz <= r * r) {
          list.push({ x: Math.round(curveX + dx), y, z: dz, color: col });
        }
      }
    }
  }
  return list;
}

function createHotDog(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...cylinder(3.0, 14, C.SAUSAGE_RED, 0)); // Sausage
  list.push(...box(-4, -2, 0, 13, -3, 3, C.BUN_TOP)); // Bun Left
  list.push(...box(2, 4, 0, 13, -3, 3, C.BUN_TOP)); // Bun Right
  // Mustard zigzag
  for (let y = 1; y <= 12; y++) {
    const x = Math.sin(y * 1.5) * 1.2;
    list.push({ x: Math.round(x), y, z: 3, color: C.MUSTARD_YELLOW });
  }
  return list;
}

function createCupcake(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y <= 5; y++) {
    const r = 3.5 + (y / 5) * 1.5;
    list.push(...cylinder(r, 1, C.CAKE_CHOCO, y));
  }
  list.push(...sphere(4.8, C.DONUT_PINK, 8));
  list.push(...sphere(2.5, C.SPRINKLE_WHITE, 12));
  list.push({ x: 0, y: 15, z: 0, color: C.APPLE_RED }); // Cherry
  return list;
}

function createCheese(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let y = 0; y <= 6; y++) {
    for (let x = -7; x <= 7; x++) {
      for (let z = 0; z <= 10; z++) {
        if (Math.abs(x) <= (10 - z) * 0.7) {
          const isHole = (x * 7 + y * 13 + z * 5) % 11 === 0 && z > 2;
          if (!isHole) {
            list.push({ x, y, z, color: C.CHEESE_GOLD });
          }
        }
      }
    }
  }
  return list;
}

// Collection 2: Toys & Retro (Levels 11 - 20)
function createRubberDuck(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...sphere(5, C.DUCK_YELLOW, 5)); // Body
  list.push(...sphere(3.5, C.DUCK_YELLOW, 10)); // Head
  list.push(...box(-1, 1, 9, 10, 3, 5, C.DUCK_ORANGE)); // Beak
  list.push({ x: -2, y: 11, z: 2, color: C.DUCK_EYE });
  list.push({ x: 2, y: 11, z: 2, color: C.DUCK_EYE });
  return list;
}

function createGamepad(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...box(-7, 7, 0, 4, -4, 4, C.GAMEPAD_BODY));
  list.push(...cylinder(3, 4, C.GAMEPAD_HANDLES, 0));
  // DPad
  list.push(...box(-5, -3, 4, 5, -1, 1, C.GAMEPAD_DPAD));
  list.push(...box(-4, -4, 4, 5, -2, 2, C.GAMEPAD_DPAD));
  // Action buttons
  list.push({ x: 4, y: 5, z: 1, color: C.GAMEPAD_BTNS });
  list.push({ x: 5, y: 5, z: 0, color: C.GAMEPAD_BTNS });
  list.push({ x: 3, y: 5, z: 0, color: C.GAMEPAD_BTNS });
  list.push({ x: 4, y: 5, z: -1, color: C.GAMEPAD_BTNS });
  return list;
}

function createRubikCube(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -4; x <= 4; x++) {
    for (let y = 0; y <= 8; y++) {
      for (let z = -4; z <= 4; z++) {
        let col = C.RUBIK_BLACK;
        if (y === 8) col = C.RUBIK_WHITE;
        else if (y === 0) col = C.RUBIK_YELLOW;
        else if (x === 4) col = C.RUBIK_RED;
        else if (x === -4) col = C.RUBIK_ORANGE;
        else if (z === 4) col = C.RUBIK_BLUE;
        else if (z === -4) col = C.RUBIK_GREEN;
        list.push({ x, y, z, color: col });
      }
    }
  }
  return list;
}

function createToyCar(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...box(-4, 4, 2, 5, -7, 7, C.CAR_BODY)); // Chassis
  list.push(...box(-3, 3, 5, 8, -3, 3, C.CAR_GLASS)); // Cabin
  // 4 Wheels
  list.push(...cylinder(2, 2, C.CAR_WHEEL, 0));
  list.forEach((v) => (v.x < 0 ? (v.x -= 4) : (v.x += 4)));
  return list;
}

function createTeddyBear(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...sphere(5, C.TEDDY_BROWN, 6)); // Body
  list.push(...sphere(4, C.TEDDY_BROWN, 13)); // Head
  list.push(...sphere(1.5, C.TEDDY_BROWN, 17)); // Ear 1
  list.push(...sphere(1.5, C.TEDDY_BROWN, 17)); // Ear 2
  list.push(...sphere(1.8, C.TEDDY_SNOUT, 12)); // Snout
  return list;
}

function createToyTrain(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...box(-4, 4, 2, 6, -8, 6, C.TRAIN_RED)); // Base
  list.push(...cylinder(3, 8, C.TRAIN_BLACK, 6)); // Boiler
  list.push(...box(-4, 4, 6, 12, -8, -2, C.TRAIN_RED)); // Cabin
  list.push(...cylinder(1.5, 4, C.TRAIN_BLACK, 11)); // Chimney
  return list;
}

function createRockingHorse(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...box(-2, 2, 4, 8, -5, 5, C.HORSE_WOOD)); // Body
  list.push(...box(-2, 2, 8, 14, 3, 6, C.HORSE_WOOD)); // Neck
  list.push(...box(-2, 2, 12, 15, 5, 8, C.HORSE_WOOD)); // Head
  list.push(...cylinder(1, 12, C.HORSE_WOOD, 0)); // Rocker
  return list;
}

function createWaterGun(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...box(-2, 2, 4, 7, -6, 8, C.GUN_CYAN)); // Barrel
  list.push(...box(-2, 2, 0, 5, -5, -2, C.GUN_ORANGE)); // Grip
  list.push(...cylinder(2.5, 6, C.GUN_ORANGE, 7)); // Tank
  return list;
}

function createYoYo(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...cylinder(5, 2, C.YOYO_NEON, 0));
  list.push(...cylinder(2, 2, C.CYBER_PURPLE, 2));
  list.push(...cylinder(5, 2, C.YOYO_NEON, 4));
  return list;
}

function createToyPyramid(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  const colors = [C.RUBIK_RED, C.RUBIK_ORANGE, C.RUBIK_YELLOW, C.RUBIK_GREEN, C.RUBIK_BLUE, C.PYRAMID_VIOLET];
  for (let i = 0; i < colors.length; i++) {
    const r = 6 - i * 0.9;
    list.push(...cylinder(r, 2, colors[i], i * 2));
  }
  return list;
}

// Collection 3: Gadgets & Tech (Levels 21 - 30)
function createSmartphone(): VoxelCoord[] {
  const list = box(-5, 5, 0, 18, -1, 1, C.PHONE_BODY);
  list.forEach((v) => {
    if (v.z === 1 && Math.abs(v.x) <= 4 && v.y >= 2 && v.y <= 16) {
      v.color = C.PHONE_SCREEN;
    }
  });
  return list;
}

function createCassette(): VoxelCoord[] {
  const list = box(-8, 8, 0, 10, -2, 2, C.CASSETTE_PLASTIC);
  list.forEach((v) => {
    if (Math.abs(v.x) <= 6 && v.y >= 2 && v.y <= 8 && Math.abs(v.z) === 2) {
      v.color = C.CASSETTE_LABEL;
    }
  });
  return list;
}

function createArcadeCabinet(): VoxelCoord[] {
  const list = box(-5, 5, 0, 16, -5, 5, C.ARCADE_CABINET);
  list.forEach((v) => {
    if (v.y >= 8 && v.y <= 12 && v.z === 5 && Math.abs(v.x) <= 4) v.color = C.ARCADE_SCREEN;
    if (v.y >= 14 && v.z === 5) v.color = C.ARCADE_MARQUEE;
  });
  return list;
}

function createRobotHead(): VoxelCoord[] {
  const list = box(-5, 5, 0, 10, -5, 5, C.ROBOT_METAL);
  list.push(...cylinder(1, 4, C.ROBOT_EARS, 10)); // Antenna
  list.push({ x: 0, y: 15, z: 0, color: C.ROBOT_EYES });
  list.forEach((v) => {
    if (v.z === 5 && (v.x === -2 || v.x === 2) && (v.y === 6 || v.y === 7)) v.color = C.ROBOT_EYES;
    if (v.z === 5 && Math.abs(v.x) <= 2 && v.y === 2) v.color = C.ROBOT_MOUTH;
  });
  return list;
}

function createHeadphones(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...torus(6, 1.2, C.PHONE_BODY, 8)); // Arc
  list.push(...cylinder(3, 3, C.CYBER_PURPLE, 3)); // Left Ear
  list.push(...cylinder(3, 3, C.CYBER_PURPLE, 3)); // Right Ear
  list.forEach((v, i) => {
    if (i < 50) v.x -= 6;
    else if (i < 100) v.x += 6;
  });
  return list;
}

function createRetroCamera(): VoxelCoord[] {
  const list = box(-6, 6, 0, 8, -3, 3, C.CASSETTE_PLASTIC);
  list.push(...cylinder(3, 3, C.TOWER_STONE_LIGHT, 2));
  list.push(...box(3, 5, 8, 9, -1, 1, C.CROWN_RUBY)); // Shutter
  return list;
}

function createHandheldConsole(): VoxelCoord[] {
  const list = box(-6, 6, 0, 14, -2, 2, C.GAMEPAD_BODY);
  list.forEach((v) => {
    if (v.y >= 7 && v.y <= 12 && Math.abs(v.x) <= 4 && v.z === 2) v.color = C.PHONE_SCREEN;
  });
  return list;
}

function createGamingMouse(): VoxelCoord[] {
  const list = sphere(5, C.PHONE_BODY, 4);
  list.forEach((v) => {
    if (v.y > 5 && v.x === 0) v.color = C.GUN_CYAN;
  });
  return list;
}

function createCyberDrone(): VoxelCoord[] {
  const list = box(-3, 3, 2, 5, -3, 3, C.DRONE_DARK);
  // 4 Rotors
  const rotorCoords = [
    [-6, 6],
    [6, 6],
    [-6, -6],
    [6, -6]
  ];
  rotorCoords.forEach(([rx, rz]) => {
    list.push(...cylinder(2.5, 1, C.GUN_CYAN, 4));
    list.push({ x: rx, y: 4, z: rz, color: C.ROBOT_METAL });
  });
  return list;
}

function createFloppyDisk(): VoxelCoord[] {
  const list = box(-6, 6, 0, 12, -1, 1, C.GAMEPAD_DPAD);
  list.push(...box(-4, 4, 1, 6, 1, 2, C.SPRINKLE_WHITE)); // Label
  list.push(...box(-3, 3, 8, 12, 1, 2, C.TOWER_STONE_LIGHT)); // Metal shutter
  return list;
}

// Collection 4: Treasures & Relics (Levels 31 - 40)
function createDiamond(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...pyramid(6, 6, C.DIAMOND_CYAN, 0));
  list.push(...pyramid(6, 6, C.DIAMOND_LIGHT, 6));
  list.forEach((v) => {
    if (v.y >= 6) v.y = 12 - (v.y - 6);
  });
  return list;
}

function createCrown(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...cylinder(6, 3, C.CROWN_GOLD, 0));
  // 5 Spikes
  for (let a = 0; a < 5; a++) {
    const angle = (a / 5) * Math.PI * 2;
    const sx = Math.round(Math.cos(angle) * 5.5);
    const sz = Math.round(Math.sin(angle) * 5.5);
    list.push(...box(sx - 1, sx + 1, 3, 7, sz - 1, sz + 1, C.CROWN_GOLD));
    list.push({ x: sx, y: 8, z: sz, color: a % 2 === 0 ? C.CROWN_RUBY : C.CROWN_EMERALD });
  }
  return list;
}

function createCastleTower(): VoxelCoord[] {
  const list = cylinder(5, 12, C.TOWER_STONE_LIGHT, 0);
  list.push(...cylinder(6, 3, C.TOWER_STONE_DARK, 12));
  list.push(...pyramid(5, 6, C.TOWER_ROOF, 15));
  return list;
}

function createSpaceRocket(): VoxelCoord[] {
  const list = cylinder(4, 12, C.ROCKET_WHITE, 2);
  list.push(...pyramid(4, 6, C.ROCKET_RED, 14));
  // Fins
  list.push(...box(-7, 7, 0, 4, -1, 1, C.ROCKET_FINS));
  list.push(...box(-1, 1, 0, 4, -7, 7, C.ROCKET_FINS));
  return list;
}

function createPirateChest(): VoxelCoord[] {
  const list = box(-6, 6, 0, 6, -4, 4, C.STEM_BROWN);
  list.push(...cylinder(4, 12, C.STEM_BROWN, 6));
  list.push(...box(-1, 1, 2, 5, 4, 5, C.CROWN_GOLD)); // Lock
  return list;
}

function createHolyGrail(): VoxelCoord[] {
  const list = cylinder(4, 2, C.CROWN_GOLD, 0); // Base
  list.push(...cylinder(1.5, 5, C.CROWN_GOLD, 2)); // Stem
  list.push(...sphere(4.5, C.CROWN_GOLD, 9)); // Bowl
  return list;
}

function createMagicRing(): VoxelCoord[] {
  const list = torus(5, 1.8, C.CROWN_GOLD, 4);
  list.push(...sphere(2.2, C.CROWN_RUBY, 9));
  return list;
}

function createRubyGem(): VoxelCoord[] {
  const list = sphere(6, C.RUBY_BRIGHT, 6);
  return list;
}

function createGoldBar(): VoxelCoord[] {
  const list = box(-6, 6, 0, 4, -3, 3, C.CROWN_GOLD);
  list.push(...box(-5, 5, 4, 6, -2, 2, C.GOLD_SHINE));
  return list;
}

function createEmeraldAmulet(): VoxelCoord[] {
  const list = cylinder(5, 2, C.CROWN_GOLD, 0);
  list.push(...cylinder(3.5, 3, C.CROWN_EMERALD, 1));
  return list;
}

// Collection 5: Weapons & Artifacts (Levels 41 - 50)
function createKnightSword(): VoxelCoord[] {
  const list = box(-1, 1, 0, 4, -1, 1, C.STEM_BROWN); // Hilt
  list.push(...box(-5, 5, 4, 6, -1, 1, C.CROWN_GOLD)); // Guard
  list.push(...box(-2, 2, 6, 20, 0, 0, C.TOWER_STONE_LIGHT)); // Blade
  return list;
}

function createBattleAxe(): VoxelCoord[] {
  const list = cylinder(1, 16, C.STEM_BROWN, 0); // Shaft
  list.push(...box(-6, 6, 10, 14, -1, 1, C.TOWER_STONE_DARK)); // Axe blade
  return list;
}

function createMagicStaff(): VoxelCoord[] {
  const list = cylinder(1, 16, C.STEM_BROWN, 0);
  list.push(...sphere(3.5, C.GUN_CYAN, 17)); // Orb
  return list;
}

function createSteelHelmet(): VoxelCoord[] {
  const list = sphere(5.5, C.TOWER_STONE_LIGHT, 5);
  list.push(...box(-4, 4, 3, 5, 4, 6, C.CROWN_GOLD)); // Visor
  return list;
}

function createTowerShield(): VoxelCoord[] {
  const list = box(-5, 5, 0, 14, -1, 1, C.GAMEPAD_BODY);
  list.push(...box(-1, 1, 2, 12, 1, 2, C.CROWN_GOLD)); // Cross
  list.push(...box(-4, 4, 6, 8, 1, 2, C.CROWN_GOLD));
  return list;
}

function createThorHammer(): VoxelCoord[] {
  const list = cylinder(1.2, 10, C.STEM_BROWN, 0);
  list.push(...box(-6, 6, 8, 14, -4, 4, C.TOWER_STONE_DARK));
  return list;
}

function createShadowDagger(): VoxelCoord[] {
  const list = box(-1, 1, 0, 3, -1, 1, C.VOID_DARK);
  list.push(...box(-3, 3, 3, 4, -1, 1, C.CYBER_PURPLE));
  list.push(...box(-1, 1, 4, 14, 0, 0, C.DIAMOND_CYAN));
  return list;
}

function createGoldenTrident(): VoxelCoord[] {
  const list = cylinder(1, 14, C.CROWN_GOLD, 0);
  list.push(...box(-4, 4, 12, 13, 0, 0, C.CROWN_GOLD));
  list.push(...box(-4, -4, 13, 18, 0, 0, C.CROWN_GOLD));
  list.push(...box(4, 4, 13, 18, 0, 0, C.CROWN_GOLD));
  list.push(...box(0, 0, 13, 19, 0, 0, C.CROWN_GOLD));
  return list;
}

function createAlchemyFlask(): VoxelCoord[] {
  const list = sphere(5, C.POISON_GREEN, 5);
  list.push(...cylinder(2, 6, C.SPRINKLE_WHITE, 9));
  list.push(...cylinder(2.5, 1, C.STEM_BROWN, 15)); // Cork
  return list;
}

function createSpellScroll(): VoxelCoord[] {
  const list = cylinder(3, 12, C.DONUT_DOUGH, 0);
  list.push(...box(-4, 4, 4, 8, 0, 3, C.CROWN_GOLD));
  return list;
}

// Collection 6: Flora & Nature (Levels 51 - 60)
function createPottedCactus(): VoxelCoord[] {
  const list = cylinder(4, 4, C.BURGER_MEAT, 0); // Pot
  list.push(...cylinder(2.5, 10, C.LEAF_GREEN, 4)); // Cactus trunk
  list.push(...box(-4, -2, 7, 10, 0, 0, C.LEAF_GREEN)); // Arm L
  list.push(...box(2, 4, 8, 11, 0, 0, C.LEAF_GREEN)); // Arm R
  return list;
}

function createFlyAgaric(): VoxelCoord[] {
  const list = cylinder(2.5, 7, C.SPRINKLE_WHITE, 0); // Stem
  list.push(...sphere(6, C.APPLE_RED, 8)); // Cap
  list.forEach((v) => {
    if (v.y >= 8 && (v.x * 5 + v.z * 7) % 6 === 0) v.color = C.SPRINKLE_WHITE;
  });
  return list;
}

function createSunflower(): VoxelCoord[] {
  const list = cylinder(1, 12, C.LEAF_GREEN, 0);
  list.push(...cylinder(3.5, 2, C.STEM_BROWN, 12));
  list.push(...torus(5.5, 1.5, C.BANANA_YELLOW, 12));
  return list;
}

function createScarletRose(): VoxelCoord[] {
  const list = cylinder(1, 10, C.LEAF_DARK, 0);
  list.push(...sphere(4.5, C.APPLE_DARK, 12));
  return list;
}

function createTropicalPalm(): VoxelCoord[] {
  const list = cylinder(1.8, 14, C.STEM_BROWN, 0);
  list.push(...box(-6, 6, 13, 15, -6, 6, C.LEAF_GREEN));
  list.push(...sphere(2.5, C.BURGER_MEAT, 12)); // Coconuts
  return list;
}

function createPineTree(): VoxelCoord[] {
  const list = cylinder(2, 4, C.STEM_BROWN, 0);
  list.push(...pyramid(6, 5, C.LEAF_DARK, 4));
  list.push(...pyramid(4.5, 4, C.LEAF_DARK, 8));
  list.push(...pyramid(3, 4, C.LEAF_DARK, 12));
  return list;
}

function createLuckyClover(): VoxelCoord[] {
  const list = cylinder(1, 8, C.LEAF_GREEN, 0);
  const petals = [
    [-3, 0],
    [3, 0],
    [0, -3],
    [0, 3]
  ];
  petals.forEach(([px, pz]) => {
    list.push(...sphere(2.2, C.LEAF_GREEN, 8));
    list.forEach((v, i) => {
      if (i >= list.length - 20) {
        v.x += px;
        v.z += pz;
      }
    });
  });
  return list;
}

function createMountainGeode(): VoxelCoord[] {
  const list = sphere(6, C.TOWER_STONE_DARK, 6);
  list.forEach((v) => {
    if (v.z > 0) v.color = C.DIAMOND_CYAN;
  });
  return list;
}

function createGlowingShroom(): VoxelCoord[] {
  const list = cylinder(2, 6, C.CYBER_BLUE, 0);
  list.push(...sphere(5, C.GUN_CYAN, 7));
  return list;
}

function createFireFlower(): VoxelCoord[] {
  const list = cylinder(1, 8, C.LEAF_GREEN, 0);
  list.push(...sphere(4, C.FIRE_ORANGE, 10));
  list.push(...sphere(2, C.FIRE_YELLOW, 10));
  return list;
}

// Collection 7: Vehicles & Transport (Levels 61 - 70)
function createRaceCar(): VoxelCoord[] {
  const list = box(-5, 5, 1, 4, -8, 8, C.APPLE_RED);
  list.push(...box(-3, 3, 4, 6, -2, 3, C.CAR_GLASS));
  list.push(...box(-6, 6, 5, 6, -8, -7, C.GAMEPAD_DPAD)); // Spoiler
  return list;
}

function createHelicopter(): VoxelCoord[] {
  const list = sphere(5, C.DRONE_DARK, 6);
  list.push(...cylinder(1, 8, C.DRONE_DARK, 6)); // Tail
  list.push(...cylinder(7, 1, C.TOWER_STONE_LIGHT, 11)); // Rotor
  return list;
}

function createMotorBoat(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let z = -8; z <= 8; z++) {
    const w = Math.max(1, 5 - Math.max(0, z - 3) * 0.8);
    list.push(...box(-w, w, 0, 4, z, z, C.CAR_BODY));
  }
  return list;
}

function createSubmarine(): VoxelCoord[] {
  const list = cylinder(4, 16, C.BANANA_YELLOW, 0);
  list.push(...cylinder(2, 5, C.BANANA_YELLOW, 8)); // Tower
  list.push(...box(0, 0, 12, 15, 2, 4, C.TOWER_STONE_DARK)); // Periscope
  return list;
}

function createSportBike(): VoxelCoord[] {
  const list = box(-1, 1, 2, 6, -6, 6, C.GUN_CYAN);
  list.push(...cylinder(2.5, 2, C.CAR_WHEEL, 0)); // Rear
  list.push(...cylinder(2.5, 2, C.CAR_WHEEL, 0)); // Front
  list.forEach((v, i) => {
    if (i < 30) v.z -= 5;
    else if (i < 60) v.z += 5;
  });
  return list;
}

function createTractor(): VoxelCoord[] {
  const list = box(-4, 4, 3, 8, -5, 4, C.LEAF_GREEN);
  list.push(...cylinder(3.5, 2, C.CAR_WHEEL, 0)); // Rear Big Wheels
  return list;
}

function createBulldozer(): VoxelCoord[] {
  const list = box(-5, 5, 2, 8, -5, 5, C.CHEESE_GOLD);
  list.push(...box(-6, 6, 0, 5, 6, 8, C.TOWER_STONE_DARK)); // Blade
  return list;
}

function createHotAirBalloon(): VoxelCoord[] {
  const list = sphere(7, C.APPLE_RED, 12);
  list.push(...box(-2, 2, 0, 3, -2, 2, C.STEM_BROWN)); // Basket
  return list;
}

function createSkateboard(): VoxelCoord[] {
  const list = box(-3, 3, 2, 3, -8, 8, C.CYBER_PURPLE);
  list.push(...cylinder(1.2, 1, C.GUN_CYAN, 0));
  return list;
}

function createMoonRover(): VoxelCoord[] {
  const list = box(-4, 4, 3, 7, -4, 4, C.SPRINKLE_WHITE);
  list.push(...sphere(2.5, C.CROWN_GOLD, 8)); // Dish
  return list;
}

// Collection 8: Monsters & Characters (Levels 71 - 80)
function createVoxelZombie(): VoxelCoord[] {
  const list = box(-3, 3, 0, 6, -2, 2, C.GAMEPAD_BODY); // Legs
  list.push(...box(-4, 4, 6, 12, -2, 2, C.CYBER_BLUE)); // Torso
  list.push(...box(-3, 3, 12, 17, -3, 3, C.LEAF_GREEN)); // Head
  list.push(...box(-2, 2, 8, 10, 2, 7, C.LEAF_GREEN)); // Arms forward
  return list;
}

function createFireDragon(): VoxelCoord[] {
  const list = box(-5, 5, 0, 8, -6, 6, C.APPLE_DARK);
  list.push(...box(-4, 4, 2, 6, 6, 10, C.APPLE_RED)); // Snout
  list.push(...cylinder(1, 4, C.CROWN_GOLD, 8)); // Horn L
  list.push(...cylinder(1, 4, C.CROWN_GOLD, 8)); // Horn R
  return list;
}

function createCyberSkull(): VoxelCoord[] {
  const list = sphere(6, C.BONE_WHITE, 6);
  list.push(...box(-3, 3, 0, 3, 2, 4, C.BONE_WHITE)); // Teeth
  list.forEach((v) => {
    if (v.z === 5 && (v.x === -2 || v.x === 2) && (v.y === 5 || v.y === 6)) v.color = C.GUN_CYAN;
  });
  return list;
}

function createSlimeBlob(): VoxelCoord[] {
  const list = sphere(6, C.SLIME_GREEN, 5);
  list.push({ x: -2, y: 6, z: 5, color: C.SEED_BLACK });
  list.push({ x: 2, y: 6, z: 5, color: C.SEED_BLACK });
  return list;
}

function createPumpkinJack(): VoxelCoord[] {
  const list = sphere(6.5, C.DUCK_ORANGE, 6);
  list.push(...cylinder(1, 3, C.LEAF_DARK, 12));
  list.forEach((v) => {
    if (v.z === 6 && (Math.abs(v.x) === 2) && v.y === 7) v.color = C.FIRE_YELLOW;
    if (v.z === 6 && Math.abs(v.x) <= 3 && v.y === 4) v.color = C.FIRE_YELLOW;
  });
  return list;
}

function createSecurityBot(): VoxelCoord[] {
  const list = cylinder(4, 8, C.ROBOT_METAL, 2);
  list.push(...sphere(3, C.DRONE_DARK, 11));
  list.push({ x: 0, y: 11, z: 3, color: C.APPLE_RED }); // Eye
  return list;
}

function createMysticGhost(): VoxelCoord[] {
  const list = sphere(5.5, C.GHOST_AQUA, 7);
  list.push(...cylinder(5, 4, C.GHOST_AQUA, 0));
  list.push({ x: -2, y: 8, z: 5, color: C.VOID_DARK });
  list.push({ x: 2, y: 8, z: 5, color: C.VOID_DARK });
  return list;
}

function createAlienInvader(): VoxelCoord[] {
  const list = sphere(6, C.POISON_GREEN, 7);
  list.push(...sphere(2.5, C.SEED_BLACK, 8)); // Big eye L
  list.push(...sphere(2.5, C.SEED_BLACK, 8)); // Big eye R
  return list;
}

function createPharaohMask(): VoxelCoord[] {
  const list = box(-5, 5, 0, 14, -3, 3, C.CROWN_GOLD);
  list.forEach((v) => {
    if (Math.abs(v.x) >= 4 && v.y % 2 === 0) v.color = C.SAPPHIRE_BLUE;
  });
  return list;
}

function createAncientGolem(): VoxelCoord[] {
  const list = box(-6, 6, 0, 12, -4, 4, C.TOWER_STONE_DARK);
  list.push(...sphere(4, C.TOWER_STONE_LIGHT, 13));
  list.push({ x: 0, y: 13, z: 4, color: C.GUN_CYAN }); // Glowing core
  return list;
}

// Collection 9: Space & Science (Levels 81 - 90)
function createSatellite(): VoxelCoord[] {
  const list = box(-3, 3, 2, 8, -3, 3, C.ROBOT_METAL);
  list.push(...box(-9, 9, 4, 6, 0, 0, C.DIAMOND_CYAN)); // Solar wings
  list.push(...cylinder(1, 4, C.CROWN_GOLD, 8)); // Antenna
  return list;
}

function createSaturnPlanet(): VoxelCoord[] {
  const list = sphere(5, C.BANANA_YELLOW, 6);
  list.push(...torus(8.5, 1.2, C.CHEESE_GOLD, 6)); // Rings
  return list;
}

function createAtomCore(): VoxelCoord[] {
  const list = sphere(3.5, C.APPLE_RED, 6);
  list.push(...torus(7, 0.8, C.GUN_CYAN, 6));
  list.push(...torus(7, 0.8, C.GUN_CYAN, 6));
  return list;
}

function createLaserBlaster(): VoxelCoord[] {
  const list = box(-2, 2, 0, 5, -4, 0, C.DRONE_DARK);
  list.push(...cylinder(2, 10, C.GUN_CYAN, 5));
  list.push(...sphere(2.5, C.FIRE_ORANGE, 14));
  return list;
}

function createAstronautHelmet(): VoxelCoord[] {
  const list = sphere(6, C.SPRINKLE_WHITE, 6);
  list.push(...sphere(4, C.CROWN_GOLD, 6)); // Visor
  return list;
}

function createOreMeteorite(): VoxelCoord[] {
  const list = sphere(6, C.TOWER_STONE_DARK, 6);
  list.forEach((v) => {
    if ((v.x * 11 + v.y * 7 + v.z * 13) % 9 === 0) v.color = C.DIAMOND_CYAN;
  });
  return list;
}

function createTelescope(): VoxelCoord[] {
  const list = cylinder(1, 8, C.TOWER_STONE_LIGHT, 0); // Tripod
  list.push(...cylinder(2.5, 12, C.DRONE_DARK, 8)); // Tube
  list.push(...cylinder(3, 2, C.DIAMOND_CYAN, 19)); // Lens
  return list;
}

function createWarpGenerator(): VoxelCoord[] {
  const list = cylinder(5, 12, C.ROBOT_METAL, 0);
  list.forEach((v) => {
    if (v.y >= 3 && v.y <= 9 && (v.x * v.x + v.z * v.z <= 12)) v.color = C.CYBER_PURPLE;
  });
  return list;
}

function createQuantumCube(): VoxelCoord[] {
  const list = box(-5, 5, 0, 10, -5, 5, C.VOID_DARK);
  list.forEach((v) => {
    if (Math.abs(v.x) === 5 || v.y === 0 || v.y === 10 || Math.abs(v.z) === 5) {
      if ((v.x + v.y + v.z) % 2 === 0) v.color = C.DIAMOND_CYAN;
    }
  });
  return list;
}

function createBlackHole(): VoxelCoord[] {
  const list = sphere(3.5, C.VOID_DARK, 6);
  list.push(...torus(8, 1.5, C.FIRE_ORANGE, 6));
  return list;
}

// Collection 10: Industrial & Mega Structures (Levels 91 - 100)
function createSteelGear(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  for (let x = -9; x <= 9; x++) {
    for (let z = -9; z <= 9; z++) {
      for (let y = 0; y <= 4; y++) {
        const r = Math.sqrt(x * x + z * z);
        const tooth = Math.abs(x) > 7 || Math.abs(z) > 7;
        if ((r <= 6.5 || (r <= 9 && tooth)) && r > 2) {
          list.push({ x, y, z, color: y === 4 ? C.CROWN_GOLD : C.TOWER_STONE_DARK });
        }
      }
    }
  }
  return list;
}

function createCrystalCluster(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...cylinder(5, 3, C.TOWER_STONE_DARK, 0));
  const crystalSpikes = [
    [0, 0, 12, C.DIAMOND_CYAN],
    [-3, 2, 9, C.CYBER_PURPLE],
    [3, -2, 10, C.DIAMOND_DEEP],
    [2, 3, 8, C.GUN_CYAN]
  ];
  crystalSpikes.forEach(([cx, cz, ch, col]) => {
    list.push(...pyramid(2.5, ch, col, 3));
    list.forEach((v, i) => {
      if (i >= list.length - 30) {
        v.x += cx;
        v.z += cz;
      }
    });
  });
  return list;
}

function createAncientTemple(): VoxelCoord[] {
  const list: VoxelCoord[] = [];
  list.push(...box(-7, 7, 0, 2, -7, 7, C.TOWER_STONE_LIGHT)); // Base
  // Columns
  const cols = [
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5]
  ];
  cols.forEach(([cx, cz]) => {
    list.push(...cylinder(1.2, 8, C.TOWER_STONE_LIGHT, 2));
    list.forEach((v, i) => {
      if (i >= list.length - 20) {
        v.x += cx;
        v.z += cz;
      }
    });
  });
  list.push(...pyramid(7, 4, C.TOWER_ROOF, 10)); // Roof
  return list;
}

function createEiffelTower(): VoxelCoord[] {
  const list = pyramid(7, 6, C.TOWER_STONE_DARK, 0);
  list.push(...pyramid(4.5, 6, C.TOWER_STONE_DARK, 6));
  list.push(...cylinder(1, 7, C.CROWN_GOLD, 12));
  return list;
}

function createOilDerrick(): VoxelCoord[] {
  const list = pyramid(6, 14, C.TOWER_STONE_DARK, 0);
  list.forEach((v) => {
    if (v.y % 3 !== 0 && Math.abs(v.x) < 4 && Math.abs(v.z) < 4) v.color = C.VOID_DARK;
  });
  return list;
}

function createWindTurbine(): VoxelCoord[] {
  const list = cylinder(1.5, 14, C.SPRINKLE_WHITE, 0);
  list.push(...cylinder(7, 1, C.SPRINKLE_WHITE, 14)); // Blades
  return list;
}

function createNuclearReactor(): VoxelCoord[] {
  const list = cylinder(6, 10, C.TOWER_STONE_LIGHT, 0);
  list.push(...cylinder(5, 3, C.CHEESE_GOLD, 10));
  return list;
}

function createHydraulicPress(): VoxelCoord[] {
  const list = box(-6, 6, 0, 3, -4, 4, C.TOWER_STONE_DARK); // Base
  list.push(...cylinder(1.5, 12, C.ROBOT_METAL, 3)); // Piston L
  list.push(...cylinder(1.5, 12, C.ROBOT_METAL, 3)); // Piston R
  list.push(...box(-6, 6, 12, 16, -4, 4, C.TOWER_STONE_DARK)); // Head
  return list;
}

function createOrbitalStation(): VoxelCoord[] {
  const list = torus(8, 2, C.ROBOT_METAL, 5); // Main ring
  list.push(...sphere(3.5, C.GUN_CYAN, 5)); // Core
  list.push(...cylinder(1, 16, C.SPRINKLE_WHITE, 0)); // Spoke
  return list;
}

function createVoxelTitan(): VoxelCoord[] {
  const list = box(-5, 5, 0, 6, -3, 3, C.VOID_DARK); // Legs
  list.push(...box(-7, 7, 6, 14, -4, 4, C.CROWN_GOLD)); // Armor
  list.push(...sphere(4.5, C.DIAMOND_CYAN, 16)); // Crown Core
  list.push(...box(-2, 2, 10, 12, 4, 6, C.RUBY_BRIGHT)); // Heart
  return list;
}

// -------------------------------------------------------------
// 100 Levels mapped into 10 Collections (10 levels each)
// -------------------------------------------------------------

export const COLLECTIONS_DATA: CollectionData[] = [
  {
    id: 'food_fruits',
    nameRu: 'Вкусняшки & Десерты',
    nameEn: 'Food & Desserts',
    icon: '🍩',
    requiredCompletedCount: 0,
    models: [
      { id: 'lvl_1_donut', nameRu: '1. Пончик с глазурью', nameEn: '1. Glazed Donut', icon: '🍩', collectionId: 'food_fruits', gridSize: [24, 12, 24], voxels: createDonut(), baseVoxelValue: 1.0, hardness: 1.0 },
      { id: 'lvl_2_apple', nameRu: '2. Сочное Яблоко', nameEn: '2. Juicy Apple', icon: '🍎', collectionId: 'food_fruits', gridSize: [20, 24, 20], voxels: createApple(), baseVoxelValue: 1.2, hardness: 1.05 },
      { id: 'lvl_3_watermelon', nameRu: '3. Долька Арбуза', nameEn: '3. Watermelon Slice', icon: '🍉', collectionId: 'food_fruits', gridSize: [24, 14, 14], voxels: createWatermelon(), baseVoxelValue: 1.4, hardness: 1.1 },
      { id: 'lvl_4_burger', nameRu: '4. Двойной Бургер', nameEn: '4. Double Burger', icon: '🍔', collectionId: 'food_fruits', gridSize: [20, 18, 20], voxels: createBurger(), baseVoxelValue: 1.6, hardness: 1.15 },
      { id: 'lvl_5_icecream', nameRu: '5. Мягкое Мороженое', nameEn: '5. Soft Ice Cream', icon: '🍦', collectionId: 'food_fruits', gridSize: [18, 22, 18], voxels: createIceCream(), baseVoxelValue: 1.8, hardness: 1.2 },
      { id: 'lvl_6_pizza', nameRu: '6. Пицца Пепперони', nameEn: '6. Pepperoni Pizza', icon: '🍕', collectionId: 'food_fruits', gridSize: [20, 6, 20], voxels: createPizza(), baseVoxelValue: 2.0, hardness: 1.25 },
      { id: 'lvl_7_banana', nameRu: '7. Спелый Банан', nameEn: '7. Ripe Banana', icon: '🍌', collectionId: 'food_fruits', gridSize: [16, 20, 16], voxels: createBanana(), baseVoxelValue: 2.2, hardness: 1.3 },
      { id: 'lvl_8_hotdog', nameRu: '8. Горячий Хот-дог', nameEn: '8. Hot Dog', icon: '🌭', collectionId: 'food_fruits', gridSize: [16, 20, 16], voxels: createHotDog(), baseVoxelValue: 2.4, hardness: 1.35 },
      { id: 'lvl_9_cupcake', nameRu: '9. Шоколадный Кекс', nameEn: '9. Chocolate Cupcake', icon: '🧁', collectionId: 'food_fruits', gridSize: [18, 20, 18], voxels: createCupcake(), baseVoxelValue: 2.6, hardness: 1.4 },
      { id: 'lvl_10_cheese', nameRu: '10. Золотой Сыр', nameEn: '10. Golden Cheese', icon: '🧀', collectionId: 'food_fruits', gridSize: [20, 12, 20], voxels: createCheese(), baseVoxelValue: 3.0, hardness: 1.45 }
    ]
  },
  {
    id: 'toys_retro',
    nameRu: 'Игрушки & Ретро',
    nameEn: 'Toys & Retro',
    icon: '🎮',
    requiredCompletedCount: 10,
    models: [
      { id: 'lvl_11_duck', nameRu: '11. Резиновая Уточка', nameEn: '11. Rubber Duck', icon: '🐥', collectionId: 'toys_retro', gridSize: [16, 18, 22], voxels: createRubberDuck(), baseVoxelValue: 3.3, hardness: 1.5 },
      { id: 'lvl_12_gamepad', nameRu: '12. Ретро-Геймпад', nameEn: '12. Retro Gamepad', icon: '🎮', collectionId: 'toys_retro', gridSize: [24, 8, 14], voxels: createGamepad(), baseVoxelValue: 3.6, hardness: 1.55 },
      { id: 'lvl_13_rubik', nameRu: '13. Кубик Рубика', nameEn: '13. Rubik Cube', icon: '🎲', collectionId: 'toys_retro', gridSize: [18, 18, 18], voxels: createRubikCube(), baseVoxelValue: 4.0, hardness: 1.6 },
      { id: 'lvl_14_car', nameRu: '14. Игрушечная Машинка', nameEn: '14. Toy Car', icon: '🚗', collectionId: 'toys_retro', gridSize: [16, 12, 22], voxels: createToyCar(), baseVoxelValue: 4.4, hardness: 1.65 },
      { id: 'lvl_15_teddy', nameRu: '15. Плюшевый Мишка', nameEn: '15. Teddy Bear', icon: '🧸', collectionId: 'toys_retro', gridSize: [18, 22, 18], voxels: createTeddyBear(), baseVoxelValue: 4.8, hardness: 1.7 },
      { id: 'lvl_16_train', nameRu: '16. Игрушечный Паровоз', nameEn: '16. Toy Train', icon: '🚂', collectionId: 'toys_retro', gridSize: [16, 18, 24], voxels: createToyTrain(), baseVoxelValue: 5.2, hardness: 1.75 },
      { id: 'lvl_17_horse', nameRu: '17. Деревянная Лошадка', nameEn: '17. Rocking Horse', icon: '🎠', collectionId: 'toys_retro', gridSize: [16, 20, 20], voxels: createRockingHorse(), baseVoxelValue: 5.6, hardness: 1.8 },
      { id: 'lvl_18_watergun', nameRu: '18. Водный Пистолет', nameEn: '18. Water Gun', icon: '🔫', collectionId: 'toys_retro', gridSize: [16, 14, 22], voxels: createWaterGun(), baseVoxelValue: 6.0, hardness: 1.85 },
      { id: 'lvl_19_yoyo', nameRu: '19. Неоновый Йо-йо', nameEn: '19. Neon Yo-Yo', icon: '🪀', collectionId: 'toys_retro', gridSize: [16, 12, 16], voxels: createYoYo(), baseVoxelValue: 6.5, hardness: 1.9 },
      { id: 'lvl_20_pyramid', nameRu: '20. Радужная Пирамидка', nameEn: '20. Rainbow Pyramid', icon: '🪆', collectionId: 'toys_retro', gridSize: [18, 20, 18], voxels: createToyPyramid(), baseVoxelValue: 7.0, hardness: 1.95 }
    ]
  },
  {
    id: 'gadgets_tech',
    nameRu: 'Гаджеты & Электроника',
    nameEn: 'Gadgets & Electronics',
    icon: '📱',
    requiredCompletedCount: 20,
    models: [
      { id: 'lvl_21_phone', nameRu: '21. Неоновый Смартфон', nameEn: '21. Neon Smartphone', icon: '📱', collectionId: 'gadgets_tech', gridSize: [14, 26, 6], voxels: createSmartphone(), baseVoxelValue: 7.5, hardness: 2.0 },
      { id: 'lvl_22_cassette', nameRu: '22. Аудиокассета', nameEn: '22. Audio Cassette', icon: '📼', collectionId: 'gadgets_tech', gridSize: [24, 16, 8], voxels: createCassette(), baseVoxelValue: 8.0, hardness: 2.05 },
      { id: 'lvl_23_arcade', nameRu: '23. Аркадный Автомат', nameEn: '23. Arcade Cabinet', icon: '🕹️', collectionId: 'gadgets_tech', gridSize: [16, 22, 16], voxels: createArcadeCabinet(), baseVoxelValue: 8.5, hardness: 2.1 },
      { id: 'lvl_24_robot', nameRu: '24. Голова Робота', nameEn: '24. Robot Head', icon: '🤖', collectionId: 'gadgets_tech', gridSize: [16, 22, 16], voxels: createRobotHead(), baseVoxelValue: 9.0, hardness: 2.15 },
      { id: 'lvl_25_headphones', nameRu: '25. DJ Наушники', nameEn: '25. DJ Headphones', icon: '🎧', collectionId: 'gadgets_tech', gridSize: [18, 18, 14], voxels: createHeadphones(), baseVoxelValue: 9.5, hardness: 2.2 },
      { id: 'lvl_26_camera', nameRu: '26. Ретро Фотоаппарат', nameEn: '26. Retro Camera', icon: '📷', collectionId: 'gadgets_tech', gridSize: [18, 14, 14], voxels: createRetroCamera(), baseVoxelValue: 10.0, hardness: 2.25 },
      { id: 'lvl_27_handheld', nameRu: '27. Карманная Консоль', nameEn: '27. Handheld Console', icon: '📟', collectionId: 'gadgets_tech', gridSize: [16, 20, 8], voxels: createHandheldConsole(), baseVoxelValue: 10.5, hardness: 2.3 },
      { id: 'lvl_28_mouse', nameRu: '28. Игровая Мышь', nameEn: '28. Gaming Mouse', icon: '🖱️', collectionId: 'gadgets_tech', gridSize: [14, 12, 18], voxels: createGamingMouse(), baseVoxelValue: 11.0, hardness: 2.35 },
      { id: 'lvl_29_drone', nameRu: '29. Кибер-Дрон', nameEn: '29. Cyber Drone', icon: '🛸', collectionId: 'gadgets_tech', gridSize: [20, 10, 20], voxels: createCyberDrone(), baseVoxelValue: 11.5, hardness: 2.4 },
      { id: 'lvl_30_floppy', nameRu: '30. Флоппи-Диск', nameEn: '30. Floppy Disk', icon: '💾', collectionId: 'gadgets_tech', gridSize: [18, 18, 6], voxels: createFloppyDisk(), baseVoxelValue: 12.0, hardness: 2.45 }
    ]
  },
  {
    id: 'treasures_relics',
    nameRu: 'Сокровища & Реликвии',
    nameEn: 'Treasures & Relics',
    icon: '💎',
    requiredCompletedCount: 30,
    models: [
      { id: 'lvl_31_diamond', nameRu: '31. Алмазный Кристалл', nameEn: '31. Diamond Crystal', icon: '💎', collectionId: 'treasures_relics', gridSize: [20, 20, 20], voxels: createDiamond(), baseVoxelValue: 13.0, hardness: 2.5 },
      { id: 'lvl_32_crown', nameRu: '32. Золотая Корона', nameEn: '32. Golden Crown', icon: '👑', collectionId: 'treasures_relics', gridSize: [20, 14, 20], voxels: createCrown(), baseVoxelValue: 14.0, hardness: 2.55 },
      { id: 'lvl_33_castle', nameRu: '33. Замковая Башня', nameEn: '33. Castle Tower', icon: '🏰', collectionId: 'treasures_relics', gridSize: [14, 22, 14], voxels: createCastleTower(), baseVoxelValue: 15.0, hardness: 2.6 },
      { id: 'lvl_34_rocket', nameRu: '34. Космическая Ракета', nameEn: '34. Space Rocket', icon: '🚀', collectionId: 'treasures_relics', gridSize: [16, 24, 16], voxels: createSpaceRocket(), baseVoxelValue: 16.0, hardness: 2.65 },
      { id: 'lvl_35_chest', nameRu: '35. Пиратский Сундук', nameEn: '35. Pirate Chest', icon: '🏴‍☠️', collectionId: 'treasures_relics', gridSize: [18, 14, 16], voxels: createPirateChest(), baseVoxelValue: 17.0, hardness: 2.7 },
      { id: 'lvl_36_grail', nameRu: '36. Священный Грааль', nameEn: '36. Holy Grail', icon: '🏆', collectionId: 'treasures_relics', gridSize: [16, 20, 16], voxels: createHolyGrail(), baseVoxelValue: 18.0, hardness: 2.75 },
      { id: 'lvl_37_ring', nameRu: '37. Магическое Кольцо', nameEn: '37. Magic Ring', icon: '💍', collectionId: 'treasures_relics', gridSize: [16, 16, 16], voxels: createMagicRing(), baseVoxelValue: 19.0, hardness: 2.8 },
      { id: 'lvl_38_rubygem', nameRu: '38. Рубиновый Октаэдр', nameEn: '38. Ruby Octahedron', icon: '🟥', collectionId: 'treasures_relics', gridSize: [16, 16, 16], voxels: createRubyGem(), baseVoxelValue: 20.0, hardness: 2.85 },
      { id: 'lvl_39_goldbar', nameRu: '39. Золотой Слиток', nameEn: '39. Gold Ingot', icon: '🧈', collectionId: 'treasures_relics', gridSize: [18, 10, 14], voxels: createGoldBar(), baseVoxelValue: 21.0, hardness: 2.9 },
      { id: 'lvl_40_amulet', nameRu: '40. Изумрудный Амулет', nameEn: '40. Emerald Amulet', icon: '🧿', collectionId: 'treasures_relics', gridSize: [16, 16, 8], voxels: createEmeraldAmulet(), baseVoxelValue: 22.0, hardness: 2.95 }
    ]
  },
  {
    id: 'weapons_artifacts',
    nameRu: 'Оружие & Артефакты',
    nameEn: 'Weapons & Artifacts',
    icon: '⚔️',
    requiredCompletedCount: 40,
    models: [
      { id: 'lvl_41_sword', nameRu: '41. Рыцарский Меч', nameEn: '41. Knight Sword', icon: '⚔️', collectionId: 'weapons_artifacts', gridSize: [16, 26, 6], voxels: createKnightSword(), baseVoxelValue: 23.0, hardness: 3.0 },
      { id: 'lvl_42_axe', nameRu: '42. Боевой Топор', nameEn: '42. Battle Axe', icon: '🪓', collectionId: 'weapons_artifacts', gridSize: [18, 22, 8], voxels: createBattleAxe(), baseVoxelValue: 24.0, hardness: 3.05 },
      { id: 'lvl_43_staff', nameRu: '43. Волшебный Посох', nameEn: '43. Magic Staff', icon: '🪄', collectionId: 'weapons_artifacts', gridSize: [14, 26, 14], voxels: createMagicStaff(), baseVoxelValue: 25.0, hardness: 3.1 },
      { id: 'lvl_44_helmet', nameRu: '44. Стальной Шлем', nameEn: '44. Steel Helmet', icon: '🪖', collectionId: 'weapons_artifacts', gridSize: [18, 18, 18], voxels: createSteelHelmet(), baseVoxelValue: 26.0, hardness: 3.15 },
      { id: 'lvl_45_shield', nameRu: '45. Рыцарский Щит', nameEn: '45. Knight Shield', icon: '🛡️', collectionId: 'weapons_artifacts', gridSize: [16, 20, 8], voxels: createTowerShield(), baseVoxelValue: 27.0, hardness: 3.2 },
      { id: 'lvl_46_hammer', nameRu: '46. Молот Тора', nameEn: '46. Thunder Hammer', icon: '🔨', collectionId: 'weapons_artifacts', gridSize: [18, 20, 16], voxels: createThorHammer(), baseVoxelValue: 28.0, hardness: 3.25 },
      { id: 'lvl_47_dagger', nameRu: '47. Кинжал Теней', nameEn: '47. Shadow Dagger', icon: '🗡️', collectionId: 'weapons_artifacts', gridSize: [14, 22, 6], voxels: createShadowDagger(), baseVoxelValue: 29.0, hardness: 3.3 },
      { id: 'lvl_48_trident', nameRu: '48. Золотой Трезубец', nameEn: '48. Golden Trident', icon: '🔱', collectionId: 'weapons_artifacts', gridSize: [16, 26, 6], voxels: createGoldenTrident(), baseVoxelValue: 30.0, hardness: 3.35 },
      { id: 'lvl_49_flask', nameRu: '49. Алхимическая Колба', nameEn: '49. Alchemy Flask', icon: '🧪', collectionId: 'weapons_artifacts', gridSize: [16, 22, 16], voxels: createAlchemyFlask(), baseVoxelValue: 32.0, hardness: 3.4 },
      { id: 'lvl_50_scroll', nameRu: '50. Свиток Заклинаний', nameEn: '50. Spell Scroll', icon: '📜', collectionId: 'weapons_artifacts', gridSize: [14, 18, 14], voxels: createSpellScroll(), baseVoxelValue: 34.0, hardness: 3.45 }
    ]
  },
  {
    id: 'flora_nature',
    nameRu: 'Флора & Природа',
    nameEn: 'Flora & Nature',
    icon: '🌻',
    requiredCompletedCount: 50,
    models: [
      { id: 'lvl_51_cactus', nameRu: '51. Кактус в Горшке', nameEn: '51. Potted Cactus', icon: '🌵', collectionId: 'flora_nature', gridSize: [16, 20, 16], voxels: createPottedCactus(), baseVoxelValue: 36.0, hardness: 3.5 },
      { id: 'lvl_52_mushroom', nameRu: '52. Лесной Мухомор', nameEn: '52. Forest Fly Agaric', icon: '🍄', collectionId: 'flora_nature', gridSize: [18, 18, 18], voxels: createFlyAgaric(), baseVoxelValue: 38.0, hardness: 3.55 },
      { id: 'lvl_53_sunflower', nameRu: '53. Подсолнух', nameEn: '53. Sunflower', icon: '🌻', collectionId: 'flora_nature', gridSize: [16, 22, 16], voxels: createSunflower(), baseVoxelValue: 40.0, hardness: 3.6 },
      { id: 'lvl_54_rose', nameRu: '54. Алая Роза', nameEn: '54. Scarlet Rose', icon: '🌹', collectionId: 'flora_nature', gridSize: [16, 20, 16], voxels: createScarletRose(), baseVoxelValue: 42.0, hardness: 3.65 },
      { id: 'lvl_55_palm', nameRu: '55. Тропическая Пальма', nameEn: '55. Tropical Palm', icon: '🌴', collectionId: 'flora_nature', gridSize: [18, 22, 18], voxels: createTropicalPalm(), baseVoxelValue: 44.0, hardness: 3.7 },
      { id: 'lvl_56_pinetree', nameRu: '56. Хвойная Ель', nameEn: '56. Pine Tree', icon: '🌲', collectionId: 'flora_nature', gridSize: [18, 22, 18], voxels: createPineTree(), baseVoxelValue: 46.0, hardness: 3.75 },
      { id: 'lvl_57_clover', nameRu: '57. Клевер Удачи', nameEn: '57. Lucky Clover', icon: '🍀', collectionId: 'flora_nature', gridSize: [16, 18, 16], voxels: createLuckyClover(), baseVoxelValue: 48.0, hardness: 3.8 },
      { id: 'lvl_58_geode', nameRu: '58. Горная Жеода', nameEn: '58. Mountain Geode', icon: '🪨', collectionId: 'flora_nature', gridSize: [18, 18, 18], voxels: createMountainGeode(), baseVoxelValue: 50.0, hardness: 3.85 },
      { id: 'lvl_59_shroom', nameRu: '59. Светящийся Гриб', nameEn: '59. Glowing Shroom', icon: '🪸', collectionId: 'flora_nature', gridSize: [16, 18, 16], voxels: createGlowingShroom(), baseVoxelValue: 52.0, hardness: 3.9 },
      { id: 'lvl_60_fireflower', nameRu: '60. Огненный Цветок', nameEn: '60. Fire Flower', icon: '🪷', collectionId: 'flora_nature', gridSize: [16, 18, 16], voxels: createFireFlower(), baseVoxelValue: 55.0, hardness: 3.95 }
    ]
  },
  {
    id: 'vehicles_transport',
    nameRu: 'Транспорт & Техника',
    nameEn: 'Vehicles & Machinery',
    icon: '🏎️',
    requiredCompletedCount: 60,
    models: [
      { id: 'lvl_61_racecar', nameRu: '61. Гоночный Болид', nameEn: '61. Racing Bolide', icon: '🏎️', collectionId: 'vehicles_transport', gridSize: [16, 12, 24], voxels: createRaceCar(), baseVoxelValue: 58.0, hardness: 4.0 },
      { id: 'lvl_62_heli', nameRu: '62. Вертолёт Апач', nameEn: '62. Attack Helicopter', icon: '🚁', collectionId: 'vehicles_transport', gridSize: [20, 18, 24], voxels: createHelicopter(), baseVoxelValue: 60.0, hardness: 4.05 },
      { id: 'lvl_63_boat', nameRu: '63. Моторный Катер', nameEn: '63. Speed Motorboat', icon: '🚤', collectionId: 'vehicles_transport', gridSize: [16, 12, 24], voxels: createMotorBoat(), baseVoxelValue: 62.0, hardness: 4.1 },
      { id: 'lvl_64_submarine', nameRu: '64. Жёлтая Субмарина', nameEn: '64. Yellow Submarine', icon: '🤿', collectionId: 'vehicles_transport', gridSize: [16, 18, 26], voxels: createSubmarine(), baseVoxelValue: 64.0, hardness: 4.15 },
      { id: 'lvl_65_sportbike', nameRu: '65. Спортбайк Неон', nameEn: '65. Neon Sport Bike', icon: '🏍️', collectionId: 'vehicles_transport', gridSize: [14, 16, 22], voxels: createSportBike(), baseVoxelValue: 66.0, hardness: 4.2 },
      { id: 'lvl_66_tractor', nameRu: '66. Полевой Трактор', nameEn: '66. Field Tractor', icon: '🚜', collectionId: 'vehicles_transport', gridSize: [16, 18, 20], voxels: createTractor(), baseVoxelValue: 68.0, hardness: 4.25 },
      { id: 'lvl_67_bulldozer', nameRu: '67. Тяжёлый Бульдозер', nameEn: '67. Heavy Bulldozer', icon: '🚧', collectionId: 'vehicles_transport', gridSize: [18, 18, 22], voxels: createBulldozer(), baseVoxelValue: 70.0, hardness: 4.3 },
      { id: 'lvl_68_balloon', nameRu: '68. Воздушный Шар', nameEn: '68. Hot Air Balloon', icon: '🎈', collectionId: 'vehicles_transport', gridSize: [20, 26, 20], voxels: createHotAirBalloon(), baseVoxelValue: 72.0, hardness: 4.35 },
      { id: 'lvl_69_skateboard', nameRu: '69. Неоновый Скейт', nameEn: '69. Neon Skateboard', icon: '🛹', collectionId: 'vehicles_transport', gridSize: [14, 8, 24], voxels: createSkateboard(), baseVoxelValue: 74.0, hardness: 4.4 },
      { id: 'lvl_70_moonrover', nameRu: '70. Луноход Аполлон', nameEn: '70. Moon Rover', icon: '🌕', collectionId: 'vehicles_transport', gridSize: [18, 18, 20], voxels: createMoonRover(), baseVoxelValue: 76.0, hardness: 4.45 }
    ]
  },
  {
    id: 'monsters_characters',
    nameRu: 'Монстры & Персонажи',
    nameEn: 'Monsters & Characters',
    icon: '👾',
    requiredCompletedCount: 70,
    models: [
      { id: 'lvl_71_zombie', nameRu: '71. Воксельный Зомби', nameEn: '71. Voxel Zombie', icon: '🧟', collectionId: 'monsters_characters', gridSize: [16, 24, 16], voxels: createVoxelZombie(), baseVoxelValue: 80.0, hardness: 4.5 },
      { id: 'lvl_72_dragon', nameRu: '72. Голова Дракона', nameEn: '72. Fire Dragon Head', icon: '🐲', collectionId: 'monsters_characters', gridSize: [18, 20, 22], voxels: createFireDragon(), baseVoxelValue: 82.0, hardness: 4.55 },
      { id: 'lvl_73_skull', nameRu: '73. Кибер-Череп', nameEn: '73. Cyber Skull', icon: '💀', collectionId: 'monsters_characters', gridSize: [18, 20, 18], voxels: createCyberSkull(), baseVoxelValue: 84.0, hardness: 4.6 },
      { id: 'lvl_74_slime', nameRu: '74. Желейный Слайм', nameEn: '74. Jelly Slime', icon: '🟢', collectionId: 'monsters_characters', gridSize: [18, 16, 18], voxels: createSlimeBlob(), baseVoxelValue: 86.0, hardness: 4.65 },
      { id: 'lvl_75_pumpkin', nameRu: '75. Тыквоголовый Джек', nameEn: '75. Pumpkin Jack', icon: '🎃', collectionId: 'monsters_characters', gridSize: [18, 20, 18], voxels: createPumpkinJack(), baseVoxelValue: 88.0, hardness: 4.7 },
      { id: 'lvl_76_droid', nameRu: '76. Боевой Дроид', nameEn: '76. Combat Droid', icon: '🦿', collectionId: 'monsters_characters', gridSize: [16, 22, 16], voxels: createSecurityBot(), baseVoxelValue: 90.0, hardness: 4.75 },
      { id: 'lvl_77_ghost', nameRu: '77. Призрак Эфира', nameEn: '77. Astral Ghost', icon: '👻', collectionId: 'monsters_characters', gridSize: [18, 20, 18], voxels: createMysticGhost(), baseVoxelValue: 92.0, hardness: 4.8 },
      { id: 'lvl_78_alien', nameRu: '78. Космический Пришелец', nameEn: '78. Space Invader', icon: '👾', collectionId: 'monsters_characters', gridSize: [18, 22, 18], voxels: createAlienInvader(), baseVoxelValue: 94.0, hardness: 4.85 },
      { id: 'lvl_79_pharaoh', nameRu: '79. Маска Фараона', nameEn: '79. Pharaoh Mask', icon: '🪦', collectionId: 'monsters_characters', gridSize: [18, 22, 16], voxels: createPharaohMask(), baseVoxelValue: 96.0, hardness: 4.9 },
      { id: 'lvl_80_golem', nameRu: '80. Каменный Голем', nameEn: '80. Stone Golem', icon: '🗿', collectionId: 'monsters_characters', gridSize: [20, 24, 18], voxels: createAncientGolem(), baseVoxelValue: 100.0, hardness: 5.0 }
    ]
  },
  {
    id: 'space_science',
    nameRu: 'Космос & Наука',
    nameEn: 'Space & Science',
    icon: '🛰️',
    requiredCompletedCount: 80,
    models: [
      { id: 'lvl_81_satellite', nameRu: '81. Орбитальный Спутник', nameEn: '81. Orbital Satellite', icon: '🛰️', collectionId: 'space_science', gridSize: [24, 16, 16], voxels: createSatellite(), baseVoxelValue: 105.0, hardness: 5.05 },
      { id: 'lvl_82_saturn', nameRu: '82. Планета Сатурн', nameEn: '82. Ringed Saturn', icon: '🪐', collectionId: 'space_science', gridSize: [24, 18, 24], voxels: createSaturnPlanet(), baseVoxelValue: 110.0, hardness: 5.1 },
      { id: 'lvl_83_atom', nameRu: '83. Ядро Атома', nameEn: '83. Atom Core', icon: '⚛️', collectionId: 'space_science', gridSize: [20, 20, 20], voxels: createAtomCore(), baseVoxelValue: 115.0, hardness: 5.15 },
      { id: 'lvl_84_laser', nameRu: '84. Плазменный Бластер', nameEn: '84. Plasma Blaster', icon: '🔫', collectionId: 'space_science', gridSize: [16, 18, 24], voxels: createLaserBlaster(), baseVoxelValue: 120.0, hardness: 5.2 },
      { id: 'lvl_85_astronaut', nameRu: '85. Шлем Астронавта', nameEn: '85. Astronaut Helmet', icon: '🧑‍🚀', collectionId: 'space_science', gridSize: [18, 20, 18], voxels: createAstronautHelmet(), baseVoxelValue: 125.0, hardness: 5.25 },
      { id: 'lvl_86_meteorite', nameRu: '86. Метеорит с Рудой', nameEn: '86. Ore Meteorite', icon: '☄️', collectionId: 'space_science', gridSize: [18, 18, 18], voxels: createOreMeteorite(), baseVoxelValue: 130.0, hardness: 5.3 },
      { id: 'lvl_87_telescope', nameRu: '87. Оптический Телескоп', nameEn: '87. Space Telescope', icon: '🔭', collectionId: 'space_science', gridSize: [18, 26, 18], voxels: createTelescope(), baseVoxelValue: 135.0, hardness: 5.35 },
      { id: 'lvl_88_warp', nameRu: '88. Варп-Генератор', nameEn: '88. Warp Core', icon: '⚡', collectionId: 'space_science', gridSize: [18, 22, 18], voxels: createWarpGenerator(), baseVoxelValue: 140.0, hardness: 5.4 },
      { id: 'lvl_89_quantum', nameRu: '89. Квантовый Тессеракт', nameEn: '89. Quantum Tesseract', icon: '🧊', collectionId: 'space_science', gridSize: [18, 18, 18], voxels: createQuantumCube(), baseVoxelValue: 145.0, hardness: 5.45 },
      { id: 'lvl_90_blackhole', nameRu: '90. Гравитационный Диск', nameEn: '90. Gravitational Disk', icon: '🕳️', collectionId: 'space_science', gridSize: [22, 18, 22], voxels: createBlackHole(), baseVoxelValue: 150.0, hardness: 5.5 }
    ]
  },
  {
    id: 'industrial_megastructures',
    nameRu: 'Индустрия & Мега-Сооружения',
    nameEn: 'Industrial & Megastructures',
    icon: '⚙️',
    requiredCompletedCount: 90,
    models: [
      { id: 'lvl_91_gear', nameRu: '91. Стальной Механизм', nameEn: '91. Steel Gear', icon: '⚙️', collectionId: 'industrial_megastructures', gridSize: [24, 10, 24], voxels: createSteelGear(), baseVoxelValue: 160.0, hardness: 5.6 },
      { id: 'lvl_92_crystals', nameRu: '92. Кристальный Кластер', nameEn: '92. Crystal Cluster', icon: '🔷', collectionId: 'industrial_megastructures', gridSize: [20, 24, 20], voxels: createCrystalCluster(), baseVoxelValue: 170.0, hardness: 5.7 },
      { id: 'lvl_93_temple', nameRu: '93. Древний Храм', nameEn: '93. Ancient Temple', icon: '🏛️', collectionId: 'industrial_megastructures', gridSize: [22, 22, 22], voxels: createAncientTemple(), baseVoxelValue: 180.0, hardness: 5.8 },
      { id: 'lvl_94_eiffel', nameRu: '94. Эйфелева Башня', nameEn: '94. Eiffel Tower', icon: '🗼', collectionId: 'industrial_megastructures', gridSize: [20, 28, 20], voxels: createEiffelTower(), baseVoxelValue: 190.0, hardness: 5.9 },
      { id: 'lvl_95_derrick', nameRu: '95. Буровая Вышка', nameEn: '95. Oil Derrick', icon: '🏗️', collectionId: 'industrial_megastructures', gridSize: [18, 26, 18], voxels: createOilDerrick(), baseVoxelValue: 200.0, hardness: 6.0 },
      { id: 'lvl_96_turbine', nameRu: '96. Ветрогенератор', nameEn: '96. Wind Turbine', icon: '💨', collectionId: 'industrial_megastructures', gridSize: [20, 26, 20], voxels: createWindTurbine(), baseVoxelValue: 215.0, hardness: 6.1 },
      { id: 'lvl_97_reactor', nameRu: '97. Ядерный Реактор', nameEn: '97. Nuclear Reactor', icon: '☢️', collectionId: 'industrial_megastructures', gridSize: [20, 22, 20], voxels: createNuclearReactor(), baseVoxelValue: 230.0, hardness: 6.2 },
      { id: 'lvl_98_press', nameRu: '98. Гидравлический Пресс', nameEn: '98. Hydraulic Press', icon: '🗜️', collectionId: 'industrial_megastructures', gridSize: [20, 24, 20], voxels: createHydraulicPress(), baseVoxelValue: 245.0, hardness: 6.3 },
      { id: 'lvl_99_station', nameRu: '99. Орбитальная Станция', nameEn: '99. Orbital Station', icon: '🌌', collectionId: 'industrial_megastructures', gridSize: [24, 22, 24], voxels: createOrbitalStation(), baseVoxelValue: 260.0, hardness: 6.4 },
      { id: 'lvl_100_titan', nameRu: '100. Мега Воксельный Титан', nameEn: '100. Mega Voxel Titan', icon: '👑', collectionId: 'industrial_megastructures', gridSize: [24, 28, 20], voxels: createVoxelTitan(), baseVoxelValue: 300.0, hardness: 6.5 }
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
