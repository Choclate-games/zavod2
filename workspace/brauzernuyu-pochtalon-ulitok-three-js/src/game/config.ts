export const GAME_CONFIG = {
  fixedStep: 1 / 60,
  courierSpeed: 0.42,
  pheromoneDecay: 0.008,
  nodeCapacity: 3,
  hydrationFloor: 0.25,
  drynessRate: 0.014,
  mailFragility: 1,
  nest: { x: 0, z: 0 },
  flowers: [
    { x: -10, z: -5, color: 0xffb8c7, name: 'Розовый мак' },
    { x: 10, z: -4, color: 0xffd37e, name: 'Солнечный лютик' },
    { x: -8, z: 7, color: 0x9ed6ff, name: 'Голубая звезда' },
    { x: 9, z: 7, color: 0xc9a7ff, name: 'Лунный ирис' },
  ],
  maxEnemies: 4,
} as const;

export type SnailRole = 'courier' | 'gatherer' | 'guard';

export interface SnailState {
  id: number;
  x: number;
  z: number;
  role: SnailRole;
  routeId: number;
  mailId: number;
  progress: number;
  returning: boolean;
  bodyHandle: number;
}

export interface MailState {
  id: number;
  flowerIndex: number;
  secondsLeft: number;
  durability: number;
  delivered: boolean;
  failed: boolean;
}

export interface RouteState {
  id: number;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  length: number;
  pheromone: number;
  flowerIndex: number;
}
