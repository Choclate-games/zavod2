import type { CargoKind, CargoPackageType, TruckId } from '../core/types';

/**
 * Single source of truth for the trucks' dimensions, handling and cargo packages.
 *
 * Chassis-local axes: +X right, +Y up, +Z forward. The cabin sits at +Z, the bed at -Z,
 * and the route runs from the village towards +Z.
 */

export interface WheelConfig {
  x: number;
  z: number;
  isSteering: boolean;
  isDrive: boolean;
}

export interface TruckConfig {
  id: TruckId;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  style: 'classic-hood' | 'cab-over' | 'heavy-6x6' | 'expedition-6x6';
  defaultColor: string;
  wheelCount: 4 | 6;
  wheelRadius: number;
  wheelHalfWidth: number;
  wheelOffsetX: number;
  wheels: WheelConfig[];
  frame: { hx: number; hy: number; hz: number };
  cabin: { hx: number; hy: number; hz: number; y: number; z: number };
  bed: {
    innerHalfX: number;
    floorY: number;
    frontZ: number;
    backZ: number;
    wallHalfY: number;
    wallThickness: number;
  };
  suspension: {
    restLength: number;
    stiffness: number;
    compression: number;
    relaxation: number;
    maxTravel: number;
    maxForce: number;
    connectionY: number;
  };
  tire: {
    frictionSlip: number;
    sideFrictionStiffness: number;
  };
  engine: {
    baseForce: number;
    forcePerUpgrade: number;
    maxSpeed: number;
    speedPerUpgrade: number;
    reverseForce: number;
    maxReverseSpeed: number;
  };
  mass: {
    frame: number;
    cabin: number;
    wall: number;
  };
  ratings: {
    power: number;      // 1..5
    speed: number;      // 1..5
    offroad: number;    // 1..5
    safety: number;     // 1..5
  };
}

export const TRUCKS: Record<TruckId, TruckConfig> = {
  zil: {
    id: 'zil',
    name: 'ЗиЛ-130 «Ветеран»',
    subtitle: 'Классический советский трудяга 4х2',
    description: 'Надёжный универсальный грузовик с проверенным двигателем V8. Хорошо сбалансирован для грунтовок и лесных просек.',
    price: 0,
    style: 'classic-hood',
    defaultColor: '#c75c32',
    wheelCount: 4,
    wheelRadius: 0.6,
    wheelHalfWidth: 0.22,
    wheelOffsetX: 1.08,
    wheels: [
      { x: -1.08, z: 2.0, isSteering: true, isDrive: false },
      { x: 1.08, z: 2.0, isSteering: true, isDrive: false },
      { x: -1.08, z: -2.0, isSteering: false, isDrive: true },
      { x: 1.08, z: -2.0, isSteering: false, isDrive: true },
    ],
    frame: { hx: 1.15, hy: 0.32, hz: 3.0 },
    cabin: { hx: 1.02, hy: 0.62, hz: 1.02, y: 0.94, z: 1.6 },
    bed: {
      innerHalfX: 1.02,
      floorY: 0.32,
      frontZ: -0.15,
      backZ: -2.95,
      wallHalfY: 0.42,
      wallThickness: 0.05,
    },
    suspension: {
      restLength: 0.5,
      stiffness: 70,
      compression: 3.4,
      relaxation: 5.2,
      maxTravel: 0.35,
      maxForce: 40000,
      connectionY: -0.1,
    },
    tire: { frictionSlip: 2.6, sideFrictionStiffness: 0.8 },
    engine: {
      baseForce: 1950,
      forcePerUpgrade: 320,
      maxSpeed: 16.0,
      speedPerUpgrade: 1.4,
      reverseForce: 950,
      maxReverseSpeed: 6.0,
    },
    mass: { frame: 360, cabin: 70, wall: 12 },
    ratings: { power: 3, speed: 3.5, offroad: 3, safety: 3 },
  },

  gaz: {
    id: 'gaz',
    name: 'ГАЗ-66 «Шишига»',
    subtitle: 'Компактный вездеход 4х4 высокой проходимости',
    description: 'Бескапотный вездеход с самоблокирующимися мостами, увеличенным клиренсом и феноменальной маневренностью на топях.',
    price: 800,
    style: 'cab-over',
    defaultColor: '#475e3a',
    wheelCount: 4,
    wheelRadius: 0.64,
    wheelHalfWidth: 0.24,
    wheelOffsetX: 1.12,
    wheels: [
      { x: -1.12, z: 1.65, isSteering: true, isDrive: true },
      { x: 1.12, z: 1.65, isSteering: true, isDrive: true },
      { x: -1.12, z: -1.85, isSteering: false, isDrive: true },
      { x: 1.12, z: -1.85, isSteering: false, isDrive: true },
    ],
    frame: { hx: 1.12, hy: 0.32, hz: 2.75 },
    cabin: { hx: 1.06, hy: 0.72, hz: 0.85, y: 1.05, z: 1.8 },
    bed: {
      innerHalfX: 1.04,
      floorY: 0.32,
      frontZ: 0.45,
      backZ: -2.7,
      wallHalfY: 0.42,
      wallThickness: 0.05,
    },
    suspension: {
      restLength: 0.54,
      stiffness: 76,
      compression: 3.6,
      relaxation: 5.4,
      maxTravel: 0.38,
      maxForce: 44000,
      connectionY: -0.06,
    },
    tire: { frictionSlip: 2.9, sideFrictionStiffness: 0.9 },
    engine: {
      baseForce: 2350,
      forcePerUpgrade: 360,
      maxSpeed: 15.2,
      speedPerUpgrade: 1.3,
      reverseForce: 1100,
      maxReverseSpeed: 6.5,
    },
    mass: { frame: 320, cabin: 65, wall: 12 },
    ratings: { power: 3.5, speed: 3, offroad: 4.5, safety: 3 },
  },

  kraz: {
    id: 'kraz',
    name: 'КрАЗ-255 «Богатырь»',
    subtitle: 'Тяжелый 3-осный лесовоз 6х6 с колесами-лаптями',
    description: 'Массивный трехосный тяжеловес с огромными колесами низкого давления. Прет как танк сквозь глубокие болота и не опрокидывается.',
    price: 2200,
    style: 'heavy-6x6',
    defaultColor: '#3d7ea6',
    wheelCount: 6,
    wheelRadius: 0.68,
    wheelHalfWidth: 0.28,
    wheelOffsetX: 1.18,
    wheels: [
      { x: -1.18, z: 2.4, isSteering: true, isDrive: false },
      { x: 1.18, z: 2.4, isSteering: true, isDrive: false },
      { x: -1.18, z: -1.1, isSteering: false, isDrive: true },
      { x: 1.18, z: -1.1, isSteering: false, isDrive: true },
      { x: -1.18, z: -2.7, isSteering: false, isDrive: true },
      { x: 1.18, z: -2.7, isSteering: false, isDrive: true },
    ],
    frame: { hx: 1.22, hy: 0.36, hz: 3.5 },
    cabin: { hx: 1.1, hy: 0.66, hz: 1.2, y: 1.02, z: 2.0 },
    bed: {
      innerHalfX: 1.12,
      floorY: 0.36,
      frontZ: 0.2,
      backZ: -3.45,
      wallHalfY: 0.48,
      wallThickness: 0.06,
    },
    suspension: {
      restLength: 0.52,
      stiffness: 92,
      compression: 4.0,
      relaxation: 5.8,
      maxTravel: 0.36,
      maxForce: 52000,
      connectionY: -0.08,
    },
    tire: { frictionSlip: 3.1, sideFrictionStiffness: 1.0 },
    engine: {
      baseForce: 3200,
      forcePerUpgrade: 450,
      maxSpeed: 14.5,
      speedPerUpgrade: 1.3,
      reverseForce: 1400,
      maxReverseSpeed: 5.5,
    },
    mass: { frame: 520, cabin: 95, wall: 18 },
    ratings: { power: 5, speed: 3, offroad: 5, safety: 4.5 },
  },

  ural: {
    id: 'ural',
    name: 'Урал-4320 «Тайфун»',
    subtitle: 'Экспедиционный монстр 6х6 с силовым каркасом',
    description: 'Ультимативный тяжеловоз для экстремальных маршрутов. Оснащен мощным турбодизелем, шноркелем и защитной клеткой кузова.',
    price: 4500,
    style: 'expedition-6x6',
    defaultColor: '#a83232',
    wheelCount: 6,
    wheelRadius: 0.67,
    wheelHalfWidth: 0.26,
    wheelOffsetX: 1.16,
    wheels: [
      { x: -1.16, z: 2.35, isSteering: true, isDrive: false },
      { x: 1.16, z: 2.35, isSteering: true, isDrive: false },
      { x: -1.16, z: -1.05, isSteering: false, isDrive: true },
      { x: 1.16, z: -1.05, isSteering: false, isDrive: true },
      { x: -1.16, z: -2.65, isSteering: false, isDrive: true },
      { x: 1.16, z: -2.65, isSteering: false, isDrive: true },
    ],
    frame: { hx: 1.18, hy: 0.34, hz: 3.45 },
    cabin: { hx: 1.08, hy: 0.65, hz: 1.15, y: 1.0, z: 1.95 },
    bed: {
      innerHalfX: 1.1,
      floorY: 0.34,
      frontZ: 0.2,
      backZ: -3.4,
      wallHalfY: 0.52,
      wallThickness: 0.06,
    },
    suspension: {
      restLength: 0.55,
      stiffness: 88,
      compression: 3.8,
      relaxation: 5.6,
      maxTravel: 0.4,
      maxForce: 50000,
      connectionY: -0.06,
    },
    tire: { frictionSlip: 3.3, sideFrictionStiffness: 1.05 },
    engine: {
      baseForce: 3650,
      forcePerUpgrade: 480,
      maxSpeed: 17.5,
      speedPerUpgrade: 1.5,
      reverseForce: 1550,
      maxReverseSpeed: 7.0,
    },
    mass: { frame: 480, cabin: 88, wall: 16 },
    ratings: { power: 5, speed: 4.5, offroad: 5, safety: 5 },
  },
};

export function getTruckConfig(id: TruckId = 'zil'): TruckConfig {
  return TRUCKS[id] || TRUCKS.zil;
}

// -------------------------------------------------------------
// Legacy constants for default truck (ZIL) backward compatibility
// -------------------------------------------------------------
export const FRAME = TRUCKS.zil.frame;
export const CABIN = TRUCKS.zil.cabin;
export const BED = TRUCKS.zil.bed;
export const WHEEL = {
  radius: TRUCKS.zil.wheelRadius,
  halfWidth: TRUCKS.zil.wheelHalfWidth,
  offsetX: TRUCKS.zil.wheelOffsetX,
  frontZ: 2.0,
  rearZ: -2.0,
  connectionY: TRUCKS.zil.suspension.connectionY,
};
export const SUSPENSION = TRUCKS.zil.suspension;
export const TIRE = TRUCKS.zil.tire;
export const ENGINE = TRUCKS.zil.engine;
export const BRAKE = { foot: 26, hand: 90, idle: 2.6 } as const;
export const STEERING = {
  maxAngle: 0.52,
  turnRate: 3.2,
  returnRate: 5.4,
  speedFalloff: 0.055,
} as const;
export const MASS = TRUCKS.zil.mass;
export const RIDE_HEIGHT = WHEEL.radius - WHEEL.connectionY + SUSPENSION.restLength * 0.6;
export const MUD = {
  frictionDrop: 0.72,
  sideFrictionDrop: 0.45,
  baseDragForce: 440,
  speedDragCoeff: 180,
  maxSinkDepth: 0.16,
} as const;

// -------------------------------------------------------------
// Cargo Specifications & Packages
// -------------------------------------------------------------
export interface CargoSlot {
  kind: CargoKind;
  x: number;
  y: number;
  z: number;
}

export interface CargoSpec {
  kind: CargoKind;
  name: string;
  icon: string;
  shape: 'cylinder' | 'box';
  dimensions: {
    radius?: number;
    halfLength?: number;
    halfX?: number;
    halfY?: number;
    halfZ?: number;
  };
  mass: number;
  friction: number;
  restitution: number;
  rewardValue: number;
}

export const CARGO_SPECS: Record<CargoKind, CargoSpec> = {
  log: {
    kind: 'log',
    name: 'Бревно',
    icon: '🌲',
    shape: 'cylinder',
    dimensions: { radius: 0.28, halfLength: 0.95 },
    mass: 25,
    friction: 0.75,
    restitution: 0.01,
    rewardValue: 20,
  },
  crate: {
    kind: 'crate',
    name: 'Ящик снабжения',
    icon: '📦',
    shape: 'box',
    dimensions: { halfX: 0.31, halfY: 0.31, halfZ: 0.31 },
    mass: 18,
    friction: 0.85,
    restitution: 0.02,
    rewardValue: 15,
  },
  barrel: {
    kind: 'barrel',
    name: 'Бочка ГСМ',
    icon: '🛢️',
    shape: 'cylinder',
    dimensions: { radius: 0.28, halfLength: 0.38 },
    mass: 30,
    friction: 0.65,
    restitution: 0.03,
    rewardValue: 30,
  },
  concrete: {
    kind: 'concrete',
    name: 'Бетонный блок',
    icon: '🧱',
    shape: 'box',
    dimensions: { halfX: 0.38, halfY: 0.22, halfZ: 0.38 },
    mass: 42,
    friction: 0.95,
    restitution: 0.01,
    rewardValue: 35,
  },
  hay: {
    kind: 'hay',
    name: 'Тюк сена',
    icon: '🌾',
    shape: 'box',
    dimensions: { halfX: 0.38, halfY: 0.28, halfZ: 0.42 },
    mass: 12,
    friction: 0.70,
    restitution: 0.12,
    rewardValue: 18,
  },
  pipe: {
    kind: 'pipe',
    name: 'Стальная труба',
    icon: '🔩',
    shape: 'cylinder',
    dimensions: { radius: 0.24, halfLength: 0.95 },
    mass: 28,
    friction: 0.60,
    restitution: 0.02,
    rewardValue: 28,
  },
  fragile: {
    kind: 'fragile',
    name: 'Хрупкий груз',
    icon: '⚠️',
    shape: 'box',
    dimensions: { halfX: 0.32, halfY: 0.32, halfZ: 0.32 },
    mass: 16,
    friction: 0.80,
    restitution: 0.01,
    rewardValue: 45,
  },
};

export const CARGO = {
  log: {
    radius: CARGO_SPECS.log.dimensions.radius ?? 0.28,
    halfLength: CARGO_SPECS.log.dimensions.halfLength ?? 0.95,
    mass: CARGO_SPECS.log.mass,
  },
  crate: {
    half: CARGO_SPECS.crate.dimensions.halfX ?? 0.31,
    mass: CARGO_SPECS.crate.mass,
  },
};

export interface CargoPackageInfo {
  type: CargoPackageType;
  title: string;
  tag: string;
  icon: string;
  description: string;
  slots: CargoSlot[];
}

export const CARGO_PACKAGES: Record<CargoPackageType, CargoPackageInfo> = {
  logs: {
    type: 'logs',
    title: 'Лесозаготовка',
    tag: 'Брёвна',
    icon: '🌲',
    description: 'Штабель свежеспиленных таёжных брёвен и ящики с инструментами.',
    slots: [
      { kind: 'log', x: -0.62, y: BED.floorY + 0.30, z: -1.05 },
      { kind: 'log', x: 0, y: BED.floorY + 0.30, z: -1.05 },
      { kind: 'log', x: 0.62, y: BED.floorY + 0.30, z: -1.05 },
      { kind: 'log', x: -0.31, y: BED.floorY + 0.78, z: -1.05 },
      { kind: 'log', x: 0.31, y: BED.floorY + 0.78, z: -1.05 },
      { kind: 'log', x: 0, y: BED.floorY + 1.25, z: -1.05 },
      { kind: 'crate', x: -0.5, y: BED.floorY + 0.33, z: -2.5 },
      { kind: 'crate', x: 0.5, y: BED.floorY + 0.33, z: -2.5 },
    ],
  },

  barrels: {
    type: 'barrels',
    title: 'Снабжение ГСМ',
    tag: 'Бочки ГСМ',
    icon: '🛢️',
    description: 'Бочки с дизельным топливом и моторным маслом для лесозаготовительной техники.',
    slots: [
      { kind: 'barrel', x: -0.52, y: BED.floorY + 0.40, z: -0.95 },
      { kind: 'barrel', x: 0.52, y: BED.floorY + 0.40, z: -0.95 },
      { kind: 'barrel', x: -0.52, y: BED.floorY + 0.40, z: -1.8 },
      { kind: 'barrel', x: 0.52, y: BED.floorY + 0.40, z: -1.8 },
      { kind: 'crate', x: -0.5, y: BED.floorY + 0.33, z: -2.55 },
      { kind: 'crate', x: 0.5, y: BED.floorY + 0.33, z: -2.55 },
      { kind: 'crate', x: -0.5, y: BED.floorY + 0.95, z: -2.55 },
      { kind: 'crate', x: 0.5, y: BED.floorY + 0.95, z: -2.55 },
    ],
  },

  construction: {
    type: 'construction',
    title: 'Стройматериалы',
    tag: 'Блоки и трубы',
    icon: '🧱',
    description: 'Тяжелые бетонные блоки и стальные трубы для строительства моста через реку.',
    slots: [
      { kind: 'concrete', x: -0.48, y: BED.floorY + 0.24, z: -0.9 },
      { kind: 'concrete', x: 0.48, y: BED.floorY + 0.24, z: -0.9 },
      { kind: 'concrete', x: 0, y: BED.floorY + 0.24, z: -1.75 },
      { kind: 'pipe', x: -0.55, y: BED.floorY + 0.26, z: -2.5 },
      { kind: 'pipe', x: 0, y: BED.floorY + 0.26, z: -2.5 },
      { kind: 'pipe', x: 0.55, y: BED.floorY + 0.26, z: -2.5 },
      { kind: 'pipe', x: -0.28, y: BED.floorY + 0.70, z: -2.5 },
      { kind: 'pipe', x: 0.28, y: BED.floorY + 0.70, z: -2.5 },
    ],
  },

  farm: {
    type: 'farm',
    title: 'Сельхозрейс',
    tag: 'Тюки сена',
    icon: '🌾',
    description: 'Объемные тюки прессованного сена для отдаленной лесной фермы.',
    slots: [
      { kind: 'hay', x: -0.48, y: BED.floorY + 0.30, z: -0.9 },
      { kind: 'hay', x: 0.48, y: BED.floorY + 0.30, z: -0.9 },
      { kind: 'hay', x: -0.48, y: BED.floorY + 0.30, z: -1.8 },
      { kind: 'hay', x: 0.48, y: BED.floorY + 0.30, z: -1.8 },
      { kind: 'hay', x: -0.48, y: BED.floorY + 0.88, z: -0.9 },
      { kind: 'hay', x: 0.48, y: BED.floorY + 0.88, z: -0.9 },
      { kind: 'crate', x: -0.5, y: BED.floorY + 0.33, z: -2.55 },
      { kind: 'crate', x: 0.5, y: BED.floorY + 0.33, z: -2.55 },
    ],
  },

  fragile: {
    type: 'fragile',
    title: 'Ценный спецгруз',
    tag: 'Хрупкое',
    icon: '⚠️',
    description: 'Особо ценное оборудование, электроника и приборы в защитных контейнерах.',
    slots: [
      { kind: 'fragile', x: -0.48, y: BED.floorY + 0.34, z: -0.95 },
      { kind: 'fragile', x: 0.48, y: BED.floorY + 0.34, z: -0.95 },
      { kind: 'fragile', x: -0.48, y: BED.floorY + 0.34, z: -1.8 },
      { kind: 'fragile', x: 0.48, y: BED.floorY + 0.34, z: -1.8 },
      { kind: 'barrel', x: -0.52, y: BED.floorY + 0.40, z: -2.55 },
      { kind: 'barrel', x: 0.52, y: BED.floorY + 0.40, z: -2.55 },
      { kind: 'crate', x: -0.48, y: BED.floorY + 1.0, z: -1.35 },
      { kind: 'crate', x: 0.48, y: BED.floorY + 1.0, z: -1.35 },
    ],
  },

  mixed: {
    type: 'mixed',
    title: 'Сборный груз',
    tag: 'Ассорти',
    icon: '📦',
    description: 'Смешанный рейс: брёвна, топливные бочки, бетон и хрупкие контейнеры.',
    slots: [
      { kind: 'log', x: -0.55, y: BED.floorY + 0.30, z: -1.0 },
      { kind: 'log', x: 0.55, y: BED.floorY + 0.30, z: -1.0 },
      { kind: 'barrel', x: -0.52, y: BED.floorY + 0.40, z: -1.9 },
      { kind: 'barrel', x: 0.52, y: BED.floorY + 0.40, z: -1.9 },
      { kind: 'concrete', x: 0, y: BED.floorY + 0.24, z: -1.45 },
      { kind: 'fragile', x: -0.48, y: BED.floorY + 0.34, z: -2.6 },
      { kind: 'fragile', x: 0.48, y: BED.floorY + 0.34, z: -2.6 },
      { kind: 'crate', x: 0, y: BED.floorY + 0.88, z: -1.0 },
    ],
  },
};

export const CARGO_SLOTS = CARGO_PACKAGES.logs.slots;

export function getCargoPackage(type: CargoPackageType = 'logs'): CargoPackageInfo {
  return CARGO_PACKAGES[type] || CARGO_PACKAGES.logs;
}


