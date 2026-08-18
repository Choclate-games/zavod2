import { EnemyType } from '../entities/Enemy.ts';

export interface WaveSquad {
  enemyType: EnemyType;
  count: number;
  spawnInterval: number;
  initialDelay: number;
  hpMultiplier?: number;
  spawnerIndex?: number;
}

export interface WaveData {
  waveNumber: number;
  titleKey: string;
  squads: WaveSquad[];
}

export interface LevelData {
  id: number;
  nameKey: string;
  startingShells: number;
  castles: Array<{ x: number; z: number }>;
  spawners: Array<{ x: number; z: number }>;
  obstacles: Array<{ x: number; z: number }>;
  waves: WaveData[];
}

export const LEVELS: LevelData[] = [
  // --- Level 1: Sandy Cove ---
  {
    id: 1,
    nameKey: 'level_1_name',
    startingShells: 300,
    castles: [{ x: 21, z: 7 }, { x: 21, z: 8 }],
    spawners: [{ x: 1, z: 7 }],
    obstacles: [
      { x: 7, z: 4 }, { x: 7, z: 11 },
      { x: 14, z: 5 }, { x: 14, z: 10 },
    ],
    waves: [
      {
        waveNumber: 1,
        titleKey: 'Волна 1: Дозор Крабиков',
        squads: [
          { enemyType: 'crab', count: 6, spawnInterval: 1.5, initialDelay: 0.5 },
        ],
      },
      {
        waveNumber: 2,
        titleKey: 'Волна 2: Морские Звёздочки',
        squads: [
          { enemyType: 'crab', count: 8, spawnInterval: 1.2, initialDelay: 0.5 },
          { enemyType: 'starfish', count: 4, spawnInterval: 1.8, initialDelay: 5.0 },
        ],
      },
      {
        waveNumber: 3,
        titleKey: 'Волна 3: Налёт Чаек (Воздух!)',
        squads: [
          { enemyType: 'seagull', count: 5, spawnInterval: 2.0, initialDelay: 0.5 },
          { enemyType: 'crab', count: 10, spawnInterval: 1.0, initialDelay: 3.0 },
        ],
      },
      {
        waveNumber: 4,
        titleKey: 'Волна 4: Бронированные Отшельники',
        squads: [
          { enemyType: 'hermit', count: 4, spawnInterval: 2.5, initialDelay: 0.5 },
          { enemyType: 'starfish', count: 8, spawnInterval: 1.0, initialDelay: 4.0 },
        ],
      },
      {
        waveNumber: 5,
        titleKey: 'Волна 5: Штурмовой Отряд',
        squads: [
          { enemyType: 'hermit', count: 5, spawnInterval: 2.0, initialDelay: 0.5 },
          { enemyType: 'seagull', count: 8, spawnInterval: 1.5, initialDelay: 2.0 },
          { enemyType: 'crab', count: 12, spawnInterval: 0.8, initialDelay: 6.0 },
        ],
      },
      {
        waveNumber: 6,
        titleKey: 'Волна 6: БОСС КРАКЕН-КРАБ!',
        squads: [
          { enemyType: 'boss_kraken', count: 1, spawnInterval: 1.0, initialDelay: 0.5, hpMultiplier: 1.0 },
          { enemyType: 'starfish', count: 10, spawnInterval: 1.2, initialDelay: 4.0 },
          { enemyType: 'seagull', count: 6, spawnInterval: 1.8, initialDelay: 8.0 },
        ],
      },
    ],
  },

  // --- Level 2: Coral Reef ---
  {
    id: 2,
    nameKey: 'level_2_name',
    startingShells: 400,
    castles: [{ x: 22, z: 7 }, { x: 22, z: 8 }],
    spawners: [{ x: 1, z: 3 }, { x: 1, z: 12 }],
    obstacles: [
      { x: 6, z: 6 }, { x: 6, z: 7 }, { x: 6, z: 8 }, { x: 6, z: 9 },
      { x: 12, z: 2 }, { x: 12, z: 3 }, { x: 12, z: 12 }, { x: 12, z: 13 },
      { x: 17, z: 7 }, { x: 17, z: 8 },
    ],
    waves: [
      {
        waveNumber: 1,
        titleKey: 'Волна 1: Двойной фронт',
        squads: [
          { enemyType: 'crab', count: 8, spawnInterval: 1.4, initialDelay: 0.5, spawnerIndex: 0 },
          { enemyType: 'crab', count: 8, spawnInterval: 1.4, initialDelay: 1.5, spawnerIndex: 1 },
        ],
      },
      {
        waveNumber: 2,
        titleKey: 'Волна 2: Быстрые Звёзды',
        squads: [
          { enemyType: 'starfish', count: 6, spawnInterval: 1.4, initialDelay: 0.5, spawnerIndex: 0 },
          { enemyType: 'starfish', count: 6, spawnInterval: 1.4, initialDelay: 1.0, spawnerIndex: 1 },
        ],
      },
      {
        waveNumber: 3,
        titleKey: 'Волна 3: Чайки над Рифом',
        squads: [
          { enemyType: 'seagull', count: 8, spawnInterval: 1.5, initialDelay: 0.5 },
          { enemyType: 'hermit', count: 4, spawnInterval: 2.5, initialDelay: 2.0, spawnerIndex: 0 },
          { enemyType: 'crab', count: 10, spawnInterval: 1.0, initialDelay: 4.0, spawnerIndex: 1 },
        ],
      },
      {
        waveNumber: 4,
        titleKey: 'Волна 4: Панцирная Стена',
        squads: [
          { enemyType: 'hermit', count: 6, spawnInterval: 2.0, initialDelay: 0.5, spawnerIndex: 0 },
          { enemyType: 'hermit', count: 6, spawnInterval: 2.0, initialDelay: 1.5, spawnerIndex: 1 },
          { enemyType: 'starfish', count: 10, spawnInterval: 1.0, initialDelay: 6.0 },
        ],
      },
      {
        waveNumber: 5,
        titleKey: 'Волна 5: Воздушная Армада',
        squads: [
          { enemyType: 'seagull', count: 12, spawnInterval: 1.2, initialDelay: 0.5 },
          { enemyType: 'crab', count: 16, spawnInterval: 0.8, initialDelay: 3.0 },
        ],
      },
      {
        waveNumber: 6,
        titleKey: 'Волна 6: Рифовый Кракено-Краб',
        squads: [
          { enemyType: 'boss_kraken', count: 1, spawnInterval: 1.0, initialDelay: 0.5, hpMultiplier: 1.4, spawnerIndex: 0 },
          { enemyType: 'hermit', count: 6, spawnInterval: 1.8, initialDelay: 3.0, spawnerIndex: 1 },
          { enemyType: 'seagull', count: 8, spawnInterval: 1.5, initialDelay: 6.0 },
        ],
      },
    ],
  },

  // --- Level 3: Palm Point ---
  {
    id: 3,
    nameKey: 'level_3_name',
    startingShells: 500,
    castles: [{ x: 22, z: 7 }, { x: 22, z: 8 }],
    spawners: [{ x: 1, z: 2 }, { x: 1, z: 7 }, { x: 1, z: 13 }],
    obstacles: [
      { x: 5, z: 4 }, { x: 5, z: 10 },
      { x: 10, z: 6 }, { x: 10, z: 9 },
      { x: 15, z: 3 }, { x: 15, z: 12 },
    ],
    waves: [
      {
        waveNumber: 1,
        titleKey: 'Волна 1: Тройной Прилив',
        squads: [
          { enemyType: 'crab', count: 6, spawnInterval: 1.2, initialDelay: 0.5, spawnerIndex: 0 },
          { enemyType: 'crab', count: 6, spawnInterval: 1.2, initialDelay: 1.0, spawnerIndex: 1 },
          { enemyType: 'crab', count: 6, spawnInterval: 1.2, initialDelay: 1.5, spawnerIndex: 2 },
        ],
      },
      {
        waveNumber: 2,
        titleKey: 'Волна 2: Десант Звёзд',
        squads: [
          { enemyType: 'starfish', count: 8, spawnInterval: 1.2, initialDelay: 0.5, spawnerIndex: 0 },
          { enemyType: 'starfish', count: 8, spawnInterval: 1.2, initialDelay: 1.0, spawnerIndex: 2 },
          { enemyType: 'seagull', count: 6, spawnInterval: 1.5, initialDelay: 3.0 },
        ],
      },
      {
        waveNumber: 3,
        titleKey: 'Волна 3: Тяжёлая Артиллерия',
        squads: [
          { enemyType: 'hermit', count: 6, spawnInterval: 2.0, initialDelay: 0.5, spawnerIndex: 1 },
          { enemyType: 'seagull', count: 10, spawnInterval: 1.2, initialDelay: 2.0 },
          { enemyType: 'crab', count: 15, spawnInterval: 0.8, initialDelay: 5.0 },
        ],
      },
      {
        waveNumber: 4,
        titleKey: 'Волна 4: Великий Кракено-Краб',
        squads: [
          { enemyType: 'boss_kraken', count: 1, spawnInterval: 1.0, initialDelay: 0.5, hpMultiplier: 1.8, spawnerIndex: 1 },
          { enemyType: 'hermit', count: 8, spawnInterval: 1.5, initialDelay: 2.0, spawnerIndex: 0 },
          { enemyType: 'starfish', count: 12, spawnInterval: 1.0, initialDelay: 4.0, spawnerIndex: 2 },
          { enemyType: 'seagull', count: 10, spawnInterval: 1.4, initialDelay: 7.0 },
        ],
      },
    ],
  },
];
