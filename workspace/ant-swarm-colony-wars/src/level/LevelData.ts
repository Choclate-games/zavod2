import { Team, Caste } from '../entities/AntTypes';
import { NestConfig } from '../entities/Nest';
import { ObstacleConfig, ObstacleType } from '../entities/Obstacle';
import { BiomassNodeConfig } from '../entities/BiomassNode';

export interface LevelDefinition {
  id: number;
  titleRu: string;
  titleEn: string;
  objectiveRu: string;
  objectiveEn: string;
  hintRu: string;
  hintEn: string;
  worldWidth: number;
  worldHeight: number;
  nests: NestConfig[];
  obstacles: ObstacleConfig[];
  biomassNodes: BiomassNodeConfig[];
  initialSpawns: { x: number; y: number; caste: Caste; team: Team; count: number }[];
}

export const CAMPAIGN_LEVELS: LevelDefinition[] = [
  // Level 1
  {
    id: 1,
    titleRu: 'Уровень 1: Первый Ручей',
    titleEn: 'Level 1: The First Stream',
    objectiveRu: 'Захватите нейтральный и вражеский муравейники!',
    objectiveEn: 'Capture the neutral and enemy hives!',
    hintRu: '✍️ Проведите пальцем или мышью, чтобы направить муравьев к цели!',
    hintEn: '✍️ Drag finger or mouse to guide your ants towards the target!',
    worldWidth: 1280,
    worldHeight: 720,
    nests: [
      { id: 1, x: 220, y: 360, team: Team.PLAYER, isHQ: true, garrison: 30 },
      { id: 2, x: 640, y: 360, team: Team.NEUTRAL, isHQ: false, garrison: 12 },
      { id: 3, x: 1060, y: 360, team: Team.ENEMY, isHQ: true, garrison: 20 }
    ],
    obstacles: [],
    biomassNodes: [
      { id: 1, x: 440, y: 220, amount: 150 },
      { id: 2, x: 440, y: 500, amount: 150 }
    ],
    initialSpawns: [
      { x: 220, y: 360, caste: Caste.WORKER, team: Team.PLAYER, count: 25 },
      { x: 220, y: 360, caste: Caste.SOLDIER, team: Team.PLAYER, count: 10 },
      { x: 1060, y: 360, caste: Caste.WORKER, team: Team.ENEMY, count: 15 }
    ]
  },

  // Level 2: Living Bridge
  {
    id: 2,
    titleRu: 'Уровень 2: Великая Расщелина',
    titleEn: 'Level 2: The Great Chasm',
    objectiveRu: 'Постройте живой мост Рабочими и перейдите пропасть!',
    objectiveEn: 'Build a living bridge with Workers to cross the chasm!',
    hintRu: '🌉 Направьте Рабочих [1] в зону расщелины, чтобы соединить края!',
    hintEn: '🌉 Direct Workers [1] to the chasm to link across the gap!',
    worldWidth: 1360,
    worldHeight: 760,
    nests: [
      { id: 1, x: 240, y: 380, team: Team.PLAYER, isHQ: true, garrison: 35 },
      { id: 2, x: 1120, y: 380, team: Team.ENEMY, isHQ: true, garrison: 25 }
    ],
    obstacles: [
      {
        id: 1,
        type: ObstacleType.CHASM,
        x: 680,
        y: 380,
        width: 140,
        height: 520
      }
    ],
    biomassNodes: [
      { id: 1, x: 450, y: 180, amount: 200 },
      { id: 2, x: 920, y: 180, amount: 200 }
    ],
    initialSpawns: [
      { x: 240, y: 380, caste: Caste.WORKER, team: Team.PLAYER, count: 35 },
      { x: 240, y: 380, caste: Caste.SOLDIER, team: Team.PLAYER, count: 12 },
      { x: 1120, y: 380, caste: Caste.WORKER, team: Team.ENEMY, count: 20 }
    ]
  },

  // Level 3: Destructible Barricade
  {
    id: 3,
    titleRu: 'Уровень 3: Древесная Стена',
    titleEn: 'Level 3: Wooden Barricade',
    objectiveRu: 'Взорвите стену Бомбардирами и сокрушите врага!',
    objectiveEn: 'Blast the wall with Bombers and crush the enemy!',
    hintRu: '💥 Выберите Бомбардиров [3] и направьте их прямо на стену!',
    hintEn: '💥 Select Bombers [3] and send them directly into the wall!',
    worldWidth: 1360,
    worldHeight: 760,
    nests: [
      { id: 1, x: 220, y: 380, team: Team.PLAYER, isHQ: true, garrison: 40 },
      { id: 2, x: 1140, y: 380, team: Team.ENEMY, isHQ: true, garrison: 35 }
    ],
    obstacles: [
      {
        id: 1,
        type: ObstacleType.DESTRUCTIBLE_WALL,
        x: 700,
        y: 380,
        width: 60,
        height: 480,
        hp: 350,
        maxHp: 350
      }
    ],
    biomassNodes: [
      { id: 1, x: 460, y: 180, amount: 250 },
      { id: 2, x: 460, y: 580, amount: 250 }
    ],
    initialSpawns: [
      { x: 220, y: 380, caste: Caste.WORKER, team: Team.PLAYER, count: 20 },
      { x: 220, y: 380, caste: Caste.SOLDIER, team: Team.PLAYER, count: 15 },
      { x: 220, y: 380, caste: Caste.BOMBER, team: Team.PLAYER, count: 18 },
      { x: 1140, y: 380, caste: Caste.SOLDIER, team: Team.ENEMY, count: 25 }
    ]
  },

  // Level 4: Two Hills War
  {
    id: 4,
    titleRu: 'Уровень 4: Война Двух Холмов',
    titleEn: 'Level 4: Two Hills War',
    objectiveRu: 'Отразите натиск врага и захватите оба холма!',
    objectiveEn: 'Repel the enemy offensive and capture both hills!',
    hintRu: '🛡️ Используйте Сферу [Space], чтобы сгруппировать рой при атаке!',
    hintEn: '🛡️ Use Sphere [Space] to cluster your swarm during attacks!',
    worldWidth: 1440,
    worldHeight: 800,
    nests: [
      { id: 1, x: 240, y: 400, team: Team.PLAYER, isHQ: true, garrison: 45 },
      { id: 2, x: 720, y: 220, team: Team.NEUTRAL, isHQ: false, garrison: 20 },
      { id: 3, x: 720, y: 580, team: Team.NEUTRAL, isHQ: false, garrison: 20 },
      { id: 4, x: 1200, y: 400, team: Team.ENEMY, isHQ: true, garrison: 40 }
    ],
    obstacles: [
      { id: 1, type: ObstacleType.CHASM, x: 720, y: 400, width: 120, height: 180 }
    ],
    biomassNodes: [
      { id: 1, x: 480, y: 220, amount: 200 },
      { id: 2, x: 480, y: 580, amount: 200 },
      { id: 3, x: 960, y: 400, amount: 250 }
    ],
    initialSpawns: [
      { x: 240, y: 400, caste: Caste.WORKER, team: Team.PLAYER, count: 25 },
      { x: 240, y: 400, caste: Caste.SOLDIER, team: Team.PLAYER, count: 25 },
      { x: 1200, y: 400, caste: Caste.SOLDIER, team: Team.ENEMY, count: 30 }
    ]
  },

  // Level 5: River of Acid
  {
    id: 5,
    titleRu: 'Уровень 5: Кислотная Река',
    titleEn: 'Level 5: Acid River',
    objectiveRu: 'Пересеките реку и сокрушите вражеские форпосты!',
    objectiveEn: 'Cross the river and eliminate enemy outposts!',
    hintRu: 'Стройте мосты в узких местах реки!',
    hintEn: 'Build bridges across the narrow sections of the river!',
    worldWidth: 1500,
    worldHeight: 850,
    nests: [
      { id: 1, x: 260, y: 425, team: Team.PLAYER, isHQ: true, garrison: 50 },
      { id: 2, x: 1240, y: 250, team: Team.ENEMY, isHQ: false, garrison: 30 },
      { id: 3, x: 1240, y: 600, team: Team.ENEMY, isHQ: true, garrison: 45 }
    ],
    obstacles: [
      { id: 1, type: ObstacleType.RIVER, x: 750, y: 425, width: 160, height: 750 }
    ],
    biomassNodes: [
      { id: 1, x: 500, y: 200, amount: 300 },
      { id: 2, x: 500, y: 650, amount: 300 }
    ],
    initialSpawns: [
      { x: 260, y: 425, caste: Caste.WORKER, team: Team.PLAYER, count: 35 },
      { x: 260, y: 425, caste: Caste.SOLDIER, team: Team.PLAYER, count: 20 },
      { x: 260, y: 425, caste: Caste.BOMBER, team: Team.PLAYER, count: 15 }
    ]
  },

  // Level 6: Fortress Citadel
  {
    id: 6,
    titleRu: 'Уровень 6: Цитадель Шершней',
    titleEn: 'Level 6: Hornet Citadel',
    objectiveRu: 'Прорвите тройную линию обороны цитадели!',
    objectiveEn: 'Breach the citadel’s triple defense line!',
    hintRu: 'Используйте Бомбардиров на стенах и Солдатов для штурма!',
    hintEn: 'Use Bombers against walls and Soldiers for the final assault!',
    worldWidth: 1500,
    worldHeight: 850,
    nests: [
      { id: 1, x: 240, y: 425, team: Team.PLAYER, isHQ: true, garrison: 50 },
      { id: 2, x: 750, y: 425, team: Team.NEUTRAL, isHQ: false, garrison: 30 },
      { id: 3, x: 1260, y: 425, team: Team.ENEMY, isHQ: true, garrison: 60 }
    ],
    obstacles: [
      { id: 1, type: ObstacleType.DESTRUCTIBLE_WALL, x: 580, y: 425, width: 50, height: 420, hp: 400 },
      { id: 2, type: ObstacleType.DESTRUCTIBLE_WALL, x: 980, y: 425, width: 50, height: 420, hp: 450 }
    ],
    biomassNodes: [
      { id: 1, x: 400, y: 200, amount: 250 },
      { id: 2, x: 400, y: 650, amount: 250 }
    ],
    initialSpawns: [
      { x: 240, y: 425, caste: Caste.WORKER, team: Team.PLAYER, count: 30 },
      { x: 240, y: 425, caste: Caste.SOLDIER, team: Team.PLAYER, count: 30 },
      { x: 240, y: 425, caste: Caste.BOMBER, team: Team.PLAYER, count: 25 }
    ]
  }
];
